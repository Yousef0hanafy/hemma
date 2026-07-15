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
  hasPassage?: boolean; // true = only with passage, false = only without passage, undefined = all
  limit?: number;
}

export async function fetchQuestions(filter: QuestionFilter = {}) {
  const questions = await db.question.findMany({
    where: {
      ...(filter.categorySlug && { category: { slug: filter.categorySlug } }),
      ...(filter.sourceSlug && { source: { slug: filter.sourceSlug } }),
      ...(filter.difficulty && { difficulty: filter.difficulty }),
      ...(filter.search && { stem: { contains: filter.search } }),
      ...(filter.hasPassage !== undefined && {
        passageId: filter.hasPassage ? { not: null } : null,
      }),
    },
    include: { category: true, source: true, passage: true },
    take: filter.limit ?? 200,
    orderBy: { sourceLocalId: "asc" },
  });
  return questions.map(toQuestionDTO);
}

export async function fetchQuestionById(id: string) {
  const q = await db.question.findUnique({
    where: { id },
    include: { category: true, source: true, passage: true },
  });
  if (!q) return null;
  return toQuestionDTO(q);
}

export async function fetchQuestionsByIds(ids: string[]) {
  const qs = await db.question.findMany({
    where: { id: { in: ids } },
    include: { category: true, source: true, passage: true },
  });
  return qs.map(toQuestionDTO);
}
