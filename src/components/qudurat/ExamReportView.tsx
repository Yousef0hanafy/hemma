"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestionsByIds } from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, formatPercent, DIFFICULTY_META, getColorHex, formatDuration } from "@/lib/content/ui-helpers";
import { MasteryRing } from "./MasteryRing";
import { AnimatedChip } from "./shared/AnimatedChip";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Star,
  Clock,
  Check,
  X,
  ArrowRight,
  RefreshCw,
  Home,
  Lightbulb,
  Zap,
  Gauge,
  Timer,
  Share2,
  BookOpen,
} from "lucide-react";
import { PassageView } from "./shared/PassageView";
import { FullScreenLoader } from "./LoadingStates";
import { ExamDeepReviewView } from "./ExamDeepReviewView";
import { xpForExamSession } from "@/lib/engine/gamification";
import { useShareAsImage } from "@/lib/hooks/use-share-image";
import { useState } from "react";

export function ExamReportView({
  questionIds,
  selections,
  durationSec,
  actualDurationSec,
}: {
  questionIds: string[];
  selections: Record<string, string | null>;
  durationSec: number;
  actualDurationSec?: number;
}) {
  const { setView } = useViewStore();
  const { data: questions } = useQuestionsByIds(questionIds);
  const { shareRef, handleShare, isSharing } = useShareAsImage("نتيجة-الاختبار.png");
  const [showDeepReview, setShowDeepReview] = useState(false);

  // Deep review mode — show one question at a time
  if (showDeepReview) {
    return (
      <ExamDeepReviewView
        questionIds={questionIds}
        selections={selections}
        actualDurationSec={actualDurationSec}
        onBack={() => setShowDeepReview(false)}
      />
    );
  }

  const stats = useMemo(() => {
    if (!questions) return null;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const byCategory: Record<string, { total: number; correct: number; nameAr: string }> = {};
    const byDifficulty: Record<string, { total: number; correct: number }> = {};
    for (const q of questions) {
      const sel = selections[q.id];
      const cat = byCategory[q.categorySlug] ?? { total: 0, correct: 0, nameAr: q.categoryNameAr };
      cat.total++;
      if (!sel) skipped++;
      else if (sel === q.correctKey) { correct++; cat.correct++; }
      else wrong++;
      byCategory[q.categorySlug] = cat;

      const d = q.difficulty;
      if (!byDifficulty[d]) byDifficulty[d] = { total: 0, correct: 0 };
      byDifficulty[d].total++;
      if (sel && sel === q.correctKey) byDifficulty[d].correct++;
    }
    const total = questions.length;
    const scorePercent = total > 0 ? (correct / total) * 100 : 0;
    return {
      total,
      correct,
      wrong,
      skipped,
      scorePercent,
      xpEarned: xpForExamSession(scorePercent),
      byCategory: Object.entries(byCategory).map(([slug, s]) => ({
        slug,
        ...s,
        percent: s.total > 0 ? (s.correct / s.total) * 100 : 0,
      })),
      byDifficulty: Object.entries(byDifficulty).map(([difficulty, s]) => ({
        difficulty,
        total: s.total,
        correct: s.correct,
        percent: s.total > 0 ? (s.correct / s.total) * 100 : 0,
      })),
    };
  }, [questions, selections]);

  if (!questions || !stats) {
    return <FullScreenLoader label="جارٍ احتساب النتيجة…" />;
  }

  const getScoreColor = (pct: number) =>
    pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "rose";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 lg:pb-12">
      {/* Hero score — wrapped for screenshot capture */}
      <div ref={shareRef}>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-bl from-emerald-700 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 text-center relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="relative">
          <div className="text-emerald-100 text-sm font-medium mb-1 flex items-center justify-center gap-1.5">
            <Trophy className="h-4 w-4" />
            <span>تقرير الاختبار</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-6">
            {stats.scorePercent >= 70
              ? "أداء رائع! 🎉"
              : stats.scorePercent >= 50
              ? "أداء جيد، واصل التحسّن 💪"
              : "بداية الطريق، لا تستسلم 🌱"}
          </h1>

          <div className="flex justify-center mb-4">
            <MasteryRing
              value={stats.scorePercent}
              color={getScoreColor(stats.scorePercent)}
              size={160}
              stroke={12}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 max-w-md mx-auto">
            <AnimatedChip
              variant="stat"
              color="emerald"
              icon={<Check className="h-4 w-4" />}
              label="صحيحة"
              value={stats.correct}
              pulseKey={stats.correct}
            />
            <AnimatedChip
              variant="stat"
              color="rose"
              icon={<X className="h-4 w-4" />}
              label="خاطئة"
              value={stats.wrong}
              pulseKey={stats.wrong}
            />
            <AnimatedChip
              variant="stat"
              color="amber"
              icon={<ArrowRight className="h-4 w-4" />}
              label="متروكة"
              value={stats.skipped}
              pulseKey={stats.skipped}
            />
          </div>

          {/* XP and time row */}
          <div className="flex items-center justify-center gap-4 mt-4 text-emerald-100/80 text-xs">
            <div className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              <span>
                +{toArabicDigits(stats.xpEarned)} نقطة خبرة
              </span>
            </div>
            {(actualDurationSec ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />
                <span>
                  {formatDuration(actualDurationSec!)}
                  {durationSec > 0 && (
                    <span className="text-emerald-100/50">
                      {" "}/ {toArabicDigits(Math.round(durationSec / 60))} د
                    </span>
                  )}
                </span>
              </div>
            )}
            {!actualDurationSec && durationSec > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {toArabicDigits(Math.round(durationSec / 60))} دقيقة
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.section>
      </div>

      {/* Summary row: XP + time + difficulty */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card border border-border p-4 text-center"
        >
          <div className="inline-flex h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 items-center justify-center mx-auto mb-1.5">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold tabular-nums">{toArabicDigits(stats.xpEarned)}</div>
          <div className="text-[10px] text-muted-foreground">نقاط الخبرة</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl bg-card border border-border p-4 text-center"
        >
          <div className="inline-flex h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 items-center justify-center mx-auto mb-1.5">
            <Gauge className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-lg font-bold tabular-nums">{formatPercent(stats.scorePercent)}</div>
          <div className="text-[10px] text-muted-foreground">نسبة النجاح</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-2xl bg-card border border-border p-4 text-center"
        >
          <div className="inline-flex h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-950/40 items-center justify-center mx-auto mb-1.5">
            <Timer className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-lg font-bold tabular-nums">{actualDurationSec ? formatDuration(actualDurationSec) : toArabicDigits(stats.total)}</div>
          <div className="text-[10px] text-muted-foreground">{actualDurationSec ? "الزمن الفعلي" : "عدد الأسئلة"}</div>
        </motion.div>
      </div>

      {/* Per-category breakdown */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="rounded-2xl bg-card border border-border p-5"
      >
        <h2 className="font-semibold mb-4">الأداء حسب الفئة</h2>
        <div className="space-y-3">
          {stats.byCategory.map((c) => {
            const meta = categoryMeta(c.slug);
            return (
              <div key={c.slug} className="flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-lg grid place-items-center text-xs", meta.bg, meta.text)}>
                  {toArabicDigits(c.correct)}/{toArabicDigits(c.total)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{c.nameAr}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatPercent(c.percent)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${c.percent}%` }}
                      transition={{ duration: 0.6 }}
                      style={{ backgroundColor: getColorHex(meta.color).stroke }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Difficulty breakdown */}
      {stats.byDifficulty.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-semibold mb-4">توزيع الصعوبة</h2>
          <div className="grid grid-cols-3 gap-3">
            {stats.byDifficulty.map((d) => {
              const dMeta = DIFFICULTY_META[d.difficulty] ?? { labelAr: d.difficulty, className: "" };
              return (
                <div key={d.difficulty} className="rounded-xl bg-muted/50 p-3.5 text-center">
                  <div className="text-sm font-semibold mb-2">{dMeta.labelAr}</div>
                  <div className="text-lg font-bold tabular-nums mb-1">
                    {toArabicDigits(d.correct)}/{toArabicDigits(d.total)}
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.percent}%`,
                        backgroundColor:
                          d.difficulty === "easy" ? "#059669" :
                          d.difficulty === "medium" ? "#d97706" : "#e11d48",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.percent}%` }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1.5">{formatPercent(d.percent)}</div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Question-by-question review */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-3"
      >
        <h2 className="font-semibold">مراجعة الأسئلة</h2>
        {questions.map((q, i) => {
          const sel = selections[q.id];
          const isCorrect = sel === q.correctKey;
          const isSkipped = !sel;
          const meta = categoryMeta(q.categorySlug);
          return (
            <div
              key={q.id}
              className={cn(
                "rounded-2xl border p-4",
                isCorrect
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10"
                  : isSkipped
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                  : "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/10"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold tabular-nums">
                    {toArabicDigits(i + 1)}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", meta.bg, meta.text)}>
                    {q.categoryNameAr}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                    isCorrect
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      : isSkipped
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {isCorrect ? (
                    <><Check className="h-3 w-3" /> صحيحة</>
                  ) : isSkipped ? (
                    <><ArrowRight className="h-3 w-3" /> متروكة</>
                  ) : (
                    <><X className="h-3 w-3" /> خاطئة</>
                  )}
                </div>
              </div>
              <p className="font-naskh text-sm leading-relaxed mb-3">{q.stem}</p>

              {/* Passage (استيعاب المقروء) */}
              {q.passage && (
                <div className="mb-3">
                  <PassageView passage={q.passage} />
                </div>
              )}

              {/* Options compact */}
              <div className="space-y-1.5 mb-3">
                {q.options.map((opt) => {
                  const isSel = sel === opt.key;
                  const isRight = opt.key === q.correctKey;
                  return (
                    <div
                      key={opt.key}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                        isRight
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 font-semibold"
                          : isSel
                          ? "bg-rose-100 dark:bg-rose-900/30 text-rose-900 dark:text-rose-100"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <span className="font-bold w-4">{opt.key}</span>
                      <span className="font-naskh">{opt.text}</span>
                      {isRight && <Check className="h-3 w-3 mr-auto" />}
                      {isSel && !isRight && <X className="h-3 w-3 mr-auto" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 p-2.5 mt-2">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
                    <Lightbulb className="h-3 w-3" />
                    <span>التفسير</span>
                  </div>
                  <p className="font-naskh text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </motion.section>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-3"
      >
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-6 py-3 text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          <span>{isSharing ? "جارٍ…" : "مشاركة النتيجة"}</span>
        </button>
        <button
          onClick={() => setShowDeepReview(true)}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
        >
          <BookOpen className="h-4 w-4" />
          <span>مراجعة مفصلة</span>
        </button>
        <button
          onClick={() => setView({ kind: "exam_setup" })}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          <span>اختبار جديد</span>
        </button>
        <button
          onClick={() => setView({ kind: "revision", tab: "mistakes" })}
          className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
        >
          <X className="h-4 w-4" />
          <span>راجع الأخطاء</span>
        </button>
        <button
          onClick={() => setView({ kind: "dashboard" })}
          className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
        >
          <Home className="h-4 w-4" />
          <span>الرئيسية</span>
        </button>
      </motion.div>
    </div>
  );
}


