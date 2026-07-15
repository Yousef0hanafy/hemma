"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Clipboard,
  Download,
  Sparkles,
  ArrowLeft,
  BrainCircuit,
  Gauge,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toArabicDigits, relativeTimeAr } from "@/lib/content/ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  previewImport,
  confirmImport,
  getImportHistory,
} from "@/server/actions/studio-import";
import { getImportProcessingStatus } from "@/server/actions/studio-processing";
import type {
  ImportPreview,
  ImportPreviewQ,
  ImportResult,
} from "@/server/actions/studio-import";
import type { ImportProcessingStatus } from "@/server/actions/studio-processing";

// ---------------------------------------------------------------------------
// Difficulty badge helper
// ---------------------------------------------------------------------------

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

// ---------------------------------------------------------------------------
// Drop Zone
// ---------------------------------------------------------------------------

function DropZone({
  onFile,
  onText,
}: {
  onFile: (text: string, filename: string) => void;
  onText: (text: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        onFile(text, file.name);
      };
      reader.readAsText(file, "utf-8");
    },
    [onFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        onFile(text, file.name);
      };
      reader.readAsText(file, "utf-8");
    },
    [onFile]
  );

  const handlePasteSubmit = useCallback(() => {
    if (pastedText.trim()) onText(pastedText.trim());
  }, [pastedText, onText]);

  if (pasteMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">لصق نص JSON</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setPasteMode(false);
              setPastedText("");
            }}
          >
            <X className="h-3 w-3 ml-1" />
            إلغاء
          </Button>
        </div>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder='{"document_title": "...", "questions": [...]}'
          className="w-full h-48 rounded-xl border border-border bg-card p-4 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary/30"
          dir="ltr"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            يجب أن يكون النص بصيغة JSON صالحة
          </span>
          <Button
            size="sm"
            onClick={handlePasteSubmit}
            disabled={!pastedText.trim()}
          >
            <Clipboard className="h-3.5 w-3.5 ml-1" />
            معاينة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-all cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl transition-all",
            dragOver
              ? "bg-primary text-primary-foreground scale-110"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6 transition-transform",
              dragOver && "translate-y-[-2px]"
            )}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {dragOver ? "أفلت الملف هنا" : "اسحب وأفلت ملف JSON هنا"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            أو اضغط لاختيار ملف من جهازك
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <FileText className="h-3 w-3" />
          <span>JSON فقط — الحد الأقصى ١٠ ميجابايت</span>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">أو</span>
        <Separator className="flex-1" />
      </div>

      {/* Paste text button */}
      <Button
        variant="outline"
        className="w-full h-12 rounded-xl"
        onClick={() => setPasteMode(true)}
      >
        <Clipboard className="h-4 w-4 ml-2" />
        لصق نص JSON
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview summary cards
// ---------------------------------------------------------------------------

function PreviewSummary({ preview }: { preview: ImportPreview }) {
  const totalWarnings = preview.warnings.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-xl bg-card border border-border p-3.5">
        <div className="text-2xl font-bold tabular-nums">
          {toArabicDigits(preview.totalQuestions)}
        </div>
        <div className="text-xs text-muted-foreground">سؤال مكتشف</div>
      </div>
      <div className="rounded-xl bg-card border border-border p-3.5">
        <div className="text-2xl font-bold tabular-nums">
          {toArabicDigits(preview.categories.length)}
        </div>
        <div className="text-xs text-muted-foreground">تصنيف</div>
      </div>
      <div className="rounded-xl bg-card border border-border p-3.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-bold tabular-nums text-emerald-600">
            {toArabicDigits(preview.difficultyDistribution.easy)}
          </span>
          <span className="text-xl font-bold tabular-nums text-amber-600">
            {toArabicDigits(preview.difficultyDistribution.medium)}
          </span>
          <span className="text-xl font-bold tabular-nums text-rose-600">
            {toArabicDigits(preview.difficultyDistribution.hard)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">سهل · وسط · صعب</div>
      </div>
      <div className="rounded-xl bg-card border border-border p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {toArabicDigits(totalWarnings)}
          </span>
          {totalWarnings > 0 && (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {totalWarnings > 0 ? "ملاحظة" : "لا توجد ملاحظات"}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question preview row
// ---------------------------------------------------------------------------

function QuestionPreviewRow({
  q,
  index,
}: {
  q: ImportPreviewQ;
  index: number;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 transition-colors",
        q.warning ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/30"
      )}
    >
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5 w-6">
        {toArabicDigits(index + 1)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm line-clamp-1 flex-1">{q.stem}</p>
          {q.warning && (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" title={q.warning} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {q.categoryNameAr}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              DIFFICULTY_CLASSES[q.difficulty]
            )}
          >
            {DIFFICULTY_LABELS[q.difficulty]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {q.hasExplanation ? "✓ شرح" : "✗ لا يوجد شرح"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "رفع الملف", icon: Upload },
  { label: "معاينة", icon: FileText },
  { label: "استيراد", icon: CheckCircle2 },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const completed = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                completed && "bg-primary text-primary-foreground",
                active && "bg-primary/10 text-primary border border-primary/20",
                !completed && !active && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-px",
                  completed ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import AI Processing Status (live polling)
// ---------------------------------------------------------------------------

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

function ImportAiStatus({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<ImportProcessingStatus | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Poll every 3 seconds
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const result = await getImportProcessingStatus(sourceId);
        if (mounted) setStatus(result);

        // Stop polling if all enabled operations are finished
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
            معالجة الذكاء الاصطناعي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري تحميل حالة المعالجة...
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledOps = Object.entries(status).filter(([, op]) => op.enabled);
  const visibleOps = showAll ? enabledOps : enabledOps.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-violet-500" />
          معالجة الذكاء الاصطناعي
          {enabledOps.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal">
              {enabledOps.filter(([, op]) => op.status === "completed").length}/
              {enabledOps.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {enabledOps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            جميع عمليات المعالجة التلقائية معطلة. فعّلها من الإعدادات.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleOps.map(([key, op]) => {
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

// ---------------------------------------------------------------------------
// Main Import Client
// ---------------------------------------------------------------------------

type ImportStep = "upload" | "preview" | "importing" | "done" | "error";

export function StudioImportClient() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [sourceName, setSourceName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Import history
  const { data: history } = useQuery({
    queryKey: ["import-history"],
    queryFn: getImportHistory,
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await previewImport(text);
      if (!res.ok) throw new Error(res.error);
      return res.preview;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (err) => {
      setError(err.message);
      setStep("error");
    },
  });

  // Confirm mutation
  const queryClient = useQueryClient();
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("لا توجد معاينة");
      return confirmImport(preview.payload, preview.sourceTitle, preview.sourceDate);
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
    },
    onError: (err) => {
      setError(err.message);
      setStep("error");
    },
  });

  // ── Handlers ──────────────────────────────────────────────

  const handleFile = useCallback(
    (text: string, filename: string) => {
      setSourceName(filename.replace(/\.json$/i, ""));
      setError(null);
      previewMutation.mutate(text);
    },
    [previewMutation]
  );

  const handleText = useCallback(
    (text: string) => {
      setSourceName("نص مباشر");
      setError(null);
      previewMutation.mutate(text);
    },
    [previewMutation]
  );

  const handleConfirm = useCallback(() => {
    setStep("importing");
    confirmMutation.mutate();
  }, [confirmMutation]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setError(null);
    previewMutation.reset();
    confirmMutation.reset();
  }, [previewMutation, confirmMutation]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">مركز الاستيراد</h1>
        <p className="text-sm text-muted-foreground mt-1">
          استيراد ملفات الأسئلة بتنسيق JSON إلى المنصة
        </p>
      </div>

      {/* Step indicator */}
      {step !== "upload" && <StepIndicator current={step === "preview" ? 1 : 2} />}

      {/* ────────────── STEP: Upload ────────────── */}
      {step === "upload" && (
        <div className="space-y-6">
          <DropZone onFile={handleFile} onText={handleText} />

          {/* Import history */}
          {history && history.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  آخر الاستيرادات
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {toArabicDigits(item.questionCount)} سؤال
                        </span>
                        <span>{relativeTimeAr(item.importedAt.toISOString())}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ────────────── STEP: Error ────────────── */}
      {step === "error" && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">فشل معالجة الملف</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {error}
          </p>
          <Button variant="outline" className="mt-4" onClick={handleReset}>
            حاول مرة أخرى
          </Button>
        </div>
      )}

      {/* ────────────── STEP: Preview ────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Source info */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{preview.sourceTitle}</h2>
              <p className="text-sm text-muted-foreground">
                {sourceName} · {toArabicDigits(preview.totalQuestions)} سؤال
                {preview.sourceDate && ` · ${preview.sourceDate}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <ArrowLeft className="h-3.5 w-3.5 ml-1" />
              تغيير الملف
            </Button>
          </div>

          {/* AI Summary */}
          <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                ملخص التحليل
              </span>
            </div>
            <div className="text-sm text-foreground/80">
              تم اكتشاف <strong>{toArabicDigits(preview.totalQuestions)} سؤالاً</strong> موزعين على{" "}
              <strong>{toArabicDigits(preview.categories.length)} تصنيفات</strong>:
              {" "}{preview.categories.join("، ")}.
              {" "}{preview.difficultyDistribution.easy > 0 && `${toArabicDigits(preview.difficultyDistribution.easy)} سهل`}
              {preview.difficultyDistribution.easy > 0 && preview.difficultyDistribution.medium > 0 && "، "}
              {preview.difficultyDistribution.medium > 0 && `${toArabicDigits(preview.difficultyDistribution.medium)} متوسط`}
              {((preview.difficultyDistribution.easy > 0 || preview.difficultyDistribution.medium > 0) && preview.difficultyDistribution.hard > 0) && "، "}
              {preview.difficultyDistribution.hard > 0 && `${toArabicDigits(preview.difficultyDistribution.hard)} صعب`}.
            </div>
          </div>

          {/* Summary cards */}
          <PreviewSummary preview={preview} />

          {/* Questions list */}
          <ScrollArea className="h-72 rounded-xl border border-border">
            <div className="p-2 divide-y divide-border/50">
              {preview.questions.map((q, i) => (
                <QuestionPreviewRow key={i} q={q} index={i} />
              ))}
            </div>
          </ScrollArea>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {toArabicDigits(preview.warnings.length)} ملاحظة
                </span>
              </div>
              <ul className="text-xs text-amber-700/80 dark:text-amber-300/80 space-y-0.5 pr-5 list-disc">
                {preview.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {preview.warnings.length > 5 && (
                  <li className="text-muted-foreground">
                    و{toArabicDigits(preview.warnings.length - 5)} ملاحظات أخرى...
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              سيتم استيراد <strong>{toArabicDigits(preview.questions.length)} سؤالاً</strong> بحالة "مراجعة"
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleReset}>
                إلغاء
              </Button>
              <Button onClick={handleConfirm}>
                <Download className="h-4 w-4 ml-1" />
                استيراد الآن
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────── STEP: Importing ────────────── */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-6">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <h3 className="text-lg font-semibold mb-1">جاري استيراد الأسئلة...</h3>
          <p className="text-sm text-muted-foreground">
            يتم حفظ الأسئلة في قاعدة البيانات. قد تستغرق هذه العملية بضع ثوانٍ.
          </p>
        </div>
      )}

      {/* ────────────── STEP: Done ────────────── */}
      {step === "done" && result && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold mb-1">تم الاستيراد بنجاح!</h2>
            <p className="text-sm text-muted-foreground">
              تم استيراد {toArabicDigits(result.inserted)} من {toArabicDigits(result.total)} سؤال
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="text-2xl font-bold tabular-nums text-emerald-600">
                {toArabicDigits(result.inserted)}
              </div>
              <div className="text-xs text-muted-foreground">تم استيرادها</div>
            </div>
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="text-2xl font-bold tabular-nums">
                {toArabicDigits(result.total - result.inserted)}
              </div>
              <div className="text-xs text-muted-foreground">تم تخطيها</div>
            </div>
          </div>

          {/* Live AI processing status */}
          <ImportAiStatus sourceId={result.sourceId} />

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {toArabicDigits(result.errors.length)} خطأ
                </span>
              </div>
              <ul className="text-xs text-rose-700/80 space-y-0.5 pr-5 list-disc">
                {result.errors.slice(0, 3).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={handleReset}>
              <Upload className="h-4 w-4 ml-1" />
              استيراد ملف آخر
            </Button>
            <Button asChild>
              <a href="/studio/library?status=review">
                <FileText className="h-4 w-4 ml-1" />
                عرض الأسئلة المستوردة
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
