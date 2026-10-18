// =====================================================================
// Server Actions — questions, sources, categories
// =====================================================================
"use server";

import { db } from "@/lib/db";
import { toCategoryDTO, toQuestionDTO, toSourceDTO } from "@/lib/content/dto";
import type { QuestionDTO } from "@/lib/content/dto";
import { requirePermission } from "@/lib/auth";

export async function fetchSources() {
  await requirePermission("source", "read");
  const sources = await db.source.findMany({ orderBy: { importedAt: "asc" } });
  return sources.map(toSourceDTO);
}

export async function fetchCategories() {
  await requirePermission("category", "read");
  const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
  const counts = await db.question.groupBy({
    by: ["categoryId"],
    where: { status: "published" },
    _count: { id: true },
  });
  const countMap = new Map<string, number>();
  for (const c of counts) {
    countMap.set(c.categoryId, c._count.id);
  }
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

const MAX_QUESTIONS_PER_FETCH = 200;

/** Fisher–Yates shuffle (in place). */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function fetchQuestions(filter: QuestionFilter = {}) {
  const userId = await requirePermission("question", "read");
  const limit = Math.min(
    MAX_QUESTIONS_PER_FETCH,
    Math.max(1, Math.floor(Number(filter.limit) || MAX_QUESTIONS_PER_FETCH))
  );
  const where = {
    // Students only ever see published questions (imports land in "review")
    status: "published",
    ...(filter.categorySlug && { category: { slug: filter.categorySlug } }),
    ...(filter.sourceSlug && { source: { slug: filter.sourceSlug } }),
    ...(filter.difficulty && { difficulty: filter.difficulty }),
    ...(filter.search && { stem: { contains: filter.search.slice(0, 200) } }),
    ...(filter.hasPassage !== undefined && {
      passageId: filter.hasPassage ? { not: null } : null,
    }),
  };
  const include = { category: true, source: true, passage: true } as const;

  // Search results keep a stable order
  if (filter.search) {
    const questions = await db.question.findMany({
      where,
      include,
      take: limit,
      orderBy: { sourceLocalId: "asc" },
    });
    return questions.map(toQuestionDTO);
  }

  // Practice pools: sample across the WHOLE matching bank (it used to be the
  // first 200 by source order forever), questions the student hasn't
  // attempted first, each group shuffled.
  const [candidates, attempted] = await Promise.all([
    db.question.findMany({ where, select: { id: true } }),
    db.attempt.findMany({
      where: { userBucket: userId },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
  ]);
  const seen = new Set(attempted.map((a) => a.questionId));
  const unseenIds = shuffleInPlace(candidates.filter((q) => !seen.has(q.id)).map((q) => q.id));
  const seenIds = shuffleInPlace(candidates.filter((q) => seen.has(q.id)).map((q) => q.id));
  return loadQuestionsByIds([...unseenIds, ...seenIds].slice(0, limit));
}

export async function fetchQuestionById(id: string) {
  await requirePermission("question", "read");
  if (!id || typeof id !== "string") {
    throw new Error("Invalid question ID");
  }
  const q = await db.question.findUnique({
    where: { id },
    include: { category: true, source: true, passage: true },
  });
  if (!q) return null;
  return toQuestionDTO(q);
}

async function loadQuestionsByIds(ids: string[]): Promise<QuestionDTO[]> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }
  const wanted = ids.filter((id) => typeof id === "string").slice(0, MAX_QUESTIONS_PER_FETCH);
  const qs = await db.question.findMany({
    where: { id: { in: wanted } },
    include: { category: true, source: true, passage: true },
  });
  // Preserve the caller's order (sessions index questions by position)
  const byId = new Map(qs.map((q) => [q.id, toQuestionDTO(q)]));
  return wanted.map((id) => byId.get(id)).filter((q): q is QuestionDTO => q !== undefined);
}

export async function fetchQuestionsByIds(ids: string[]) {
  await requirePermission("question", "read");
  return loadQuestionsByIds(ids);
}

/** A question as shown during a running exam — without the answer or explanation. */
export type ExamQuestionDTO = Omit<QuestionDTO, "correctKey" | "explanation" | "studyTip">;

export async function fetchExamQuestionsByIds(ids: string[]): Promise<ExamQuestionDTO[]> {
  await requirePermission("question", "read");
  const qs = await loadQuestionsByIds(ids);
  return qs.map(({ correctKey: _c, explanation: _e, studyTip: _s, ...rest }) => rest);
}
