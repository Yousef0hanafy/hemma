"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";
import { revalidatePath } from "next/cache";
import { toQuestionDTO } from "@/lib/content/dto";
import { generateAIExplanation, estimateDifficultyAI } from "@/server/ai/evaluator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuestionDetail {
  id: string;
  sourceLocalId: number;
  type: string;
  stem: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string | null;
  studyTip: string | null;
  difficulty: string;
  tags: string[];
  citation: string | null;
  status: string;
  aiQualityScore: number | null;
  aiProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations
  category: { id: string; slug: string; nameAr: string; icon: string | null };
  source: { id: string; slug: string; title: string };
  passage: { id: string; titleAr: string | null; bodyAr: string } | null;

  // Aggregations
  reviewCount: number;
  lastReview: {
    action: string;
    notes: string | null;
    reviewerName: string | null;
    createdAt: string;
  } | null;
  attemptCount: number;
  attemptAccuracy: number | null; // 0–100 or null
  aiProcessingLogs: Array<{
    operation: string;
    status: string;
    result: string | null;
    error: string | null;
    createdAt: string;
  }>;
  versions: QuestionVersionInfo[];
}

export interface QuestionVersionInfo {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface EditableField {
  field: string;
  type: "text" | "textarea" | "select" | "tags" | "options";
  label: string;
  currentValue: string | string[] | { key: string; text: string }[] | null;
}

// ---------------------------------------------------------------------------
// Get full question detail
// ---------------------------------------------------------------------------

export async function getQuestionDetail(
  id: string
): Promise<QuestionDetail | null> {
  await requireStudioAccess();

  const q = await db.question.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, slug: true, nameAr: true, icon: true } },
      source: { select: { id: true, slug: true, title: true } },
      passage: { select: { id: true, titleAr: true, bodyAr: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { reviewer: { select: { name: true } } },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!q) return null;

  // Fetch attempts accuracy
  const accuracyAgg = await db.attempt.aggregate({
    where: { questionId: id },
    _avg: { isCorrect: true },
  });

  // Fetch AI processing logs
  const aiLogs = await db.aIProcessingLog.findMany({
    where: { questionId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch versions
  const versions = await db.questionVersion.findMany({
    where: { questionId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    id: q.id,
    sourceLocalId: q.sourceLocalId,
    type: q.type,
    stem: q.stem,
    options: JSON.parse(q.options) as { key: string; text: string }[],
    correctKey: q.correctKey,
    explanation: q.explanation,
    studyTip: q.studyTip,
    difficulty: q.difficulty,
    tags: JSON.parse(q.tags) as string[],
    citation: q.citation,
    status: q.status,
    aiQualityScore: q.aiQualityScore,
    aiProcessedAt: q.aiProcessedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    category: q.category,
    source: q.source,
    passage: q.passage,
    reviewCount: q._count.attempts,
    lastReview: q.reviews[0]
      ? {
          action: q.reviews[0].action,
          notes: q.reviews[0].notes,
          reviewerName: q.reviews[0].reviewer?.name ?? null,
          createdAt: q.reviews[0].createdAt.toISOString(),
        }
      : null,
    attemptCount: q._count.attempts,
    attemptAccuracy:
      accuracyAgg._avg.isCorrect !== null
        ? Math.round(accuracyAgg._avg.isCorrect * 100)
        : null,
    aiProcessingLogs: aiLogs.map((l) => ({
      operation: l.operation,
      status: l.status,
      result: l.result,
      error: l.error,
      createdAt: l.createdAt.toISOString(),
    })),
    versions: versions.map((v) => ({
      id: v.id,
      field: v.field,
      oldValue: v.oldValue,
      newValue: v.newValue,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Update a single field
// ---------------------------------------------------------------------------

export async function updateQuestionField(
  questionId: string,
  field: string,
  value: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireStudioAccess();

  // Validate field
  const allowedFields = [
    "stem",
    "explanation",
    "studyTip",
    "difficulty",
    "status",
    "correctKey",
    "citation",
  ];
  if (!allowedFields.includes(field)) {
    return { ok: false, error: "الحقل غير قابل للتعديل" };
  }

  // Validate difficulty
  if (field === "difficulty" && !["easy", "medium", "hard"].includes(value)) {
    return { ok: false, error: "قيمة الصعوبة غير صالحة" };
  }

  // Validate status
  if (
    field === "status" &&
    !["draft", "review", "approved", "published", "archived"].includes(value)
  ) {
    return { ok: false, error: "قيمة الحالة غير صالحة" };
  }

  // Get current value for version history
  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { [field]: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const raw = (current as any)[field];
  const oldValue = raw === null ? "" : String(raw);

  try {
    // Update the question
    await db.question.update({
      where: { id: questionId },
      data: { [field]: value },
    });

    // Create version record
    await db.questionVersion.create({
      data: {
        questionId,
        field,
        oldValue,
        newValue: value,
        changedBy: userId,
      },
    });

    revalidatePath(`/studio/questions/${questionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Update tags (JSON array)
// ---------------------------------------------------------------------------

export async function updateQuestionTags(
  questionId: string,
  tags: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireStudioAccess();

  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { tags: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const oldValue = current.tags;

  try {
    await db.question.update({
      where: { id: questionId },
      data: { tags: JSON.stringify(tags) },
    });

    await db.questionVersion.create({
      data: {
        questionId,
        field: "tags",
        oldValue,
        newValue: JSON.stringify(tags),
        changedBy: userId,
      },
    });

    revalidatePath(`/studio/questions/${questionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Update options (JSON array)
// ---------------------------------------------------------------------------

export async function updateQuestionOptions(
  questionId: string,
  options: { key: string; text: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireStudioAccess();

  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { options: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const oldValue = current.options;

  try {
    await db.question.update({
      where: { id: questionId },
      data: { options: JSON.stringify(options) },
    });

    await db.questionVersion.create({
      data: {
        questionId,
        field: "options",
        oldValue,
        newValue: JSON.stringify(options),
        changedBy: userId,
      },
    });

    revalidatePath(`/studio/questions/${questionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Get version history
// ---------------------------------------------------------------------------

export async function getQuestionVersions(
  questionId: string
): Promise<QuestionVersionInfo[]> {
  await requireStudioAccess();

  const versions = await db.questionVersion.findMany({
    where: { questionId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return versions.map((v) => ({
    id: v.id,
    field: v.field,
    oldValue: v.oldValue,
    newValue: v.newValue,
    createdAt: v.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Filter-based bulk field update — apply a value to questions matching filters
// ---------------------------------------------------------------------------

export interface BulkApplyFilter {
  categorySlug?: string;
  sourceSlug?: string;
  difficulty?: string;
  status?: string;
  excludeQuestionId?: string; // exclude the current question
}

export async function bulkApplyField(
  field: string,
  value: string,
  filter: BulkApplyFilter
): Promise<{ updated: number }> {
  const userId = await requireStudioAccess();

  // Validate field
  const allowedFields = [
    "explanation",
    "studyTip",
    "difficulty",
    "status",
    "citation",
  ];
  if (!allowedFields.includes(field)) {
    throw new Error("الحقل غير قابل للتطبيق الجماعي");
  }

  // Validate value for constrained fields
  if (field === "difficulty" && !["easy", "medium", "hard"].includes(value)) {
    throw new Error("قيمة الصعوبة غير صالحة");
  }
  if (
    field === "status" &&
    !["draft", "review", "approved", "published", "archived"].includes(value)
  ) {
    throw new Error("قيمة الحالة غير صالحة");
  }

  // Build where clause
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
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.excludeQuestionId) {
    where.id = { not: filter.excludeQuestionId };
  }

  // Get matching question IDs first
  const questions = await db.question.findMany({
    where: where as any,
    select: { id: true },
  });

  const questionIds = questions.map((q) => q.id);
  if (questionIds.length === 0) return { updated: 0 };

  // Update all matching questions
  await db.question.updateMany({
    where: { id: { in: questionIds } },
    data: { [field]: value },
  });

  // Create version records for each updated question
  await db.questionVersion.createMany({
    data: questionIds.map((qId) => ({
      questionId: qId,
      field,
      newValue: value,
      changedBy: userId,
    })),
  });

  return { updated: questionIds.length };
}

/// Preview count of questions that would match the filter
export async function previewBulkApplyCount(
  filter: BulkApplyFilter
): Promise<{ count: number }> {
  await requireStudioAccess();

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
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.excludeQuestionId) {
    where.id = { not: filter.excludeQuestionId };
  }

  const count = await db.question.count({ where: where as any });
  return { count };
}

// ---------------------------------------------------------------------------
// Generate AI explanation for a question
// ---------------------------------------------------------------------------

export async function generateExplanationForQuestion(
  questionId: string
): Promise<
  | { ok: true; explanation: string; studyTip: string; commonMistakes: string[] }
  | { ok: false; error: string }
> {
  await requireStudioAccess();

  const q = await db.question.findUnique({
    where: { id: questionId },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  if (!q) return { ok: false, error: "السؤال غير موجود" };

  const options = JSON.parse(q.options) as { key: string; text: string }[];

  try {
    const result = await generateAIExplanation({
      stem: q.stem,
      options,
      correctKey: q.correctKey,
      categoryName: q.category.nameAr,
    });

    if (!result) {
      return {
        ok: false,
        error: "تعذر الاتصال بخدمة AI أو فشل تحليل الاستجابة",
      };
    }

    return {
      ok: true,
      explanation: result.explanation,
      studyTip: result.studyTip,
      commonMistakes: result.commonMistakes,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Estimate difficulty using AI
// ---------------------------------------------------------------------------

export async function estimateDifficultyForQuestion(
  questionId: string
): Promise<
  | {
      ok: true;
      difficulty: string;
      reason: string;
      estimatedTime: number;
    }
  | { ok: false; error: string }
> {
  await requireStudioAccess();

  const q = await db.question.findUnique({
    where: { id: questionId },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  if (!q) return { ok: false, error: "السؤال غير موجود" };

  const options = JSON.parse(q.options) as { key: string; text: string }[];

  try {
    const result = await estimateDifficultyAI({
      stem: q.stem,
      options,
      categoryName: q.category.nameAr,
    });

    if (!result) {
      return { ok: false, error: "تعذر الاتصال بخدمة AI أو فشل تحليل الاستجابة" };
    }

    return {
      ok: true,
      difficulty: result.difficulty,
      reason: result.reason,
      estimatedTime: result.estimatedTime,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Get adjacent question IDs for prev/next navigation
// ---------------------------------------------------------------------------

export async function getAdjacentQuestionIds(
  questionId: string
): Promise<{ prevId: string | null; nextId: string | null }> {
  await requireStudioAccess();

  const q = await db.question.findUnique({
    where: { id: questionId },
    select: { sourceId: true, sourceLocalId: true },
  });

  if (!q) return { prevId: null, nextId: null };

  // Get questions from the same source ordered by sourceLocalId
  const prev = await db.question.findFirst({
    where: {
      sourceId: q.sourceId,
      sourceLocalId: { lt: q.sourceLocalId },
    },
    orderBy: { sourceLocalId: "desc" },
    select: { id: true },
  });

  const next = await db.question.findFirst({
    where: {
      sourceId: q.sourceId,
      sourceLocalId: { gt: q.sourceLocalId },
    },
    orderBy: { sourceLocalId: "asc" },
    select: { id: true },
  });

  return {
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
  };
}
