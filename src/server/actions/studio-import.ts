"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";
import { validateSource, normalizeQuestion } from "@/lib/content/normalize";
import { processSource } from "@/server/ai/service";
import {
  batchEstimateDifficultyForSource,
  batchGenerateExplanationsForSource,
} from "./studio-ai";
import type { NormalizedQuestion } from "@/lib/content/types";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ImportPreviewQ {
  index: number;
  stem: string;
  categoryNameAr: string;
  difficulty: string;
  correctKey: string;
  hasExplanation: boolean;
  warning?: string;
}

export interface ImportPreview {
  sourceTitle: string;
  sourceDate: string | null;
  totalQuestions: number;
  questions: ImportPreviewQ[];
  categories: string[];
  difficultyDistribution: { easy: number; medium: number; hard: number };
  warnings: string[];
  errors: string[];
  /** Serialized normalised questions for the confirm step */
  payload: string; // JSON array of NormalizedQuestion
}

export interface ImportResult {
  sourceSlug: string;
  sourceId: string;
  inserted: number;
  total: number;
  errors: string[];
}

export interface ImportHistoryItem {
  id: string;
  title: string;
  slug: string;
  questionCount: number;
  importedAt: Date;
}

// ---------------------------------------------------------------------------
// Preview — validate & normalise the uploaded JSON (no DB writes)
// ---------------------------------------------------------------------------

export async function previewImport(
  jsonText: string
): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  await requireStudioAccess();

  // 1. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "الملف لا يحتوي على JSON صالح. تحقق من تنسيق الملف." };
  }

  // 2. Validate against schema
  const validation = validateSource(parsed);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      error: `فشل التحقق من صحة الملف:\n${validation.errors.join("\n")}`,
    };
  }

  const source = validation.data;

  // 3. Normalise each question
  const slug = `import_${Date.now()}`;
  const normalized: NormalizedQuestion[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const categories = new Set<string>();
  const difficultyDist = { easy: 0, medium: 0, hard: 0 };

  for (const rawQ of source.questions) {
    try {
      const nq = normalizeQuestion(slug, rawQ);
      normalized.push(nq);
      categories.add(nq.categoryNameAr);
      difficultyDist[nq.difficulty]++;

      // Detect potential issues
      const optionTexts = nq.options.map((o) => o.text);
      const uniqueTexts = new Set(optionTexts);
      if (optionTexts.length !== uniqueTexts.size) {
        warnings.push(`السؤال #${rawQ.id}: يوجد خياران متطابقان`);
      }
      if (!nq.explanation || nq.explanation.length < 10) {
        warnings.push(`السؤال #${rawQ.id}: الشرح قصير جداً أو مفقود`);
      }
    } catch (e) {
      errors.push(`السؤال #${rawQ.id}: ${(e as Error).message}`);
    }
  }

  if (normalized.length === 0) {
    return {
      ok: false,
      error: "لم يتم استخراج أي أسئلة صالحة من الملف. تحقق من تنسيق البيانات.",
    };
  }

  return {
    ok: true,
    preview: {
      sourceTitle: source.document_title,
      sourceDate: source.date ?? null,
      totalQuestions: source.questions.length,
      questions: normalized.map((nq, i) => ({
        index: i,
        stem: nq.stem.slice(0, 100),
        categoryNameAr: nq.categoryNameAr,
        difficulty: nq.difficulty,
        correctKey: nq.correctKey,
        hasExplanation: nq.explanation.length > 10,
        warning: warnings.find((w) => w.startsWith(`السؤال #${nq.sourceLocalId}`)),
      })),
      categories: Array.from(categories),
      difficultyDistribution: difficultyDist,
      warnings,
      errors,
      payload: JSON.stringify(normalized),
    },
  };
}

// ---------------------------------------------------------------------------
// Confirm — write to database
// ---------------------------------------------------------------------------

export async function confirmImport(
  payload: string,
  sourceTitle: string,
  sourceDate: string | null
): Promise<ImportResult> {
  await requireStudioAccess();

  const normalized: NormalizedQuestion[] = JSON.parse(payload);
  if (!Array.isArray(normalized) || normalized.length === 0) {
    throw new Error("لا توجد بيانات صالحة للاستيراد");
  }

  const slug = `import_${Date.now()}`;

  // Create source record
  const sourceRecord = await db.source.create({
    data: {
      slug,
      title: sourceTitle,
      date: sourceDate,
    },
  });

  let inserted = 0;
  const errors: string[] = [];

  for (const nq of normalized) {
    try {
      // Upsert category
      const cat = await db.category.upsert({
        where: { slug: nq.categorySlug },
        update: { nameAr: nq.categoryNameAr },
        create: {
          slug: nq.categorySlug,
          nameAr: nq.categoryNameAr,
        },
      });

      // Create question
      await db.question.create({
        data: {
          sourceId: sourceRecord.id,
          categoryId: cat.id,
          sourceLocalId: nq.sourceLocalId,
          type: nq.rawType,
          stem: nq.stem,
          options: JSON.stringify(nq.options),
          correctKey: nq.correctKey,
          explanation: nq.explanation,
          studyTip: nq.studyTip,
          difficulty: nq.difficulty,
          tags: JSON.stringify(nq.tags),
          citation: nq.citation ?? null,
          metadata: JSON.stringify(nq.metadata),
          status: "review", // New imports default to review
        },
      });
      inserted++;
    } catch (e) {
      errors.push(`Q#${nq.sourceLocalId}: ${(e as Error).message}`);
    }
  }

  // Update source question count
  await db.source.update({
    where: { id: sourceRecord.id },
    data: { questionCount: inserted },
  });

  // Auto-process with AI if enabled in settings
  try {
    const setting = await db.studioSetting.findUnique({
      where: { key: "auto_process_on_import" },
    });
    if (setting?.value === "true") {
      // Fire and forget — don't block the import response
      processSource(sourceRecord.id).catch(() => {});
    }
  } catch {
    // Settings check failed silently — import still succeeds
  }

  // Auto-estimate difficulty for all imported questions if enabled
  try {
    const setting = await db.studioSetting.findUnique({
      where: { key: "auto_estimate_difficulty_on_import" },
    });
    if (setting?.value === "true" && inserted > 0) {
      // Fire and forget — don't block the import response
      batchEstimateDifficultyForSource(sourceRecord.id).catch(() => {});
    }
  } catch {
    // Settings check failed silently — import still succeeds
  }

  // Auto-generate explanations for imported questions without one if enabled
  try {
    const setting = await db.studioSetting.findUnique({
      where: { key: "auto_generate_explanations_on_import" },
    });
    if (setting?.value === "true" && inserted > 0) {
      // Fire and forget — don't block the import response
      batchGenerateExplanationsForSource(sourceRecord.id).catch(() => {});
    }
  } catch {
    // Settings check failed silently — import still succeeds
  }

  return {
    sourceSlug: slug,
    sourceId: sourceRecord.id,
    inserted,
    total: normalized.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Import history
// ---------------------------------------------------------------------------

export async function getImportHistory(): Promise<ImportHistoryItem[]> {
  await requireStudioAccess();

  const sources = await db.source.findMany({
    orderBy: { importedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      questionCount: true,
      importedAt: true,
    },
  });

  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    questionCount: s.questionCount,
    importedAt: s.importedAt,
  }));
}
