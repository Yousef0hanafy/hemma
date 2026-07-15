"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Flag,
  Clock,
  Grid3x3,
} from "lucide-react";
import { useViewStore } from "@/lib/store/view-store";
import {
  useQuestionsByIds,
  useRecordAttempt,
  useFinalizeExam,
  useAutoRegisterMistake,
} from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, formatDuration, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { ArabicLetter } from "@/lib/content/dto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FullScreenLoader } from "./LoadingStates";
import { OptionCard } from "./shared/OptionCard";
import { PassageView } from "./shared/PassageView";
import {
  savePendingExam,
  loadPendingExam,
  clearPendingExam,
} from "@/lib/exam-persistence";

export function ExamRunnerView({
  sessionId,
  questionIds,
  durationSec,
}: {
  sessionId: string;
  questionIds: string[];
  durationSec: number;
}) {
  const { setView } = useViewStore();
  const { data: questions } = useQuestionsByIds(questionIds);
  const recordAttempt = useRecordAttempt();
  const finalizeExam = useFinalizeExam();
  const autoRegisterMistake = useAutoRegisterMistake();

  // Restore persisted state if available (e.g. after session expiry)
  const persisted = useRef(loadPendingExam());
  const savedInternal = persisted.current?.view.kind === "exam_running"
    ? persisted.current.internal
    : null;

  const examStartTime = useRef(Date.now());
  const [currentIndex, setCurrentIndex] = useState(savedInternal?.currentIndex ?? 0);
  const [selections, setSelections] = useState<Record<string, ArabicLetter | null>>(
    savedInternal?.selections as Record<string, ArabicLetter | null> ?? {}
  );
  const questionStartTimesRef = useRef<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(savedInternal?.timeLeft ?? durationSec);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showNavGrid, setShowNavGrid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = questions?.[currentIndex];
  const total = questions?.length ?? 0;
  const answered = Object.values(selections).filter(Boolean).length;

  // Clear persisted state once restored
  useEffect(() => {
    if (persisted.current) {
      persisted.current = null;
      clearPendingExam();
    }
  }, []);

  // Persist internal state on every change (for session-expiry recovery)
  useEffect(() => {
    savePendingExam({
      view: { kind: "exam_running", sessionId, questionIds, durationSec },
      internal: { currentIndex, selections, timeLeft },
      savedAt: Date.now(),
    });
  }, [currentIndex, selections, timeLeft, sessionId, questionIds, durationSec]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitDialog(false);
    try {
      const finalSelections: Record<string, string | null> = {};
      for (const q of questions ?? []) {
        finalSelections[q.id] = selections[q.id] ?? null;
      }
      const actualDurationSec = Math.floor((Date.now() - examStartTime.current) / 1000);
      await finalizeExam(sessionId, questionIds, finalSelections, actualDurationSec);
      setView({
        kind: "exam_report",
        sessionId,
        questionIds,
        selections: finalSelections,
        durationSec,
        actualDurationSec,
      });
    } catch (e) {
      console.error(e);
      toast("حدث خطأ أثناء التسليم");
      setSubmitting(false);
    }
  }, [submitting, questions, selections, finalizeExam, sessionId, questionIds, durationSec, setView]);

  // Timer countdown
  useEffect(() => {
    if (durationSec === 0) return; // no time limit
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, durationSec, handleSubmit]);

  // Track question start time via ref (no re-render needed)
  if (current && !questionStartTimesRef.current[current.id]) {
    questionStartTimesRef.current[current.id] = Date.now();
  }

  const selectAnswer = useCallback(
    async (key: ArabicLetter) => {
      if (!current) return;
      const prevSelection = selections[current.id] ?? null;

      // If changing answer, we don't re-record — we just update local state
      // (We'll record all attempts on submit)
      setSelections((prev) => ({ ...prev, [current.id]: key }));

      // If first selection for this question, record the attempt silently
      // (so we get attempt history for analytics)
      if (!prevSelection) {
        const isCorrect = key === current.correctKey;
        const timeMs = Date.now() - (questionStartTimesRef.current[current.id] ?? Date.now());
        try {
          await recordAttempt({
            questionId: current.id,
            selectedKey: key,
            isCorrect,
            mode: "exam",
            sessionId,
            timeMs,
          });

          // Auto-register wrong answers for SRS revision
          if (!isCorrect) {
            autoRegisterMistake(current.id);
          }
        } catch (e) {
          console.error(e);
        }
      }
    },
    [current, selections, recordAttempt, sessionId, autoRegisterMistake]
  );

  if (!questions || questions.length === 0) {
    return <FullScreenLoader label="جارٍ تحضير الاختبار…" />;
  }
  if (!current) return null;

  const meta = categoryMeta(current.categorySlug);
  const progress = ((currentIndex + 1) / total) * 100;
  const timeWarning = durationSec > 0 && timeLeft < 60;

  return (
    <div className="max-w-3xl mx-auto pb-32 lg:pb-12">
      {/* Top bar with timer */}
      <div className="flex items-center justify-between gap-3 mb-3 sticky top-16 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNavGrid(true)}
            className="p-2 rounded-full bg-card border border-border hover:bg-muted"
            aria-label="شبكة الأسئلة"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold tabular-nums">
            {toArabicDigits(currentIndex + 1)} / {toArabicDigits(total)}
          </span>
        </div>

        {durationSec > 0 && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 font-bold tabular-nums text-sm",
              timeWarning
                ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 animate-pulse"
                : "bg-card border border-border"
            )}
          >
            <Clock className="h-4 w-4" />
            <span>{formatDuration(timeLeft)}</span>
          </div>
        )}

        <button
          onClick={() => setShowSubmitDialog(true)}
          className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold hover:bg-primary/90"
        >
          <Flag className="h-3.5 w-3.5" />
          <span>تسليم</span>
        </button>
      </div>

      {/* Progress */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                meta.bg,
                meta.text
              )}
            >
              {current.categoryNameAr}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
                DIFFICULTY_META[current.difficulty].className
              )}
            >
              {DIFFICULTY_META[current.difficulty].labelAr}
            </span>
          </div>

          {/* Passage (استيعاب المقروء) */}
          {current.passage && (
            <PassageView passage={current.passage} />
          )}

          {/* Stem */}
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
            <p className="question-stem text-foreground">{current.stem}</p>
          </div>

          {/* Options — no feedback shown */}
          <div className="space-y-2.5">
            {current.options.map((opt) => (
              <OptionCard
                key={opt.key}
                opt={opt}
                selected={selections[current.id] === opt.key}
                onClick={() => selectAnswer(opt.key)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom navigation */}
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

        <div className="text-xs text-muted-foreground">
          أُجيب: {toArabicDigits(answered)} / {toArabicDigits(total)}
        </div>

        <button
          onClick={() =>
            currentIndex < total - 1
              ? setCurrentIndex((i) => i + 1)
              : setShowSubmitDialog(true)
          }
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90"
        >
          <span>{currentIndex < total - 1 ? "التالي" : "تسليم"}</span>
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد التسليم</DialogTitle>
            <DialogDescription>
              {answered === total
                ? `أجبت على جميع الأسئلة الـ${toArabicDigits(total)}. هل تريد التسليم وعرض النتيجة؟`
                : `أجبت على ${toArabicDigits(answered)} من ${toArabicDigits(total)} أسئلة. الأسئلة المتبقية ستُحسب كإجابات خاطئة.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSubmitDialog(false)}>
              متابعة الاختبار
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "جاري التسليم…" : "تسليم نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Navigation grid dialog */}
      <Dialog open={showNavGrid} onOpenChange={setShowNavGrid}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>شبكة الأسئلة</DialogTitle>
            <DialogDescription>
              اضغط على أي سؤال للانتقال إليه مباشرة
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {(questions ?? []).map((q, i) => {
              const isAnswered = !!selections[q.id];
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(i);
                    setShowNavGrid(false);
                  }}
                  className={cn(
                    "h-10 w-10 rounded-lg font-bold text-sm tabular-nums transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : isAnswered
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {toArabicDigits(i + 1)}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
