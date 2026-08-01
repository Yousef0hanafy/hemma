"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
  await requirePermission("library", "read");

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
  await requirePermission("library", "read");

  const [categories, sources, statusGroups] = await Promise.all([
    db.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, slug: true, nameAr: true },
    }),
    db.source.findMany({
      orderBy: { importedAt: "desc" },
      select: { id: true, slug: true, title: true },
    }),
    db.question.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

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

  // Build category counts map
  const categoryCountMap = new Map<string, number>();
  for (const group of categoryCounts) {
    categoryCountMap.set(group.categoryId, group._count);
  }

  // Build source counts map
  const sourceCountMap = new Map<string, number>();
  for (const group of sourceCounts) {
    sourceCountMap.set(group.sourceId, group._count);
  }

  return {
    categories: categories.map((cat) => ({
      slug: cat.slug,
      nameAr: cat.nameAr,
      count: categoryCountMap.get(cat.id) ?? 0,
    })),
    sources: sources.map((src) => ({
      slug: src.slug,
      title: src.title,
      count: sourceCountMap.get(src.id) ?? 0,
    })),
    statusCounts: statusGroups.map((group) => ({
      status: group.status,
      count: group._count,
    })),
  };
}

export async function bulkUpdateStatus(ids: string[], status: string) {
  await requirePermission("library", "update");
  await db.question.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  return { updated: ids.length };
}

export async function bulkUpdateCategory(ids: string[], categoryId: string) {
  await requirePermission("library", "update");
  await db.question.updateMany({
    where: { id: { in: ids } },
    data: { categoryId },
  });
  return { updated: ids.length };
}

export async function bulkUpdateDifficulty(ids: string[], difficulty: string) {
  await requirePermission("library", "update");
  await db.question.updateMany({
    where: { id: { in: ids } },
    data: { difficulty },
  });
  return { updated: ids.length };
}

export async function bulkDeleteQuestions(ids: string[]) {
  await requirePermission("library", "delete");
  await db.attempt.deleteMany({ where: { questionId: { in: ids } } });
  await db.favorite.deleteMany({ where: { questionId: { in: ids } } });
  await db.reviewSchedule.deleteMany({ where: { questionId: { in: ids } } });
  await db.contentReview.deleteMany({ where: { questionId: { in: ids } } });
  await db.question.deleteMany({ where: { id: { in: ids } } });
  return { deleted: ids.length };
}
