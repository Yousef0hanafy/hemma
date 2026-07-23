"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";
import {
  processSource,
  processAllUnprocessed,
  processQuestion,
  getAIProcessingSummary,
  getAIProcessingHistory,
} from "@/server/ai/service";
import { estimateDifficultyAI, generateAIExplanation } from "@/server/ai/evaluator";
import type { ProcessingResult } from "@/server/ai/service";



// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface AIProcessingSummaryDTO {
  processed: number;
  unprocessed: number;
  total: number;
  percentProcessed: number;
  averageQuality: number | null;
  lowQuality: number;
  recentOperations: number;
}

export interface AIHistoryItem {
  id: string;
  operation: string;
  operationLabel: string;
  status: string;
  statusLabel: string;
  sourceTitle: string | null;
  summary: string | null;
  error: string | null;
  durationMs: number | null;
  durationLabel: string;
  createdAt: string;
}

export interface AIProcessResult {
  total: number;
  completed: number;
  failed: number;
  averageScore: number | null;
}

// ---------------------------------------------------------------------------
// Operation labels
// ---------------------------------------------------------------------------

const OPERATION_LABELS: Record<string, string> = {
  quality_check: "فحص الجودة",
  generate_explanation: "توليد الشرح",
  estimate_difficulty: "تقدير الصعوبة",
  categorize: "تصنيف",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  failed: "فشل",
};

// ---------------------------------------------------------------------------
// Get AI processing summary
// ---------------------------------------------------------------------------

export async function getAIStatus(): Promise<AIProcessingSummaryDTO> {
  await requireStudioAccess();

  const summary = await getAIProcessingSummary();

  return {
    processed: summary.processed,
    unprocessed: summary.unprocessed,
    total: summary.processed + summary.unprocessed,
    percentProcessed:
      summary.processed + summary.unprocessed > 0
        ? Math.round(
            (summary.processed / (summary.processed + summary.unprocessed)) *
              100
          )
        : 0,
    averageQuality: summary.averageQuality,
    lowQuality: summary.lowQuality,
    recentOperations: summary.recentOperations,
  };
}

// ---------------------------------------------------------------------------
// Get AI processing history
// ---------------------------------------------------------------------------

