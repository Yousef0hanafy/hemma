"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";
import { toQuestionDTO, toCategoryDTO, toSourceDTO } from "@/lib/content/dto";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface LibraryQuestionRow {
  id: string;
  sourceLocalId: number;
  stem: string;
  categorySlug: string;
  categoryNameAr: string;
  difficulty: string;
  status: string;
  sourceTitle: string;
  correctKey: string;
  hasExplanation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryFilter {
  search?: string;
  categorySlug?: string;
  sourceSlug?: string;
  difficulty?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export interface LibraryResult {
  rows: LibraryQuestionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LibraryMeta {
  categories: { slug: string; nameAr: string; count: number }[];
  sources: { slug: string; title: string; count: number }[];
  statusCounts: { status: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Library queries
// ---------------------------------------------------------------------------

export async function fetchLibraryQuestions(
  filter: LibraryFilter = {}
): Promise<LibraryResult> {
  await requireStudioAccess();

  const {
    search,
    categorySlug,
    sourceSlug,
    difficulty,
    status,
    page = 1,
    pageSize = 20,
    sortField = "sourceLocalId",
    sortDir = "asc",
  } = filter;

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (search) {
    where.stem = { contains: search, mode: "insensitive" };
  }
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }
  if (sourceSlug) {
    where.source = { slug: sourceSlug };
  }
  if (difficulty) {
    where.difficulty = difficulty;
  }
  if (status) {
    where.status = status;
  }

  // Validate sort field
  const allowedSortFields = [
    "sourceLocalId",
    "stem",
    "difficulty",
    "status",
    "createdAt",
    "updatedAt",
  ];
  const safeSortField = allowedSortFields.includes(sortField)
    ? sortField
    : "sourceLocalId";

  const [rows, total] = await Promise.all([
    db.question.findMany({
      where: where as any,
      include: {
        category: { select: { slug: true, nameAr: true } },
        source: { select: { title: true, slug: true } },
      },
      orderBy: { [safeSortField]: sortDir },
      skip,
      take: pageSize,
    }),
    db.question.count({ where: where as any }),
  ]);

  return {
    rows: rows.map((q) => ({
      id: q.id,
      sourceLocalId: q.sourceLocalId,
      stem: q.stem.slice(0, 120),
      categorySlug: q.category.slug,
      categoryNameAr: q.category.nameAr,
      difficulty: q.difficulty,
      status: q.status,
      sourceTitle: q.source.title,
      correctKey: q.correctKey,
      hasExplanation: q.explanation !== null && q.explanation.length > 0,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function fetchLibraryMeta(): Promise<LibraryMeta> {
  await requireStudioAccess();

  const [categories, sources, statusGroups] = await Promise.all([
    db.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: { slug: true, nameAr: true },
    }),
    db.source.findMany({
      orderBy: { importedAt: "desc" },
      select: { slug: true, title: true },
    }),
    db.question.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  // Get counts per category and source
  const [categoryCounts, sourceCounts] = await Promise.all([
    db.question.groupBy({
      by: ["categoryId"],
      _count: true,
    }),
    db.question.groupBy({
      by: ["sourceId"],
      _count: true,
    }),
  ]);

  const catCountMap = new Map(categoryCounts.map((c) => [c.categoryId, c._count]));
  const srcCountMap = new Map(sourceCounts.map((s) => [s.sourceId, s._count]));

  // For each category, we need to match by slug. We'll join via the actual category records.
  const catSlugToId = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ])
  );

  const srcSlugToId = new Map(
    (await db.source.findMany({ select: { id: true, slug: true } })).map((s) => [
      s.slug,
      s.id,
    ])
  );

  return {
    categories: categories.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      count: catCountMap.get(catSlugToId.get(c.slug) ?? "") ?? 0,
    })),
    sources: sources.map((s) => ({
      slug: s.slug,
      title: s.title,
      count: srcCountMap.get(srcSlugToId.get(s.slug) ?? "") ?? 0,
    })),
    statusCounts: statusGroups.map((g) => ({
      status: g.status,
      count: g._count,
    })),
  };
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export async function bulkUpdateStatus(
  questionIds: string[],
  newStatus: string
): Promise<{ updated: number }> {
  await requireStudioAccess();

  const result = await db.question.updateMany({
    where: { id: { in: questionIds } },
    data: { status: newStatus },
  });

  return { updated: result.count };
}

export async function bulkUpdateCategory(
  questionIds: string[],
  categorySlug: string
): Promise<{ updated: number }> {
  await requireStudioAccess();

  const category = await db.category.findUnique({
    where: { slug: categorySlug },
  });
  if (!category) throw new Error("التصنيف غير موجود");

  const result = await db.question.updateMany({
    where: { id: { in: questionIds } },
    data: { categoryId: category.id },
  });

  return { updated: result.count };
}

export async function bulkUpdateDifficulty(
  questionIds: string[],
  difficulty: string
): Promise<{ updated: number }> {
  await requireStudioAccess();

  const result = await db.question.updateMany({
    where: { id: { in: questionIds } },
    data: { difficulty },
  });

  return { updated: result.count };
}

export async function bulkDeleteQuestions(
  questionIds: string[]
): Promise<{ deleted: number }> {
  await requireStudioAccess();

  // Delete related records first
  await db.attempt.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.favorite.deleteMany({ where: { questionId: { in: questionIds } } });
  await db.reviewSchedule.deleteMany({
    where: { questionId: { in: questionIds } },
  });
  await db.contentReview.deleteMany({
    where: { questionId: { in: questionIds } },
  });

  const result = await db.question.deleteMany({
    where: { id: { in: questionIds } },
  });

  return { deleted: result.count };
}
