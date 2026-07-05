"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Star,
  Bookmark,
  BookmarkCheck,
  Lightbulb,
  Sparkles,
  Trophy,
  Flame,
  ChevronLeft,
} from "lucide-react";
import { useViewStore } from "@/lib/store/view-store";
import {
  useQuestionsByIds,
  useRecordAttempt,
  useToggleFavorite,
  useFavoriteIds,
} from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { ArabicLetter } from "@/lib/content/dto";
import { QuestionDTO } from "@/lib/content/dto";
import { FullScreenLoader } from "./LoadingStates";

export function StudyPlayerView({
  questionIds,
  categorySlug,
}: {
  questionIds: string[];
  categorySlug?: string;
}) {
  const { data: questions } = useQuestionsByIds(questionIds);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!questions || questions.length === 0) {
    return <FullScreenLoader label="جارٍ تحضير الأسئلة…" />;
  }

  const current = questions[currentIndex];
  if (!current) return null;

  return (
    <StudyPlayerInner
      key={current.id}
      questions={questions}
      currentIndex={currentIndex}
      setCurrentIndex={setCurrentIndex}
    />
  );
}

function StudyPlayerInner({
  questions,
  currentIndex,
  setCurrentIndex,
}: {
  questions: QuestionDTO[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { setView, back } = useViewStore();
  const recordAttempt = useRecordAttempt();
  const toggleFavorite = useToggleFavorite();
  const { data: favoriteIds } = useFavoriteIds();

  const [selectedKey, setSelectedKey] = useState<ArabicLetter | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [localFavorite, setLocalFavorite] = useState<boolean | null>(null);

  const current = questions[currentIndex];

  // Derive favorite state from server data + local override
  const isFavorite =
    localFavorite !== null
      ? localFavorite
      : (favoriteIds ?? []).includes(current.id);

  const handleSubmit = useCallback(
    async (key: ArabicLetter) => {
      if (!current || submitted) return;
      setSelectedKey(key);
      setSubmitted(true);
      const isCorrect = key === current.correctKey;
      const timeMs = Date.now() - startTime;

      try {
        const result = await recordAttempt({
          questionId: current.id,
          selectedKey: key,
          isCorrect,
          mode: "study",
          timeMs,
          confidence,
        });
        if (result.xpEarned > 0) {
          toast.success(`+${toArabicDigits(result.xpEarned)} نقطة خبرة`, {
            icon: <Star className="h-4 w-4" fill="currentColor" />,
          });
        }
        if (result.leveledUp && result.newLevel) {
          toast(`وصلت إلى المستوى ${toArabicDigits(result.newLevel)}!`, {
            icon: <Trophy className="h-4 w-4 text-amber-500" />,
          });
        }
        for (const a of result.unlockedAchievements) {
          toast(`إنجاز جديد: ${a.nameAr}`, {
            icon: <span className="text-lg">{a.iconAr}</span>,
          });
        }
      } catch (e) {
        console.error(e);
      }
    },
    [current, submitted, startTime, confidence, recordAttempt]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      toast("أنهيت الجلسة بنجاح! 🎓", {
        icon: <Sparkles className="h-4 w-4" />,
      });
      setView({ kind: "dashboard" });
    }
  }, [currentIndex, questions.length, setCurrentIndex, setView]);

  const handleFavorite = useCallback(async () => {
    if (!current) return;
    const newState = await toggleFavorite(current.id);
    setLocalFavorite(newState);
    toast(newState ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
  }, [current, toggleFavorite]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") handleSubmit("أ");
      else if (e.key === "2") handleSubmit("ب");
      else if (e.key === "3") handleSubmit("ج");
      else if (e.key === "4") handleSubmit("د");
      else if (e.key === "Enter" && submitted) handleNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit, handleNext, submitted]);

  const meta = categoryMeta(current.categorySlug);
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto pb-32 lg:pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>إنهاء الجلسة</span>
        </button>

        <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          <span>{toArabicDigits(currentIndex + 1)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{toArabicDigits(questions.length)}</span>
        </div>

        <button
          onClick={handleFavorite}
          className={cn(
            "p-2 rounded-full transition-colors",
            isFavorite
              ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              : "text-muted-foreground hover:bg-muted"
          )}
          aria-label={isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
        >
          {isFavorite ? (
            <BookmarkCheck className="h-5 w-5" fill="currentColor" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
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
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Question header */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
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
            <span className="text-[10px] text-muted-foreground">
              {current.sourceTitle}
            </span>
          </div>

          {/* Stem */}
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
            <p className="question-stem text-foreground leading-loose">
              {current.stem}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {current.options.map((opt) => (
              <OptionCard
                key={opt.key}
                opt={opt}
                selected={selectedKey === opt.key}
                correct={submitted && opt.key === current.correctKey}
                wrong={
                  submitted &&
                  selectedKey === opt.key &&
                  opt.key !== current.correctKey
                }
                disabled={submitted}
                onClick={() => handleSubmit(opt.key)}
              />
            ))}
          </div>

          {/* Feedback panel */}
          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                className="overflow-hidden"
              >
                <FeedbackPanel
                  isCorrect={selectedKey === current.correctKey}
                  correctKey={current.correctKey}
                  explanation={current.explanation}
                  studyTip={current.studyTip}
                  confidence={confidence}
                  setConfidence={setConfidence}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Bottom nav */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex justify-center"
        >
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span>
              {currentIndex < questions.length - 1
                ? "السؤال التالي"
                : "إنهاء الجلسة"}
            </span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OptionCard({
  opt,
  selected,
  correct,
  wrong,
  disabled,
  onClick,
}: {
  opt: { key: ArabicLetter; text: string };
  selected: boolean;
  correct: boolean;
  wrong: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-right transition-all",
        correct
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
          : wrong
          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
          : selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/50",
        !disabled && "cursor-pointer active:scale-[0.99]"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 shrink-0 rounded-lg grid place-items-center font-bold text-sm transition-colors",
          correct
            ? "bg-emerald-500 text-white"
            : wrong
            ? "bg-rose-500 text-white"
            : selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {correct ? <Check className="h-5 w-5" /> : wrong ? <X className="h-5 w-5" /> : opt.key}
      </div>
      <span className="font-naskh text-base leading-relaxed flex-1">{opt.text}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function FeedbackPanel({
  isCorrect,
  correctKey,
  explanation,
  studyTip,
  confidence,
  setConfidence,
}: {
  isCorrect: boolean;
  correctKey: ArabicLetter;
  explanation: string | null;
  studyTip: string | null;
  confidence: number;
  setConfidence: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Verdict */}
      <div
        className={cn(
          "rounded-2xl p-4 border-2",
          isCorrect
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {isCorrect ? (
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <X className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          )}
          <h3 className="font-bold text-sm">
            {isCorrect ? "إجابة صحيحة!" : `الإجابة الصحيحة: ${correctKey}`}
          </h3>
        </div>
        {explanation && (
          <p className="font-naskh text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {explanation}
          </p>
        )}
      </div>

      {/* Study tip */}
      {studyTip && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
            <Lightbulb className="h-4 w-4" />
            <span className="font-semibold text-xs">نصيحة للدراسة</span>
          </div>
          <p className="font-naskh text-sm leading-relaxed text-foreground/90">{studyTip}</p>
        </div>
      )}

      {/* Confidence rating (metacognition) */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-xs text-muted-foreground mb-2">
          كيف تقيّم ثقتك بهذا السؤال؟ (يساعد على تحسين توصية الأسئلة)
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setConfidence(n)}
              className={cn(
                "p-1 rounded transition-colors",
                confidence >= n
                  ? "text-amber-500"
                  : "text-muted-foreground/30 hover:text-muted-foreground"
              )}
            >
              <Star className="h-6 w-6" fill={confidence >= n ? "currentColor" : "none"} />
            </button>
          ))}
          <span className="text-xs text-muted-foreground mr-2">
            {confidence === 0 ? "لم أقيّم" : confidence === 1 ? "لست متأكدًا" : confidence === 2 ? "متأكد نسبيًا" : "متأكد جدًا"}
          </span>
        </div>
      </div>
    </div>
  );
}
