// =====================================================================
// Achievement evaluation — runs on the server after attempts, exams and
// SRS reviews. Only still-locked achievements are checked, and each
// statistic is queried only if a locked achievement needs it.
// =====================================================================

import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/engine/achievements";
import { levelForXp } from "@/lib/engine/gamification";
import type { AchievementDTO } from "@/lib/content/dto";

/** Minimum attempts in a category before its accuracy counts as mastery. */
const MASTERY_MIN_ATTEMPTS = 10;
/** "speed_10": correct answers faster than this. */
const FAST_ANSWER_MS = 15_000;

export interface AchievementContext {
  /** The attempt just recorded (study / exam / revision answer) */
  attempt?: { isCorrect: boolean; timeMs: number };
  /** The exam just finalized */
  examScorePercent?: number;
}

export type UnlockedAchievement = Pick<AchievementDTO, "slug" | "nameAr" | "iconAr" | "xpReward">;

/** Lazily computed user statistics, each fetched at most once. */
function statsFor(userId: string) {
  const memo = new Map<string, Promise<unknown>>();
  const once = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key) as Promise<T>;
  };
  return {
    attempts: () => once("attempts", () => db.attempt.count({ where: { userBucket: userId } })),
    correct: () =>
      once("correct", () => db.attempt.count({ where: { userBucket: userId, isCorrect: true } })),
    fastCorrect: () =>
      once("fast", () =>
        db.attempt.count({
          where: { userBucket: userId, isCorrect: true, timeMs: { gt: 0, lt: FAST_ANSWER_MS } },
        })
      ),
    reviewed: () =>
      once("reviewed", () =>
        db.reviewSchedule.count({ where: { userBucket: userId, lastReviewedAt: { not: null } } })
      ),
    /** [best category accuracy, worst category accuracy] over all categories (0–100) */
    mastery: () =>
      once("mastery", async () => {
        const [categories, rows] = await Promise.all([
          db.category.count(),
          db.$queryRaw<{ attempts: number; correct: number }[]>`
            SELECT COUNT(*)::int AS attempts,
                   COUNT(*) FILTER (WHERE a."isCorrect")::int AS correct
            FROM attempts a JOIN questions q ON q.id = a."questionId"
            WHERE a."userBucket" = ${userId}
            GROUP BY q."categoryId"`,
        ]);
        const accuracies = rows
          .filter((r) => r.attempts >= MASTERY_MIN_ATTEMPTS)
          .map((r) => (r.correct / r.attempts) * 100);
        const best = accuracies.length ? Math.max(...accuracies) : 0;
        // "All categories" means every category, including untouched ones
        const worst =
          categories > 0 && accuracies.length >= categories ? Math.min(...accuracies) : 0;
        return [best, worst] as const;
      }),
  };
}

type Stats = ReturnType<typeof statsFor>;

/** Unlock rule per achievement slug. */
const RULES: Record<
  string,
  (a: AchievementDTO, s: Stats, ctx: AchievementContext, streak: number) => Promise<boolean> | boolean
> = {
  first_correct: async (a, s) => (await s.correct()) >= a.threshold,
  questions_25: async (a, s) => (await s.attempts()) >= a.threshold,
  questions_50: async (a, s) => (await s.attempts()) >= a.threshold,
  questions_100: async (a, s) => (await s.attempts()) >= a.threshold,
  questions_200: async (a, s) => (await s.attempts()) >= a.threshold,
  questions_500: async (a, s) => (await s.attempts()) >= a.threshold,
  questions_1000: async (a, s) => (await s.attempts()) >= a.threshold,
  streak_3: (a, _s, _c, streak) => streak >= a.threshold,
  streak_7: (a, _s, _c, streak) => streak >= a.threshold,
  streak_14: (a, _s, _c, streak) => streak >= a.threshold,
  streak_30: (a, _s, _c, streak) => streak >= a.threshold,
  streak_60: (a, _s, _c, streak) => streak >= a.threshold,
  streak_100: (a, _s, _c, streak) => streak >= a.threshold,
  exam_pass: (a, _s, ctx) => (ctx.examScorePercent ?? -1) >= a.threshold,
  exam_perfect: (a, _s, ctx) => (ctx.examScorePercent ?? -1) >= a.threshold,
  master_category: async (a, s) => (await s.mastery())[0] >= a.threshold,
  all_rounder: async (a, s) => (await s.mastery())[1] >= a.threshold,
  speed_3s: (a, _s, ctx) =>
    !!ctx.attempt?.isCorrect && ctx.attempt.timeMs > 0 && ctx.attempt.timeMs < a.threshold * 1000,
  lightning: (a, _s, ctx) =>
    !!ctx.attempt?.isCorrect && ctx.attempt.timeMs > 0 && ctx.attempt.timeMs < a.threshold * 1000,
  speed_10: async (a, s) => (await s.fastCorrect()) >= a.threshold,
  review_30: async (a, s) => (await s.reviewed()) >= a.threshold,
  review_100: async (a, s) => (await s.reviewed()) >= a.threshold,
  review_500: async (a, s) => (await s.reviewed()) >= a.threshold,
};

function parseSlugs(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Check every still-locked achievement, persist new unlocks and their XP
 * rewards, and return what was unlocked (for celebration toasts).
 * Never throws: achievements must not break recording an answer.
 */
export async function evaluateAchievements(
  userId: string,
  ctx: AchievementContext = {}
): Promise<UnlockedAchievement[]> {
  try {
    const profile = await db.userProfile.findUnique({
      where: { userBucket: userId },
      select: { unlockedAchievements: true, currentStreak: true },
    });
    if (!profile) return [];

    const unlocked = new Set(parseSlugs(profile.unlockedAchievements));
    const stats = statsFor(userId);
    const newly: AchievementDTO[] = [];

    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.slug)) continue;
      const rule = RULES[a.slug];
      if (rule && (await rule(a, stats, ctx, profile.currentStreak))) newly.push(a);
    }
    if (newly.length === 0) return [];

    const reward = newly.reduce((sum, a) => sum + a.xpReward, 0);
    // Compare-and-set on the unlocked list: if a concurrent request already
    // changed it, skip — that request (or the next one) awards these, so
    // the XP reward is never paid twice.
    const { count } = await db.userProfile.updateMany({
      where: { userBucket: userId, unlockedAchievements: profile.unlockedAchievements },
      data: {
        unlockedAchievements: JSON.stringify([...unlocked, ...newly.map((a) => a.slug)]),
        totalXp: { increment: reward },
      },
    });
    if (count === 0) return [];

    const updated = await db.userProfile.findUnique({
      where: { userBucket: userId },
      select: { totalXp: true, level: true },
    });
    if (updated && levelForXp(updated.totalXp) !== updated.level) {
      await db.userProfile.update({
        where: { userBucket: userId },
        data: { level: levelForXp(updated.totalXp) },
      });
    }

    return newly.map(({ slug, nameAr, iconAr, xpReward }) => ({ slug, nameAr, iconAr, xpReward }));
  } catch (error) {
    console.error("[achievements] evaluation failed:", error);
    return [];
  }
}
