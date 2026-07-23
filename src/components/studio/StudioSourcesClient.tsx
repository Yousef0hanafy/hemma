"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSources,
  getSourceDetail,
  deleteSource,
  exportSourceToJSON,
  updateSource,
  getSourcesProcessingStatus,
} from "@/server/actions/studio-sources";
import type {
  SourceListItem,
  SourceDetail,
  ProcessingFlags,
} from "@/server/actions/studio-sources";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  batchEstimateDifficultyForSource,
  triggerFullSourceProcessing,
  triggerFullSourceProcessingBatch,
} from "@/server/actions/studio-ai";
import { getSourceProcessingHistory } from "@/server/actions/studio-processing";
import type { ProcessingHistoryItem } from "@/server/actions/studio-processing";
import {
  FolderOpen,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  FileText,
  AlertTriangle,
  Loader2,
  Search,
  Calendar,
  Hash,
  BarChart3,
  Layers,
  Sparkles,
  BrainCircuit,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTimeAr } from "@/lib/content/ui-helpers";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  archived: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "مراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
  return d.toLocaleDateString("ar-SA");
}

function StatusBadge({ status, count }: { status: string; count?: number }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-normal px-1.5 py-0.5",
        STATUS_COLORS[status] ?? "bg-slate-50 text-slate-600 border-slate-200"
      )}
    >
      {STATUS_LABELS[status] ?? status}
      {count !== undefined && (
        <span className="mr-1 font-semibold">{count}</span>
      )}
    </Badge>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
    medium: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
    hard: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-normal", colors[difficulty] ?? "")}
    >
      {difficulty === "easy" ? "سهل" : difficulty === "medium" ? "متوسط" : "صعب"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Source Detail Panel (expanded row)
// ---------------------------------------------------------------------------

function SourceDetailPanel({
  sourceId,
  slug,
}: {
  sourceId: string;
  slug: string;
}) {
  const queryClient = useQueryClient();
  const [estimatingDifficulty, setEstimatingDifficulty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["source-detail", slug],
    queryFn: () => getSourceDetail(slug),
    enabled: !!slug,
  });

  const { data: processingHistory } = useQuery({
    queryKey: ["source-processing-history", sourceId],
    queryFn: () => getSourceProcessingHistory(sourceId),
    enabled: !!sourceId,
  });

  const handleBatchDifficulty = async () => {
    setEstimatingDifficulty(true);
    try {
      const result = await batchEstimateDifficultyForSource(sourceId);
      toast.success(
        `تقدير الصعوبة: ${result.updated} سؤال${
          result.failed > 0 ? ` (فشل ${result.failed})` : ""
        } من ${result.total}`
      );
      queryClient.invalidateQueries({ queryKey: ["source-detail", slug] });
    } catch (e) {
      toast.error("فشل تقدير الصعوبة: " + (e as Error).message);
    } finally {
      setEstimatingDifficulty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        تعذر تحميل التفاصيل
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الأسئلة</p>
          <p className="text-xl font-bold">{data.questionCount}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">المقاطع</p>
          <p className="text-xl font-bold">{data.passageCount}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">التصنيفات</p>
          <p className="text-xl font-bold">{data.categoryBreakdown.length}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">تاريخ الاستيراد</p>
          <p className="text-sm font-semibold">
            {new Date(data.importedAt).toLocaleDateString("ar-SA")}
          </p>
        </div>
      </div>

      {/* Status breakdown */}
      <div>
        <h4 className="text-sm font-medium mb-2">توزيع الحالات</h4>
        <div className="flex flex-wrap gap-2">
          {data.statusBreakdown.map((s) => (
            <StatusBadge key={s.status} status={s.status} count={s.count} />
          ))}
        </div>
      </div>

      {/* Difficulty breakdown */}
      {data.difficultyBreakdown.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">توزيع الصعوبة</h4>
            <button
              onClick={handleBatchDifficulty}
              disabled={estimatingDifficulty}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 transition-colors shrink-0"
              title="تقدير صعوبة جميع الأسئلة بالذكاء الاصطناعي"
            >
              {estimatingDifficulty ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {estimatingDifficulty
                ? "جارٍ التقدير..."
                : `تقدير AI للكل (${data.questionCount})`}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.difficultyBreakdown.map((d) => (
              <DifficultyBadge key={d.difficulty} difficulty={d.difficulty} />
            ))}
            <span className="text-xs text-muted-foreground self-center mr-2">
              (إجمالي: {data.difficultyBreakdown.reduce((a, b) => a + b.count, 0)})
            </span>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">التصنيفات</h4>
          <div className="space-y-1.5">
            {data.categoryBreakdown.slice(0, 8).map((c) => (
              <div
                key={c.nameAr}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{c.nameAr}</span>
                <span className="font-semibold tabular-nums">{c.count}</span>
              </div>
            ))}
            {data.categoryBreakdown.length > 8 && (
              <p className="text-xs text-muted-foreground">
                + {data.categoryBreakdown.length - 8} تصنيفات أخرى
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Processing History */}
      {processingHistory && processingHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-500" />
            سجل معالجة AI
          </h4>
          <div className="space-y-1">
            {processingHistory.map((h) => {
              const statusColors: Record<string, string> = {
                completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
                processing: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
              };
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <BrainCircuit className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{h.operationLabel}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{relativeTimeAr(h.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.summary && (
                      <span className="text-[10px] text-muted-foreground">
                        {h.summary}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        statusColors[h.status] ??
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {h.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline rename
// ---------------------------------------------------------------------------

function InlineRename({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (draft.trim() && draft !== value) {
      setSaving(true);
      try {
        await onSave(draft.trim());
        toast.success("تم تحديث العنوان");
      } catch {
        toast.error("فشل التحديث");
        setDraft(value);
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  }, [draft, value, onSave]);

  if (editing) {
    return (
      <div className="flex items-center gap-1" dir="ltr">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 text-sm w-56"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          dir="rtl"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-medium truncate max-w-[220px]">{value}</span>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete dialog
// ---------------------------------------------------------------------------

function DeleteSourceDialog({
  source,
  onDelete,
}: {
  source: SourceListItem;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      await deleteSource(source.id);
      toast.success(`تم حذف المصدر "${source.title}"`);
      onDelete(source.id);
      setOpen(false);
    } catch {
      toast.error("فشل حذف المصدر");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف المصدر</DialogTitle>
          <DialogDescription>
            هل أنت متأكد من حذف المصدر &quot;{source.title}&quot;؟
            <br />
            <span className="text-rose-500 font-medium">
              سيتم حذف {source.questionCount} سؤالاً و{source.passageCount}{" "}
              مقطعاً مرتبطاً بهذا المصدر نهائياً.
            </span>
            <br />
            لا يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري الحذف...
              </>
            ) : (
              "حذف نهائي"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Export dialog
// ---------------------------------------------------------------------------

function ExportSourceDialog({ sourceId }: { sourceId: string }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ json: string; filename: string } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportSourceToJSON(sourceId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setResult(res);
      }
    } catch {
      toast.error("فشل تصدير المصدر");
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تحميل الملف");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          <Download className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تصدير المصدر</DialogTitle>
          <DialogDescription>
            تصدير جميع الأسئلة في هذا المصدر كملف JSON.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">تم التصدير بنجاح</p>
              <p className="text-muted-foreground text-xs">
                اسم الملف: {result.filename}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                إغلاق
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 ml-2" />
                تحميل الملف
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                "تصدير"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Source Row
// ---------------------------------------------------------------------------

function SourceRow({
  source,
  expanded,
  onToggle,
  onDeleted,
  processingFlags,
  selected,
  onSelect,
}: {
  source: SourceListItem;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: (id: string) => void;
  processingFlags?: ProcessingFlags | null;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [aiProcessing, setAiProcessing] = useState(false);

  const handleRunAllAI = useCallback(async () => {
    setAiProcessing(true);
    try {
      const result = await triggerFullSourceProcessing(source.id);
      const parts: string[] = [];
      if (result.quality)
        parts.push(`جودة: ${result.quality.completed}/${result.quality.total}`);
      if (result.difficulty)
        parts.push(`صعوبة: ${result.difficulty.updated} تحديث`);
      if (result.explanations)
        parts.push(
          `شروحات: ${result.explanations.generated} توليد, ${result.explanations.skipped} تخطي`
        );
      toast.success(`اكتملت المعالجة: ${parts.join(" | ")}`);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    } catch (e) {
      toast.error("فشلت المعالجة: " + (e as Error).message);
    } finally {
      setAiProcessing(false);
    }
  }, [source.id, queryClient]);

  const handleRename = async (title: string) => {
    await updateSource(source.id, { title });
    queryClient.invalidateQueries({ queryKey: ["sources"] });
  };

  // Stats for the mini bar chart
  const totalStatus =
    source.statusBreakdown.reduce((a, b) => a + b.count, 0) ||
    source.questionCount;
  const maxStatus = Math.max(
    ...source.statusBreakdown.map((s) => s.count),
    1
  );

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/50",
          expanded && "bg-muted/30 border-b-0"
        )}
        onClick={onToggle}
      >
        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={(v) => onSelect?.(v === true)}
              className="shrink-0 mr-0.5"
            />
            <div className="text-muted-foreground transition-transform duration-200">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <FolderOpen className="h-4 w-4 text-amber-500" />
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <InlineRename value={source.title} onSave={handleRename} />
            </div>
            {processingFlags && (
              <div className="flex items-center gap-0.5 mr-1">
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full transition-colors",
                    processingFlags.qualityDone
                      ? "bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                  title={
                    processingFlags.qualityDone
                      ? "تم فحص الجودة"
                      : "لم يتم فحص الجودة"
                  }
                />
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full transition-colors",
                    processingFlags.difficultyDone
                      ? "bg-violet-400"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                  title={
                    processingFlags.difficultyDone
                      ? "تم تقدير الصعوبة"
                      : "لم يتم تقدير الصعوبة"
                  }
                />
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full transition-colors",
                    processingFlags.explanationsDone
                      ? "bg-sky-400"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                  title={
                    processingFlags.explanationsDone
                      ? "تم توليد الشروحات"
                      : "لم يتم توليد الشروحات"
                  }
                />
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="py-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(source.importedAt)}</span>
          </div>
        </TableCell>
        <TableCell className="py-3">
          <div className="flex items-center gap-1.5 text-sm">
            <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold tabular-nums">
              {source.questionCount}
            </span>
          </div>
          {source.passageCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <FileText className="h-3 w-3 shrink-0" />
              <span>{source.passageCount} مقاطع</span>
            </div>
          )}
        </TableCell>
        <TableCell className="py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-0.5 h-5 items-end">
              {source.statusBreakdown.map((s) => {
                const pct =
                  totalStatus > 0
                    ? Math.max((s.count / maxStatus) * 100, 8)
                    : 0;
                const barColor = STATUS_COLORS[s.status]
                  ?.match(/text-(\w+)-/)
                  ?.at(1);
                return (
                  <div
                    key={s.status}
                    className="relative group/bar flex-1"
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  >
                    <div
                      className={cn(
                        "absolute bottom-0 inset-x-0 rounded-t transition-all duration-300",
                        barColor === "emerald"
                          ? "bg-emerald-400 dark:bg-emerald-600"
                          : barColor === "amber"
                            ? "bg-amber-400 dark:bg-amber-600"
                            : barColor === "rose"
                              ? "bg-rose-400 dark:bg-rose-600"
                              : "bg-slate-300 dark:bg-slate-600"
                      )}
                      style={{ height: `${pct}%` }}
                    />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10">
                      {STATUS_LABELS[s.status]}: {s.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TableCell>
        <TableCell className="py-3 text-left">
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleRunAllAI}
              disabled={aiProcessing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 transition-colors shrink-0"
              title="تشغيل جميع عمليات AI (فحص الجودة + تقدير الصعوبة + توليد الشروحات)"
            >
              {aiProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BrainCircuit className="h-3.5 w-3.5" />
              )}
              {aiProcessing ? "جاري..." : "AI"}
            </button>
            <ExportSourceDialog sourceId={source.id} />
            <DeleteSourceDialog source={source} onDelete={onDeleted} />
          </div>
        </TableCell>
      </TableRow>
      <AnimatePresence initial={false}>
        {expanded && (
          <TableRow>
            <TableCell
              colSpan={6}
              className="p-0 border-b"
            >
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/50">
                  <SourceDetailPanel
                    sourceId={source.id}
                    slug={source.slug}
                  />
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StudioSourcesClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });

  const { data: processingStatus } = useQuery({
    queryKey: ["sources-processing-status"],
    queryFn: getSourcesProcessingStatus,
    refetchInterval: 30_000,
  });

  const filtered = data
    ? searchQuery.trim()
      ? data.filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.slug.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : data
    : [];

  const allIds = filtered.map((s) => s.id);
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(allIds));
      else setSelectedIds(new Set());
    },
    [allIds]
  );

  const handleBatchRunAI = useCallback(async () => {
    const sourceIds = Array.from(selectedIds);
    if (sourceIds.length === 0) return;
    setBatchProcessing(true);
    try {
      const result = await triggerFullSourceProcessingBatch(sourceIds);
      toast.success(
        `تمت معالجة ${result.processed} مصادر من ${sourceIds.length}`
      );
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["sources-processing-status"] });
    } catch (e) {
      toast.error("فشلت المعالجة: " + (e as Error).message);
    } finally {
      setBatchProcessing(false);
    }
  }, [selectedIds, queryClient]);

  const handleDeleted = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      if (expandedId === id) setExpandedId(null);
    },
    [queryClient, expandedId]
  );

  // ── Loading state ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل المصادر</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["sources"] })}
          >
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ───────────────────────────────────────────────

  if (!filtered.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">المصادر</h1>
            <p className="text-muted-foreground text-sm mt-1">
              عرض وإدارة ملفات المصادر المستوردة
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium mb-1">
              {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد مصادر بعد"}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? "حاول تغيير كلمة البحث"
                : "المصادر تظهر تلقائياً بعد استيراد الأسئلة من مركز الاستيراد"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/studio/import")}
              >
                <UploadIcon className="h-4 w-4 ml-2" />
                الذهاب لمركز الاستيراد
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalQuestions = filtered.reduce((a, s) => a + s.questionCount, 0);

  // ── Main view ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصادر</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.length ?? 0} مصادر — {totalQuestions} سؤال
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <FolderOpen className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المصادر</p>
              <p className="text-lg font-bold tabular-nums">
                {data?.length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الأسئلة</p>
              <p className="text-lg font-bold tabular-nums">{totalQuestions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">متوسط الأسئلة</p>
              <p className="text-lg font-bold tabular-nums">
                {data?.length
                  ? Math.round(totalQuestions / data.length)
                  : 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">آخر استيراد</p>
              <p className="text-sm font-bold">
                {data?.length
                  ? formatDate(data[0].importedAt)
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                {selectedIds.size} مصدر{" "}
                {selectedIds.size !== 1 ? "محددة" : "محدد"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                disabled={batchProcessing}
                className="h-8 text-xs"
              >
                إلغاء التحديد
              </Button>
              <Button
                size="sm"
                onClick={handleBatchRunAI}
                disabled={batchProcessing}
                className="h-8 text-xs gap-1"
              >
                {batchProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BrainCircuit className="h-3.5 w-3.5" />
                )}
                {batchProcessing
                  ? "جاري المعالجة..."
                  : `تشغيل AI على ${selectedIds.size} مصادر`}
              </Button>
            </div>
          </div>
          {/* Status filter chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium shrink-0">
              تحديد حسب الحالة:
            </span>
            {(() => {
              const statusCounts = new Map<string, number>();
              for (const s of filtered) {
                for (const b of s.statusBreakdown) {
                  statusCounts.set(
                    b.status,
                    (statusCounts.get(b.status) ?? 0) + b.count
                  );
                }
              }
              return Array.from(statusCounts.entries()).map(
                ([status, count]) => (
                  <button
                    key={status}
                    onClick={() => {
                      const ids = filtered
                        .filter((s) =>
                          s.statusBreakdown.some((b) => b.status === status)
                        )
                        .map((s) => s.id);
                      setSelectedIds(new Set(ids));
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all hover:scale-105",
                      STATUS_COLORS[status] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {STATUS_LABELS[status] ?? status}
                    <span className="tabular-nums text-[10px]">
                      {count}
                    </span>
                  </button>
                )
              );
            })()}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث في المصادر..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-10"
          dir="rtl"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[4%]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => handleSelectAll(v === true)}
                  className={cn(allSelected && "text-primary")}
                />
              </TableHead>
              <TableHead className="w-[36%]">المصدر</TableHead>
              <TableHead className="w-[15%]">تاريخ الاستيراد</TableHead>
              <TableHead className="w-[12%]">الأسئلة</TableHead>
              <TableHead className="w-[25%]">توزيع الحالات</TableHead>
              <TableHead className="w-[8%] text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                expanded={expandedId === source.id}
                onToggle={() => handleToggle(source.id)}
                onDeleted={handleDeleted}
                processingFlags={processingStatus?.[source.id] ?? null}
                selected={selectedIds.has(source.id)}
                onSelect={(checked) => handleSelectOne(source.id, checked)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icon component for empty state
// ---------------------------------------------------------------------------

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="12" y2="12" />
      <line x1="15" y1="15" x2="12" y2="12" />
    </svg>
  );
}
