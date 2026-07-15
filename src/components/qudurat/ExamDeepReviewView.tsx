"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestionsByIds } from "@/lib/hooks/use-data";
import {
  categoryMeta,
  toArabicDigits,
  formatDuration,
  DIFFICULTY_META,
} from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Clock,
  Grid3x3,
  Filter,
  Target,
  Gauge,
} from "lucide-react";
import { PassageView } from "./shared/PassageView";
import { FullScreenLoader } from "./LoadingStates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeepReviewProps {
  questionIds: string[];
  selections: Record<string, string | null>;
  actualDurationSec?: number;
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Deep Review View
// ---------------------------------------------------------------------------

export function ExamDeepReviewView({
  questionIds,
  selections,
  actualDurationSec,
  onBack,
}: DeepReviewProps) {
  const { setView } = useViewStore();
  const { data: questions } = useQuestionsByIds(questionIds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNavGrid, setShowNavGrid] = useState(false);
  const [showWrongOnly, setShowWrongOnly] = useState(false);

  // Compute wrong question indices
  const wrongIndices = useMemo(() => {
    if (!questions) return [];
    return questions
      .map((q, i) => {
        const sel = selections[q.id];
        if (sel && sel !== q.correctKey) return i;
        if (!sel) return i; // Skipped counts as wrong
        return -1;
      })
      .filter((i) => i !== -1);
  }, [questions, selections]);

  // Filtered questions based on wrong-only mode
  const filteredIndices = useMemo(() => {
    if (!questions) return [];
    if (!showWrongOnly) return questions.map((_, i) => i);
    return wrongIndices;
  }, [questions, showWrongOnly, wrongIndices]);

  // Get the actual question index from filtered view
  const actualIndex = filteredIndices[currentIndex] ?? 0;
  const current = questions?.[actualIndex];
  const totalFiltered = filteredIndices.length;
  const totalAll = questions?.length ?? 0;

  // Reset to first when toggling filter
  useEffect(() => {
    setCurrentIndex(0);
  }, [showWrongOnly]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showNavGrid) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(totalFiltered - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [totalFiltered, showNavGrid]);

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else setView({ kind: "dashboard" });
  }, [onBack, setView]);

  if (!questions) {
    return <FullScreenLoader label="جارٍ تحميل الأسئلة…" />;
  }

  if (questions.length === 0) return null;
  if (!current) return null;

  const sel = selections[current.id];
  const isCorrect = sel === current.correctKey;
  const isSkipped = !sel;
  const meta = categoryMeta(current.categorySlug);
  const progress = ((currentIndex + 1) / totalFiltered) * 100;

  return (
    <div className="max-w-3xl mx-auto pb-32 lg:pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>تقرير الاختبار</span>
        </button>
        <h1 className="font-display text-base font-bold">مراجعة مفصلة</h1>
        <div />
      </div>

      {/* ── Top bar: nav, progress, filter ── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNavGrid(true)}
            className="p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
            aria-label="شبكة الأسئلة"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {toArabicDigits(actualIndex + 1)} / {toArabicDigits(totalAll)}
            {showWrongOnly && (
              <span className="text-rose-500 mr-1">
                (أخطاء: {toArabicDigits(wrongIndices.length)})
              </span>
            )}
          </span>
        </div>

        {/* Filter toggle */}
        {wrongIndices.length > 0 && (
          <button
            onClick={() => setShowWrongOnly(!showWrongOnly)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              showWrongOnly
                ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-700"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter className="h-3 w-3" />
            <span>الأخطاء فقط</span>
          </button>
        )}

        {/* Wrong-only indicator */}
        {showWrongOnly && wrongIndices.length > 0 && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {toArabicDigits(currentIndex + 1)}/{toArabicDigits(totalFiltered)}
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
        <motion.div
          className={cn(
            "h-full rounded-full",
            showWrongOnly ? "bg-rose-500" : "bg-primary"
          )}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* ── Question card ── */}
      <motion.div
        key={current.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        {/* Category + difficulty + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            meta.bg, meta.text
          )}>
            {current.categoryNameAr}
          </span>
          <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
            DIFFICULTY_META[current.difficulty].className
          )}>
            {DIFFICULTY_META[current.difficulty].labelAr}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
            isCorrect
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
              : isSkipped
              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
          )}>
            {isCorrect ? (
              <><Check className="h-3 w-3" /> صحيحة</>
            ) : isSkipped ? (
              <><ArrowRight className="h-3 w-3" /> متروكة</>
            ) : (
              <><X className="h-3 w-3" /> خاطئة</>
            )}
          </span>
        </div>

        {/* Passage (if applicable) */}
        {current.passage && (
          <div className="rounded-xl bg-muted/30 border border-border p-4">
            <PassageView passage={current.passage} />
          </div>
        )}

        {/* Stem */}
        <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
          <p className="question-stem text-foreground">{current.stem}</p>
        </div>

        {/* Options with answer comparison */}
        <div className="space-y-2.5">
          {current.options.map((opt) => {
            const isSel = sel === opt.key;
            const isRight = opt.key === current.correctKey;
            return (
              <div
                key={opt.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 sm:p-4 transition-all",
                  isRight
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20"
                    : isSel && !isRight
                    ? "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/20"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                {/* Letter badge */}
                <div className={cn(
                  "h-8 w-8 rounded-lg grid place-items-center text-sm font-bold shrink-0",
                  isRight
                    ? "bg-emerald-500 text-white"
                    : isSel
                    ? "bg-rose-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}>
                  {opt.key}
                </div>

                {/* Option text */}
                <span className={cn(
                  "font-naskh text-sm leading-relaxed flex-1",
                  isRight || (isSel && !isRight) ? "font-semibold" : "text-foreground/80"
                )}>
                  {opt.text}
                </span>

                {/* Status icon */}
                {isRight && (
                  <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                )}
                {isSel && !isRight && (
                  <X className="h-5 w-5 text-rose-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {current.explanation && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-2">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>التفسير</span>
            </div>
            <p className="font-naskh text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
              {current.explanation}
            </p>
            {current.studyTip && (
              <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-[10px] font-semibold mb-1">
                  <Lightbulb className="h-3 w-3" />
                  <span>نصيحة دراسية</span>
                </div>
                <p className="font-naskh text-xs leading-relaxed text-foreground/70">
                  {current.studyTip}
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Bottom navigation ── */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            currentIndex === 0
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-card border border-border hover:bg-muted"
          )}
        >
          <ArrowRight className="h-4 w-4" />
          <span>السابق</span>
        </button>

        {/* Question nav dots */}
        <div className="hidden sm:flex items-center gap-1">
          {filteredIndices.slice(0, 20).map((qIdx, i) => {
            const q = questions[qIdx];
            if (!q) return null;
            const qSel = selections[q.id];
            const qCorrect = qSel === q.correctKey;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  i === currentIndex
                    ? "ring-2 ring-primary ring-offset-1 scale-125"
                    : "",
                  qCorrect
                    ? "bg-emerald-400"
                    : qSel
                    ? "bg-rose-400"
                    : "bg-amber-400"
                )}
                aria-label={`سؤال ${toArabicDigits(qIdx + 1)}`}
              />
            );
          })}
          {filteredIndices.length > 20 && (
            <span className="text-[10px] text-muted-foreground mx-1">
              +{toArabicDigits(filteredIndices.length - 20)}
            </span>
          )}
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(totalFiltered - 1, i + 1))}
          disabled={currentIndex >= totalFiltered - 1}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            currentIndex >= totalFiltered - 1
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <span>التالي</span>
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          <span>
            {isCorrect ? "أجبت صحيحًا" : isSkipped ? "تركت السؤال" : "أجبت خطأً"}
          </span>
        </div>
        {actualDurationSec && actualDurationSec > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              الوقت الفعلي: {formatDuration(actualDurationSec)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          <span>
            {toArabicDigits(actualIndex + 1)} من {toArabicDigits(totalAll)}
          </span>
        </div>
      </div>

      {/* ── Navigation grid dialog ── */}
      <Dialog open={showNavGrid} onOpenChange={setShowNavGrid}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>شبكة الأسئلة</DialogTitle>
            <DialogDescription>
              اضغط على أي سؤال للانتقال إليه مباشرة
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {questions.map((q, i) => {
              const qSel = selections[q.id];
              const qCorrect = qSel === q.correctKey;
              const isCurrent = i === actualIndex;
              const isInFiltered = showWrongOnly ? wrongIndices.includes(i) : true;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    // Find index in filtered list
                    const filteredIdx = filteredIndices.indexOf(i);
                    if (filteredIdx !== -1) {
                      setCurrentIndex(filteredIdx);
                      setShowNavGrid(false);
                    }
                  }}
                  disabled={showWrongOnly && !isInFiltered}
                  className={cn(
                    "h-10 w-10 rounded-lg font-bold text-sm tabular-nums transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : qCorrect
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : qSel
                      ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                      : "bg-muted text-muted-foreground",
                    showWrongOnly && !isInFiltered && "opacity-20 cursor-not-allowed"
                  )}
                >
                  {showWrongOnly && !isInFiltered ? "·" : toArabicDigits(i + 1)}
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              صحيحة
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              خاطئة
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              متروكة
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              الحالي
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Keyboard hints ── */}
      <div className="mt-8 text-center text-[10px] text-muted-foreground/60">
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[9px]">←</kbd>
        <span className="mx-1">/</span>
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[9px]">→</kbd>
        <span className="mx-1.5">للتنقل بين الأسئلة</span>
      </div>
    </div>
  );
}
