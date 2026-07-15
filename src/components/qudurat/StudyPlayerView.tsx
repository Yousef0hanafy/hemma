"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Star,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Trophy,
  ChevronLeft,
  Brain,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Shield,
  Bot,
} from "lucide-react";
import { useViewStore } from "@/lib/store/view-store";
import {
  useQuestionsByIds,
  useRecordAttempt,
  useToggleFavorite,
  useFavoriteIds,
  useAutoRegisterMistake,
  useNextReviewDate,
} from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, DIFFICULTY_META, relativeTimeAr, formatPercent, formatDuration } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { ArabicLetter } from "@/lib/content/dto";
import { QuestionDTO } from "@/lib/content/dto";
import { FullScreenLoader } from "./LoadingStates";
import { OptionCard } from "./shared/OptionCard";
import { FeedbackPanel } from "./shared/FeedbackPanel";
import { AnimatedChip } from "./shared/AnimatedChip";
import { PassageView } from "./shared/PassageView";
import {
  savePendingExam,
  loadPendingExam,
  clearPendingExam,
} from "@/lib/exam-persistence";

export function StudyPlayerView({
  questionIds,
  categorySlug,
}: {
  questionIds: string[];
  categorySlug?: string;
}) {
  const { setView, view } = useViewStore();
  const purpose = view.kind === "study" ? view.purpose ?? "study" : "study";
  const { data: questions } = useQuestionsByIds(questionIds);
  const { data: nextReviewDate, refresh: refreshNextReview } = useNextReviewDate();

  // Restore persisted currentIndex if available (e.g. after session expiry)
  const persisted = useRef(loadPendingExam());
  const savedIndex =
    persisted.current?.view.kind === "study"
      ? persisted.current.internal.currentIndex
      : null;
  const [currentIndex, setCurrentIndex] = useState(savedIndex ?? 0);
  const [done, setDone] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const resultsRef = useRef({ correct: 0, total: 0 });
  const sessionXpRef = useRef(0);

  // Elapsed timer — ticks every second while the session is active
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  // Clear persisted state once restored
  useEffect(() => {
    if (persisted.current) {
      persisted.current = null;
      clearPendingExam();
    }
  }, []);

  // Persist currentIndex on every change (for session-expiry recovery)
  useEffect(() => {
    savePendingExam({
      view: { kind: "study", questionIds, ...(categorySlug ? { categorySlug } : {}) },
      internal: { currentIndex, selections: {}, timeLeft: 0 },
      savedAt: Date.now(),
    });
  }, [currentIndex, questionIds, categorySlug]);

  const onResult = useCallback((isCorrect: boolean, xpGained?: number) => {
    resultsRef.current.total++;
    if (isCorrect) resultsRef.current.correct++;
    if (xpGained) sessionXpRef.current += xpGained;
  }, []);

  const onFinish = useCallback(() => {
    refreshNextReview();
    setDone(true);
  }, [refreshNextReview]);

  // Show summary when session is done (all session types)
  if (done) {
    return (
      <SessionSummary
        correct={resultsRef.current.correct}
        total={resultsRef.current.total}
        elapsedSeconds={elapsedSeconds}
        xpEarned={sessionXpRef.current}
        nextReviewDate={nextReviewDate}
        isReview={purpose === "review"}
      />
    );
  }

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
      onResult={onResult}
      onFinish={onFinish}
      elapsedSeconds={elapsedSeconds}
    />
  );
}

