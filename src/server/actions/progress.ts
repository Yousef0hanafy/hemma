// =====================================================================
// Server Actions — user progress, attempts, favorites, SRS
// =====================================================================
"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { toQuestionDTO } from "@/lib/content/dto";
import { applySm2, type SrsQuality } from "@/lib/engine/srs";
import {
  computeMastery,
  dayKeyOffset,
  dayStart,
  levelForXp,
  levelProgress,
  todayKey,
  updateStreak,
  weekEndKey,
  weekStartKey,
  xpForCorrect,
  xpForExamSession,
} from "@/lib/engine/gamification";
import type { Difficulty } from "@/lib/content/dto";
import { ACHIEVEMENTS } from "@/lib/engine/achievements";
import { evaluateAchievements } from "@/server/achievements";

const ANSWER_KEYS = ["أ", "ب", "ج", "د"] as const;
type AnswerKey = (typeof ANSWER_KEYS)[number];
const ATTEMPT_MODES = ["study", "exam", "revision"] as const;
/** XP for a wrong answer — a small reward for effort. */
const XP_FOR_EFFORT = 2;
/** Exam bonus XP is only granted for exams with at least this many answers… */
const EXAM_BONUS_MIN_ANSWERED = 5;
/** …and only for this many exams per day, so it can't be farmed. */
const EXAM_BONUS_MAX_PER_DAY = 3;
const MAX_EXAM_QUESTIONS = 200;

function isAnswerKey(v: unknown): v is AnswerKey {
  return typeof v === "string" && (ANSWER_KEYS as readonly string[]).includes(v);
}

function isShortId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 128;
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(max, Math.max(min, n));
}

export interface RecordAttemptInput {
  questionId: string;
  selectedKey: string | null;
  mode: "study" | "exam" | "revision";
  sessionId?: string;
  timeMs?: number;
  confidence?: number;
}

/**
 * Add XP to the user's profile and update their streak for today.
 * XP is incremented atomically so concurrent attempts don't lose XP.
 */
async function awardXp(userId: string, xp: number) {
  const today = todayKey();
  const existing = await db.userProfile.findUnique({
    where: { userBucket: userId },
    select: { level: true, currentStreak: true, longestStreak: true, streakShields: true, lastActiveDate: true },
  });

  const streak = updateStreak(
    existing?.currentStreak ?? 0,
    existing?.lastActiveDate ?? null,
    existing?.streakShields ?? 1
  );

  const profile = await db.userProfile.upsert({
    where: { userBucket: userId },
    create: {
      userBucket: userId,
      totalXp: xp,
      level: levelForXp(xp),
      currentStreak: streak.streak,
      longestStreak: streak.streak,
      streakShields: streak.shields,
      lastActiveDate: today,
    },
    update: {
      totalXp: { increment: xp },
      currentStreak: streak.streak,
      longestStreak: Math.max(existing?.longestStreak ?? 0, streak.streak),
      streakShields: streak.shields,
      lastActiveDate: today,
    },
  });

  const newLevel = levelForXp(profile.totalXp);
  if (newLevel !== profile.level) {
    await db.userProfile.update({
      where: { userBucket: userId },
      data: { level: newLevel },
    });
  }

  return {
    newLevel,
    leveledUp: newLevel > (existing?.level ?? 1),
    shieldEarned: streak.shieldEarned,
  };
}

/**
 * Record an answer. Correctness and XP are decided here from the stored
 * question — never trusted from the client.
 */
