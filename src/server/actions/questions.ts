// =====================================================================
// Server Actions — questions, sources, categories
// =====================================================================
"use server";

import { db } from "@/lib/db";
import { toCategoryDTO, toQuestionDTO, toSourceDTO } from "@/lib/content/dto";

export async function fetchSources() {
  const sources = await db.source.findMany({ orderBy: { importedAt: "asc" } });
  return sources.map(toSourceDTO);
}

export async function fetchCategories() {
  const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
  const counts = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));
  return cats.map((c) => toCategoryDTO(c, countMap.get(c.id) ?? 0));
}

export interface QuestionFilter {
  categorySlug?: string;
  sourceSlug?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
}

export async function fetchQuestions(filter: QuestionFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.categorySlug) {
    where.category = { slug: filter.categorySlug };
  }
  if (filter.sourceSlug) {
    where.source = { slug: filter.sourceSlug };
  }
  if (filter.difficulty) {
    where.difficulty = filter.difficulty;
  }
  if (filter.search) {
    where.stem = { contains: filter.search };
  }

  const questions = await db.question.findMany({
    where,
    include: { category: true, source: true },
    take: filter.limit ?? 200,
    orderBy: { sourceLocalId: "asc" },
  });
  return questions.map(toQuestionDTO);
}

export async function fetchQuestionById(id: string) {
  const q = await db.question.findUnique({
    where: { id },
    include: { category: true, source: true },
  });
  if (!q) return null;
  return toQuestionDTO(q);
}

export async function fetchQuestionsByIds(ids: string[]) {
  const qs = await db.question.findMany({
    where: { id: { in: ids } },
    include: { category: true, source: true },
  });
  return qs.map(toQuestionDTO);
}
