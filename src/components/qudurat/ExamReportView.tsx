"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestionsByIds } from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, formatPercent, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { MasteryRing } from "./MasteryRing";
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
} from "lucide-react";
import { FullScreenLoader } from "./LoadingStates";

export function ExamReportView({
  questionIds,
  selections,
  durationSec,
}: {
  questionIds: string[];
  selections: Record<string, string | null>;
  durationSec: number;
}) {
  const { setView } = useViewStore();
  const { data: questions } = useQuestionsByIds(questionIds);

  const stats = useMemo(() => {
    if (!questions) return null;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const byCategory: Record<string, { total: number; correct: number; nameAr: string }> = {};
    for (const q of questions) {
      const sel = selections[q.id];
      const cat = byCategory[q.categorySlug] ?? { total: 0, correct: 0, nameAr: q.categoryNameAr };
      cat.total++;
      if (!sel) skipped++;
      else if (sel === q.correctKey) { correct++; cat.correct++; }
      else wrong++;
      byCategory[q.categorySlug] = cat;
    }
    const total = questions.length;
    const scorePercent = total > 0 ? (correct / total) * 100 : 0;
    return {
      total,
      correct,
      wrong,
      skipped,
      scorePercent,
      byCategory: Object.entries(byCategory).map(([slug, s]) => ({
        slug,
        ...s,
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
      {/* Hero score */}
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
            <StatChip
              icon={<Check className="h-4 w-4" />}
              label="صحيحة"
              value={stats.correct}
              color="emerald"
            />
            <StatChip
              icon={<X className="h-4 w-4" />}
              label="خاطئة"
              value={stats.wrong}
              color="rose"
            />
            <StatChip
              icon={<ArrowRight className="h-4 w-4" />}
              label="متروكة"
              value={stats.skipped}
              color="amber"
            />
          </div>

          {durationSec > 0 && (
            <div className="text-emerald-100/80 text-xs mt-4 flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                زمن الاختبار: {toArabicDigits(Math.round(durationSec / 60))} دقيقة
              </span>
            </div>
          )}
        </div>
      </motion.section>

      {/* Per-category breakdown */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
                      className={cn("h-full", `bg-${meta.color}-500`)}
                      initial={{ width: 0 }}
                      animate={{ width: `${c.percent}%` }}
                      transition={{ duration: 0.6 }}
                      style={{ backgroundColor: meta.color === "emerald" ? "#10b981" : meta.color === "amber" ? "#f59e0b" : meta.color === "rose" ? "#f43f5e" : meta.color === "violet" ? "#8b5cf6" : meta.color === "cyan" ? "#06b6d4" : "#64748b" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

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

// ---------------------------------------------------------------------------

const STAT_COLOR: Record<string, string> = {
  emerald: "bg-emerald-500/20 text-emerald-100",
  rose:    "bg-rose-500/20 text-rose-100",
  amber:   "bg-amber-500/20 text-amber-100",
};

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 text-center", STAT_COLOR[color])}>
      <div className="flex items-center justify-center gap-1 mb-1 text-xs opacity-90">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{toArabicDigits(value)}</div>
    </div>
  );
}
