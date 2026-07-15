"use client";

import { motion } from "framer-motion";
import {
  Flame,
  Star,
  Shield,
  BookOpen,
  Timer,
  RefreshCw,
  TrendingUp,
  Calendar,
  Target,
  Sparkles,
  ChevronLeft,
  Play,
  X,
  Shuffle,
  AlignRight,
  AlertCircle,
  Shapes,
  Lightbulb,
  Clock,
  ListChecks,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { useViewStore, type ViewKey } from "@/lib/store/view-store";
import {
  useUserProfile,
  useCategoryMastery,
  useDailyActivity,
  useDailyQuest,
  useSources,
  useCategories,
  useRecentlyStudiedCategories,
  useDueReviewCount,
  useServerData,
} from "@/lib/hooks/use-data";
import { fetchWeeklyChallenge } from "@/server/actions/progress";
import { fetchLearningGoals } from "@/server/actions/learning-goals";
import type { GoalsWithProgress } from "@/server/actions/learning-goals";
import {
  levelProgress,
  masteryLabel,
  todayKey,
  dayKeyOffset,
} from "@/lib/engine/gamification";
import {
  toArabicDigits,
  categoryMeta,
  getActionCardColor,
  getColorHex,
} from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { MasteryRing } from "./MasteryRing";
import { FullScreenLoader } from "./LoadingStates";
import {
  loadPendingExam,
  clearPendingExam,
  pendingSessionLabel,
} from "@/lib/exam-persistence";
import type { PendingSession } from "@/lib/exam-persistence";
import { useEffect, useState, type ElementType } from "react";
import { AnimatedNumber } from "./shared/AnimatedNumber";
import { AnimatedChip } from "./shared/AnimatedChip";
import type { RecentCategoryInfo, CategoryMastery } from "@/lib/content/dto";

export function DashboardView() {
  const { setView } = useViewStore();
  const { data: profile, loading: profileLoading } = useUserProfile();

  // Check for pending session on mount
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  useEffect(() => {
    const saved = loadPendingExam();
    setPendingSession(saved);
  }, []);
  const { data: mastery } = useCategoryMastery();
  const { data: activity } = useDailyActivity();
  const { data: quest } = useDailyQuest();
  const { data: sources } = useSources();
  const { data: categories, loading: categoriesLoading } = useCategories();
  const { data: recentCategories } = useRecentlyStudiedCategories(5);
  const { data: dueReviewCount } = useDueReviewCount();
  const { data: weeklyChallenge } = useServerData("weekly-challenge", fetchWeeklyChallenge);
  const { data: goals } = useServerData<GoalsWithProgress | null>("learning-goals", fetchLearningGoals);

  // Show full-screen loader until critical data arrives
  if (profileLoading || categoriesLoading) {
    return <FullScreenLoader label="جارٍ تحميل لوحة التحكم…" />;
  }

  const lp = profile ? levelProgress(profile.totalXp) : null;

  // Last 7 days for the weekly activity strip
  const today = todayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => dayKeyOffset(6 - i));
  const activityMap = new Map((activity ?? []).map((a) => [a.date, a]));
  const last7Data = last7.map((d) => ({
    date: d,
    attempts: activityMap.get(d)?.attempts ?? 0,
  }));
  const maxAttempts = Math.max(1, ...last7Data.map((d) => d.attempts));

  const totalQuestions = (sources ?? []).reduce((s, src) => s + src.questionCount, 0);

  return (
    <div className="space-y-6">
      {/* ============ HERO: Streak + Welcome ============ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-700 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 shadow-lg"
      >
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              <span>أهلًا بك في رحلتك نحو الإتقان</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              {profile && profile.currentStreak > 0
                ? `لسلسلتك ${toArabicDigits(profile.currentStreak)} يوم متواصل 🔥`
                : "ابدأ سلسلتك اليوم"}
            </h1>
            <p className="text-emerald-100/90 text-sm sm:text-base max-w-lg leading-relaxed">
              منصة همّة التعليمية — رحلتك المتكاملة لإتقان القدرات اللفظية. مذاكرة بتفسير فوري،
              اختبارات وقتية، ومراجعة ذكية لأخطائك. كل سؤال يقرّبك خطوة نحو الهدف.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setView({ kind: "study_setup" })}
                className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-800 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span>ابدأ المذاكرة</span>
              </button>
              <button
                onClick={() => setView({ kind: "exam_setup" })}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600/40 backdrop-blur-sm border border-white/30 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-600/60 transition-colors"
              >
                <Timer className="h-4 w-4" />
                <span>اختبار سريع</span>
              </button>
              <button
                onClick={() => setView({ kind: "study_plan" })}
                className="inline-flex items-center gap-2 rounded-full bg-amber-400/30 backdrop-blur-sm border border-amber-300/40 text-amber-100 px-5 py-2.5 text-sm font-semibold hover:bg-amber-400/50 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>خطة ذكية</span>
              </button>
            </div>
          </div>

          {/* Streak hero number */}
          <div className="flex items-center gap-4 sm:flex-col sm:gap-1 sm:text-center">
            <div className="relative">
              <Flame
                className={cn(
                  "h-20 w-20 sm:h-24 sm:w-24 text-orange-300",
                  profile && profile.currentStreak > 0 && "flame-active"
                )}
                fill={profile && profile.currentStreak > 0 ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            </div>
            <div className="sm:text-center">
              <div className="text-5xl sm:text-6xl font-bold tabular-nums leading-none">
                {toArabicDigits(profile?.currentStreak ?? 0)}
              </div>
              <div className="text-emerald-100/80 text-xs sm:text-sm mt-1">
                أيام متتالية
              </div>
              {profile && profile.streakShields > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2 text-orange-200 text-xs">
                  <Shield className="h-3 w-3" />
                  <span>{toArabicDigits(profile.streakShields)} درع حماية</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ============ WEEKLY CHALLENGE ============ */}
      {weeklyChallenge && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className={cn(
            "rounded-2xl border p-4 sm:p-5",
            weeklyChallenge.complete
              ? "bg-gradient-to-bl from-emerald-600 to-teal-700 text-white border-emerald-500"
              : "bg-gradient-to-bl from-violet-600 to-indigo-700 text-white border-violet-500"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center shrink-0">
                {weeklyChallenge.complete ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <Target className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm mb-0.5">
                  {weeklyChallenge.complete
                    ? "أكملت التحدي الأسبوعي! 🎉"
                    : `التحدي الأسبوعي — ${weeklyChallenge.challenge.rewardLabel}`}
                </div>
                <div className="text-sm text-white/80">
                  {weeklyChallenge.challenge.descriptionAr}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div className="text-xl font-bold tabular-nums">
                {toArabicDigits(Math.min(weeklyChallenge.current, weeklyChallenge.target))}
                <span className="text-sm text-white/70 font-normal">
                  /{toArabicDigits(weeklyChallenge.target)}
                </span>
              </div>
              <div className="h-1.5 w-20 rounded-full bg-white/20 overflow-hidden mt-1">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (weeklyChallenge.current / weeklyChallenge.target) * 100)}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============ LEARNING GOALS ============ */}
      {goals && goals.progress.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className={cn(
            "rounded-2xl border p-4 sm:p-5",
            goals.completedCount === goals.totalCount
              ? "bg-gradient-to-bl from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-md"
              : "bg-card border-border"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {goals.completedCount === goals.totalCount ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              ) : (
                <ListChecks className={cn("h-5 w-5", goals.totalCount > 0 ? "text-primary" : "text-muted-foreground")} />
              )}
              <h3 className={cn("font-semibold", goals.completedCount === goals.totalCount ? "text-white" : "")}>
                أهدافي اليومية
              </h3>
            </div>
            <div className={cn(
              "text-xs tabular-nums",
              goals.completedCount === goals.totalCount
                ? "text-emerald-200"
                : "text-muted-foreground"
            )}>
              {toArabicDigits(goals.completedCount)}/{toArabicDigits(goals.totalCount)} مكتمل
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mb-3">
            <motion.div
              className={cn(
                "h-full rounded-full",
                goals.completedCount === goals.totalCount
                  ? "bg-emerald-300"
                  : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{
                width: `${goals.totalCount > 0 ? (goals.completedCount / goals.totalCount) * 100 : 0}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Individual goals */}
          <div className="space-y-2">
            {goals.progress.map((p) => {
              const isComplete = p.complete;
              const iconMap: Record<string, string> = {
                attempts: "📝",
                correct: "✅",
                xp: "⭐",
              };
              return (
                <div
                  key={p.goal.type}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    isComplete
                      ? goals.completedCount === goals.totalCount
                        ? "bg-white/10"
                        : "bg-emerald-50 dark:bg-emerald-950/20"
                      : "bg-muted/30"
                  )}
                >
                  <div className="text-lg shrink-0">{iconMap[p.goal.type] ?? "🎯"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-xs font-semibold",
                        isComplete && goals.completedCount === goals.totalCount
                          ? "text-white/90"
                          : isComplete
                            ? "text-emerald-700 dark:text-emerald-300"
                            : ""
                      )}>
                        {p.goal.label ?? (p.goal.type === "attempts" ? "أسئلة محلولة" : p.goal.type === "correct" ? "إجابات صحيحة" : "نقاط خبرة")}
                      </span>
                      <span className={cn(
                        "text-[10px] tabular-nums",
                        isComplete && goals.completedCount === goals.totalCount
                          ? "text-white/80"
                          : isComplete
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      )}>
                        {toArabicDigits(Math.min(p.current, p.target))}/{toArabicDigits(p.target)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          isComplete
                            ? goals.completedCount === goals.totalCount
                              ? "bg-white/70"
                              : "bg-emerald-500"
                            : "bg-primary/70"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${p.percent}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      />
                    </div>
                  </div>
                  {isComplete && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      {goals.completedCount === goals.totalCount ? (
                        <Trophy className="h-5 w-5 text-yellow-300" />
                      ) : (
                        <CheckCircle2 className={cn("h-5 w-5", goals.completedCount === goals.totalCount ? "text-emerald-300" : "text-emerald-500")} />
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All goals complete celebration */}
          {goals.completedCount === goals.totalCount && goals.totalCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 text-center"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100 bg-white/10 rounded-full px-4 py-1.5">
                🎉 حققت جميع أهدافك اليوم! استمر بهذا التميّز
              </span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ============ PENDING SESSION BANNER ============ */}
      {pendingSession && (
        <PendingSessionBanner
          session={pendingSession}
          onResume={() => {
            setView(pendingSession.view);
            setPendingSession(null);
          }}
          onDismiss={() => {
            clearPendingExam();
            setPendingSession(null);
          }}
        />
      )}

      {/* ============ STATS ROW ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* XP / Level */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
            <Star className="h-4 w-4" fill="currentColor" />
            <span className="text-xs font-medium">نقاط الخبرة</span>
          </div>
          <div className="text-2xl font-bold">
            <AnimatedNumber value={profile?.totalXp ?? 0} />
          </div>
          {lp && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                المستوى {toArabicDigits(lp.level)} ← {toArabicDigits(lp.nextLevelXp)}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${lp.pct}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Longest streak */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">أطول سلسلة</span>
          </div>
          <div className="text-2xl font-bold">
            <AnimatedNumber value={profile?.longestStreak ?? 0} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">يومًا متواصلًا</div>
        </motion.div>

        {/* Total questions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs font-medium">إجمالي الأسئلة</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {toArabicDigits(totalQuestions)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            من {toArabicDigits(sources?.length ?? 0)} مصادر
          </div>
        </motion.div>

        {/* Daily quest */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-gradient-to-bl from-accent/60 to-accent/30 border border-accent/40 p-4"
        >
          <div className="flex items-center gap-2 text-accent-foreground mb-2">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium">هدف اليوم</span>
          </div>
          <div className="text-sm font-semibold leading-tight line-clamp-2">
            {quest?.quest.descriptionAr ?? "—"}
          </div>
          {quest && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-accent-foreground/15 overflow-hidden flex-1">
                <motion.div
                  className="h-full bg-accent-foreground/80"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (quest.current / quest.target) * 100)}%`,
                  }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-accent-foreground/80">
                {toArabicDigits(quest.current)}/{toArabicDigits(quest.target)}
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {/* ============ MASTERY RINGS ============ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-xl font-bold">إتقان الفئات</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              تتبّع تقدّمك في كل فئة من فئات القدرات اللفظية
            </p>
          </div>
          <button
            onClick={() => setView({ kind: "stats" })}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <span>تفاصيل</span>
            <ChevronLeft className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(mastery ?? []).map((m, i) => {
            const meta = categoryMeta(m.categorySlug);
            return (
              <motion.button
                key={m.categorySlug}
                onClick={() =>
                  setView({ kind: "study", categorySlug: m.categorySlug })
                }
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                whileHover={{ y: -2 }}
                className="group rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition-colors text-center"
              >
                <MasteryRing
                  value={m.mastery}
                  color={meta.color}
                  size={88}
                />
                <div className="mt-2 font-semibold text-sm leading-tight line-clamp-1">
                  {m.categoryNameAr}
                </div>
                <div className={cn("text-xs mt-0.5", meta.text)}>
                  {masteryLabel(m.mastery)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                  {toArabicDigits(m.correct)}/{toArabicDigits(m.attempted)} من {toArabicDigits(m.total)}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ============ CONTINUE LEARNING ============ */}
      {recentCategories && recentCategories.length > 0 && (
        <ContinueLearningSection
          recentCategories={recentCategories}
          mastery={mastery ?? []}
          dueReviewCount={dueReviewCount ?? 0}
          setView={setView}
        />
      )}

      {/* ============ ACTIVITY + SOURCES ============ */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Weekly activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-2xl bg-card border border-border p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">نشاط الأسبوع</h3>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-32">
            {last7Data.map((d, i) => {
              const date = new Date(d.date);
              const dayName = date.toLocaleDateString("ar", { weekday: "short" });
              const heightPct = (d.attempts / maxAttempts) * 100;
              const isToday = d.date === today;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="text-[10px] tabular-nums text-muted-foreground">
                    {toArabicDigits(d.attempts)}
                  </div>
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, heightPct)}%` }}
                      transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: "easeOut" }}
                      className={cn(
                        "w-full rounded-t-md",
                        isToday
                          ? "bg-primary"
                          : d.attempts > 0
                          ? "bg-primary/40"
                          : "bg-muted"
                      )}
                    />
                  </div>
                  <div className={cn("text-[10px]", isToday && "font-bold text-primary")}>
                    {dayName}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Sources card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">مصادر الأسئلة</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {toArabicDigits(sources?.length ?? 0)} ملف
            </span>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto no-scrollbar">
            {(sources ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg p-2.5 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {s.date ?? "—"}
                  </div>
                </div>
                <div className="text-sm font-bold tabular-nums text-primary">
                  {toArabicDigits(s.questionCount)}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setView({ kind: "search" })}
            className="mt-3 w-full text-xs text-primary hover:underline"
          >
            تصفّح كل الأسئلة ←
          </button>
        </motion.div>
      </div>

      {/* ============ QUICK ACTIONS ============ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="font-display text-xl font-bold mb-3">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            icon={<BookOpen className="h-5 w-5" />}
            title="مذاكرة موجهة"
            subtitle="تفسير فوري بعد كل سؤال"
            color="emerald"
            onClick={() => setView({ kind: "study_setup" })}
          />
          <QuickAction
            icon={<Timer className="h-5 w-5" />}
            title="اختبار وقتي"
            subtitle="محاكاة الاختبار الحقيقي"
            color="amber"
            onClick={() => setView({ kind: "exam_setup" })}
          />
          <QuickAction
            icon={<RefreshCw className="h-5 w-5" />}
            title="حديقة الأخطاء"
            subtitle="راجع ما أخفقت فيه"
            color="rose"
            onClick={() => setView({ kind: "revision", tab: "mistakes" })}
          />
          <QuickAction
            icon={<Sparkles className="h-5 w-5" />}
            title="بطاقات المراجعة"
            subtitle="تثبيت سريع للمعلومات"
            color="violet"
            onClick={() => setView({ kind: "revision", tab: "flashcards" })}
          />
        </div>
      </motion.section>
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function PendingSessionBanner({
  session,
  onResume,
  onDismiss,
}: {
  session: PendingSession;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const label = pendingSessionLabel(session.view);
  const totalQuestions =
    session.view.kind === "exam_running"
      ? session.view.questionIds.length
      : session.view.questionIds?.length ?? 0;
  const current = session.internal.currentIndex + 1;
  const savedTimeAgo = Math.floor((Date.now() - session.savedAt) / 60000);
  const timeAgo =
    savedTimeAgo < 1
      ? "منذ لحظات"
      : savedTimeAgo < 60
      ? `منذ ${toArabicDigits(savedTimeAgo)} دقيقة`
      : `منذ ${toArabicDigits(Math.floor(savedTimeAgo / 60))} ساعة`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-bl from-violet-600 to-indigo-700 dark:from-violet-700 dark:to-indigo-800 p-4 sm:p-5 text-white shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center shrink-0">
            {session.view.kind === "exam_running" ? (
              <Timer className="h-5 w-5" />
            ) : (
              <BookOpen className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold mb-0.5">
              لديك {label} غير مكتمل
            </div>
            <div className="text-sm text-white/80">
              {totalQuestions > 0 && (
                <span>
                  السؤال {toArabicDigits(current)} من {toArabicDigits(totalQuestions)}
                  <span className="mx-1.5 opacity-50">·</span>
                </span>
              )}
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
            aria-label="تجاهل"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={onResume}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-violet-700 px-4 py-2 text-sm font-bold hover:bg-white/90 active:scale-95 transition-all shadow-sm"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>استئناف</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function QuickAction({
  icon,
  title,
  subtitle,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-right transition-colors",
        getActionCardColor(color)
      )}
    >
      <div className="flex items-start justify-between mb-2">
        {icon}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] opacity-80 mt-0.5">{subtitle}</div>
    </motion.button>
  );
}

// =====================================================================
// Continue Learning Section
// =====================================================================

// Map category slug → Lucide icon component
const CATEGORY_ICON_MAP: Record<string, ElementType> = {
  verbal_analogy: Shuffle,
  sentence_completion: AlignRight,
  contextual_error: AlertCircle,
  odd_word_out: Shapes,
  reading_comprehension: BookOpen,
};

function CategoryIcon({ slug, className = "h-4 w-4" }: { slug: string; className?: string }) {
  const Icon = CATEGORY_ICON_MAP[slug] ?? BookOpen;
  return <Icon className={className} />;
}

function ContinueLearningSection({
  recentCategories,
  mastery,
  dueReviewCount,
  setView,
}: {
  recentCategories: RecentCategoryInfo[];
  mastery: CategoryMastery[];
  dueReviewCount: number;
  setView: (v: ViewKey) => void;
}) {
  const masteryMap = new Map(mastery.map((m) => [m.categorySlug, m]));

  // Find the weakest category (lowest mastery among studied ones)
  const studied = mastery.filter((m) => m.attempted > 0);
  const weakest = studied.length > 0 ? [...studied].sort((a, b) => a.mastery - b.mastery)[0] : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Title + due reviews badge */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display text-xl font-bold">تابع تعلّمك</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            استأنف من حيث توقّفت في كل فئة
          </p>
        </div>
        {dueReviewCount > 0 && (
          <button
            onClick={() => setView({ kind: "revision", tab: "flashcards" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors shrink-0"
          >
            <Clock className="h-3 w-3" />
            <span>{toArabicDigits(dueReviewCount)} مراجعة</span>
          </button>
        )}
      </div>

      {/* Horizontal-scrollable category cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1 snap-x">
        {recentCategories.map((rc, i) => {
          const meta = categoryMeta(rc.categorySlug);
          const hex = getColorHex(meta.color);
          const masteryInfo = masteryMap.get(rc.categorySlug);
          const masteryVal = masteryInfo?.mastery ?? 0;

          return (
            <motion.button
              key={rc.categorySlug}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView({ kind: "study", categorySlug: rc.categorySlug })}
              className="flex-shrink-0 w-56 snap-start rounded-2xl bg-card border border-border hover:border-primary/40 transition-all text-right overflow-hidden group"
            >
              {/* Color accent bar */}
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: hex.stroke }}
              />

              <div className="p-4">
                {/* Header: icon + name */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("h-8 w-8 rounded-lg grid place-items-center", meta.bg)}>
                    <CategoryIcon slug={rc.categorySlug} />
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="font-semibold text-sm leading-tight line-clamp-1">
                      {rc.categoryNameAr}
                    </div>
                    <div className={cn("text-[10px]", meta.text)}>
                      {masteryLabel(masteryVal)}
                    </div>
                  </div>
                </div>

                {/* Mastery bar */}
                <div className="mb-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: hex.stroke }}
                      initial={{ width: 0 }}
                      animate={{ width: `${masteryVal}%` }}
                      transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    إتقان {toArabicDigits(masteryVal)}%
                  </span>
                  {rc.attempted > 0 && (
                    <span>
                      آخر {toArabicDigits(Math.min(rc.attempted, 99))} سؤال
                    </span>
                  )}
                </div>

                {/* Accuracy chip with pulse animation */}
                <div className="mt-2 flex items-center gap-1.5">
                  <AnimatedChip
                    pulseKey={`${rc.categorySlug}-acc-${Math.floor(rc.accuracy / 5) * 5}`}
                    color={rc.accuracy >= 70 ? "emerald" : rc.accuracy >= 40 ? "amber" : "rose"}
                    label={`دقة ${toArabicDigits(rc.accuracy)}٪`}
                    size="sm"
                    delay={0.6 + i * 0.08}
                  />
                </div>

                {/* Hover action */}
                <div className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronLeft className="h-3 w-3" />
                  <span>استمر</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Recommended: weakest category */}
      {weakest && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-3 rounded-2xl bg-gradient-to-bl from-accent/40 to-accent/10 border border-accent/30 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm mb-0.5">
                مقترَح لك: حسّن {weakest.categoryNameAr}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                إتقان هذه الفئة {toArabicDigits(weakest.mastery)}% —
                {weakest.mastery < 40
                  ? " لا تزال في البداية. خصص حصة مذاكرة لتعزيز أساسياتك."
                  : weakest.mastery < 65
                  ? " تسير في الطريق الصحيح. استمر في التدريب لترفع مستواك."
                  : " أداؤك جيّد! القليل من المراجعة كافٍ للوصول إلى الإتقان."}
              </p>
            </div>
            <button
              onClick={() =>
                setView({ kind: "study", categorySlug: weakest.categorySlug })
              }
              className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shrink-0"
            >
              <span>ادرسها</span>
              <ChevronLeft className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
