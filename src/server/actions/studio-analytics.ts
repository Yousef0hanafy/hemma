"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  totalStudents: number;
  totalQuestions: number;
  totalAttempts: number;
  totalSources: number;
  avgAccuracy: number | null;
  avgQuality: number | null;
}

export interface CategoryBreakdown {
  nameAr: string;
  slug: string;
  count: number;
  color: string;
}

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface StatusDistribution {
  draft: number;
  review: number;
  approved: number;
  published: number;
  archived: number;
}

export interface QualityInsights {
  lowQualityCount: number;
  noExplanationCount: number;
  lowAttemptCount: number;
  avgQualityScore: number | null;
  withExplanationPct: number;
}

export interface NeedsAttentionItem {
  id: string;
  stem: string;
  categoryNameAr: string;
  reason: string;
  aiQualityScore: number | null;
}

export interface DailyActivityPoint {
  date: string;
  attempts: number;
  correct: number;
}

// ---------------------------------------------------------------------------
// Analytics queries
// ---------------------------------------------------------------------------

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  await requireStudioAccess();

  const [
    totalStudents,
    totalQuestions,
    totalAttempts,
    totalSources,
    qualityAgg,
  ] = await Promise.all([
    db.user.count({ where: { role: "student" } }),
    db.question.count(),
    db.attempt.count(),
    db.source.count(),
    db.question.aggregate({
      _avg: { aiQualityScore: true },
    }),
  ]);

  // Calculate average accuracy from attempts
  const correctAttempts = await db.attempt.count({ where: { isCorrect: true } });
  const avgAccuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : null;

  return {
    totalStudents,
    totalQuestions,
    totalAttempts,
    totalSources,
    avgAccuracy,
    avgQuality: qualityAgg._avg.aiQualityScore ?? null,
  };
}

export async function getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  await requireStudioAccess();

  const cats = await db.category.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      colorTheme: true,
    },
  });

  const counts = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });

  const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));

  return cats.map((c) => ({
    nameAr: c.nameAr,
    slug: c.slug,
    count: countMap.get(c.id) ?? 0,
    color: c.colorTheme ?? "slate",
  }));
}

export async function getDifficultyDistribution(): Promise<DifficultyDistribution> {
  await requireStudioAccess();

  const groups = await db.question.groupBy({
    by: ["difficulty"],
    _count: true,
  });

  return {
    easy: groups.find((g) => g.difficulty === "easy")?._count ?? 0,
    medium: groups.find((g) => g.difficulty === "medium")?._count ?? 0,
    hard: groups.find((g) => g.difficulty === "hard")?._count ?? 0,
  };
}

export async function getStatusDistribution(): Promise<StatusDistribution> {
  await requireStudioAccess();

  const groups = await db.question.groupBy({
    by: ["status"],
    _count: true,
  });

  return {
    draft: groups.find((g) => g.status === "draft")?._count ?? 0,
    review: groups.find((g) => g.status === "review")?._count ?? 0,
    approved: groups.find((g) => g.status === "approved")?._count ?? 0,
    published: groups.find((g) => g.status === "published")?._count ?? 0,
    archived: groups.find((g) => g.status === "archived")?._count ?? 0,
  };
}

export async function getQualityInsights(): Promise<QualityInsights> {
  await requireStudioAccess();

  const [totalQuestions, lowQuality, noExplanation, qualityAgg] =
    await Promise.all([
      db.question.count(),
      db.question.count({
        where: {
          OR: [
            { aiQualityScore: { lt: 0.5 } },
            { aiQualityScore: null },
          ],
        },
      }),
      db.question.count({
        where: {
          OR: [
            { explanation: null },
            { explanation: "" },
          ],
        },
      }),
      db.question.aggregate({
        _avg: { aiQualityScore: true },
      }),
    ]);

  const withExplanation = await db.question.count({
    where: {
      explanation: { not: null },
      NOT: { explanation: "" },
    },
  });

  // Questions with very few attempts
  const lowAttemptCount = await db.question.count({
    where: {
      attempts: { none: {} },
    },
  });

  return {
    lowQualityCount: lowQuality,
    noExplanationCount: noExplanation,
    lowAttemptCount,
    avgQualityScore: qualityAgg._avg.aiQualityScore ?? null,
    withExplanationPct:
      totalQuestions > 0 ? (withExplanation / totalQuestions) * 100 : 0,
  };
}

export async function getNeedsAttention(
  limit: number = 5
): Promise<NeedsAttentionItem[]> {
  await requireStudioAccess();

  const questions = await db.question.findMany({
    where: {
      OR: [
        { aiQualityScore: { lt: 0.5 } },
        { aiQualityScore: null },
        { explanation: null },
        { explanation: "" },
      ],
    },
    include: {
      category: { select: { nameAr: true } },
    },
    orderBy: { aiQualityScore: "asc" },
    take: limit,
  });

  return questions.map((q) => {
    let reason = "";
    if (
      (q.aiQualityScore === null || q.aiQualityScore < 0.5) &&
      (!q.explanation || q.explanation === "")
    ) {
      reason = "جودة منخفضة وشرح مفقود";
    } else if (q.aiQualityScore === null || q.aiQualityScore < 0.5) {
      reason = "جودة منخفضة";
    } else {
      reason = "شرح مفقود";
    }

    return {
      id: q.id,
      stem: q.stem.slice(0, 80),
      categoryNameAr: q.category.nameAr,
      reason,
      aiQualityScore: q.aiQualityScore,
    };
  });
}

export async function getDailyActivity(
  days: number = 30
): Promise<DailyActivityPoint[]> {
  await requireStudioAccess();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const activities = await db.dailyActivity.findMany({
    where: {
      date: {
        gte: cutoff.toISOString().slice(0, 10),
      },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      attempts: true,
      correct: true,
    },
  });

  // Fill in missing days with zeros
  const result: DailyActivityPoint[] = [];
  const start = new Date(cutoff);
  start.setDate(start.getDate() + 1);
  const end = new Date();

  const activityMap = new Map(activities.map((a) => [a.date, a]));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const a = activityMap.get(dateStr);
    result.push({
      date: dateStr,
      attempts: a?.attempts ?? 0,
      correct: a?.correct ?? 0,
    });
  }

  return result;
}
