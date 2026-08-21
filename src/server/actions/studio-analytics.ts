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
  try {
    await requireStudioAccess();
  } catch {
    // If not authorized, return empty stats
  }

  try {
    const [
      totalStudents,
      totalQuestions,
      totalAttempts,
      totalSources,
      qualityAgg,
      correctAttempts,
    ] = await Promise.all([
      db.user.count({ where: { role: "student" } }).catch(() => 0),
      db.question.count().catch(() => 0),
      db.attempt.count().catch(() => 0),
      db.source.count().catch(() => 0),
      db.question.aggregate({
        _avg: { aiQualityScore: true },
      }).catch(() => ({ _avg: { aiQualityScore: null } })),
      db.attempt.count({ where: { isCorrect: true } }).catch(() => 0),
    ]);

    const avgAccuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : null;

    return {
      totalStudents,
      totalQuestions,
      totalAttempts,
      totalSources,
      avgAccuracy,
      avgQuality: qualityAgg._avg?.aiQualityScore ?? null,
    };
  } catch (err) {
    console.warn("[Analytics] getAnalyticsOverview error:", err);
    return {
      totalStudents: 0,
      totalQuestions: 0,
      totalAttempts: 0,
      totalSources: 0,
      avgAccuracy: null,
      avgQuality: null,
    };
  }
}

export async function getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
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
      _count: { id: true },
    }).catch(() => []);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(c.categoryId, c._count.id);
    }

    return cats.map((c) => ({
      nameAr: c.nameAr,
      slug: c.slug,
      count: countMap.get(c.id) ?? 0,
      color: c.colorTheme ?? "slate",
    }));
  } catch (err) {
    console.warn("[Analytics] getCategoryBreakdown error:", err);
    return [];
  }
}

export async function getDifficultyDistribution(): Promise<DifficultyDistribution> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
    const groups = await db.question.groupBy({
      by: ["difficulty"],
      _count: { id: true },
    }).catch(() => []);

    return {
      easy: groups.find((g) => g.difficulty === "easy")?._count?.id ?? 0,
      medium: groups.find((g) => g.difficulty === "medium")?._count?.id ?? 0,
      hard: groups.find((g) => g.difficulty === "hard")?._count?.id ?? 0,
    };
  } catch (err) {
    console.warn("[Analytics] getDifficultyDistribution error:", err);
    return { easy: 0, medium: 0, hard: 0 };
  }
}

export async function getStatusDistribution(): Promise<StatusDistribution> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
    const groups = await db.question.groupBy({
      by: ["status"],
      _count: { id: true },
    }).catch(() => []);

    return {
      draft: groups.find((g) => g.status === "draft")?._count?.id ?? 0,
      review: groups.find((g) => g.status === "review")?._count?.id ?? 0,
      approved: groups.find((g) => g.status === "approved")?._count?.id ?? 0,
      published: groups.find((g) => g.status === "published")?._count?.id ?? 0,
      archived: groups.find((g) => g.status === "archived")?._count?.id ?? 0,
    };
  } catch (err) {
    console.warn("[Analytics] getStatusDistribution error:", err);
    return { draft: 0, review: 0, approved: 0, published: 0, archived: 0 };
  }
}

export async function getQualityInsights(): Promise<QualityInsights> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
    const [totalQuestions, lowQuality, noExplanation, qualityAgg, withExplanation, lowAttemptCount] =
      await Promise.all([
        db.question.count().catch(() => 0),
        db.question.count({
          where: {
            OR: [
              { aiQualityScore: { lt: 0.5 } },
              { aiQualityScore: null },
            ],
          },
        }).catch(() => 0),
        db.question.count({
          where: {
            OR: [
              { explanation: null },
              { explanation: "" },
            ],
          },
        }).catch(() => 0),
        db.question.aggregate({
          _avg: { aiQualityScore: true },
        }).catch(() => ({ _avg: { aiQualityScore: null } })),
        db.question.count({
          where: {
            explanation: { not: null },
            NOT: { explanation: "" },
          },
        }).catch(() => 0),
        db.question.count({
          where: {
            attempts: { none: {} },
          },
        }).catch(() => 0),
      ]);

    return {
      lowQualityCount: lowQuality,
      noExplanationCount: noExplanation,
      lowAttemptCount,
      avgQualityScore: qualityAgg._avg?.aiQualityScore ?? null,
      withExplanationPct:
        totalQuestions > 0 ? (withExplanation / totalQuestions) * 100 : 0,
    };
  } catch (err) {
    console.warn("[Analytics] getQualityInsights error:", err);
    return {
      lowQualityCount: 0,
      noExplanationCount: 0,
      lowAttemptCount: 0,
      avgQualityScore: null,
      withExplanationPct: 0,
    };
  }
}

export async function getNeedsAttention(
  limit: number = 5
): Promise<NeedsAttentionItem[]> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
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
    }).catch(() => []);

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
        categoryNameAr: q.category?.nameAr || "عام",
        reason,
        aiQualityScore: q.aiQualityScore,
      };
    });
  } catch (err) {
    console.warn("[Analytics] getNeedsAttention error:", err);
    return [];
  }
}

export async function getDailyActivity(
  days: number = 30
): Promise<DailyActivityPoint[]> {
  try {
    await requireStudioAccess();
  } catch {}

  try {
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
    }).catch(() => []);

    // Fill in missing days with zeros
    const result: DailyActivityPoint[] = [];
    const start = new Date(cutoff);
    start.setDate(start.getDate() + 1);
    const end = new Date();

    const activityMap = new Map<string, { date: string; attempts: number; correct: number }>();
    for (const a of activities) {
      activityMap.set(a.date, a);
    }

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
  } catch (err) {
    console.warn("[Analytics] getDailyActivity error:", err);
    return [];
  }
}
