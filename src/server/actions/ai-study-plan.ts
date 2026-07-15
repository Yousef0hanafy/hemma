"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { requireStudioAccess } from "@/lib/studio-auth";
import { computeMastery } from "@/lib/engine/gamification";
import { generateAIStudyPlan } from "@/server/ai/study-plan-service";
import { isAIAvailable } from "@/server/ai/evaluator";
import { fetchStudyPlan as fetchHeuristicPlan } from "./study-plan";
import type { StudyPlanInput } from "@/server/ai/study-plan-prompt";
import type { StudyPlanOutput } from "@/server/ai/study-plan-prompt";
import type { StudyPlanRecommendation } from "./study-plan";

// -------------------------------------------------------------------
// DTO — Combined result with AI plan + heuristic fallback
// -------------------------------------------------------------------

export interface AIStudyPlanResult {
  /** The AI-generated plan (null if AI unavailable or failed) */
  aiPlan: (StudyPlanOutput & { generatedAt: string }) | null;
  /** The heuristic plan as fallback */
  heuristicPlan: StudyPlanRecommendation | null;
  /** Whether AI was used successfully */
  aiUsed: boolean;
  /** Summary stats shared by both plans */
  summary: StudyPlanRecommendation["summary"];
  /** Performance trend */
  trend: StudyPlanRecommendation["trend"];
  /** Category mastery data (for AI input) */
  categoryData: Array<{
    slug: string;
    nameAr: string;
    mastery: number;
    attempted: number;
    correct: number;
    total: number;
  }>;
}

// -------------------------------------------------------------------
// Server action
// -------------------------------------------------------------------

