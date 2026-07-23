"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditFilter {
  operation?: string;
  status?: string;
  sourceId?: string;
  search?: string;
  dateRange?: "24h" | "7d" | "30d" | "all";
  page: number;
  pageSize: number;
}

export interface AuditLogEntry {
  id: string;
  operation: string;
  operationLabel: string;
  status: string;
  statusLabel: string;
  sourceId: string | null;
  sourceTitle: string | null;
  questionId: string | null;
  questionPreview: string | null;
  result: string | null;
  resultSummary: string | null;
  error: string | null;
  durationMs: number | null;
  durationLabel: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AuditSummary {
  totalOperations: number;
  successRate: number;
  failedCount: number;
  completedCount: number;
  avgDurationMs: number;
  avgDurationLabel: string;
  operationsByType: Array<{ operation: string; label: string; count: number }>;
  operationsByStatus: Array<{ status: string; label: string; count: number }>;
}

export interface AuditTrailResponse {
  entries: AuditLogEntry[];
  summary: AuditSummary;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  availableSources: Array<{ id: string; title: string }>;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const OPERATION_LABELS: Record<string, string> = {
  quality_check: "فحص الجودة",
  generate_explanation: "توليد الشروحات",
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
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function getResultSummary(result: string | null): string | null {
  if (!result) return null;
  try {
    const r = JSON.parse(result);
    if (r.issues) {
      return `${r.issues.length} ملاحظة${r.issues.length !== 1 ? "ات" : ""}`;
    }
    if (r.total !== undefined && r.completed !== undefined) {
      return `${r.completed}/${r.total} مكتمل`;
    }
    if (r.generated !== undefined) {
      return `${r.generated} توليد, ${r.skipped ?? 0} تخطي`;
    }
    if (r.updated !== undefined) {
      return `${r.updated} تحديث`;
    }
    if (r.overall !== undefined) {
      return `الدرجة: ${Math.round(r.overall * 100)}%`;
    }
    return "✓ مكتمل";
  } catch {
    return null;
  }
}

function getDateFilter(dateRange: string): Date | null {
  switch (dateRange) {
    case "24h":
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getAuditTrail(
  filter: AuditFilter
): Promise<AuditTrailResponse> {
  await requireStudioAccess();

  const { operation, status, sourceId, search, dateRange, page, pageSize } =
    filter;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (operation) where.operation = operation;
  if (status) where.status = status;
  if (sourceId) where.sourceId = sourceId;

  const dateFrom = getDateFilter(dateRange ?? "all");
  if (dateFrom) {
    where.createdAt = { gte: dateFrom };
  }

  if (search) {
    where.OR = [
      { error: { contains: search } },
      { result: { contains: search } },
      { source: { title: { contains: search } } },
    ];
  }

  // Get total count for pagination
  const totalCount = await db.aIProcessingLog.count({ where });

  // Get entries with pagination
  const logs = await db.aIProcessingLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      source: { select: { title: true, id: true } },
    },
  });

  const entries: AuditLogEntry[] = logs.map((l) => ({
    id: l.id,
    operation: l.operation,
    operationLabel: OPERATION_LABELS[l.operation] ?? l.operation,
    status: l.status,
    statusLabel: STATUS_LABELS[l.status] ?? l.status,
    sourceId: l.sourceId,
    sourceTitle: l.source?.title ?? null,
    questionId: l.questionId,
    questionPreview: null,
    result: l.result,
    resultSummary: getResultSummary(l.result),
    error: l.error,
    durationMs: l.durationMs,
    durationLabel: formatDuration(l.durationMs),
    createdAt: l.createdAt.toISOString(),
    completedAt: l.completedAt?.toISOString() ?? null,
  }));

  // Get summary stats (from all matching logs, not just current page)
  const [totalOps, failedCount, completedCount, avgDuration] =
    await Promise.all([
      db.aIProcessingLog.count({ where }),
      db.aIProcessingLog.count({ where: { ...where, status: "failed" } }),
      db.aIProcessingLog.count({ where: { ...where, status: "completed" } }),
      db.aIProcessingLog.aggregate({
        _avg: { durationMs: true },
        where,
      }),
    ]);

  const avgDurationMs = avgDuration._avg.durationMs ?? 0;

  // Get breakdown by operation type
  const operationGroups = await db.aIProcessingLog.groupBy({
    by: ["operation"],
    where,
    _count: true,
  });

  const operationsByType = operationGroups
    .sort((a, b) => b._count - a._count)
    .map((g) => ({
      operation: g.operation,
      label: OPERATION_LABELS[g.operation] ?? g.operation,
      count: g._count,
    }));

  // Get breakdown by status
  const statusGroups = await db.aIProcessingLog.groupBy({
    by: ["status"],
    where,
    _count: true,
  });

  const operationsByStatus = statusGroups
    .sort((a, b) => b._count - a._count)
    .map((g) => ({
      status: g.status,
      label: STATUS_LABELS[g.status] ?? g.status,
      count: g._count,
    }));

  // Get available sources for filter dropdown
  const sources = await db.source.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return {
    entries,
    summary: {
      totalOperations: totalOps,
      successRate:
        totalOps > 0
          ? Math.round((completedCount / totalOps) * 100)
          : 0,
      failedCount,
      completedCount,
      avgDurationMs,
      avgDurationLabel: formatDuration(avgDurationMs),
      operationsByType,
      operationsByStatus,
    },
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    availableSources: sources.map((s) => ({ id: s.id, title: s.title })),
  };
}

// ---------------------------------------------------------------------------
// Quick stats for dashboard widget
// ---------------------------------------------------------------------------

export async function getAuditQuickStats(): Promise<{
  totalToday: number;
  failedToday: number;
  avgDurationMs: number;
}> {
  await requireStudioAccess();

  const today = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalToday, failedToday, avgDuration] = await Promise.all([
    db.aIProcessingLog.count({ where: { createdAt: { gte: today } } }),
    db.aIProcessingLog.count({
      where: { createdAt: { gte: today }, status: "failed" },
    }),
    db.aIProcessingLog.aggregate({
      _avg: { durationMs: true },
      where: { createdAt: { gte: today } },
    }),
  ]);

  return {
    totalToday,
    failedToday,
    avgDurationMs: avgDuration._avg.durationMs ?? 0,
  };
}
