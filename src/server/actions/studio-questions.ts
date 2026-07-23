"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateAIExplanation, estimateDifficultyAI } from "@/server/ai/evaluator";
import { isValidId, isValidLength, isValidEnum } from "@/lib/studio-auth";

// ── Circuit Breaker for AI Services ─────────────────────────────
const aiCircuitState = new Map<string, {
  failures: number;
  lastFailure: number;
  open: boolean;
}>();

const AI_FAILURE_THRESHOLD = 5;
const AI_RESET_TIMEOUT = 60000;

function isAICircuitOpen(service: string): boolean {
  const state = aiCircuitState.get(service);
  if (!state) return false;
  
  if (state.open && Date.now() - state.lastFailure > AI_RESET_TIMEOUT) {
    state.open = false;
    return false;
  }
  
  return state.open;
}

function recordAIFailure(service: string): void {
  const state = aiCircuitState.get(service) || {
    failures: 0,
    lastFailure: 0,
    open: false,
  };
  
  state.failures++;
  state.lastFailure = Date.now();
  
  if (state.failures >= AI_FAILURE_THRESHOLD) {
    state.open = true;
  }
  
  aiCircuitState.set(service, state);
}

function recordAISuccess(service: string): void {
  aiCircuitState.set(service, {
    failures: 0,
    lastFailure: 0,
    open: false,
  });
}

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
  attemptAccuracy: number | null;
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
// Constants
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;
const VALID_STATUSES = ["draft", "review", "approved", "published", "archived"] as const;
const MAX_TEXT_LENGTH = 5000;
const MAX_TAGS_LENGTH = 100;
const MAX_TAG_LENGTH = 50;
const MAX_OPTIONS_COUNT = 10;
const MAX_OPTION_LENGTH = 500;

// ---------------------------------------------------------------------------
// Get full question detail
// ---------------------------------------------------------------------------

