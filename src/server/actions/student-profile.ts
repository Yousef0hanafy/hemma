"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { requireAuth } from "@/lib/studio-auth";
import { levelProgress, computeMastery } from "@/lib/engine/gamification";
import type { AchievementDTO, CategoryMastery } from "@/lib/content/dto";

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface ExtendedProfile {
  // User info
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;

  // Gamification
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  streakShields: number;
  levelProgress: { level: number; pct: number; nextLevelXp: number };

  // Stats
  totalAttempts: number;
  correctAttempts: number;
  overallAccuracy: number | null;
  totalExamSessions: number;
  bestExamScore: number | null;
  avgExamScore: number | null;
  totalReviewsDone: number;
  avgTimePerQuestion: number | null; // seconds

  // Achievements
  achievements: AchievementDTO[];
  unlockedSlugs: string[];

  // Category mastery
  categoryMastery: CategoryMastery[];

  // Recent activity (last 10 attempts)
  recentActivity: Array<{
    id: string;
    questionId: string;
    stem: string;
    categoryNameAr: string;
    isCorrect: boolean;
    mode: string;
    timeMs: number;
    createdAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function fetchExtendedProfile(): Promise<ExtendedProfile | null> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return null;
  }

  const userBucket = await getUserBucket();

  // Fetch all required data in parallel
  const [user, profile, achievements, masteryData] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    }),
    db.userProfile.findUnique({ where: { userBucket } }),
    db.achievement.findMany({ orderBy: { threshold: "asc" } }),
    fetchCategoryMasteryData(userBucket),
  ]);

  if (!user) return null;

  const totalXp = profile?.totalXp ?? 0;
  const lp = levelProgress(totalXp);
  const unlockedSlugs = JSON.parse(
    profile?.unlockedAchievements ?? "[]"
  ) as string[];

  // Stats
  const [totalAttempts, correctAttempts, totalExamSessions, bestExamScore, totalReviewsDone, avgTimeResult] =
    await Promise.all([
      db.attempt.count({ where: { userBucket } }),
      db.attempt.count({ where: { userBucket, isCorrect: true } }),
      db.attempt.groupBy({
        by: ["sessionId"],
        where: { userBucket, mode: "exam", sessionId: { not: null } },
        _count: true,
      }),
      db.$queryRaw<{ scorePercent: number }[]>`
        SELECT COALESCE(
          ROUND(
            SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::numeric
            / COUNT(*)::numeric * 100
          ), 0
        )::int AS "scorePercent"
        FROM attempts a
        WHERE a."userBucket" = ${userBucket}
          AND a.mode = 'exam'
          AND a."sessionId" IS NOT NULL
        GROUP BY a."sessionId"
        ORDER BY "scorePercent" DESC
        LIMIT 1
      `,
      db.reviewSchedule.count({
        where: { userBucket, lastReviewedAt: { not: null } },
      }),
      db.attempt.aggregate({
        where: { userBucket, timeMs: { gt: 0 } },
        _avg: { timeMs: true },
      }),
    ]);

  // Recent activity
  const recentAttempts = await db.attempt.findMany({
    where: { userBucket },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      question: {
        select: {
          stem: true,
          category: { select: { nameAr: true } },
        },
      },
    },
  });

  // Calculate average exam score
  const allExamScores = await db.$queryRaw<{ scorePercent: number }[]>`
    SELECT COALESCE(
      ROUND(
        SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::numeric
        / COUNT(*)::numeric * 100
      ), 0
    )::int AS "scorePercent"
    FROM attempts a
    WHERE a."userBucket" = ${userBucket}
      AND a.mode = 'exam'
      AND a."sessionId" IS NOT NULL
    GROUP BY a."sessionId"
  `;

  const avgExamScore =
    allExamScores.length > 0
      ? Math.round(
          allExamScores.reduce((s, e) => s + e.scorePercent, 0) /
            allExamScores.length
        )
      : null;

  const bestScore =
    bestExamScore.length > 0 ? bestExamScore[0].scorePercent : null;

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    createdAt: profile?.createdAt ? profile.createdAt.toISOString() : new Date().toISOString(),

    totalXp,
    level: profile?.level ?? 1,
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    streakShields: profile?.streakShields ?? 0,
    levelProgress: { level: lp.level, pct: lp.pct, nextLevelXp: lp.nextLevelXp },

    totalAttempts,
    correctAttempts,
    overallAccuracy:
      totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : null,
    totalExamSessions: totalExamSessions.length,
    bestExamScore: bestScore,
    avgExamScore,
    totalReviewsDone,
    avgTimePerQuestion:
      avgTimeResult._avg.timeMs !== null
        ? Math.round((avgTimeResult._avg.timeMs / 1000) * 10) / 10
        : null,

    achievements,
    unlockedSlugs,
    categoryMastery: masteryData,

    recentActivity: recentAttempts.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      stem: a.question.stem.slice(0, 80),
      categoryNameAr: a.question.category.nameAr,
      isCorrect: a.isCorrect,
      mode: a.mode,
      timeMs: a.timeMs,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchCategoryMasteryData(
  userBucket: string
): Promise<CategoryMastery[]> {
  const [cats, totals, userStats] = await Promise.all([
    db.category.findMany({ orderBy: { displayOrder: "asc" } }),
    db.question.groupBy({ by: ["categoryId"], _count: true }),
    db.$queryRaw<{ categoryId: string; attempted: number; correct: number }[]>`
      SELECT q."categoryId",
             COUNT(a.id)::int AS attempted,
             SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
      FROM attempts a
      JOIN questions q ON a."questionId" = q.id
      WHERE a."userBucket" = ${userBucket}
      GROUP BY q."categoryId"
    `,
  ]);

  const totalMap = new Map(totals.map((t) => [t.categoryId, t._count]));
  const statMap = new Map(userStats.map((s) => [s.categoryId, s]));

  return cats.map((c) => {
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
