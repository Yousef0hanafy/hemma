"use client";

// =====================================================================
// Studio Import AI Status Polling Component
// =====================================================================

import { useState, useEffect } from "react";
import {
  BrainCircuit,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getImportProcessingStatus } from "@/server/actions/studio-processing";
import type { ImportProcessingStatus } from "@/server/actions/studio-processing";

const OPERATION_ICONS: Record<string, React.ReactNode> = {
  quality_check: <BrainCircuit className="h-4 w-4" />,
  estimate_difficulty: <Gauge className="h-4 w-4" />,
  generate_explanation: <Sparkles className="h-4 w-4" />,
};

const STATUS_META: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string }
> = {
  disabled: { icon: <Clock className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground", text: "معطل" },
  queued: { icon: <Clock className="h-3.5 w-3.5" />, bg: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300", text: "قيد الانتظار" },
  processing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", text: "قيد المعالجة..." },
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", text: "مكتمل" },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", text: "فشل" },
};

export function ImportAiStatus({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<ImportProcessingStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const result = await getImportProcessingStatus(sourceId);
        if (mounted) setStatus(result);

        const allDone = Object.values(result).every(
          (op) => op.status === "completed" || op.status === "failed" || op.status === "disabled"
        );
        if (!allDone) {
          timeoutId = setTimeout(poll, 3000);
        }
      } catch {
        if (mounted) timeoutId = setTimeout(poll, 5000);
      }
    };

    poll();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [sourceId]);

  if (!status) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-500" />
            معالجة الذكاء الاصطناعي اللاحقة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري فحص وتدقيق الجودة...
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledOps = Object.entries(status).filter(([, op]) => op.enabled);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-violet-500" />
          معالجة الذكاء الاصطناعي اللاحقة
          {enabledOps.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal">
              ({enabledOps.filter(([, op]) => op.status === "completed").length}/
              {enabledOps.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {enabledOps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            جميع عمليات المعالجة التلقائية معطلة في إعدادات الاستوديو.
          </p>
        ) : (
          <div className="space-y-2">
            {enabledOps.map(([key, op]) => {
              const meta = STATUS_META[op.status] ?? STATUS_META.queued;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground shrink-0">
                      {OPERATION_ICONS[key]}
                    </span>
                    <span className="text-xs font-medium">{op.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {op.summary && op.status === "completed" && (
                      <span className="text-[10px] text-muted-foreground">
                        {op.summary}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        meta.bg
                      )}
                    >
                      {meta.icon}
                      {meta.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
