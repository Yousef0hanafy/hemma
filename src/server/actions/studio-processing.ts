"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// Import processing status (live polling for the success page)
// ---------------------------------------------------------------------------

export interface ImportProcessingStatus {
  quality_check: { enabled: boolean; status: string; label: string; summary?: string };
  estimate_difficulty: { enabled: boolean; status: string; label: string; summary?: string };
  generate_explanation: { enabled: boolean; status: string; label: string; summary?: string };
}

export async function getImportProcessingStatus(
  sourceId: string
): Promise<ImportProcessingStatus> {
  // Check which settings are enabled
  const settings = await db.studioSetting.findMany({
    where: {
      key: {
        in: [
          "auto_process_on_import",
          "auto_estimate_difficulty_on_import",
          "auto_generate_explanations_on_import",
        ],
      },
    },
  });

  const enabledMap = new Map(settings.map((s) => [s.key, s.value === "true"]));

  // Get latest log per operation
  const logs = await db.aIProcessingLog.findMany({
    where: {
      sourceId,
      operation: {
        in: ["quality_check", "estimate_difficulty", "generate_explanation"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestLog = new Map<string, (typeof logs)[0]>();
  for (const log of logs) {
    if (!latestLog.has(log.operation)) {
      latestLog.set(log.operation, log);
    }
  }

  function buildStatus(
    operation: string,
    label: string
  ): { enabled: boolean; status: string; label: string; summary?: string } {
    const enabled =
      enabledMap.get(
        operation === "quality_check"
          ? "auto_process_on_import"
          : operation === "estimate_difficulty"
            ? "auto_estimate_difficulty_on_import"
            : "auto_generate_explanations_on_import"
      ) ?? false;

    if (!enabled) {
      return { enabled: false, status: "disabled", label };
    }

    const log = latestLog.get(operation);
    if (!log) {
      return { enabled: true, status: "queued", label };
    }

    if (log.status === "processing") {
      return { enabled: true, status: "processing", label };
    }

    if (log.status === "completed") {
      let summary: string | undefined;
      try {
        if (log.result) {
          const r = JSON.parse(log.result);
          if (operation === "quality_check") {
            summary = `${r.completed ?? "?"}/${r.total ?? "?"}`;
          } else if (operation === "estimate_difficulty") {
            summary = `${r.updated ?? 0} تم التحديث`;
          } else if (operation === "generate_explanation") {
            const parts: string[] = [];
            if (r.generated) parts.push(`${r.generated} تم التوليد`);
            if (r.skipped) parts.push(`${r.skipped} تخطي`);
            if (r.failed) parts.push(`${r.failed} فشل`);
            summary = parts.join("، ");
          }
        }
      } catch {}
      return { enabled: true, status: "completed", label, summary };
    }

    if (log.status === "failed") {
      return { enabled: true, status: "failed", label, summary: log.error ?? undefined };
    }

    return { enabled: true, status: log.status, label };
  }

  return {
    quality_check: buildStatus("quality_check", "فحص الجودة"),
    estimate_difficulty: buildStatus("estimate_difficulty", "تقدير الصعوبة"),
    generate_explanation: buildStatus("generate_explanation", "توليد الشروحات"),
  };
}

// ---------------------------------------------------------------------------
// Processing history for a source (for the Sources page detail panel)
// ---------------------------------------------------------------------------

export interface ProcessingHistoryItem {
  id: string;
  operation: string;
  operationLabel: string;
  status: string;
  statusLabel: string;
  summary: string | null;
  durationMs: number | null;
  durationLabel: string;
  createdAt: string;
}

export async function getSourceProcessingHistory(
  sourceId: string
): Promise<ProcessingHistoryItem[]> {
  await requireStudioAccess();

  const logs = await db.aIProcessingLog.findMany({
    where: {
      sourceId,
      questionId: null, // Only source-level summary logs
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const OPERATION_LABELS: Record<string, string> = {
    quality_check: "فحص الجودة",
    estimate_difficulty: "تقدير الصعوبة",
    generate_explanation: "توليد الشروحات",
  };

  const STATUS_LABELS: Record<string, string> = {
    processing: "قيد المعالجة",
    completed: "مكتمل",
    failed: "فشل",
  };

  return logs.map((log) => {
    let summary: string | null = null;
    if (log.result) {
      try {
        const r = JSON.parse(log.result);
        if (log.operation === "quality_check") {
          summary = `${r.completed ?? "?"}/${r.total ?? "?"}`;
        } else if (log.operation === "estimate_difficulty") {
          summary = `${r.updated ?? 0} تحديث`;
        } else if (log.operation === "generate_explanation") {
          const parts: string[] = [];
          if (r.generated) parts.push(`${r.generated} توليد`);
          if (r.skipped) parts.push(`${r.skipped} تخطي`);
          if (r.failed) parts.push(`${r.failed} فشل`);
          summary = parts.join("، ");
        }
      } catch {}
    }

    return {
      id: log.id,
      operation: log.operation,
      operationLabel: OPERATION_LABELS[log.operation] ?? log.operation,
      status: log.status,
      statusLabel: STATUS_LABELS[log.status] ?? log.status,
      summary,
      durationMs: log.durationMs,
      durationLabel:
        log.durationMs != null
          ? log.durationMs < 1000
            ? `${log.durationMs}ms`
            : `${(log.durationMs / 1000).toFixed(1)}s`
          : "—",
      createdAt: log.createdAt.toISOString(),
    };
  });
}
