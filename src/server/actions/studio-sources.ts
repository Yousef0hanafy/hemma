"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SourceListItem {
  id: string;
  slug: string;
  title: string;
  date: string | null;
  importedAt: Date;
  questionCount: number;
  passageCount: number;
  statusBreakdown: { status: string; count: number }[];
}

export interface SourceDetail {
  id: string;
  slug: string;
  title: string;
  date: string | null;
  importedAt: Date;
  questionCount: number;
  passageCount: number;
  metadata: string;
  statusBreakdown: { status: string; count: number }[];
  difficultyBreakdown: { difficulty: string; count: number }[];
  categoryBreakdown: { nameAr: string; count: number }[];
  questions: {
    id: string;
    sourceLocalId: number;
    stem: string;
    difficulty: string;
    status: string;
    categoryNameAr: string;
  }[];
}

// ---------------------------------------------------------------------------
// List all sources with question stats
// ---------------------------------------------------------------------------

export async function getSources(): Promise<SourceListItem[]> {
  await requireStudioAccess();

  const sources = await db.source.findMany({
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      date: true,
      importedAt: true,
      questionCount: true,
    },
  });

  // Get question counts per status per source, and passage counts
  const [statusGroups, passageCounts] = await Promise.all([
    db.question.groupBy({
      by: ["sourceId", "status"],
      _count: true,
    }),
    db.passage.groupBy({
      by: ["sourceId"],
      _count: true,
    }),
  ]);

  const passageCountMap = new Map(
    passageCounts.map((p) => [p.sourceId, p._count])
  );

  // Group status breakdowns by sourceId
  const statusMap = new Map<string, { status: string; count: number }[]>();
  for (const g of statusGroups) {
    const arr = statusMap.get(g.sourceId) ?? [];
    arr.push({ status: g.status, count: g._count });
    statusMap.set(g.sourceId, arr);
  }

  return sources.map((s) => ({
    ...s,
    passageCount: passageCountMap.get(s.id) ?? 0,
    statusBreakdown: statusMap.get(s.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Full source detail (for expanded view)
// ---------------------------------------------------------------------------

export async function getSourceDetail(slug: string): Promise<SourceDetail | null> {
  await requireStudioAccess();

  const source = await db.source.findUnique({
    where: { slug },
    include: {
      passages: { select: { id: true, titleAr: true } },
    },
  });

  if (!source) return null;

  const questions = await db.question.findMany({
    where: { sourceId: source.id },
    orderBy: { sourceLocalId: "asc" },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  // Breakdowns
  const statusB: Record<string, number> = {};
  const difficultyB: Record<string, number> = {};
  const categoryB: Record<string, number> = {};

  for (const q of questions) {
    statusB[q.status] = (statusB[q.status] ?? 0) + 1;
    difficultyB[q.difficulty] = (difficultyB[q.difficulty] ?? 0) + 1;
    categoryB[q.category.nameAr] = (categoryB[q.category.nameAr] ?? 0) + 1;
  }

  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    date: source.date,
    importedAt: source.importedAt,
    questionCount: source.questionCount,
    passageCount: source.passages.length,
    metadata: source.metadata,
    statusBreakdown: Object.entries(statusB).map(([status, count]) => ({
      status,
      count,
    })),
    difficultyBreakdown: Object.entries(difficultyB).map(
      ([difficulty, count]) => ({ difficulty, count })
    ),
    categoryBreakdown: Object.entries(categoryB)
      .map(([nameAr, count]) => ({ nameAr, count }))
      .sort((a, b) => b.count - a.count),
    questions: questions.map((q) => ({
      id: q.id,
      sourceLocalId: q.sourceLocalId,
      stem: q.stem.slice(0, 100),
      difficulty: q.difficulty,
      status: q.status,
      categoryNameAr: q.category.nameAr,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get processing status per source (for row indicators)
// ---------------------------------------------------------------------------

export type ProcessingFlags = {
  qualityDone: boolean;
  difficultyDone: boolean;
  explanationsDone: boolean;
};

export async function getSourcesProcessingStatus(): Promise<
  Record<string, ProcessingFlags>
> {
  await requireStudioAccess();

  // Get the latest source-level summary log per operation for all sources
  const logs = await db.aIProcessingLog.findMany({
    where: {
      questionId: null,
      operation: {
        in: ["quality_check", "estimate_difficulty", "generate_explanation"],
      },
      status: "completed",
    },
    orderBy: { createdAt: "desc" },
  });

  const result: Record<string, ProcessingFlags> = {};

  for (const log of logs) {
    if (!result[log.sourceId]) {
      result[log.sourceId] = {
        qualityDone: false,
        difficultyDone: false,
        explanationsDone: false,
      };
    }

    if (log.operation === "quality_check") result[log.sourceId].qualityDone = true;
    if (log.operation === "estimate_difficulty") result[log.sourceId].difficultyDone = true;
    if (log.operation === "generate_explanation") result[log.sourceId].explanationsDone = true;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Delete source + all related data
// ---------------------------------------------------------------------------

export async function deleteSource(id: string): Promise<{ deleted: boolean }> {
  await requireStudioAccess();

  // Delete all related records in the right order
  const questions = await db.question.findMany({
    where: { sourceId: id },
    select: { id: true },
  });
  const questionIds = questions.map((q) => q.id);

  if (questionIds.length > 0) {
    await db.attempt.deleteMany({ where: { questionId: { in: questionIds } } });
    await db.favorite.deleteMany({ where: { questionId: { in: questionIds } } });
    await db.reviewSchedule.deleteMany({
      where: { questionId: { in: questionIds } },
    });
    await db.contentReview.deleteMany({
      where: { questionId: { in: questionIds } },
    });
    await db.question.deleteMany({ where: { sourceId: id } });
  }

  await db.passage.deleteMany({ where: { sourceId: id } });
  await db.source.delete({ where: { id } });

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Export source as JSON
// ---------------------------------------------------------------------------

export async function exportSourceToJSON(
  id: string
): Promise<{ json: string; filename: string } | { error: string }> {
  await requireStudioAccess();

  const source = await db.source.findUnique({ where: { id } });
  if (!source) return { error: "المصدر غير موجود" };

  const questions = await db.question.findMany({
    where: { sourceId: id },
    orderBy: { sourceLocalId: "asc" },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  // Reconstruct the original source format
  const exportData = {
    document_title: source.title,
    date: source.date,
    exported_at: new Date().toISOString(),
    source_metadata: source.metadata,
    total_questions: questions.length,
    questions: questions.map((q) => ({
      id: q.sourceLocalId,
      type: q.type,
      stem: q.stem,
      options: JSON.parse(q.options),
      correctKey: q.correctKey,
      explanation: q.explanation ?? "",
      studyTip: q.studyTip ?? "",
      difficulty: q.difficulty,
      tags: JSON.parse(q.tags),
      category: q.category.nameAr,
      status: q.status,
    })),
  };

  return {
    json: JSON.stringify(exportData, null, 2),
    filename: `${source.slug.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.json`,
  };
}

// ---------------------------------------------------------------------------
// Update source metadata
// ---------------------------------------------------------------------------

export async function updateSource(
  id: string,
  data: { title?: string; date?: string | null }
): Promise<{ ok: boolean }> {
  await requireStudioAccess();

  await db.source.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.date !== undefined ? { date: data.date } : {}),
    },
  });

  return { ok: true };
}