function StudyPlayerInner({
  questions,
  currentIndex,
  setCurrentIndex,
  onResult,
  onFinish,
  elapsedSeconds,
}: {
  questions: QuestionDTO[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  onResult: (isCorrect: boolean) => void;
  onFinish: () => void;
  elapsedSeconds: number;
}) {
  const { setView, back, view } = useViewStore();
  const purpose = view.kind === "study" ? view.purpose ?? "study" : "study";
  const recordAttempt = useRecordAttempt();
  const toggleFavorite = useToggleFavorite();
  const autoRegisterMistake = useAutoRegisterMistake();
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
        if (!isCorrect) {
          autoRegisterMistake(current.id);
        }
        onResult(isCorrect, result.xpEarned);

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
        if (result.shieldEarned) {
          toast("درع حماية جديد! يحمي إنجازك المتسلسل من الانقطاع 🛡️", {
            icon: <Shield className="h-4 w-4 text-amber-500" />,
            duration: 5000,
          });
        }

        // ── XP milestone celebrations ──
        if (result.xpMilestonesHit && result.xpMilestonesHit.length > 0) {
          for (const m of result.xpMilestonesHit) {
            toast(`🎉 ${m.emoji} إنجاز ${m.name}!`, {
              icon: <Trophy className="h-4 w-4 text-amber-500" />,
              duration: 5000,
            });
          }
        }

        // ── Streak milestone celebration ──
        if (result.streakMilestoneHit) {
          const sm = result.streakMilestoneHit;
          toast(`🔥 ${sm.emoji} ${sm.name}!`, {
            icon: <Trophy className="h-5 w-5 text-amber-500" />,
            duration: 6000,
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("حدث خطأ أثناء تسجيل الإجابة. حاول مجددًا.");
        setSubmitted(false);
      }
    },
    [current, submitted, startTime, confidence, recordAttempt, autoRegisterMistake, onResult]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      toast("أنهيت الجلسة بنجاح! 🎓", {
        icon: <Sparkles className="h-4 w-4" />,
      });
      onFinish();
    }
  }, [currentIndex, questions.length, setCurrentIndex, onFinish]);

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
          <span>{purpose === "review" ? "إنهاء المراجعة" : "إنهاء الجلسة"}</span>
        </button>

        {purpose === "review" && (
          <AnimatedChip
            color="violet"
            size="sm"
            icon={<Brain className="h-3 w-3" />}
            label="مراجعة التكرار المتباعد"
          />
        )}

        {purpose === "study" && (
          <AnimatedChip
            color="emerald"
            size="sm"
            icon={<BookOpen className="h-3 w-3" />}
            label="مذاكرة"
          />
        )}

        {/* Elapsed timer */}
        {elapsedSeconds > 5 && (
          <div className="flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(elapsedSeconds)}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          <span>{toArabicDigits(currentIndex + 1)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{toArabicDigits(questions.length)}</span>
        </div>

        <button
          onClick={() =>
            setView({
              kind: "study_buddy",
              initialQuestion: `اشرح لي هذا السؤال: ${current.stem.substring(0, 200)}`,
              context: current.id,
            })
          }
          className="p-2 rounded-full text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
          title="اسأل المساعد الذكي عن هذا السؤال"
          aria-label="اسأل المساعد الذكي"
        >
          <Bot className="h-5 w-5" />
        </button>

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

          {/* Passage (استيعاب المقروء) */}
          {current.passage && (
            <PassageView passage={current.passage} />
          )}

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
                  onAskAI={
                    selectedKey && selectedKey !== current.correctKey
                      ? () =>
                          setView({
                            kind: "study_buddy",
                            initialQuestion: `لقد أخطأت في هذا السؤال. اخترت "${selectedKey}" ولكن الإجابة الصحيحة هي "${current.correctKey}".

السؤال: ${current.stem.substring(0, 300)}

اشرح لي لماذا إجابتي خاطئة وكيف يمكنني التوصّل للإجابة الصحيحة.`,
                            context: current.id,
                          })
                      : undefined
                  }
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

function SessionSummary({
  correct,
  total,
  elapsedSeconds,
  xpEarned,
  nextReviewDate,
  isReview,
}: {
  correct: number;
  total: number;
  elapsedSeconds: number;
  xpEarned: number;
  nextReviewDate: string | null;
  isReview: boolean;
}) {
  const { setView } = useViewStore();
  const wrong = total - correct;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTimePerQuestion = total > 0 ? Math.round(elapsedSeconds / total) : 0;

  // Generate a recommendation based on performance
  const recommendation =
    scorePercent >= 85
      ? "أداء ممتاز! أنت في طريقك للإتقان. جرّب اختبارًا وقتيًا لتتحدّى نفسك."
      : scorePercent >= 65
      ? "أداء جيد جدًا! واصل التدريب المنتظم لتحقيق نتائج أفضل."
      : scorePercent >= 40
      ? "أداء متوسط. ركّز على مراجعة الأخطاء في حديقة الأخطاء لتحسين مستواك."
      : "لا تيأس! كل خطأ هو فرصة للتعلّم. ادرس الفئات التي تحتاج تحسينًا.";

  const scoreColor =
    scorePercent >= 70 ? "emerald" :
    scorePercent >= 40 ? "amber" : "rose";

  const scoreBgMap: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
  };

  const title = isReview
    ? "تمت المراجعة بنجاح! 🎯"
    : scorePercent >= 70
    ? "أحسنت! 🎉"
    : "انتهت الجلسة 📚";

  const subtitle = isReview
    ? "ساعدتك هذه الجلسة على تثبيت المعلومات في ذاكرتك طويلة المدى."
    : scorePercent >= 70
    ? `حصلت على ${formatPercent(scorePercent)} — أداء ممتاز!`
    : "واصل التدريب اليومي لتحسّن مستواك.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto text-center py-6 space-y-6"
    >
      {/* Score ring */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="inline-flex relative"
      >
        <svg width="140" height="140" className="transform -rotate-90">
          <circle
            cx="70" cy="70" r="58"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          <motion.circle
            cx="70" cy="70" r="58"
            fill="none"
            stroke={scorePercent >= 70 ? "#10b981" : scorePercent >= 40 ? "#f59e0b" : "#f43f5e"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 58}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - scorePercent / 100) }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{formatPercent(scorePercent)}</span>
          <span className="text-[10px] text-muted-foreground">نسبة الصحة</span>
        </div>
      </motion.div>

      <div>
        <h2 className="font-display text-2xl font-bold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryStat
          label="صحيح"
          value={toArabicDigits(correct)}
          color="emerald"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <SummaryStat
          label="خطأ"
          value={toArabicDigits(wrong)}
          color="rose"
          icon={<XCircle className="h-4 w-4" />}
        />
        <SummaryStat
          label="الوقت"
          value={formatDuration(elapsedSeconds)}
          color="violet"
          icon={<Clock className="h-4 w-4" />}
        />
        <SummaryStat
          label="XP"
          value={`+${toArabicDigits(xpEarned)}`}
          color="amber"
          icon={<Star className="h-4 w-4" fill="currentColor" />}
        />
      </div>

      {/* Extra stats row */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded-xl bg-card border border-border p-3">
          <span className="block text-[10px]">متوسط الوقت للسؤال</span>
          <span className="font-bold text-foreground tabular-nums">
            {avgTimePerQuestion < 60
              ? `${toArabicDigits(avgTimePerQuestion)} ث`
              : formatDuration(avgTimePerQuestion)}
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <span className="block text-[10px]">إجمالي الأسئلة</span>
          <span className="font-bold text-foreground tabular-nums">{toArabicDigits(total)}</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/40 to-accent/10 border border-accent/30 p-4 text-right">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold mb-0.5">توصية</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {recommendation}
            </p>
            {wrong > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                راجع {toArabicDigits(wrong)} سؤالًا خاطئًا في حديقة الأخطاء.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* For review: next review date */}
      {isReview && (
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div className="text-right flex-1">
              <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                المراجعة القادمة
              </div>
              <div className="text-xs text-violet-600/70 dark:text-violet-400/70">
                {nextReviewDate
                  ? relativeTimeAr(nextReviewDate)
                  : "لا توجد مراجعات قادمة — أحسنت! 🎉"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {wrong > 0 && (
          <button
            onClick={() => setView({ kind: "revision", tab: "mistakes" })}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 px-5 py-2.5 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors w-full sm:w-auto"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>راجع الأخطاء</span>
          </button>
        )}
        <button
          onClick={() => {
            if (isReview) {
              setView({ kind: "revision", tab: "flashcards" });
            } else {
              setView({ kind: "study_setup" });
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-muted transition-colors w-full sm:w-auto"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>{isReview ? "العودة للمراجعة" : "جلسة جديدة"}</span>
        </button>
        <button
          onClick={() => setView({ kind: "dashboard" })}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors w-full sm:w-auto"
        >
          <span>الرئيسية</span>
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function SummaryStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  };

  return (
    <div className="rounded-xl bg-card border border-border p-3 text-center">
      <div className={cn("inline-flex h-7 w-7 rounded-lg items-center justify-center mb-1", colorMap[color] ?? colorMap.emerald)}>
        {icon}
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

