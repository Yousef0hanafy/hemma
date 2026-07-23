"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAIStatus,
  getAIHistory,
  triggerBatchProcessing,
  triggerSourceProcessing,
  getSourcesWithAIStatus,
} from "@/server/actions/studio-ai";
import type {
  AIProcessingSummaryDTO,
  AIHistoryItem,
  SourceAIStatus,
} from "@/server/actions/studio-ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { relativeTimeAr } from "@/lib/content/ui-helpers";
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
  Gauge,
  Database,
  Clock,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPercent(value: number): string {
  return `${value}%`;
}

function qualityColor(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-600";
  if (score >= 80) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  if (score >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300";
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            color
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Operation status badge
// ---------------------------------------------------------------------------

function OperationBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    processing: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    failed: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="h-3 w-3" />,
    processing: <Loader2 className="h-3 w-3 animate-spin" />,
    failed: <XCircle className="h-3 w-3" />,
    pending: <Clock className="h-3 w-3" />,
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium gap-1 px-1.5 py-0.5",
        colors[status] ?? ""
      )}
    >
      {icons[status] ?? null}
      {status === "completed"
        ? "مكتمل"
        : status === "processing"
          ? "قيد المعالجة"
          : status === "failed"
            ? "فشل"
            : status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StudioAIClient() {
  const queryClient = useQueryClient();

  // ── Queries ───────────────────────────────────────────────────

  const statusQ = useQuery({
    queryKey: ["ai-status"],
    queryFn: getAIStatus,
    refetchInterval: 15_000,
  });

  const historyQ = useQuery({
    queryKey: ["ai-history"],
    queryFn: getAIHistory,
    refetchInterval: 15_000,
  });

  const sourcesQ = useQuery({
    queryKey: ["ai-sources"],
    queryFn: getSourcesWithAIStatus,
  });

  const status = statusQ.data;
  const history = historyQ.data ?? [];
  const sources = sourcesQ.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────

  const [selectedSourceId, setSelectedSourceId] = useState<string>("");

  const batchMutation = useMutation({
    mutationFn: triggerBatchProcessing,
    onSuccess: (data) => {
      toast.success(
        `تمت معالجة ${data.completed} سؤال${
          data.failed > 0 ? ` (فشل ${data.failed})` : ""
        }`
      );
      queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
      queryClient.invalidateQueries({ queryKey: ["ai-sources"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sourceMutation = useMutation({
    mutationFn: (sourceId: string) => triggerSourceProcessing(sourceId),
    onSuccess: (data) => {
      toast.success(
        `تمت معالجة ${data.completed} سؤال في المصدر${
          data.failed > 0 ? ` (فشل ${data.failed})` : ""
        }`
      );
      queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
      queryClient.invalidateQueries({ queryKey: ["ai-sources"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ── Loading state ─────────────────────────────────────────────

  if (statusQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────

  if (statusQ.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل البيانات</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(statusQ.error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              statusQ.refetch();
              historyQ.refetch();
              sourcesQ.refetch();
            }}
          >
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Main view ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">معالجة الذكاء الاصطناعي</h1>
          <p className="text-muted-foreground text-sm mt-1">
            فحص جودة المحتوى ومعالجته تلقائياً
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              statusQ.refetch();
              historyQ.refetch();
              sourcesQ.refetch();
            }}
            disabled={
              statusQ.isFetching ||
              historyQ.isFetching ||
              sourcesQ.isFetching
            }
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 ml-2",
                (statusQ.isFetching || historyQ.isFetching) &&
                  "animate-spin"
              )}
            />
            تحديث
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<BrainCircuit className="h-4 w-4 text-violet-500" />}
          label="تمت المعالجة"
          value={status?.processed ?? 0}
          color="bg-violet-50 dark:bg-violet-950"
          subtitle={
            status
              ? `${status.percentProcessed}% من الإجمالي`
              : undefined
          }
        />
        <StatCard
          icon={<Database className="h-4 w-4 text-amber-500" />}
          label="بالمعالجة"
          value={status?.unprocessed ?? 0}
          color="bg-amber-50 dark:bg-amber-950"
          subtitle={status && status.unprocessed > 0 ? "بحاجة للمعالجة" : undefined}
        />
        <StatCard
          icon={<Gauge className="h-4 w-4 text-emerald-500" />}
          label="متوسط الجودة"
          value={
            status?.averageQuality !== null
              ? formatPercent(Math.round(status.averageQuality! * 100))
              : "—"
          }
          color="bg-emerald-50 dark:bg-emerald-950"
          subtitle={
            status?.averageQuality !== null
              ? status.averageQuality >= 0.8
                ? "ممتاز"
                : status.averageQuality >= 0.5
                  ? "جيد"
                  : "بحاجة تحسين"
              : undefined
          }
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          label="جودة منخفضة"
          value={status?.lowQuality ?? 0}
          color="bg-rose-50 dark:bg-rose-950"
          subtitle={
            status && status.lowQuality > 0
              ? "بحاجة مراجعة"
              : undefined
          }
        />
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-500" />
            تشغيل المعالجة
          </CardTitle>
          <CardDescription>
            معالجة الأسئلة لفحص الجودة وحساب الدرجات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Batch all */}
            <Button
              onClick={() => batchMutation.mutate()}
              disabled={
                batchMutation.isPending ||
                (status?.unprocessed ?? 0) === 0
              }
              className="gap-2"
            >
              {batchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              معالجة الكل ({status?.unprocessed ?? 0} سؤال)
            </Button>

            {/* Source picker */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedSourceId}
                onValueChange={setSelectedSourceId}
              >
                <SelectTrigger className="w-48 h-9 text-xs">
                  <SelectValue placeholder="اختر مصدراً..." />
                </SelectTrigger>
                <SelectContent>
                  {sources
                    .filter((s) => s.totalQuestions > 0)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.title} ({s.totalQuestions})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedSourceId) sourceMutation.mutate(selectedSourceId);
                }}
                disabled={
                  !selectedSourceId || sourceMutation.isPending
                }
              >
                {sourceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-1" />
                ) : (
                  <Play className="h-4 w-4 ml-1" />
                )}
                معالجة المصدر
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-500" />
            حالة المصادر
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {sources.filter((s) => s.processedQuestions === s.totalQuestions)
              .length}{" "}
            / {sources.length} مكتمل
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {sources.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              لا توجد مصادر بعد
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">المصدر</TableHead>
                  <TableHead className="text-xs">الأسئلة</TableHead>
                  <TableHead className="text-xs">تمت المعالجة</TableHead>
                  <TableHead className="text-xs">متوسط الجودة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => {
                  const progress =
                    s.totalQuestions > 0
                      ? Math.round(
                          (s.processedQuestions / s.totalQuestions) * 100
                        )
                      : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="py-2 text-sm">
                        {s.title}
                      </TableCell>
                      <TableCell className="py-2 tabular-nums text-xs">
                        {s.totalQuestions}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                progress === 100
                                  ? "bg-emerald-400"
                                  : progress > 0
                                    ? "bg-amber-400"
                                    : "bg-slate-200"
                              )}
                              style={{ width: `${Math.max(progress, 2)}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {s.processedQuestions}/{s.totalQuestions}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {s.averageQuality !== null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              qualityColor(s.averageQuality)
                            )}
                          >
                            {Math.round(s.averageQuality * 100)}%
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-500" />
            سجل المعالجة
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {history.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لا توجد عمليات معالجة سابقة
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <OperationBadge status={h.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {h.operationLabel}
                      </span>
                      {h.sourceTitle && (
                        <span className="text-muted-foreground truncate text-xs">
                          — {h.sourceTitle}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {h.summary && <span>{h.summary}</span>}
                      {h.durationLabel && h.durationLabel !== "—" && (
                        <>
                          <span>·</span>
                          <span>{h.durationLabel}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{relativeTimeAr(h.createdAt)}</span>
                    </div>
                  </div>
                  {h.error && (
                    <div className="shrink-0" title={h.error}>
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