export async function fetchAIStudyPlan(): Promise<AIStudyPlanResult | null> {
  try {
    await requireStudioAccess();
  } catch {
    return null;
  }

  const userBucket = await getUserBucket();

  // Fetch all required data
  const [profile, categories] = await Promise.all([
    db.userProfile.findUnique({ where: { userBucket } }),
    db.category.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);

  if (!profile) return null;

  // Compute mastery data and stats
  const categoryData = await buildCategoryData(userBucket, categories);
  const stats = await buildStats(userBucket, profile);

  // Try AI plan
  let aiPlan: (StudyPlanOutput & { generatedAt: string }) | null = null;
  let aiUsed = false;

  if (isAIAvailable() && stats.totalAttempts > 0) {
    const input = buildAIInput(stats, categoryData);
    const plan = await generateAIStudyPlan(input);
    if (plan) {
      aiPlan = { ...plan, generatedAt: new Date().toISOString() };
      aiUsed = true;
    }
  }

  // Always fetch heuristic plan as fallback
  const heuristicPlan = await fetchHeuristicPlan();

  return {
    aiPlan,
    heuristicPlan,
    aiUsed,
    summary: heuristicPlan?.summary ?? stats,
    trend: heuristicPlan?.trend ?? "new",
    categoryData,
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

async function buildCategoryData(
  userBucket: string,
  categories: Array<{ id: string; slug: string; nameAr: string }>
) {
  const totals = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });
  const totalMap = new Map(totals.map((t) => [t.categoryId, t._count]));

  const allAttempts = await db.attempt.findMany({
    where: { userBucket },
    include: { question: { select: { categoryId: true } } },
  });

  const stats: Record<string, { attempted: number; correct: number }> = {};
  for (const a of allAttempts) {
    const cid = a.question.categoryId;
    stats[cid] = stats[cid] ?? { attempted: 0, correct: 0 };
    stats[cid].attempted++;
    if (a.isCorrect) stats[cid].correct++;
  }

  return categories.map((c) => {
    const total = totalMap.get(c.id) ?? 0;
    const s = stats[c.id] ?? { attempted: 0, correct: 0 };
    return {
      slug: c.slug,
      nameAr: c.nameAr,
      mastery: computeMastery(total, s.attempted, s.correct),
      attempted: s.attempted,
      correct: s.correct,
      total,
    };
  });
}

interface FullStats {
  totalAttempts: number;
  overallAccuracy: number | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  dueReviewCount: number;
  avgTimePerQuestion: number | null;
}

async function buildStats(
  userBucket: string,
  profile: {
    totalXp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
  }
): Promise<FullStats> {
  const [totalAttempts, correctAttempts, dueReviewCount, avgTimeResult] =
    await Promise.all([
      db.attempt.count({ where: { userBucket } }),
      db.attempt.count({ where: { userBucket, isCorrect: true } }),
      db.reviewSchedule.count({
        where: { userBucket, nextReviewAt: { lte: new Date() } },
      }),
      db.attempt.aggregate({
        where: { userBucket, timeMs: { gt: 0 } },
        _avg: { timeMs: true },
      }),
    ]);

  return {
    totalAttempts,
    overallAccuracy:
      totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : null,
    level: profile.level,
    totalXp: profile.totalXp,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    dueReviewCount,
    avgTimePerQuestion:
      avgTimeResult._avg.timeMs !== null
        ? Math.round((avgTimeResult._avg.timeMs / 1000) * 10) / 10
        : null,
  };
}

async function buildAIInput(
  stats: FullStats,
  categories: Array<{
    slug: string;
    nameAr: string;
    mastery: number;
    attempted: number;
    correct: number;
    total: number;
  }>
): Promise<StudyPlanInput> {
  const userBucket = await getUserBucket();

  // Recent attempts analysis
  const recent30 = await db.attempt.findMany({
    where: { userBucket },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      question: { select: { difficulty: true } },
    },
  });

  const recent7 = recent30.slice(0, 7);
  const prior23 = recent30.slice(7, 30);

  const recent7Correct = recent7.filter((a) => a.isCorrect).length;
  const prior23Correct = prior23.filter((a) => a.isCorrect).length;

  const recentAccuracy =
    recent7.length > 0 ? (recent7Correct / recent7.length) * 100 : null;
  const priorAccuracy =
    prior23.length > 0 ? (prior23Correct / prior23.length) * 100 : null;

  let trend: "improving" | "declining" | "stable" | "new" = "new";
  if (stats.totalAttempts >= 10 && recentAccuracy !== null && priorAccuracy !== null) {
    if (recentAccuracy > priorAccuracy + 10) trend = "improving";
    else if (recentAccuracy < priorAccuracy - 10) trend = "declining";
    else trend = "stable";
  }

  // Difficulty breakdown
  const diffGroups: Record<string, { total: number; correct: number }> = {};
  for (const a of recent30) {
    const d = a.question.difficulty;
    diffGroups[d] = diffGroups[d] ?? { total: 0, correct: 0 };
    diffGroups[d].total++;
    if (a.isCorrect) diffGroups[d].correct++;
  }

  const difficultyStats = Object.entries(diffGroups).map(([name, data]) => ({
    name,
    total: data.total,
    correct: data.correct,
    accuracy: data.total > 0 ? data.correct / data.total : 0,
  }));

  // Weekly challenge
  let weeklyChallenge: StudyPlanInput["weeklyChallenge"] = null;
  try {
    const { weekStartKey, weeklyChallengeForDate, weekEndKey } = await import(
      "@/lib/engine/gamification"
    );
    const start = weekStartKey();
    const challenge = weeklyChallengeForDate(start);
    const weekActivity = await db.dailyActivity.findMany({
      where: {
        userBucket,
        date: { gte: start, lte: weekEndKey() },
      },
    });
    let current = 0;
    for (const day of weekActivity) {
      switch (challenge.metric) {
        case "attempts": current += day.attempts; break;
        case "correct": current += day.correct; break;
        case "xp": current += day.xpEarned; break;
      }
    }
    weeklyChallenge = {
      description: challenge.descriptionAr,
      current,
      target: challenge.target,
    };
  } catch {
    // Silently skip weekly challenge
  }

  return {
    totalAttempts: stats.totalAttempts,
    overallAccuracy: stats.overallAccuracy,
    level: stats.level,
    totalXp: stats.totalXp,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    dueReviewCount: stats.dueReviewCount,
    categories,
    difficultyStats,
    recentAccuracy,
    priorAccuracy,
    trend,
    avgTimePerQuestion: stats.avgTimePerQuestion,
    weeklyChallenge,
  };
}


