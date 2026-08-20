"use client";

// =====================================================================
// Studio Ingestion Client — File-Native (PDF, DOCX, TXT, JSON) UI
// =====================================================================

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Clipboard,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BrainCircuit,
  FileSpreadsheet,
  FileType,
  Loader2,
  Layers,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toArabicDigits, relativeTimeAr } from "@/lib/content/ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ingestSourceDocument,
  type IngestResponse,
} from "@/server/actions/studio-ingest";
import { getImportHistory } from "@/server/actions/studio-import";
import { ImportAiStatus } from "@/components/studio/StudioImportAiStatus";

// ---------------------------------------------------------------------------
// Helpers & Badges
// ---------------------------------------------------------------------------

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileType className="h-6 w-6 text-rose-500" />;
  if (ext === "docx" || ext === "doc") return <FileText className="h-6 w-6 text-blue-500" />;
  if (ext === "json") return <FileSpreadsheet className="h-6 w-6 text-amber-500" />;
  return <FileText className="h-6 w-6 text-violet-500" />;
}

// ---------------------------------------------------------------------------
// Universal Drop Zone
// ---------------------------------------------------------------------------

function UniversalDropZone({
  onFileSelect,
  onPasteSubmit,
  isProcessing,
}: {
  onFileSelect: (file: File) => void;
  onPasteSubmit: (jsonText: string) => void;
  isProcessing: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (isProcessing) return;
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect, isProcessing]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handlePasteAction = useCallback(() => {
    if (pastedText.trim()) {
      onPasteSubmit(pastedText.trim());
    }
  }, [pastedText, onPasteSubmit]);

  if (pasteMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">لصق نص JSON مباشر</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setPasteMode(false);
              setPastedText("");
            }}
          >
            <X className="h-3 w-3 me-1" />
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
            تنسيق JSON معتمد للتجميعات وبنوك الأسئلة
          </span>
          <Button
            size="sm"
            onClick={handlePasteAction}
            disabled={!pastedText.trim() || isProcessing}
          >
            <Clipboard className="h-3.5 w-3.5 me-1" />
            استيراد
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isProcessing) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-all cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
          isProcessing && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.json"
          className="hidden"
          disabled={isProcessing}
          onChange={handleInputChange}
        />
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl transition-all shadow-sm",
            dragOver
              ? "bg-primary text-primary-foreground scale-110"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Upload
            className={cn(
              "h-8 w-8 transition-transform",
              dragOver && "translate-y-[-2px]"
            )}
          />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold">
            {dragOver ? "أفلت المستند هنا للبدء" : "اسحب وأفلت ملف المستند التعليمي هنا"}
          </p>
          <p className="text-xs text-muted-foreground">
            يدعم ملفات PDF، ومستندات Word (DOCX)، وملفات النصوص، وJSON
          </p>
        </div>

        {/* Supported Formats Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Badge variant="outline" className="gap-1 text-[11px] py-1 px-2.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            PDF (كتب وملازم)
          </Badge>
          <Badge variant="outline" className="gap-1 text-[11px] py-1 px-2.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Word DOCX
          </Badge>
          <Badge variant="outline" className="gap-1 text-[11px] py-1 px-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            JSON
          </Badge>
          <Badge variant="outline" className="gap-1 text-[11px] py-1 px-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            نصوص TXT
          </Badge>
        </div>

        <div className="text-[11px] text-muted-foreground/70">
          الحد الأقصى لحجم الملف: ١٥ ميجابايت
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">أو للمطورين</span>
        <Separator className="flex-1" />
      </div>

      <Button
        variant="outline"
        className="w-full h-11 rounded-xl"
        onClick={() => setPasteMode(true)}
      >
        <Clipboard className="h-4 w-4 me-2" />
        لصق نص JSON يدوي
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Processing Live Progress Stepper
// ---------------------------------------------------------------------------

function ProcessingLiveStepper({
  currentPhase,
  filename,
}: {
  currentPhase: number;
  filename: string;
}) {
  const steps = [
    { label: "رفع وحفظ الملف", sub: "التحقق من الامتداد والحجم" },
    { label: "استخراج النصوص", sub: "قراءة النص بدقة قاطعة" },
    { label: "التحليل الذكي وتوليد الأسئلة", sub: "استخراج وتدقيق الهيكلة" },
    { label: "حفظ في الاستوديو", sub: "تسجيل بحالة قيد المراجعة" },
  ];

  return (
    <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-8 text-center space-y-6">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BrainCircuit className="h-10 w-10 animate-pulse text-primary" />
          <div className="absolute inset-0 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold">جاري استيعاب ومعالجة المستند</h3>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            {getFileIcon(filename)}
            <span className="font-mono font-medium">{filename}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
          {steps.map((st, i) => {
            const isCompleted = i < currentPhase;
            const isCurrent = i === currentPhase;
            return (
              <div
                key={i}
                className={cn(
                  "p-3 rounded-xl border transition-all text-xs space-y-1",
                  isCompleted && "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
                  isCurrent && "bg-primary/5 border-primary text-primary font-semibold shadow-sm",
                  !isCompleted && !isCurrent && "bg-muted/40 border-border text-muted-foreground opacity-60"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[9px]">
                      {i + 1}
                    </span>
                  )}
                  <span>{st.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{st.sub}</p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground/80">
          تتم معالجة الأسئلة والنصوص بالذكاء الاصطناعي مع الحفظ الآمن في قاعدة البيانات...
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type Step = "upload" | "processing" | "done" | "error";

export function StudioImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState<string>("");
  const [progressPhase, setProgressPhase] = useState(0);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: history } = useQuery({
    queryKey: ["import-history"],
    queryFn: getImportHistory,
  });

  const ingestMutation = useMutation({
    mutationFn: async (fileOrText: File | string) => {
      const formData = new FormData();
      if (typeof fileOrText === "string") {
        const blob = new Blob([fileOrText], { type: "application/json" });
        formData.append("file", blob, "direct_input.json");
        setFilename("direct_input.json");
      } else {
        formData.append("file", fileOrText);
        setFilename(fileOrText.name);
      }

      setStep("processing");
      setProgressPhase(1);

      // Simulate progressing phase states for smooth UI feedback
      const timer1 = setTimeout(() => setProgressPhase(2), 2000);
      const timer2 = setTimeout(() => setProgressPhase(3), 5000);

      try {
        const res = await ingestSourceDocument(formData);
        clearTimeout(timer1);
        clearTimeout(timer2);
        if (!res.ok) {
          throw new Error(res.error || "فشل استيراد المستند.");
        }
        return res;
      } catch (e) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        throw e;
      }
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

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      ingestMutation.mutate(file);
    },
    [ingestMutation]
  );

  const handlePasteSubmit = useCallback(
    (jsonText: string) => {
      setError(null);
      ingestMutation.mutate(jsonText);
    },
    [ingestMutation]
  );

  const handleReset = useCallback(() => {
    setStep("upload");
    setFilename("");
    setResult(null);
    setError(null);
    setProgressPhase(0);
    ingestMutation.reset();
  }, [ingestMutation]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">مركز استيعاب المصادر التعليمية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ارفع أي ملف تعليمي (PDF، Word، نصوص، أو JSON) وسيقوم النظام باستخراجه وهيكلته تلقائياً
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <UniversalDropZone
              onFileSelect={handleFileSelect}
              onPasteSubmit={handlePasteSubmit}
              isProcessing={ingestMutation.isPending}
            />

            {/* Ingestion History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  المصادر المستوردة مؤخراً
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {history && history.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {history.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 hover:bg-muted/30 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(item.title)}
                          <span className="text-sm font-medium">{item.title}</span>
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
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Layers className="h-8 w-8 mb-3 opacity-30" />
                    <p className="text-sm font-medium">لا توجد مصادر مستوردة بعد</p>
                    <p className="text-xs mt-1 opacity-70">ارفع أول ملف لك أعلاه لتبدأ</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Processing Live Stepper */}
        {step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <ProcessingLiveStepper
              currentPhase={progressPhase}
              filename={filename}
            />
          </motion.div>
        )}

        {/* STEP 3: Error */}
        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-8 text-center space-y-4"
          >
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
                تعذر استيعاب الملف
              </h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto whitespace-pre-line">
                {error}
              </p>
            </div>
            <Button variant="outline" onClick={handleReset} className="mt-2">
              <ArrowRight className="h-4 w-4 me-1" />
              المحاولة مرة أخرى
            </Button>
          </motion.div>
        )}

        {/* STEP 4: Success & Review */}
        {step === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">تم استيعاب المستند بنجاح!</h2>
                <p className="text-sm text-muted-foreground">
                  المصدر: <strong>{result.title}</strong>
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200">
                تم الحفظ بحالة: قيد المراجعة (Review)
              </Badge>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums text-emerald-600">
                    {toArabicDigits(result.insertedQuestions ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    أسئلة مستخرجة / مولدة
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums text-blue-600">
                    {toArabicDigits(result.insertedPassages ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    قطع ونصوص تعليمية
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-4 text-center">
                  <div className="text-sm font-semibold text-foreground flex items-center justify-center gap-1">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    مكتمل
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    جاهز للمراجعة في الاستوديو
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Warnings / Ambiguities if any */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                  <AlertCircle className="h-4 w-4" />
                  ملاحظات أثناء الاستخراج:
                </div>
                <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc pr-5 space-y-1">
                  {result.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Post-Processing Status Polling */}
            {result.sourceId && <ImportAiStatus sourceId={result.sourceId} />}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
                <Upload className="h-4 w-4 me-1" />
                استيعاب مستند آخر
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/studio/library?source=${result.sourceId || ""}`}>
                  <BookOpen className="h-4 w-4 me-1" />
                  مراجعة الأسئلة في المكتبة
                  <ArrowLeft className="h-3.5 w-3.5 ms-1" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
