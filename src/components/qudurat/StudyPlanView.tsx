"use client";

import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useServerData } from "@/lib/hooks/use-data";
import { fetchAIStudyPlan } from "@/server/actions/ai-study-plan";
import type { AIStudyPlanResult } from "@/server/actions/ai-study-plan";
import {
  categoryMeta,
  toArabicDigits,
  formatPercent,
} from "@/lib/content/ui-helpers";
import { masteryLabel } from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FullScreenLoader } from "./LoadingStates";
import {
  Sparkles,
  Target,
  Brain,
  BookOpen,
  Timer,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  ChevronLeft,
  Clock,
  Gauge,
  BarChart3,
  Play,
  Flame,
  Bot,
  Lightbulb,
  CalendarDays,
} from "lucide-react";

export function StudyPlanView() {
  const { setView, back } = useViewStore();
  const { data: result, loading } = useServerData<AIStudyPlanResult | null>(
    "ai-study-plan",
    fetchAIStudyPlan
  );

  const [showAIPlan, setShowAIPlan] = useState(true);

  if (loading || !result) {
    return <FullScreenLoader label="جارٍ تحليل أدائك…" />;
  }

  const plan = result.heuristicPlan;
  const ai = showAIPlan ? result.aiPlan : null;

  if (!plan) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <p className="text-muted-foreground">لم يتم العثور على بيانات كافية للتحليل.</p>
        <button
          onClick={() => back()}
          className="text-sm text-primary hover:underline"
        >
          العودة
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 lg:pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>رجوع</span>
        </button>
        <h1 className="font-display text-xl font-bold">الخطة الذكية</h1>
        {/* AI toggle */}
        {result.aiPlan && (
          <button
            onClick={() => setShowAIPlan(!showAIPlan)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              showAIPlan
                ? "bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className={cn("h-3.5 w-3.5", showAIPlan && "animate-pulse")} />
            <span>{showAIPlan ? "AI" : "يدوي"}</span>
          </button>
        )}
      </div>

      {/* ── AI-Generated Insight ── */}
      {ai && ai.insight && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 dark:from-violet-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800 p-5"
        >
          <div className="absolute top-3 left-3 opacity-10">
            <Bot className="h-16 w-16 text-violet-600" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                تحليل AI
              </span>
              <span className="text-[9px] text-muted-foreground">
                {new Date(ai.generatedAt).toLocaleTimeString("ar-SA", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground/90">
              {ai.insight}
            </p>
            {ai.learningStyle && (
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span>{ai.learningStyle}</span>
              </div>
            )}
            {ai.motivation && (
              <div className="mt-2 flex items-start gap-2 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-500" />
                <span className="text-violet-700 dark:text-violet-300">{ai.motivation}</span>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* ── Hero / Primary Action ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-violet-700 via-indigo-800 to-purple-900 text-white p-6 sm:p-8 shadow-lg"
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium mb-2">
            {showAIPlan && result.aiUsed ? (
              <Bot className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>
              {result.trend === "new"
                ? "أول مرة هنا؟"
                : result.trend === "improving"
                  ? "أداؤك في تحسّن! 🎉"
                  : result.trend === "declining"
                    ? "لاحظنا تراجعًا — لا تقلق"
                    : "استمر على هذا المنوال 💪"}
            </span>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 leading-tight">
            {ai ? ai.insight : plan.insight}
          </h2>

          <p className="text-indigo-200/90 text-sm sm:text-base max-w-xl leading-relaxed mb-6">
            {ai
              ? `خطة ذكية مُعدّة خصّيصًا بناءً على ${toArabicDigits(result.summary.totalAttempts)} محاولة.`
              : `بناءً على تحليل أدائك في آخر ${toArabicDigits(result.summary.totalAttempts)} محاولة، إليك خطة مصمّمة خصّيصًا لك.`}
          </p>

          {/* Primary action button */}
          <button
            onClick={() =>
              setView(
                (ai && ai.primaryAction.type === "study_category" && ai.primaryAction.categorySlug
                  ? {
                      kind: "study",
                      categorySlug: ai.primaryAction.categorySlug,
                    }
                  : ai && ai.primaryAction.type === "review_mistakes"
                    ? { kind: "revision", tab: "mistakes" }
                    : ai && ai.primaryAction.type === "flashcards"
                      ? { kind: "revision", tab: "flashcards" }
                      : ai && ai.primaryAction.type === "take_exam"
                        ? { kind: "exam_setup" }
                        : plan.primaryAction.view)
              )
            }
            className="inline-flex items-center gap-2 rounded-full bg-white text-indigo-700 px-6 py-3 text-sm font-bold hover:bg-indigo-50 active:scale-95 transition-all shadow-lg"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{ai ? ai.primaryAction.label : plan.primaryAction.label}</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </motion.section>

      {/* ── AI Weekly Schedule ── */}
      {ai && ai.weeklySchedule && ai.weeklySchedule.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border overflow-hidden"
        >
          <div className="bg-gradient-to-l from-indigo-600 to-violet-600 text-white px-5 py-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <h2 className="font-semibold">خطة الأسبوع</h2>
            </div>
            <p className="text-indigo-200 text-[10px] mt-0.5">
              جدول مقترَح من AI بناءً على أدائك
            </p>
          </div>
          <div className="p-4 space-y-2">
            {ai.weeklySchedule.map((day, i) => (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
              >
                {/* Day badge */}
                <div className="shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-xs font-bold shadow-sm">
                  {day.day.slice(0, 2)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{day.focus}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {day.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {day.note}
                  </p>
                </div>

                {/* Mode + count */}
                <div className="shrink-0 text-right">
                  <ModeBadge mode={day.mode} />
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {toArabicDigits(day.targetQuestions)} سؤال
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Summary stats row ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <SummaryCard
          icon={<Gauge className="h-4 w-4" />}
          value={result.summary.overallAccuracy !== null ? formatPercent(result.summary.overallAccuracy) : "—"}
          label="الدقة"
          color={result.summary.overallAccuracy && result.summary.overallAccuracy >= 70 ? "emerald" : result.summary.overallAccuracy && result.summary.overallAccuracy >= 40 ? "amber" : "rose"}
        />
        <SummaryCard
          icon={<Zap className="h-4 w-4" />}
          value={toArabicDigits(result.summary.level)}
          label="المستوى"
          color="violet"
        />
        <SummaryCard
          icon={<Flame className="h-4 w-4" fill="currentColor" />}
          value={toArabicDigits(result.summary.streakDays)}
          label="السلسلة"
          color="amber"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          value={toArabicDigits(result.summary.dueReviewCount)}
          label="مراجعة مستحقة"
          color={result.summary.dueReviewCount > 0 ? "rose" : "emerald"}
        />
      </motion.div>

      {/* ── Recommendations row ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="grid sm:grid-cols-2 gap-3"
      >
        {/* Difficulty recommendation */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground">
              مستوى الصعوبة المقترَح
            </h3>
          </div>
          <div className="text-lg font-bold mb-1">
            {ai ? ai.difficultyRecommendation.recommended === "easy" ? "سهل" : ai.difficultyRecommendation.recommended === "medium" ? "متوسط" : ai.difficultyRecommendation.recommended === "hard" ? "صعب" : "متنوع" : plan.difficultyRecommendation.label}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {ai ? ai.difficultyRecommendation.reason : plan.difficultyRecommendation.reason}
          </p>
        </div>

        {/* Mode recommendation */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground">
              النمط المقترَح
            </h3>
          </div>
          <div className="text-lg font-bold mb-1">
            {ai ? (ai.modeRecommendation.recommended === "study" ? "مذاكرة" : ai.modeRecommendation.recommended === "exam" ? "اختبار" : "متنوّع") : plan.modeRecommendation.label}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {ai ? ai.modeRecommendation.reason : plan.modeRecommendation.reason}
          </p>
        </div>
      </motion.div>

      {/* ── AI Category Priorities ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl bg-card border border-border p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">أولويات الفئات</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ai ? "بناءً على تحليل AI لبيانات أدائك" : "مرتّبة حسب درجة الاحتياج — ابدأ من الأعلى"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3 text-rose-400" />
              <span>أولوية عالية</span>
            </span>
            <span className="opacity-50 mx-1">|</span>
            <span className="inline-flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3 text-emerald-400" />
              <span>أولوية منخفضة</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {buildCategoryPriorities(result, ai).map((cat, i) => {
            const meta = categoryMeta(cat.slug);
            const priorityColors: Record<string, string> = {
              highest: "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20",
              high: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20",
              medium: "border-border bg-card",
              low: "border-border bg-muted/20 opacity-70",
            };
            const priorityIcons: Record<string, React.ReactNode> = {
              highest: <TrendingUp className="h-3.5 w-3.5 text-rose-500" />,
              high: <TrendingUp className="h-3.5 w-3.5 text-amber-500" />,
              medium: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
              low: <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />,
            };

            return (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className={cn(
                  "rounded-xl border p-3 flex items-center gap-3",
                  priorityColors[cat.priority] ?? priorityColors.medium
                )}
              >
                {/* Priority icon */}
                <div className="shrink-0">
                  {priorityIcons[cat.priority] ?? priorityIcons.medium}
                </div>

                {/* Category name + reason */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-xs font-semibold", meta.text)}>
                      {cat.nameAr}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", meta.bg, meta.text)}>
                      {cat.masteryLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {cat.reason}
                  </p>
                </div>

                {/* Mastery bar */}
                <div className="w-24">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                    <span>إتقان</span>
                    <span>{formatPercent(cat.mastery)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.mastery}%` }}
                      transition={{ duration: 0.6, delay: 0.3 + i * 0.04 }}
                      style={{
                        backgroundColor:
                          cat.mastery >= 70
                            ? "#10b981"
                            : cat.mastery >= 40
                              ? "#f59e0b"
                              : "#f43f5e",
                      }}
                    />
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() =>
                    setView({
                      kind: "study",
                      categorySlug: cat.slug,
                    })
                  }
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all hover:scale-105 active:scale-95",
                    cat.priority === "highest"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  <span>{cat.suggestedQuestions} س</span>
                  <Play className="h-2.5 w-2.5 fill-current" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ── AI Learning Style & Motivation ── */}
      {ai && (ai.learningStyle || ai.motivation) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid sm:grid-cols-2 gap-3"
        >
          {ai.learningStyle && (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  أسلوب التعلّم
                </h3>
              </div>
              <p className="text-sm leading-relaxed">
                {ai.learningStyle}
              </p>
            </div>
          )}
          {ai.motivation && (
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-xs font-semibold text-violet-800 dark:text-violet-300">
                  رسالة تحفيزية
                </h3>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {ai.motivation}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Quick Action buttons ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <QuickActionBtn
          icon={<Brain className="h-4 w-4" />}
          label="بطاقات المراجعة"
          description="تكرار متباعد"
          color="violet"
          onClick={() => setView({ kind: "revision", tab: "flashcards" })}
        />
        <QuickActionBtn
          icon={<Target className="h-4 w-4" />}
          label="حديقة الأخطاء"
          description="راجع أخطاءك"
          color="rose"
          onClick={() => setView({ kind: "revision", tab: "mistakes" })}
        />
        <QuickActionBtn
          icon={<BookOpen className="h-4 w-4" />}
          label="مذاكرة عامة"
          description="كل الفئات"
          color="emerald"
          onClick={() => setView({ kind: "study_setup" })}
        />
        <QuickActionBtn
          icon={<Timer className="h-4 w-4" />}
          label="اختبار سريع"
          description="وقت محدود"
          color="amber"
          onClick={() => setView({ kind: "exam_setup" })}
        />
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Merge AI category priorities with heuristic mastery data for display. */
function buildCategoryPriorities(
  result: AIStudyPlanResult,
  ai: AIStudyPlanResult["aiPlan"]
): Array<{
  slug: string;
  nameAr: string;
  mastery: number;
  masteryLabel: string;
  priority: string;
  reason: string;
  suggestedQuestions: number;
}> {
  const masteryMap = new Map(
    result.categoryData.map((c) => [c.slug, c])
  );

  // Use AI priorities if available
  if (ai && ai.categoryPriorities.length > 0) {
    return ai.categoryPriorities.map((p) => {
      const cat = masteryMap.get(p.slug);
      const mastery = cat?.mastery ?? 0;
      return {
        slug: p.slug,
        nameAr: cat?.nameAr ?? p.slug,
        mastery,
        masteryLabel: masteryLabel(mastery),
        priority: p.priority,
        reason: p.reason,
        suggestedQuestions: p.suggestedQuestions ?? 5,
      };
    });
  }

  // Fall back to heuristic plan
  return (
    result.heuristicPlan?.categoryPriorities.map((p) => {
      const cat = masteryMap.get(p.slug);
      return {
        slug: p.slug,
        nameAr: cat?.nameAr ?? p.slug,
        mastery: p.mastery,
        masteryLabel: p.masteryLabel,
        priority: p.priority,
        reason: p.reason,
        suggestedQuestions: p.suggestedQuestionCount ?? 5,
      };
    }) ?? []
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    study: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    exam: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    review: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    flashcards: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  };
  const labels: Record<string, string> = {
    study: "مذاكرة",
    exam: "اختبار",
    review: "مراجعة",
    flashcards: "بطاقات",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold",
        colors[mode] ?? colors.study
      )}
    >
      {labels[mode] ?? mode}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  };

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="rounded-2xl bg-card border border-border p-4 text-center"
    >
      <div
        className={cn(
          "inline-flex h-8 w-8 rounded-lg items-center justify-center mb-1.5",
          colorMap[color] ?? colorMap.emerald
        )}
      >
        {icon}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </motion.div>
  );
}

function QuickActionBtn({
  icon,
  label,
  description,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    violet: "from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600",
    rose: "from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600",
    emerald: "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600",
    amber: "from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600",
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-gradient-to-bl text-white px-4 py-3 text-xs font-semibold transition-all shadow-sm",
        colorMap[color] ?? colorMap.emerald
      )}
    >
      <div className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="text-right min-w-0">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[10px] text-white/70">{description}</div>
      </div>
    </motion.button>
  );
}