export async function getAIHistory(): Promise<AIHistoryItem[]> {
  await requireStudioAccess();

  const history = await getAIProcessingHistory(30);

  return history.map((h) => ({
    id: h.id,
    operation: h.operation,
    operationLabel: OPERATION_LABELS[h.operation] ?? h.operation,
    status: h.status,
    statusLabel: STATUS_LABELS[h.status] ?? h.status,
    sourceTitle: h.sourceTitle,
    summary: h.result
      ? (() => {
          try {
            const r = JSON.parse(h.result);
            return r.issues
              ? `${r.issues.length} ملاحظة${
                  r.issues.length !== 1 ? "ات" : ""
                }`
              : `${r.completed ?? r.total ?? "✓"} مكتمل`;
          } catch {
            return null;
          }
        })()
      : null,
    error: h.error,
    durationMs: h.durationMs,
    durationLabel: h.durationMs
      ? h.durationMs < 1000
        ? `${h.durationMs}ms`
        : `${(h.durationMs / 1000).toFixed(1)}s`
      : "—",
    createdAt: h.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Process a specific source
// ---------------------------------------------------------------------------

export async function triggerSourceProcessing(
  sourceId: string
): Promise<AIProcessResult> {
  await requireStudioAccess();

  const result = await processSource(sourceId);

  // Calculate average score from results
  const scores = result.results
    .filter((r) => r.scoreResult?.overall !== undefined)
    .map((r) => r.scoreResult!.overall);

  return {
    total: result.total,
    completed: result.completed,
    failed: result.failed,
    averageScore:
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Process a single question
// ---------------------------------------------------------------------------

export async function triggerSingleProcessing(
  questionId: string
): Promise<{ score: number | null; issues: string[] }> {
  await requireStudioAccess();

  const result = await processQuestion(questionId);

  return {
    score: result.scoreResult
      ? Math.round(result.scoreResult.overall * 100)
      : null,
    issues: result.scoreResult?.issues ?? [],
  };
}

// ---------------------------------------------------------------------------
// Process all unprocessed questions
// ---------------------------------------------------------------------------

export async function triggerBatchProcessing(): Promise<AIProcessResult> {
  await requireStudioAccess();

  const result = await processAllUnprocessed();

  // Get the aggregate quality
  const qualityAgg = await db.question.aggregate({
    _avg: { aiQualityScore: true },
  });

  return {
    total: result.total,
    completed: result.completed,
    failed: result.failed,
    averageScore:
      qualityAgg._avg.aiQualityScore !== null
        ? Math.round(qualityAgg._avg.aiQualityScore * 100)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Get sources with their processing status (for the source picker)
// ---------------------------------------------------------------------------

export interface SourceAIStatus {
  id: string;
  title: string;
  totalQuestions: number;
  processedQuestions: number;
  averageQuality: number | null;
}

// ---------------------------------------------------------------------------
// Batch estimate difficulty for all questions in a source
// ---------------------------------------------------------------------------

export async function batchEstimateDifficultyForSource(
  sourceId: string
): Promise<{ total: number; updated: number; failed: number }> {
  const userId = await requireStudioAccess();

  const questions = await db.question.findMany({
    where: { sourceId },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  let updated = 0;
  let failed = 0;
  const errors: string[] = []; // cap at 5 to avoid unbounded memory usage

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const start = Date.now();

    try {
      const options = JSON.parse(q.options) as { key: string; text: string }[];

      const result = await estimateDifficultyAI({
        stem: q.stem,
        options,
        categoryName: q.category.nameAr,
      });

      if (result && result.difficulty !== q.difficulty) {
        // Update difficulty
        await db.question.update({
          where: { id: q.id },
          data: { difficulty: result.difficulty },
        });

        // Create version record
        await db.questionVersion.create({
          data: {
            questionId: q.id,
            field: "difficulty",
            oldValue: q.difficulty,
            newValue: result.difficulty,
            changedBy: userId,
          },
        });
      }

      updated++;

      await db.aIProcessingLog.create({
        data: {
          questionId: q.id,
          sourceId,
          operation: "estimate_difficulty",
          status: "completed",
          durationMs: Date.now() - start,
          completedAt: new Date(),
        },
      });
    } catch (e) {
      failed++;
      if (errors.length < 5) errors.push(`سؤال #${q.sourceLocalId}: ${(e as Error).message}`);

      await db.aIProcessingLog.create({
        data: {
          questionId: q.id,
          sourceId,
          operation: "estimate_difficulty",
          status: "failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
          completedAt: new Date(),
        },
      });
    }
  }

  // Log summary to the source-level log
  if (questions.length > 0) {
    await db.aIProcessingLog.create({
      data: {
        sourceId,
        operation: "estimate_difficulty",
        status: "completed",
        result: JSON.stringify({
          total: questions.length,
          updated,
          failed,
          errors: errors.slice(0, 5),
        }),
        durationMs: 0,
        completedAt: new Date(),
      },
    });
  }

  return { total: questions.length, updated, failed };
}

// ---------------------------------------------------------------------------
// Batch generate explanations for all questions in a source
// ---------------------------------------------------------------------------

export async function batchGenerateExplanationsForSource(
  sourceId: string
): Promise<{ total: number; generated: number; skipped: number; failed: number }> {
  const userId = await requireStudioAccess();

  const questions = await db.question.findMany({
    where: { sourceId },
    include: {
      category: { select: { nameAr: true } },
    },
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const start = Date.now();

    // Skip questions that already have a meaningful explanation
    if (q.explanation && q.explanation.length >= 20) {
      skipped++;
      continue;
    }

    try {
      const options = JSON.parse(q.options) as { key: string; text: string }[];

      const result = await generateAIExplanation({
        stem: q.stem,
        options,
        correctKey: q.correctKey,
        categoryName: q.category.nameAr,
      });

      if (result) {
        const updates: Record<string, string> = {};

        // Always update explanation (was empty/short)
        updates.explanation = result.explanation;

        // Only update studyTip if it doesn't exist
        if (!q.studyTip && result.studyTip) {
          updates.studyTip = result.studyTip;
        }

        await db.question.update({
          where: { id: q.id },
          data: updates,
        });

        // Create version records
        const versionEntries: Array<{
          questionId: string;
          field: string;
          oldValue: string;
          newValue: string;
          changedBy: string;
        }> = [];

        if (q.explanation !== updates.explanation) {
          versionEntries.push({
            questionId: q.id,
            field: "explanation",
            oldValue: q.explanation ?? "",
            newValue: updates.explanation,
            changedBy: userId,
          });
        }
        if (updates.studyTip && q.studyTip !== updates.studyTip) {
          versionEntries.push({
            questionId: q.id,
            field: "studyTip",
            oldValue: q.studyTip ?? "",
            newValue: updates.studyTip,
            changedBy: userId,
          });
        }

        if (versionEntries.length > 0) {
          await db.questionVersion.createMany({ data: versionEntries });
        }

        generated++;

        await db.aIProcessingLog.create({
          data: {
            questionId: q.id,
            sourceId,
            operation: "generate_explanation",
            status: "completed",
            durationMs: Date.now() - start,
            completedAt: new Date(),
          },
        });
      } else {
        failed++;
        if (errors.length < 5) errors.push(`سؤال #${q.sourceLocalId}: فشل استجابة AI`);

        await db.aIProcessingLog.create({
          data: {
            questionId: q.id,
            sourceId,
            operation: "generate_explanation",
            status: "failed",
            error: "AI returned null",
            durationMs: Date.now() - start,
            completedAt: new Date(),
          },
        });
      }
    } catch (e) {
      failed++;
      if (errors.length < 5) errors.push(`سؤال #${q.sourceLocalId}: ${(e as Error).message}`);

      await db.aIProcessingLog.create({
        data: {
          questionId: q.id,
          sourceId,
          operation: "generate_explanation",
          status: "failed",
          error: (e as Error).message,
          durationMs: Date.now() - start,
          completedAt: new Date(),
        },
      });
    }
  }

  // Log summary
  if (questions.length > 0) {
    await db.aIProcessingLog.create({
      data: {
        sourceId,
        operation: "generate_explanation",
        status: "completed",
        result: JSON.stringify({
          total: questions.length,
          generated,
          skipped,
          failed,
          errors: errors.slice(0, 5),
        }),
        durationMs: 0,
        completedAt: new Date(),
      },
    });
  }

  return { total: questions.length, generated, skipped, failed };
}

// ---------------------------------------------------------------------------
// Run all AI processing for a source (quality + difficulty + explanations)
// ---------------------------------------------------------------------------

export interface FullProcessingResult {
  quality: { total: number; completed: number; failed: number } | null;
  difficulty: { total: number; updated: number; failed: number } | null;
  explanations: { total: number; generated: number; skipped: number; failed: number } | null;
}

export async function triggerFullSourceProcessing(
  sourceId: string
): Promise<FullProcessingResult> {
  await requireStudioAccess();

  // Run all three in sequence
  const quality = await processSource(sourceId).catch(() => null);

  const difficulty = await batchEstimateDifficultyForSource(sourceId).catch(
    () => null
  );

  const explanations = await batchGenerateExplanationsForSource(
    sourceId
  ).catch(() => null);

  return {
    quality: quality
      ? { total: quality.total, completed: quality.completed, failed: quality.failed }
      : null,
    difficulty,
    explanations,
  };
}

// ---------------------------------------------------------------------------
// Run all AI processing for multiple sources (batch)
// ---------------------------------------------------------------------------

export async function triggerFullSourceProcessingBatch(
  sourceIds: string[]
): Promise<{ processed: number; failed: number; results: FullProcessingResult[] }> {
  await requireStudioAccess();

  let processed = 0;
  let failed = 0;
  const results: FullProcessingResult[] = [];

  for (const sourceId of sourceIds) {
    try {
      const result = await triggerFullSourceProcessing(sourceId);
      results.push(result);
      processed++;
    } catch {
      failed++;
    }
  }

  return { processed, failed, results };
}

// ---------------------------------------------------------------------------

export async function getSourcesWithAIStatus(): Promise<SourceAIStatus[]> {
  await requireStudioAccess();

  const sources = await db.source.findMany({
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true } },
    },
  });

  const processedCounts = await db.question.groupBy({
    by: ["sourceId"],
    where: { aiProcessedAt: { not: null } },
    _count: true,
  });

  const qualityBySource = await db.question.groupBy({
    by: ["sourceId"],
    _avg: { aiQualityScore: true },
    where: { aiQualityScore: { not: null } },
  });

  const processedMap = new Map(
    processedCounts.map((p) => [p.sourceId, p._count])
  );
  const qualityMap = new Map(
    qualityBySource.map((q) => [q.sourceId, q._avg.aiQualityScore])
  );

  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    totalQuestions: s._count.questions,
    processedQuestions: processedMap.get(s.id) ?? 0,
    averageQuality: qualityMap.get(s.id) ?? null,
  }));
}
