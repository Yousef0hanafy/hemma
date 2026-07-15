// =====================================================================
// AI Processing Service — orchestrates quality scoring + logging
// =====================================================================

import { db } from "@/lib/db";
import { scoreQuestionWithAI, isAIAvailable } from "./evaluator";
import type { ScoringResult } from "./scoring";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/** Read the ai_provider setting from DB to decide if AI should be used */
export async function shouldUseAI(): Promise<boolean> {
  try {
    const setting = await db.studioSetting.findUnique({
      where: { key: "ai_provider" },
    });
    const provider = setting?.value ?? "auto";

    if (provider === "heuristic") return false;
    if (provider === "gemini" || provider === "auto") return isAIAvailable();
    return isAIAvailable();
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// Operation types
// -------------------------------------------------------------------

export type AIOperation =
  | "quality_check"
  | "generate_explanation"
  | "estimate_difficulty"
  | "categorize";

export interface ProcessingResult {
  operation: AIOperation;
  questionId?: string;
  sourceId?: string;
  status: "completed" | "failed";
  scoreResult?: ScoringResult;
  error?: string;
  durationMs: number;
}

// -------------------------------------------------------------------
// Process a single question: run quality scoring + update DB
// accept optional preferAI to avoid per-question DB reads
// -------------------------------------------------------------------

export async function processQuestion(
  questionId: string,
  preferAI?: boolean
): Promise<ProcessingResult> {
  const start = Date.now();

  try {
    const question = await db.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return {
        operation: "quality_check",
        status: "failed",
        error: "السؤال غير موجود",
        durationMs: Date.now() - start,
      };
    }

    const options = JSON.parse(question.options) as Array<{
      key: string;
      text: string;
    }>;
    const tags = JSON.parse(question.tags) as string[];

    // Read setting once if not provided by caller
    const useAI = preferAI ?? await shouldUseAI();

    const result = await scoreQuestionWithAI({
      stem: question.stem,
      options: options.map((o) => ({ key: o.key as any, text: o.text })),
      correctKey: question.correctKey,
      explanation: question.explanation,
      difficulty: question.difficulty,
      tags,
      preferAI: useAI,
    });

    await db.question.update({
      where: { id: questionId },
      data: {
        aiQualityScore: result.overall,
        aiProcessedAt: new Date(),
      },
    });

    await db.aIProcessingLog.create({
      data: {
        questionId,
        operation: "quality_check",
        status: "completed",
        result: JSON.stringify({
          overall: result.overall,
          dimensions: result.dimensions,
          issues: result.issues.slice(0, 5),
        }),
        durationMs: Date.now() - start,
        completedAt: new Date(),
      },
    });

    return {
      operation: "quality_check",
      questionId,
      status: "completed",
      scoreResult: result,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const error = (e as Error).message;

    await db.aIProcessingLog
      .create({
        data: {
          questionId,
          operation: "quality_check",
          status: "failed",
          error,
          durationMs: Date.now() - start,
          completedAt: new Date(),
        },
      })
      .catch(() => {});

    return {
      operation: "quality_check",
      questionId,
      status: "failed",
      error,
      durationMs: Date.now() - start,
    };
  }
}

// -------------------------------------------------------------------
// Process all questions in a source
// -------------------------------------------------------------------

export async function processSource(
  sourceId: string,
  options?: { onProgress?: (current: number, total: number) => void }
): Promise<{
  sourceId: string;
  total: number;
  completed: number;
  failed: number;
  results: ProcessingResult[];
}> {
  const questions = await db.question.findMany({
    where: { sourceId },
    select: { id: true },
  });

  const total = questions.length;
  let completed = 0;
  let failed = 0;
  const results: ProcessingResult[] = [];

  // Read AI preference once for this batch
  const preferAI = await shouldUseAI();

  const log = await db.aIProcessingLog.create({
    data: {
      sourceId,
      operation: "quality_check",
      status: "processing",
    },
  });

  for (let i = 0; i < questions.length; i++) {
    const result = await processQuestion(questions[i].id, preferAI);
    results.push(result);

    if (result.status === "completed") completed++;
    else failed++;

    options?.onProgress?.(i + 1, total);
  }

  await db.aIProcessingLog.update({
    where: { id: log.id },
    data: {
      status: "completed",
      result: JSON.stringify({ total, completed, failed }),
      durationMs: results.reduce((a, r) => a + r.durationMs, 0),
      completedAt: new Date(),
    },
  });

  return { sourceId, total, completed, failed, results };
}

// -------------------------------------------------------------------
// Process all unprocessed questions across all sources
// -------------------------------------------------------------------

export async function processAllUnprocessed(): Promise<{
  total: number;
  completed: number;
  failed: number;
}> {
  const unprocessed = await db.question.findMany({
    where: { aiProcessedAt: null },
    select: { id: true, sourceId: true },
  });

  const total = unprocessed.length;
  let completed = 0;
  let failed = 0;

  // Read AI preference once for this batch
  const preferAI = await shouldUseAI();

  const sourceGroups = new Map<string, string[]>();
  for (const q of unprocessed) {
    const arr = sourceGroups.get(q.sourceId) ?? [];
    arr.push(q.id);
    sourceGroups.set(q.sourceId, arr);
  }

  for (const [sourceId, questionIds] of sourceGroups) {
    await db.aIProcessingLog.create({
      data: {
        sourceId,
        operation: "quality_check",
        status: "processing",
      },
    });

    for (const qId of questionIds) {
      const result = await processQuestion(qId, preferAI);
      if (result.status === "completed") completed++;
      else failed++;
    }
  }

  return { total, completed, failed };
}

// -------------------------------------------------------------------
// Get AI processing summary
// -------------------------------------------------------------------

export async function getAIProcessingSummary(): Promise<{
  processed: number;
  unprocessed: number;
  averageQuality: number | null;
  lowQuality: number;
  recentOperations: number;
}> {
  const [processed, unprocessed, qualityAgg, lowQuality, recentOps] =
    await Promise.all([
      db.question.count({ where: { aiProcessedAt: { not: null } } }),
      db.question.count({ where: { aiProcessedAt: null } }),
      db.question.aggregate({ _avg: { aiQualityScore: true } }),
      db.question.count({
        where: { aiQualityScore: { not: null, lt: 0.5 } },
      }),
      db.aIProcessingLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  return {
    processed,
    unprocessed,
    averageQuality: qualityAgg._avg.aiQualityScore ?? null,
    lowQuality,
    recentOperations,
  };
}

// -------------------------------------------------------------------
// Get recent AI processing history
// -------------------------------------------------------------------

export async function getAIProcessingHistory(
  limit = 20
): Promise<
  Array<{
    id: string;
    operation: string;
    status: string;
    sourceTitle: string | null;
    result: string | null;
    error: string | null;
    durationMs: number | null;
    createdAt: Date;
    completedAt: Date | null;
  }>
> {
  const logs = await db.aIProcessingLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      source: { select: { title: true } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    operation: l.operation,
    status: l.status,
    sourceTitle: l.source?.title ?? null,
    result: l.result,
    error: l.error,
    durationMs: l.durationMs,
    createdAt: l.createdAt,
    completedAt: l.completedAt,
  }));
}
