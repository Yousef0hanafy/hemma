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
} from "lucide-react";
import { useViewStore } from "@/lib/store/view-store";
import {
  useUserProfile,
  useCategoryMastery,
  useDailyActivity,
  useDailyQuest,
  useSources,
  useCategories,
} from "@/lib/hooks/use-data";
import {
  levelProgress,
  masteryLabel,
  todayKey,
  dayKeyOffset,
} from "@/lib/engine/gamification";
import {
  toArabicDigits,
  formatPercent,
  categoryMeta,
  categoryDisplayName,
} from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { MasteryRing } from "./MasteryRing";

export function DashboardView() {
  const { setView } = useViewStore();
  const { data: profile } = useUserProfile();
  const { data: mastery } = useCategoryMastery();
  const { data: activity } = useDailyActivity();
  const { data: quest } = useDailyQuest();
  const { data: sources } = useSources();
  const { data: categories } = useCategories();

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
          <div className="text-2xl font-bold tabular-nums">
            {toArabicDigits(profile?.totalXp ?? 0)}
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
          <div className="text-2xl font-bold tabular-nums">
            {toArabicDigits(profile?.longestStreak ?? 0)}
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

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  amber:   "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  rose:    "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  violet:  "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900",
};

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
        COLOR_MAP[color]
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