export async function getQuestionDetail(
  id: string
): Promise<QuestionDetail | null> {
  await requirePermission("question", "read");

  if (!isValidId(id)) {
    throw new Error("Invalid question ID");
  }

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
      attempts: {
        select: {
          isCorrect: true,
          createdAt: true,
        },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!q) return null;

  const attemptAccuracy = q.attempts.length > 0
    ? Math.round(
        (q.attempts.filter((a) => a.isCorrect).length / q.attempts.length) * 100
      )
    : null;

  const aiLogs = await db.aIProcessingLog.findMany({
    where: { questionId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

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
    attemptAccuracy,
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
  const userId = await requirePermission("question", "update");

  if (!isValidId(questionId)) {
    return { ok: false, error: "معرّف السؤال غير صالح" };
  }

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

  // Validate field-specific constraints
  if (field === "difficulty") {
    if (!isValidEnum(value, VALID_DIFFICULTIES)) {
      return { ok: false, error: "قيمة الصعوبة غير صالحة" };
    }
  }

  if (field === "status") {
    if (!isValidEnum(value, VALID_STATUSES)) {
      return { ok: false, error: "قيمة الحالة غير صالحة" };
    }
  }

  // Validate text field lengths
  if (["stem", "explanation", "studyTip", "citation"].includes(field)) {
    if (!isValidLength(value, MAX_TEXT_LENGTH)) {
      return { ok: false, error: "القيمة غير صالحة أو طويلة جداً" };
    }
  }

  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { [field]: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const raw = (current as any)[field];
  const oldValue = raw === null ? "" : String(raw);

  try {
    // Use transaction to ensure both operations succeed or fail together
    await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: { [field]: value },
      });

      await tx.questionVersion.create({
        data: {
          questionId,
          field,
          oldValue,
          newValue: value,
          changedBy: userId,
        },
      });
    });

    revalidatePath(`/studio/questions/${questionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Update tags
// ---------------------------------------------------------------------------

export async function updateQuestionTags(
  questionId: string,
  tags: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requirePermission("question", "update");

  if (!isValidId(questionId)) {
    return { ok: false, error: "معرّف السؤال غير صالح" };
  }

  if (!Array.isArray(tags)) {
    return { ok: false, error: "الوسوم يجب أن تكون مصفوفة" };
  }

  if (tags.length > MAX_TAGS_LENGTH) {
    return { ok: false, error: "عدد الوسوم كبير جداً" };
  }

  // Validate each tag
  for (const tag of tags) {
    if (typeof tag !== "string" || !isValidLength(tag, MAX_TAG_LENGTH)) {
      return { ok: false, error: "وسم غير صالح" };
    }
  }

  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { tags: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const oldValue = current.tags;

  try {
    // Use transaction to ensure both operations succeed or fail together
    await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: { tags: JSON.stringify(tags) },
      });

      await tx.questionVersion.create({
        data: {
          questionId,
          field: "tags",
          oldValue,
          newValue: JSON.stringify(tags),
          changedBy: userId,
        },
      });
    });

    revalidatePath(`/studio/questions/${questionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Update options
// ---------------------------------------------------------------------------

export async function updateQuestionOptions(
  questionId: string,
  options: { key: string; text: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requirePermission("question", "update");

  if (!isValidId(questionId)) {
    return { ok: false, error: "معرّف السؤال غير صالح" };
  }

  if (!Array.isArray(options)) {
    return { ok: false, error: "الخيارات يجب أن تكون مصفوفة" };
  }

  if (options.length > MAX_OPTIONS_COUNT) {
    return { ok: false, error: "عدد الخيارات كبير جداً" };
  }

  // Validate each option
  for (const option of options) {
    if (
      !option ||
      typeof option !== "object" ||
      typeof option.key !== "string" ||
      typeof option.text !== "string" ||
      !isValidLength(option.text, MAX_OPTION_LENGTH)
    ) {
      return { ok: false, error: "خيار غير صالح" };
    }
  }

  const current = await db.question.findUnique({
    where: { id: questionId },
    select: { options: true },
  });

  if (!current) return { ok: false, error: "السؤال غير موجود" };

  const oldValue = current.options;

  try {
    // Use transaction to ensure both operations succeed or fail together
    await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: { options: JSON.stringify(options) },
      });

      await tx.questionVersion.create({
        data: {
          questionId,
          field: "options",
          oldValue,
          newValue: JSON.stringify(options),
          changedBy: userId,
        },
      });
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
  await requirePermission("question", "read");

  if (!isValidId(questionId)) {
    throw new Error("Invalid question ID");
  }

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
// Filter-based bulk field update
// ---------------------------------------------------------------------------

export interface BulkApplyFilter {
  categorySlug?: string;
  sourceSlug?: string;
  difficulty?: string;
  status?: string;
  excludeQuestionId?: string;
}

export async function bulkApplyField(
  field: string,
  value: string,
  filter: BulkApplyFilter
): Promise<{ updated: number }> {
  const userId = await requirePermission("question", "update");

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

  if (field === "difficulty") {
    if (!isValidEnum(value, VALID_DIFFICULTIES)) {
      throw new Error("قيمة الصعوبة غير صالحة");
    }
  }
  if (field === "status") {
    if (!isValidEnum(value, VALID_STATUSES)) {
      throw new Error("قيمة الحالة غير صالحة");
    }
  }

  // Validate text field lengths
  if (["explanation", "studyTip", "citation"].includes(field)) {
    if (!isValidLength(value, MAX_TEXT_LENGTH)) {
      throw new Error("القيمة غير صالحة أو طويلة جداً");
    }
  }

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

  const questions = await db.question.findMany({
    where: where as any,
    select: { id: true },
  });

  const questionIds = questions.map((q) => q.id);
  if (questionIds.length === 0) return { updated: 0 };

  // Use transaction for bulk update to ensure atomicity
  await db.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { id: { in: questionIds } },
      data: { [field]: value },
    });

    await tx.questionVersion.createMany({
      data: questionIds.map((qId) => ({
        questionId: qId,
        field,
        newValue: value,
        changedBy: userId,
      })),
    });
  });

  return { updated: questionIds.length };
}

/// Preview count of questions that would match the filter
export async function previewBulkApplyCount(
  filter: BulkApplyFilter
): Promise<{ count: number }> {
  await requirePermission("question", "read");

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
// Generate AI explanation for a question (with circuit breaker)
// ---------------------------------------------------------------------------

export async function generateExplanationForQuestion(
  questionId: string
): Promise<
  | { ok: true; explanation: string; studyTip: string; commonMistakes: string[] }
  | { ok: false; error: string }
> {
  await requirePermission("ai_processing", "create");

  if (!isValidId(questionId)) {
    return { ok: false, error: "معرّف السؤال غير صالح" };
  }

  if (isAICircuitOpen("generateExplanation")) {
    return {
      ok: false,
      error: "خدمة AI مؤقتاً غير متاحة. حاول مرة أخرى لاحقاً.",
    };
  }

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
      recordAIFailure("generateExplanation");
      return {
        ok: false,
        error: "تعذر الاتصال بخدمة AI أو فشل تحليل الاستجابة",
      };
    }

    recordAISuccess("generateExplanation");
    return {
      ok: true,
      explanation: result.explanation,
      studyTip: result.studyTip,
      commonMistakes: result.commonMistakes,
    };
  } catch (e) {
    recordAIFailure("generateExplanation");
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Estimate difficulty using AI (with circuit breaker)
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
  await requirePermission("ai_processing", "create");

  if (!isValidId(questionId)) {
    return { ok: false, error: "معرّف السؤال غير صالح" };
  }

  if (isAICircuitOpen("estimateDifficulty")) {
    return {
      ok: false,
      error: "خدمة AI مؤقتاً غير متاحة. حاول مرة أخرى لاحقاً.",
    };
  }

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
      recordAIFailure("estimateDifficulty");
      return { ok: false, error: "تعذر الاتصال بخدمة AI أو فشل تحليل الاستجابة" };
    }

    recordAISuccess("estimateDifficulty");
    return {
      ok: true,
      difficulty: result.difficulty,
      reason: result.reason,
      estimatedTime: result.estimatedTime,
    };
  } catch (e) {
    recordAIFailure("estimateDifficulty");
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Get adjacent question IDs for prev/next navigation
// ---------------------------------------------------------------------------

export async function getAdjacentQuestionIds(
  questionId: string
): Promise<{ prevId: string | null; nextId: string | null }> {
  await requirePermission("question", "read");

  if (!isValidId(questionId)) {
    throw new Error("Invalid question ID");
  }

  const q = await db.question.findUnique({
    where: { id: questionId },
    select: { sourceId: true, sourceLocalId: true },
  });

  if (!q) return { prevId: null, nextId: null };

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