export async function recordAttempt(input: RecordAttemptInput) {
  const userId = await requirePermission("attempt", "create");

  if (!isShortId(input.questionId)) {
    throw new Error("معرّف السؤال غير صالح");
  }
  if (!(ATTEMPT_MODES as readonly string[]).includes(input.mode)) {
    throw new Error("وضع المحاولة غير صالح");
  }
  if (input.selectedKey !== null && !isAnswerKey(input.selectedKey)) {
    throw new Error("الإجابة غير صالحة");
  }
  if (input.sessionId !== undefined && !isShortId(input.sessionId)) {
    throw new Error("معرّف الجلسة غير صالح");
  }

  const question = await db.question.findUnique({
    where: { id: input.questionId },
    select: { correctKey: true, difficulty: true },
  });
  if (!question) {
    throw new Error("السؤال غير موجود");
  }

  const isCorrect = input.selectedKey !== null && input.selectedKey === question.correctKey;
  const today = todayKey();

  // XP only for the first attempt at a question each day — re-answering a
  // question you've already seen today can't be used to farm XP.
  const answeredToday = await db.attempt.findFirst({
    where: { userBucket: userId, questionId: input.questionId, createdAt: { gte: dayStart(today) } },
    select: { id: true },
  });
  const xpEarned = answeredToday
    ? 0
    : isCorrect
      ? xpForCorrect(question.difficulty as Difficulty, input.mode)
      : XP_FOR_EFFORT;

  const attempt = await db.attempt.create({
    data: {
      userBucket: userId,
      questionId: input.questionId,
      selectedKey: input.selectedKey,
      isCorrect,
      mode: input.mode,
      sessionId: input.sessionId,
      timeMs: clampInt(input.timeMs, 0, 60 * 60 * 1000),
      confidence: clampInt(input.confidence, 0, 5),
    },
  });

  await db.dailyActivity.upsert({
    where: { userBucket_date: { userBucket: userId, date: today } },
    create: {
      userBucket: userId,
      date: today,
      attempts: 1,
      correct: isCorrect ? 1 : 0,
      xpEarned,
    },
    update: {
      attempts: { increment: 1 },
      correct: { increment: isCorrect ? 1 : 0 },
      xpEarned: { increment: xpEarned },
    },
  });

  const { newLevel, leveledUp, shieldEarned } = await awardXp(userId, xpEarned);
  const unlockedAchievements = await evaluateAchievements(userId, {
    attempt: { isCorrect, timeMs: attempt.timeMs },
  });

  return {
    attemptId: attempt.id,
    isCorrect,
    xpEarned,
    leveledUp,
    newLevel,
    unlockedAchievements,
    shieldEarned,
    xpMilestonesHit: [] as Array<{ xp: number; label: string }>,
    streakMilestoneHit: undefined as { streak: number; label: string } | undefined,
  };
}

