"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAuditTrail,
  getAuditQuickStats,
} from "@/server/actions/studio-audit";
import type { AuditFilter, AuditLogEntry } from "@/server/actions/studio-audit";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { relativeTimeAr } from "@/lib/content/ui-helpers";
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Gauge,
  Sparkles,
  Clock,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  Timer,
  AlertCircle,
} from "lucide-react";
import { Fragment } from "react";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPERATION_META: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  quality_check: {
    icon: <BrainCircuit className="h-3.5 w-3.5" />,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  estimate_difficulty: {
    icon: <Gauge className="h-3.5 w-3.5" />,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  generate_explanation: {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
  categorize: {
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

const STATUS_META: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  processing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
  pending: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  trend?: { direction: "up" | "down"; text: string };
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
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-[10px] flex items-center gap-0.5",
                trend.direction === "up"
                  ? "text-emerald-500"
                  : "text-rose-500"
              )}
            >
              {trend.text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Operation badge
// ---------------------------------------------------------------------------

function OperationBadge({ operation }: { operation: string }) {
  const meta = OPERATION_META[operation] ?? {
    icon: <Activity className="h-3.5 w-3.5" />,
    color: "bg-slate-100 text-slate-600",
  };
  const label =
    operation === "quality_check"
      ? "فحص الجودة"
      : operation === "estimate_difficulty"
        ? "تقدير الصعوبة"
        : operation === "generate_explanation"
          ? "توليد الشروحات"
          : operation === "categorize"
            ? "تصنيف"
            : operation;

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium gap-1 px-1.5 py-0.5", meta.color)}
    >
      {meta.icon}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "bg-slate-100 text-slate-600",
  };
  const label =
    status === "completed"
      ? "مكتمل"
      : status === "processing"
        ? "قيد المعالجة"
        : status === "pending"
          ? "قيد الانتظار"
          : status === "failed"
            ? "فشل"
            : status;

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium gap-1 px-1.5 py-0.5", meta.color)}
    >
      {meta.icon}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Expanded row detail
// ---------------------------------------------------------------------------

function FormattedQualityResult({ data }: { data: any }) {
  const overall = typeof data.overall === "number" ? data.overall : null;
  const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
  const issues = Array.isArray(data.issues) ? data.issues : [];
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  return (
    <div className="space-y-3">
      {/* Overall Score */}
      {overall !== null && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border">
          <div className="space-y-0.5">
            <span className="font-semibold text-xs">الدرجة الإجمالية للجودة</span>
            <p className="text-[10px] text-muted-foreground">
              {overall >= 0.8
                ? "جودة ممتازة متوافقة مع المعايير"
                : overall >= 0.5
                ? "جودة مقبولة مع بعض الملاحظات"
                : "تحتاج إلى مراجعة وتعديل"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-bold text-xs px-2.5 py-1",
              overall >= 0.8
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300"
                : overall >= 0.5
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300"
            )}
          >
            {Math.round(overall * 100)}%
          </Badge>
        </div>
      )}

      {/* Dimensions Bars */}
      {dimensions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {dimensions.map((dim: any, i: number) => {
            const score = typeof dim.score === "number" ? dim.score : 0;
            const pct = Math.round(score * 100);
            return (
              <div key={i} className="p-2 rounded-lg bg-background/80 border space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-medium text-foreground">{dim.label || dim.name}</span>
                  <span className="font-bold tabular-nums text-muted-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-semibold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            الملاحظات المستخرجة ({issues.length}):
          </p>
          <div className="space-y-1">
            {issues.map((iss: any, i: number) => (
              <div
                key={i}
                className="p-2 rounded-md bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-1.5"
              >
                <span className="font-bold text-[10px] bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded shrink-0">
                  {iss.field || "عام"}
                </span>
                <span>{iss.message || JSON.stringify(iss)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-semibold text-xs text-primary flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            التوصيات:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground pr-1">
            {suggestions.map((sug: any, i: number) => (
              <li key={i}>{typeof sug === "string" ? sug : JSON.stringify(sug)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FormattedResult({ result, operation }: { result: any; operation: string }) {
  const [showRaw, setShowRaw] = useState(false);

  if (typeof result !== "object" || result === null) {
    return <div className="text-xs text-muted-foreground">{String(result)}</div>;
  }

  // Quality check custom view
  if (operation === "quality_check" || result.overall !== undefined || result.dimensions) {
    return (
      <div className="space-y-2">
        <FormattedQualityResult data={result} />
        <div className="pt-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {showRaw ? "إخفاء التفاصيل البرمجية الخام" : "عرض التفاصيل البرمجية الخام (JSON)"}
          </button>
          {showRaw && (
            <pre className="mt-1.5 bg-background rounded border p-2 font-mono text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto" dir="ltr">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Difficulty estimation view
  if (operation === "estimate_difficulty" || result.difficulty) {
    const diffMap: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border text-xs">
          <span className="font-semibold">الصعوبة المقدرة:</span>
          <Badge variant="outline" className="font-bold">
            {diffMap[result.difficulty] || result.difficulty}
          </Badge>
          {result.confidence && (
            <span className="text-muted-foreground mr-auto text-[11px]">
              نسبة الثقة: {Math.round(result.confidence * 100)}%
            </span>
          )}
        </div>
        {result.reasoning && (
          <div className="p-2.5 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
            {result.reasoning}
          </div>
        )}
      </div>
    );
  }

  // Explanation view
  if (operation === "generate_explanation" || result.explanation) {
    return (
      <div className="space-y-2">
        {result.explanation && (
          <div className="p-2.5 rounded-lg bg-background border text-xs space-y-1">
            <span className="font-semibold text-[11px] text-muted-foreground">الشرح المولد:</span>
            <p className="leading-relaxed text-foreground">{result.explanation}</p>
          </div>
        )}
        {result.studyTip && (
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
            <span className="font-semibold text-[11px] text-primary">فائدة دراسية:</span>
            <p className="leading-relaxed text-foreground">{result.studyTip}</p>
          </div>
        )}
      </div>
    );
  }

  // Generic object summary
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(result).map(([k, v]) => (
          <div key={k} className="p-2 rounded-lg bg-background border text-xs">
            <span className="text-[10px] text-muted-foreground block truncate">{k}</span>
            <span className="font-semibold text-foreground truncate block">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandedRowDetail({ entry }: { entry: any }) {
  const hasResult = entry.result;
  const hasError = entry.error;
  const hasDuration = entry.durationMs !== null;

  let parsedResult: Record<string, unknown> | null = null;
  if (hasResult) {
    try {
      parsedResult = JSON.parse(entry.result!);
    } catch {}
  }

  return (
    <div className="p-4 bg-muted/30 rounded-xl space-y-3 text-xs border border-border/50">
      {/* Metadata row */}
      <div className="flex flex-wrap gap-4 text-muted-foreground text-xs pb-1 border-b border-border/40">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {relativeTimeAr(entry.createdAt)}
        </span>
        {hasDuration && (
          <span className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-amber-500" />
            المدة: {entry.durationLabel}
          </span>
        )}
        {entry.sourceTitle && (
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            المصدر: {entry.sourceTitle}
          </span>
        )}
        {entry.questionId && (
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            معرف السؤال: {entry.questionId}
          </span>
        )}
      </div>

      {/* Result details */}
      {parsedResult && (
        <FormattedResult result={parsedResult} operation={entry.operation} />
      )}

      {/* Error */}
      {hasError && (
        <div className="space-y-1.5">
          <p className="font-semibold text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            تفاصيل الخطأ:
          </p>
          <div className="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 p-3 text-xs leading-relaxed">
            {entry.error}
          </div>
        </div>
      )}

      {/* Raw result if not parsed */}
      {hasResult && !parsedResult && (
        <div className="p-3 bg-background rounded-lg border text-xs leading-relaxed">
          {entry.result}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Options for filter dropdowns
// ---------------------------------------------------------------------------

const OPERATION_OPTIONS = [
  { value: "", label: "جميع العمليات" },
  { value: "quality_check", label: "فحص الجودة" },
  { value: "estimate_difficulty", label: "تقدير الصعوبة" },
  { value: "generate_explanation", label: "توليد الشروحات" },
  { value: "categorize", label: "تصنيف" },
];

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "completed", label: "مكتمل" },
  { value: "processing", label: "قيد المعالجة" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "failed", label: "فشل" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "كل الوقت" },
  { value: "24h", label: "آخر 24 ساعة" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يوم" },
];

const PAGE_SIZE = 25;

export function StudioAuditClient() {
  // ── Filters ──────────────────────────────────────────────────
  const [operation, setOperation] = useState("");
  const [status, setStatus] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filter: AuditFilter = {
    operation: operation || undefined,
    status: status || undefined,
    sourceId: !sourceId || sourceId === "__all__" ? undefined : sourceId,
    search: search || undefined,
    dateRange: dateRange as AuditFilter["dateRange"],
    page,
    pageSize: PAGE_SIZE,
  };

  // ── Queries ──────────────────────────────────────────────────
  const auditQ = useQuery({
    queryKey: ["audit-trail", filter],
    queryFn: () => getAuditTrail(filter),
    refetchInterval: 30_000,
  });

  const quickStatsQ = useQuery({
    queryKey: ["audit-quick-stats"],
    queryFn: getAuditQuickStats,
    refetchInterval: 60_000,
  });

  const data = auditQ.data;
  const entries = data?.entries ?? [];
  const summary = data?.summary;
  const quickStats = quickStatsQ.data;

  // ── Handlers ─────────────────────────────────────────────────
  const handleResetFilters = useCallback(() => {
    setOperation("");
    setStatus("");
    setSourceId("");
    setDateRange("all");
    setSearch("");
    setPage(1);
    setExpandedId(null);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const hasActiveFilters =
    !!operation || !!status || !!sourceId || !!search || dateRange !== "all";

  // ── Loading state ────────────────────────────────────────────
  if (auditQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (auditQ.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل سجل المعالجة</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(auditQ.error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => auditQ.refetch()}
          >
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ──────────────────────────────────────────────
  if (entries.length === 0 && !hasActiveFilters) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">سجل المعالجة</h1>
            <p className="text-muted-foreground text-sm mt-1">
              سجل جميع عمليات الذكاء الاصطناعي على المحتوى
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditQ.refetch()}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 me-2",
                auditQ.isFetching && "animate-spin"
              )}
            />
            تحديث
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BrainCircuit className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">لا توجد عمليات معالجة بعد</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              سيظهر هنا سجل جميع عمليات الذكاء الاصطناعي بعد تشغيل المعالجة
              على الأسئلة والمصادر
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">سجل المعالجة</h1>
          <p className="text-muted-foreground text-sm mt-1">
            سجل جميع عمليات الذكاء الاصطناعي على المحتوى
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              <XCircle className="h-4 w-4 me-1.5" />
              إلغاء الفلاتر
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditQ.refetch()}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 me-2",
                auditQ.isFetching && "animate-spin"
              )}
            />
            تحديث
          </Button>
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4 text-violet-500" />}
          label="إجمالي العمليات"
          value={summary?.totalOperations ?? 0}
          color="bg-violet-50 dark:bg-violet-950"
          trend={
            quickStats && quickStats.totalToday > 0
              ? {
                  direction: "up",
                  text: `${quickStats.totalToday} اليوم`,
                }
              : undefined
          }
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="نسبة النجاح"
          value={
            summary ? `${summary.successRate}%` : "—"
          }
          color="bg-emerald-50 dark:bg-emerald-950"
          trend={
            summary && summary.failedCount > 0
              ? {
                  direction: "down",
                  text: `${summary.failedCount} فشل`,
                }
              : undefined
          }
        />
        <StatCard
          icon={<Timer className="h-4 w-4 text-amber-500" />}
          label="متوسط المدة"
          value={summary?.avgDurationLabel ?? "—"}
          color="bg-amber-50 dark:bg-amber-950"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          label="فاشلة"
          value={
            quickStats && quickStats.failedToday > 0
              ? quickStats.failedToday
              : summary?.failedCount ?? 0
          }
          color="bg-rose-50 dark:bg-rose-950"
          trend={
            quickStats && quickStats.failedToday > 0
              ? {
                  direction: "up",
                  text: "في آخر 24 ساعة",
                }
              : undefined
          }
        />
      </div>

      {/* ── Breakdown chips ─────────────────────────────────── */}
      {summary &&
        (summary.operationsByType.length > 0 ||
          summary.operationsByStatus.length > 0) && (
          <div className="flex flex-wrap gap-4 text-xs">
            {summary.operationsByType.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground font-medium">
                  حسب النوع:
                </span>
                {summary.operationsByType.map((o: any) => (
                  <Badge
                    key={o.operation}
                    variant="secondary"
                    className="text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() =>
                      setOperation((prev) =>
                        prev === o.operation ? "" : o.operation
                      )
                    }
                  >
                    {OPERATION_META[o.operation]?.icon ?? null}
                    {o.label}
                    <span className="mr-1 font-bold tabular-nums">
                      {o.count}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
            {summary.operationsByStatus.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground font-medium">
                  حسب الحالة:
                </span>
                {summary.operationsByStatus.map((s: any) => (
                  <Badge
                    key={s.status}
                    variant="secondary"
                    className={cn(
                      "text-[10px] cursor-pointer hover:bg-secondary/80 transition-colors",
                      status === s.status && "ring-1 ring-primary/50"
                    )}
                    onClick={() =>
                      setStatus((prev) =>
                        prev === s.status ? "" : s.status
                      )
                    }
                  >
                    {STATUS_META[s.status]?.icon ?? null}
                    {s.label}
                    <span className="mr-1 font-bold tabular-nums">
                      {s.count}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

      {/* ── Filters bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في السجل..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pr-8 h-9 text-sm"
          />
        </div>

        <Select
          value={operation}
          onValueChange={(v) => {
            setOperation(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="العمليات" />
          </SelectTrigger>
          <SelectContent>
            {OPERATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sourceId}
          onValueChange={(v) => {
            setSourceId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="المصدر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">
              جميع المصادر
            </SelectItem>
            {data?.availableSources.map((s: any) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={dateRange}
          onValueChange={(v) => {
            setDateRange(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue placeholder="المدة" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((d) => (
              <SelectItem key={d.value} value={d.value} className="text-xs">
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Results count ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {data && (
            <>
              إجمالي{" "}
              <span className="font-bold tabular-nums">{data.totalCount}</span>{" "}
              عملية
              {data.totalCount !== 1 ? "ات" : ""}
              {hasActiveFilters && (
                <>
                  {" — "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={handleResetFilters}
                  >
                    إلغاء الفلاتر
                  </Button>
                </>
              )}
            </>
          )}
        </p>
        {data && data.totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground px-1">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Audit table ──────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Filter className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-base font-medium">لا توجد نتائج للفلترة الحالية</p>
              <p className="text-sm text-muted-foreground mt-1">
                حاول تغيير معايير البحث أو إلغاء الفلاتر
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleResetFilters}
              >
                إلغاء الفلاتر
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%] text-xs">العملية</TableHead>
                  <TableHead className="w-[12%] text-xs">الحالة</TableHead>
                  <TableHead className="w-[22%] text-xs">المصدر</TableHead>
                  <TableHead className="w-[24%] text-xs">الملخص</TableHead>
                  <TableHead className="w-[10%] text-xs text-start">المدة</TableHead>
                  <TableHead className="w-[10%] text-xs text-start">التاريخ</TableHead>
                  <TableHead className="w-[4%] text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => {
                  const isExpanded = expandedId === entry.id;
                  const hasDetails =
                    entry.result || entry.error || entry.durationMs !== null;

                  return (
                    <Fragment key={entry.id}>
                      {/* 1. الصف الرئيسي للجدول */}
                      <TableRow
                        className={cn(
                          "group cursor-pointer transition-colors",
                          isExpanded && "bg-muted/40",
                          entry.status === "failed" && "border-r-2 border-r-rose-300"
                        )}
                        onClick={() => handleToggleExpand(entry.id)}
                      >
                        <TableCell className="w-[18%] py-2.5">
                          <OperationBadge operation={entry.operation} />
                        </TableCell>
                        <TableCell className="w-[12%] py-2.5">
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="w-[22%] py-2.5 text-xs text-muted-foreground truncate">
                          {entry.sourceTitle ?? (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="w-[24%] py-2.5 text-xs">
                          {entry.resultSummary ? (
                            <span className="text-muted-foreground truncate block font-medium">
                              {entry.resultSummary}
                            </span>
                          ) : entry.error ? (
                            <span className="text-rose-500 truncate block">
                              {entry.error.length > 60
                                ? entry.error.slice(0, 60) + "..."
                                : entry.error}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="w-[10%] py-2.5 text-xs tabular-nums text-muted-foreground text-start">
                          {entry.durationLabel}
                        </TableCell>
                        <TableCell className="w-[10%] py-2.5 text-xs text-muted-foreground text-start whitespace-nowrap">
                          {relativeTimeAr(entry.createdAt)}
                        </TableCell>
                        <TableCell className="w-[4%] py-2.5 text-end">
                          {hasDetails && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(entry.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* 2. صف التفاصيل الموسع يظهر مباشرة أسفل الصف الرئيسي */}
                      {isExpanded && hasDetails && (
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={100} className="p-4">
                            <ExpandedRowDetail entry={entry} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination footer ────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            عرض{" "}
            <span className="font-bold tabular-nums">
              {(page - 1) * PAGE_SIZE + 1}
            </span>
            {" — "}
            <span className="font-bold tabular-nums">
              {Math.min(page * PAGE_SIZE, data.totalCount)}
            </span>
            {" من "}
            <span className="font-bold tabular-nums">{data.totalCount}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              التالي
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
