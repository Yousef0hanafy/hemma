"use client";

import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import {
  useCategoryMastery,
  useDailyActivity,
  useUserProfile,
  useRecentAttempts,
  useExamHistory,
  useSpeedStats,
} from "@/lib/hooks/use-data";
import { MasteryRing } from "./MasteryRing";
import {
  toArabicDigits,
  formatPercent,
  categoryMeta,
  relativeTimeAr,
  getStatCardColor,
  getColorPalette,
} from "@/lib/content/ui-helpers";
import {
  levelProgress,
  masteryLabel,
  todayKey,
  dayKeyOffset,
} from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Zap,
  Trophy,
  Check,
  X,
  LineChartIcon,
  Timer,
  ChevronLeft,
} from "lucide-react";
import { FullScreenLoader } from "./LoadingStates";

export function StatsView() {
  const { setView } = useViewStore();
  const { data: mastery, loading: masteryLoading } = useCategoryMastery();
  const { data: activity } = useDailyActivity(84);
  const { data: profile, loading: profileLoading } = useUserProfile();
  const { data: recent } = useRecentAttempts(15);
  const { data: speedStats } = useSpeedStats();

  if (profileLoading || masteryLoading) {
    return <FullScreenLoader label="جارٍ تحميل الإحصاءات…" />;
  }

  const lp = profile ? levelProgress(profile.totalXp) : null;

  // Build 84-day heatmap grid (12 weeks × 7 days)
  const today = todayKey();
  const heatDays = Array.from({ length: 84 }, (_, i) => dayKeyOffset(83 - i));
  const activityMap = new Map((activity ?? []).map((a) => [a.date, a]));

  // Find weakest category
  const weakest = (mastery ?? [])
    .filter((m) => m.attempted > 0)
    .sort((a, b) => a.mastery - b.mastery)[0];

  const totalAttempts = (activity ?? []).reduce((s, a) => s + a.attempts, 0);
  const totalCorrect = (activity ?? []).reduce((s, a) => s + a.correct, 0);
  const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32 lg:pb-12">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">لوحة الإحصاءات</h1>
        <p className="text-muted-foreground text-sm">
          فهم نقاط قوتك ومواطن ضعفك هو مفتاح التحسّن.
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="الدقة الكلية"
          value={formatPercent(accuracy)}
          color="emerald"
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="إجمالي المحاولات"
          value={toArabicDigits(totalAttempts)}
          color="amber"
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="النقاط"
          value={toArabicDigits(profile?.totalXp ?? 0)}
          color="violet"
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="المستوى"
          value={toArabicDigits(profile?.level ?? 1)}
          color="rose"
        />
      </div>

      {/* Activity heatmap */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">نشاط آخر ١٢ أسبوعًا</h2>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>أقل</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((lvl) => (
                <div
                  key={lvl}
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor:
                      lvl === 0 ? "var(--muted)" :
                      `oklch(0.55 0.13 155 / ${0.25 + lvl * 0.18})`,
                  }}
                />
              ))}
            </div>
            <span>أكثر</span>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <div
            className="grid grid-flow-col grid-rows-7 gap-1 min-w-max"
            dir="ltr"
          >
            {heatDays.map((d) => {
              const a = activityMap.get(d);
              const count = a?.attempts ?? 0;
              const level =
                count === 0 ? 0 :
                count <= 2 ? 1 :
                count <= 5 ? 2 :
                count <= 10 ? 3 : 4;
              return (
                <div
                  key={d}
                  className="h-3.5 w-3.5 rounded-sm transition-transform hover:scale-125"
                  style={{
                    backgroundColor:
                      level === 0 ? "var(--muted)" :
                      `oklch(0.55 0.13 155 / ${0.25 + level * 0.18})`,
                  }}
                  title={`${d}: ${toArabicDigits(count)} محاولة`}
                />
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Speed stats */}
      <SpeedStatsSection speedStats={speedStats ?? []} />

      {/* Category mastery breakdown */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-card border border-border p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">إتقان الفئات بالتفصيل</h2>
        </div>
        <div className="space-y-3">
          {(mastery ?? []).map((m) => {
            const meta = categoryMeta(m.categorySlug);
            return (
              <div key={m.categorySlug} className="flex items-center gap-3">
                <div className="w-28 sm:w-32 text-sm font-medium truncate">{m.categoryNameAr}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{toArabicDigits(m.correct)} صحيحة من {toArabicDigits(m.attempted)}</span>
                    <span className="tabular-nums">{formatPercent(m.mastery)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.mastery}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      style={{
                        backgroundColor:
                          meta.color === "emerald" ? "#10b981" :
                          meta.color === "amber" ? "#f59e0b" :
                          meta.color === "rose" ? "#f43f5e" :
                          meta.color === "violet" ? "#8b5cf6" :
                          meta.color === "cyan" ? "#06b6d4" : "#64748b",
                      }}
                    />
                  </div>
                </div>
                <div className="w-16 text-xs text-muted-foreground text-left">
                  {masteryLabel(m.mastery)}
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Weakness recommendation */}
      {weakest && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-gradient-to-bl from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/20 border border-amber-200 dark:border-amber-900 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white grid place-items-center shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">توصية شخصية</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                أداؤك في فئة <strong>{weakest.categoryNameAr}</strong> يحتاج تحسينًا
                (إتقان {formatPercent(weakest.mastery)}). ننصحك بحصة مذاكرة مكثّفة فيها.
              </p>
              <button
                onClick={() => setView({ kind: "study", categorySlug: weakest.categorySlug })}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-4 py-2 text-xs font-semibold hover:bg-amber-600"
              >
                <Target className="h-3.5 w-3.5" />
                <span>ابدأ المراجعة</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {/* Exam history link */}
      <ExamHistoryCard />

      {/* Recent attempts */}
      {recent && recent.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-semibold mb-3">آخر المحاولات</h2>
          <div className="space-y-1.5">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 text-xs"
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-md grid place-items-center shrink-0",
                    a.isCorrect
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {a.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 text-muted-foreground">
                  {a.mode === "study" ? "مذاكرة" : a.mode === "exam" ? "اختبار" : a.mode === "revision" ? "مراجعة" : "بطاقة"}
                </div>
                <div className="text-muted-foreground tabular-nums">
                  {relativeTimeAr(a.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className={cn("inline-flex h-8 w-8 rounded-lg items-center justify-center mb-2", getStatCardColor(color))}>
        {icon}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function SpeedStatsSection({ speedStats }: { speedStats: SpeedStatDTO[] }) {
  const withAttempts = speedStats.filter((s) => s.attempted > 0);
  if (withAttempts.length === 0) return null;

  const maxTime = Math.max(...withAttempts.map((s) => s.avgTimeSec), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Timer className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">متوسط سرعة الإجابة</h2>
      </div>
      <div className="space-y-3">
        {withAttempts.map((s) => {
          const colorTheme = s.colorTheme ?? "emerald";
          const palette = getColorPalette(colorTheme);
          const barWidth = maxTime > 0 ? (s.avgTimeSec / maxTime) * 100 : 0;

          // Speed tier: ≤15s fast, ≤30s moderate, >30s slow
          const speedTier =
            s.avgTimeSec <= 15 ? "emerald" :
            s.avgTimeSec <= 30 ? "amber" :
            "rose";
          const tierPalette = getColorPalette(speedTier);

          return (
            <div key={s.categorySlug} className="flex items-center gap-3">
              <div className="w-28 sm:w-32 text-sm font-medium truncate">{s.categoryNameAr}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{toArabicDigits(s.attempted)} محاولة</span>
                  <span
                    className={cn("tabular-nums font-semibold", tierPalette.text)}
                  >
                    {toArabicDigits(s.avgTimeSec)} ث
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden" dir="ltr">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ backgroundColor: palette.hex.stroke }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------

function ExamHistoryCard() {
  const { setView } = useViewStore();
  const { data: sessions } = useExamHistory();

  if (!sessions || sessions.length === 0) return null;

  const avg = sessions.slice(0, 5).reduce((s, sess) => s + sess.scorePercent, 0) / Math.min(5, sessions.length);
  const trend = sessions.length >= 2
    ? sessions[0].scorePercent - sessions[sessions.length - 1].scorePercent
    : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      onClick={() => setView({ kind: "exam_history" })}
      className="w-full rounded-2xl bg-gradient-to-bl from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-900 p-5 text-right hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500 text-white grid place-items-center">
            <LineChartIcon className="h-5 w-5" />
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-sm">سجل الاختبارات</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {toArabicDigits(sessions.length)} اختبار · متوسط {formatPercent(avg)}
              {trend !== 0 && (
                <span className={cn("mr-1", trend > 0 ? "text-emerald-600" : "text-rose-600")}>
                  ({trend > 0 ? "↑" : "↓"}{toArabicDigits(Math.abs(Math.round(trend)))}) 
                </span>
              )}
            </p>
          </div>
        </div>
        <ChevronLeft className="h-5 w-5 text-violet-500 shrink-0" />
      </div>
    </motion.button>
  );
}