export async function toggleFavorite(questionId: string) {
  const userId = await requirePermission("favorite", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Check if already favorited
  const existing = await db.favorite.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (existing) {
    await db.favorite.delete({
      where: { userBucket_questionId: { userBucket: userId, questionId } },
    });
    return { favorited: false };
  } else {
    await db.favorite.create({
      data: { userBucket: userId, questionId },
    });
    return { favorited: true };
  }
}

export async function submitSrsReview(questionId: string, quality: SrsQuality) {
  const userId = await requirePermission("review", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Update SRS schedule
  const schedule = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (schedule) {
    const { newState, nextReviewAt } = applySm2(
      {
        easiness: schedule.easiness,
        interval: schedule.interval,
        repetitions: schedule.repetitions,
      },
      quality
    );

    await db.reviewSchedule.update({
      where: { userBucket_questionId: { userBucket: userId, questionId } },
      data: {
        easiness: newState.easiness,
        interval: newState.interval,
        repetitions: newState.repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  } else {
    // Create new schedule
    const { newState, nextReviewAt } = applySm2(
      { easiness: 2.5, interval: 0, repetitions: 0 },
      quality
    );
    
    await db.reviewSchedule.create({
      data: {
        userBucket: userId,
        questionId,
        easiness: newState.easiness,
        interval: newState.interval,
        repetitions: newState.repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  }

  const unlockedAchievements = await evaluateAchievements(userId);
  return { success: true, unlockedAchievements };
}

export async function autoRegisterMistake(questionId: string) {
  const userId = await requirePermission("attempt", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Ensure SRS schedule exists
  const existing = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (!existing) {
    const nextReviewAt = new Date();
    nextReviewAt.setHours(nextReviewAt.getHours() + 1);
    
    await db.reviewSchedule.create({
      data: {
        userBucket: userId,
        questionId,
        easiness: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewAt,
      },
    });
  }

  return { success: true };
}

export async function finalizeExamSession(
  sessionId: string,
  questionIds: string[],
  selections: Record<string, string | null>,
  actualDurationSec?: number,
  /** Time spent per question (ms), measured on the client */
  timings?: Record<string, number>
) {
  const userId = await requirePermission("attempt", "create");

  if (!isShortId(sessionId)) {
    throw new Error("معرّف الجلسة غير صالح");
  }
  if (
    !Array.isArray(questionIds) ||
    questionIds.length === 0 ||
    questionIds.length > MAX_EXAM_QUESTIONS ||
    !questionIds.every(isShortId) ||
    new Set(questionIds).size !== questionIds.length
  ) {
    throw new Error("قائمة الأسئلة غير صالحة");
  }
  if (!selections || typeof selections !== "object") {
    throw new Error("الإجابات غير صالحة");
  }
  // Keep only answers for questions in this exam, with valid keys
  const cleanSelections: Record<string, AnswerKey | null> = {};
  for (const id of questionIds) {
    const sel = selections[id];
    cleanSelections[id] = isAnswerKey(sel) ? sel : null;
  }

  // Idempotent: a retried submit returns the stored result instead of failing
  const existing = await db.examSessionData.findUnique({ where: { sessionId } });
  if (existing) {
    if (existing.userBucket !== userId) throw new Error("غير مصرح به");
    return { success: true, xpEarned: 0, unlockedAchievements: [] };
  }

  // Grade on the server from the stored answer keys
  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, correctKey: true, difficulty: true },
  });
  const answered = questionIds.filter((id) => cleanSelections[id] !== null).length;
  const correct = questions.filter((q) => cleanSelections[q.id] === q.correctKey).length;
  const scorePercent = (correct / questionIds.length) * 100;
  const today = todayKey();

  // One attempt per answered question, using the FINAL answer (recording the
  // first tap meant changed answers never counted). Same XP rule as
  // recordAttempt: only for the first attempt at a question each day.
  const answeredQuestions = questions.filter((q) => cleanSelections[q.id] !== null);
  const seenToday = new Set(
    (
      await db.attempt.findMany({
        where: {
          userBucket: userId,
          questionId: { in: answeredQuestions.map((q) => q.id) },
          createdAt: { gte: dayStart(today) },
        },
        select: { questionId: true },
      })
    ).map((a) => a.questionId)
  );
  let answersXp = 0;
  const graded = answeredQuestions.map((q) => {
    const isCorrect = cleanSelections[q.id] === q.correctKey;
    if (!seenToday.has(q.id)) {
      answersXp += isCorrect ? xpForCorrect(q.difficulty as Difficulty, "exam") : XP_FOR_EFFORT;
    }
    return { q, isCorrect };
  });

  const examsToday = await db.examSessionData.count({
    where: { userBucket: userId, createdAt: { gte: dayStart(today) } },
  });
  const bonusXp =
    answered >= EXAM_BONUS_MIN_ANSWERED && examsToday < EXAM_BONUS_MAX_PER_DAY
      ? xpForExamSession(scorePercent)
      : 0;
  const xpEarned = answersXp + bonusXp;

  const durationSec = clampInt(actualDurationSec, 0, 24 * 60 * 60);
  await db.examSessionData.create({
    data: {
      sessionId,
      userBucket: userId,
      questionIds: JSON.stringify(questionIds),
      selections: JSON.stringify(cleanSelections),
      durationSec,
      actualDurationSec: durationSec,
    },
  });

  if (graded.length > 0) {
    await db.attempt.createMany({
      data: graded.map(({ q, isCorrect }) => ({
        userBucket: userId,
        questionId: q.id,
        selectedKey: cleanSelections[q.id],
        isCorrect,
        mode: "exam",
        sessionId,
        timeMs: clampInt(timings?.[q.id], 0, 60 * 60 * 1000),
      })),
    });
    // Wrong answers go into the SRS review queue (in an hour)
    const wrong = graded.filter((g) => !g.isCorrect);
    if (wrong.length > 0) {
      await db.reviewSchedule.createMany({
        data: wrong.map(({ q }) => ({
          userBucket: userId,
          questionId: q.id,
          easiness: 2.5,
          interval: 1,
          repetitions: 0,
          nextReviewAt: new Date(Date.now() + 60 * 60 * 1000),
        })),
        skipDuplicates: true,
      });
    }
  }

  await db.dailyActivity.upsert({
    where: { userBucket_date: { userBucket: userId, date: today } },
    create: {
      userBucket: userId,
      date: today,
      attempts: graded.length,
      correct,
      xpEarned,
    },
    update: {
      attempts: { increment: graded.length },
      correct: { increment: correct },
      xpEarned: { increment: xpEarned },
    },
  });
  await awardXp(userId, xpEarned);
  const unlockedAchievements = await evaluateAchievements(userId, { examScorePercent: scorePercent });

  return { success: true, xpEarned, unlockedAchievements };
}

// ── Data Fetching Functions ─────────────────────────────────────

export async function fetchUserProfile() {
  const userId = await requirePermission("profile", "read");
  
  let profile = await db.userProfile.findUnique({
    where: { userBucket: userId },
  });

  if (!profile) {
    // Create default profile if it doesn't exist
    profile = await db.userProfile.create({
      data: {
        userBucket: userId,
        totalXp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        streakShields: 1,
      },
    });
  }

  return {
    userBucket: profile.userBucket,
    totalXp: profile.totalXp,
    level: profile.level,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActiveDate: profile.lastActiveDate,
    streakShields: profile.streakShields,
    unlockedAchievements: JSON.parse(profile.unlockedAchievements || "[]") as string[],
  };
}

export async function fetchAchievements() {
  await requirePermission("achievement", "read");
  return ACHIEVEMENTS;
}

export async function fetchCategoryMastery() {
  const userId = await requirePermission("question", "read");
  
  const [categories, totals, userStats] = await Promise.all([
    db.category.findMany({ orderBy: { displayOrder: "asc" } }),
    db.question.groupBy({ by: ["categoryId"], _count: { id: true } }),
    db.$queryRaw<{ categoryId: string; attempted: number; correct: number }[]>`
      SELECT q."categoryId",
             COUNT(a.id)::int AS attempted,
             SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
      FROM attempts a
      JOIN questions q ON a."questionId" = q.id
      WHERE a."userBucket" = ${userId}
      GROUP BY q."categoryId"
    `.catch(() => [] as { categoryId: string; attempted: number; correct: number }[]),
  ]);

  const totalMap = new Map<string, number>();
  for (const t of totals) {
    totalMap.set(t.categoryId, t._count.id);
  }

  const statMap = new Map<string, { attempted: number; correct: number }>();
  for (const s of userStats) {
    statMap.set(s.categoryId, { attempted: s.attempted, correct: s.correct });
  }

  return categories.map((c) => {
    const total = totalMap.get(c.id) ?? 0;
    const s = statMap.get(c.id) ?? { attempted: 0, correct: 0 };
    return {
      categorySlug: c.slug,
      categoryNameAr: c.nameAr,
      colorTheme: c.colorTheme,
      icon: c.icon,
      total,
      attempted: s.attempted,
      correct: s.correct,
      mastery: computeMastery(total, s.attempted, s.correct),
    };
  });
}

export async function fetchRecentAttempts(limit = 20) {
  const userId = await requirePermission("attempt", "read");
  
  const attempts = await db.attempt.findMany({
    where: { userBucket: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { question: true },
  });

  return attempts.map(a => ({
    id: a.id,
    questionId: a.questionId,
    selectedKey: a.selectedKey as any,
    isCorrect: a.isCorrect,
    mode: a.mode as any,
    sessionId: a.sessionId,
    timeMs: a.timeMs,
    confidence: a.confidence,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function fetchMistakeQuestionIds(limit = 50) {
  const userId = await requirePermission("attempt", "read");
  
  const attempts = await db.attempt.findMany({
    where: { userBucket: userId, isCorrect: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { questionId: true },
  });

  return [...new Set(attempts.map(a => a.questionId))];
}

export async function fetchDailyActivity(days = 84) {
  const userId = await requirePermission("attempt", "read");
  
  const activities = await db.dailyActivity.findMany({
    where: {
      userBucket: userId,
      date: { gte: dayKeyOffset(days) }
    },
    orderBy: { date: "asc" },
  });

  return activities.map(a => ({
    date: a.date,
    attempts: a.attempts,
    correct: a.correct,
    xpEarned: a.xpEarned,
  }));
}

export async function fetchDailyQuestProgress() {
  const userId = await requirePermission("attempt", "read");
  
  const today = todayKey();
  const activity = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket: userId, date: today } },
  });

  // Default quests
  const quests = [
    { slug: "q10_attempts", target: 10, metric: "attempts" as const, descriptionAr: "أكمل 10 محاولات" },
    { slug: "q7_correct", target: 7, metric: "correct" as const, descriptionAr: "أجب على 7 أسئلة صحيحة" },
    { slug: "q3_categories", target: 3, metric: "categories" as const, descriptionAr: "درّب على 3 فئات" },
    { slug: "q5_attempts", target: 5, metric: "attempts" as const, descriptionAr: "أكمل 5 محاولات" },
    { slug: "q30_xp", target: 30, metric: "xp" as const, descriptionAr: "اكسب 30 نقطة خبرة" },
  ];

  const dayOfYear = Math.floor(new Date().getTime() / 86400000);
  let userHash = 0;
  for (let i = 0; i < userId.length; i++) {
    userHash += userId.charCodeAt(i);
  }
  const questIndex = (dayOfYear + userHash) % quests.length;
  const currentQuest = quests[questIndex];

  let categoriesCount = 0;
  if (activity?.categoryStats) {
    try {
      categoriesCount = Object.keys(JSON.parse(activity.categoryStats)).length;
    } catch {}
  }

  const progress = {
    attempts: activity?.attempts ?? 0,
    correct: activity?.correct ?? 0,
    xp: activity?.xpEarned ?? 0,
    categories: categoriesCount,
  };

  return {
    quest: currentQuest,
    progress,
    completed: progress[currentQuest.metric] >= currentQuest.target,
  };
}

export async function fetchFavoriteIds() {
  const userId = await requirePermission("favorite", "read");
  
  const favorites = await db.favorite.findMany({
    where: { userBucket: userId },
    select: { questionId: true },
  });

  return favorites.map(f => f.questionId);
}

export async function fetchExamHistory() {
  const userId = await requirePermission("attempt", "read");
  
  const sessions = await db.examSessionData.findMany({
    where: { userBucket: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const allQuestionIds = new Set<string>();
  sessions.forEach(s => {
    const qids = JSON.parse(s.questionIds) as string[];
    qids.forEach(id => allQuestionIds.add(id));
  });

  const questions = await db.question.findMany({
    where: { id: { in: Array.from(allQuestionIds) } },
    select: { id: true, correctKey: true }
  });

  const correctKeys = new Map(questions.map(q => [q.id, q.correctKey]));

  return sessions.map(s => {
    const questionIds = JSON.parse(s.questionIds) as string[];
    const selections = JSON.parse(s.selections) as Record<string, string | null>;
    
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let total = questionIds.length;
    
    for (const qid of questionIds) {
      const selection = selections[qid];
      if (!selection) {
        skipped++;
      } else if (selection === correctKeys.get(qid)) {
        correct++;
      } else {
        wrong++;
      }
    }

    return {
      sessionId: s.sessionId,
      date: s.createdAt.toISOString(),
      total,
      correct,
      wrong,
      skipped,
      scorePercent: total > 0 ? Math.round((correct / total) * 100) : 0,
      durationSec: s.durationSec,
    };
  });
}

export async function fetchExamSessionData(sessionId: string) {
  const userId = await requirePermission("attempt", "read");
  
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("معرّف الجلسة غير صالح");
  }

  const session = await db.examSessionData.findUnique({
    where: { sessionId },
  });

  if (!session || session.userBucket !== userId) {
    return null;
  }

  return {
    questionIds: JSON.parse(session.questionIds) as string[],
    selections: JSON.parse(session.selections) as Record<string, string | null>,
    actualDurationSec: session.actualDurationSec,
  };
}

export async function fetchDueReviewIds(limit = 50) {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const schedules = await db.reviewSchedule.findMany({
    where: { 
      userBucket: userId,
      nextReviewAt: { lte: now }
    },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    select: { questionId: true },
  });

  return schedules.map(s => s.questionId);
}

export async function fetchDueReviewCount() {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const count = await db.reviewSchedule.count({
    where: { 
      userBucket: userId,
      nextReviewAt: { lte: now }
    },
  });

  return count;
}

export async function fetchNextReviewDate() {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const next = await db.reviewSchedule.findFirst({
    where: { 
      userBucket: userId,
      nextReviewAt: { gt: now }
    },
    orderBy: { nextReviewAt: "asc" },
    select: { nextReviewAt: true },
  });

  return next ? next.nextReviewAt.toISOString() : null;
}

export async function fetchTodayReviewCount() {
  const userId = await requirePermission("review", "read");
  
  const today = todayKey();
  const count = await db.reviewSchedule.count({
    where: {
      userBucket: userId,
      nextReviewAt: { gte: dayStart(today), lt: dayStart(dayKeyOffset(-1)) }
    },
  });

  return count;
}

export async function fetchSpeedStats() {
  const userId = await requirePermission("attempt", "read");
  
  const stats = await db.$queryRaw<{ categoryId: string; avgTimeMs: number; count: number }[]>`
    SELECT q."categoryId",
           AVG(a."timeMs")::int AS "avgTimeMs",
           COUNT(a.id)::int AS count
    FROM attempts a
    JOIN questions q ON a."questionId" = q.id
    WHERE a."userBucket" = ${userId} AND a."timeMs" > 0
    GROUP BY q."categoryId"
  `;

  if (stats.length === 0) return [];

  const categoryIds = stats.map(s => s.categoryId);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } }
  });
  
  const catMap = new Map(categories.map(c => [c.id, c]));

  return stats.map(stat => {
    const cat = catMap.get(stat.categoryId);
    return {
      categorySlug: cat?.slug || "",
      categoryNameAr: cat?.nameAr || "",
      colorTheme: cat?.colorTheme || null,
      attempted: stat.count,
      avgTimeSec: Math.round(stat.avgTimeMs / 1000),
    };
  });
}

export async function fetchRecentlyStudiedCategories(limit = 5) {
  const userId = await requirePermission("attempt", "read");
  
  const stats = await db.$queryRaw<{ categoryId: string; attempts: number; correct: number; lastAttempt: Date }[]>`
    WITH recent_attempts AS (
      SELECT a.id, a."questionId", a."isCorrect", a."createdAt"
      FROM attempts a
      WHERE a."userBucket" = ${userId}
      ORDER BY a."createdAt" DESC
      LIMIT 100
    )
    SELECT q."categoryId",
           COUNT(r.id)::int AS attempts,
           SUM(CASE WHEN r."isCorrect" THEN 1 ELSE 0 END)::int AS correct,
           MAX(r."createdAt") AS "lastAttempt"
    FROM recent_attempts r
    JOIN questions q ON r."questionId" = q.id
    GROUP BY q."categoryId"
    ORDER BY "lastAttempt" DESC
  `;

  if (stats.length === 0) return [];

  const categoryIds = stats.slice(0, limit).map(s => s.categoryId);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } }
  });
  
  const catMap = new Map(categories.map(c => [c.id, c]));

  return stats.slice(0, limit).map(stat => {
    const cat = catMap.get(stat.categoryId);
    return {
      categorySlug: cat?.slug || "",
      categoryNameAr: cat?.nameAr || "",
      colorTheme: cat?.colorTheme || null,
      icon: cat?.icon || null,
      lastAttemptAt: stat.lastAttempt.toISOString(),
      attempted: stat.attempts,
      correct: stat.correct,
      accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
    };
  });
}

export async function fetchWeeklyChallenge() {
  const userId = await requirePermission("challenge", "read");
  
  // Get weekly activity (Monday–Sunday, Riyadh time — same week as the leaderboard)
  const weeklyActivity = await db.dailyActivity.findMany({
    where: {
      userBucket: userId,
      date: { gte: weekStartKey(), lte: weekEndKey() }
    }
  });
  
  // Define weekly challenge
  const challenge = {
    descriptionAr: "أكمل 30 محاولة خلال هذا الأسبوع",
    rewardLabel: "🔥 درع حماية",
  };
  
  const target = 30;
  const current = weeklyActivity.reduce((sum, activity) => sum + activity.attempts, 0);
  const complete = current >= target;
  
  return {
    challenge,
    current,
    target,
    complete,
  };
}
