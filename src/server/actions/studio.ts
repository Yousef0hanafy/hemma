"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface StudioDashboardStats {
  pendingReview: number;
  inProgress: number;
  published: number;
  todayImports: number;
  totalQuestions: number;
  totalSources: number;
  avgQuality: number | null;
}

export interface ReviewQueueItem {
  id: string;
  questionId: string;
  stem: string;
  authorName: string | null;
  status: string;
  aiFlagged: boolean;
  createdAt: Date;
}

export interface RecentImport {
  id: string;
  title: string;
  questionCount: number;
  status: string;
  importedAt: Date;
}

// ---------------------------------------------------------------------------
// Dashboard server actions
// ---------------------------------------------------------------------------

export async function getStudioDashboardStats(): Promise<StudioDashboardStats> {
  await requireStudioAccess();

  const [pendingReview, published, totalQuestions, totalSources, todayImports] =
    await Promise.all([
      db.question.count({ where: { status: "review" } }),
      db.question.count({ where: { status: "published" } }),
      db.question.count(),
      db.source.count(),
      db.source.count({
        where: {
          importedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

  // Average AI quality score across all questions
  const qualityResult = await db.question.aggregate({
    _avg: { aiQualityScore: true },
  });

  return {
    pendingReview,
    inProgress: await db.question.count({ where: { status: "draft" } }),
    published,
    todayImports,
    totalQuestions,
    totalSources,
    avgQuality: qualityResult._avg.aiQualityScore ?? null,
  };
}

export async function getStudioReviewQueue(limit = 5): Promise<ReviewQueueItem[]> {
  await requireStudioAccess();

  const reviews = await db.contentReview.findMany({
    where: { action: "changes_requested" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      question: {
        select: {
          id: true,
          stem: true,
          status: true,
        },
      },
      reviewer: {
        select: { name: true },
      },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    questionId: r.questionId,
    stem: r.question.stem.slice(0, 60),
    authorName: r.reviewer?.name ?? null,
    status: r.question.status,
    aiFlagged: false,
    createdAt: r.createdAt,
  }));
}

export async function getRecentImports(limit = 5): Promise<RecentImport[]> {
  await requireStudioAccess();

  const sources = await db.source.findMany({
    orderBy: { importedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      questionCount: true,
      importedAt: true,
    },
  });

  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    questionCount: s.questionCount,
    status: "completed",
    importedAt: s.importedAt,
  }));
}

// ---------------------------------------------------------------------------
// Dashboard activity trend — daily question activity for sparkline
// ---------------------------------------------------------------------------

export interface DailyTrendPoint {
  date: string;
  label: string;
  created: number;
  attempts: number;
}

export async function getDashboardActivityTrend(
  days = 7
): Promise<DailyTrendPoint[]> {
  await requireStudioAccess();

  const points: DailyTrendPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const startOfDay = new Date(dateStr + "T00:00:00.000Z");
    const endOfDay = new Date(dateStr + "T23:59:59.999Z");

    const [created, attempts] = await Promise.all([
      db.question.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      db.attempt.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
    ]);

    // Arabic day label
    const dayNames = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
    const label = dayNames[d.getDay()];

    points.push({ date: dateStr, label, created, attempts });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Dashboard status & quality distribution
// ---------------------------------------------------------------------------

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface QualityDistribution {
  label: string;
  count: number;
  color: string;
}

export async function getDashboardDistributions(): Promise<{
  statuses: StatusDistribution[];
  qualities: QualityDistribution[];
}> {
  await requireStudioAccess();

  const [statusGroups, totalQuestions, lowQuality, noExplanation] =
    await Promise.all([
      db.question.groupBy({
        by: ["status"],
        _count: true,
      }),
      db.question.count(),
      db.question.count({
        where: {
          aiQualityScore: { not: null, lt: 0.5 },
        },
      }),
      db.question.count({
        where: { explanation: null },
      }),
    ]);

  const total = totalQuestions || 1;
  const statuses = statusGroups.map((g) => ({
    status: g.status,
    count: g._count,
    percentage: Math.round((g._count / total) * 100),
  }));

  // Quality categories are independent counts that may overlap
  // (a question can be both low quality and missing explanation).
  const qualities: QualityDistribution[] = [
    {
      label: "جودة عالية",
      count: Math.max(0, totalQuestions - lowQuality - noExplanation),
      color: "bg-emerald-400",
    },
    {
      label: "جودة منخفضة",
      count: lowQuality,
      color: "bg-amber-400",
    },
    {
      label: "بدون شرح",
      count: noExplanation,
      color: "bg-slate-300",
    },
  ];

  return { statuses, qualities };
}
