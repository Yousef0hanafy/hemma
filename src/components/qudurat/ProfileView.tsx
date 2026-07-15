"use client";

import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useServerData } from "@/lib/hooks/use-data";
import { fetchExtendedProfile } from "@/server/actions/student-profile";
import type { ExtendedProfile } from "@/server/actions/student-profile";
import { categoryMeta, toArabicDigits, formatPercent, relativeTimeAr, formatDuration } from "@/lib/content/ui-helpers";
import { masteryLabel } from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import { FullScreenLoader } from "./LoadingStates";
import {
  ChevronLeft,
  Star,
  Flame,
  Shield,
  Trophy,
  Target,
  Clock,
  Brain,
  Zap,
  Check,
  X,
  Calendar,
  BarChart3,
  BookOpen,
  Timer,
  Sparkles,
  Gauge,
  Medal,
  Settings,
  LogOut,
  TrendingUp,
  Bell,
  BellOff,
  ListChecks,
  Plus,
  Minus,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { AnimatedNumber } from "./shared/AnimatedNumber";
import { signOut } from "next-auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  supportsNotifications,
  requestPermission,
  getNotificationPrefs,
  setNotificationPrefs,
} from "@/lib/notifications";
import { fetchLearningGoals, upsertLearningGoal, deleteLearningGoal } from "@/server/actions/learning-goals";
import type { GoalsWithProgress, GoalType } from "@/server/actions/learning-goals";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "next-themes";

export function ProfileView() {
  const { setView, back } = useViewStore();
  const { data: profile, loading } = useServerData<ExtendedProfile | null>(
    "extended-profile",
    fetchExtendedProfile
  );
  const [activeTab, setActiveTab] = useState<"stats" | "achievements" | "activity">("stats");
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifEnabled, setNotifEnabled] = useState(() => {
    const p = getNotificationPrefs();
    return p.reviewReminder || p.streakAlert;
  });
  const [gearSpinning, setGearSpinning] = useState(false);
  const { data: goals, refresh: refreshGoals } = useServerData<GoalsWithProgress | null>("learning-goals", fetchLearningGoals);

  if (loading || !profile) {
    return <FullScreenLoader label="جارٍ تحميل الملف الشخصي…" />;
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
        <h1 className="font-display text-xl font-bold">الملف الشخصي</h1>
        <motion.button
          onClick={() => {
            setGearSpinning(true);
            setTimeout(() => setGearSpinning(false), 600);
            notifRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="relative flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="الإعدادات"
        >
          {/* Gear icon with spin animation */}
          <motion.div
            animate={{ rotate: gearSpinning ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <Settings className="h-4 w-4" />
          </motion.div>
          {/* Badge dot */}
          <motion.span
            initial={false}
            animate={{
              scale: notifEnabled ? 1 : 0.6,
              opacity: notifEnabled ? 1 : 0.4,
            }}
            transition={{ duration: 0.3 }}
            className={cn(
              "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-background",
              notifEnabled ? "bg-emerald-500" : "bg-muted-foreground/50"
            )}
          />
          <span className="hidden sm:inline">الإعدادات</span>
        </motion.button>
      </div>

      {/* ── Hero Section ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
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

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-white/15 ring-2 ring-white/30 overflow-hidden grid place-items-center">
              {profile.image ? (
                <img
                  src={profile.image}
                  alt={profile.name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-4xl font-bold text-white/80">
                  {profile.name?.charAt(0) ?? "?"}
                </div>
              )}
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 text-white px-3 py-0.5 text-xs font-bold shadow-md border-2 border-emerald-800">
              المستوى {toArabicDigits(profile.level)}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-right min-w-0">
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-1">
              {profile.name ?? "مستخدم"}
            </h2>
            {profile.email && (
              <p className="text-emerald-100/80 text-sm mb-2">{profile.email}</p>
            )}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Calendar className="h-3 w-3" />
                <span>انضم {relativeTimeAr(profile.createdAt)}</span>
              </span>
              {profile.role === "admin" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 text-amber-200 px-3 py-1 text-xs font-semibold">
                  <Star className="h-3 w-3" fill="currentColor" />
                  <span>مشرف</span>
                </span>
              )}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => signOut()}
            className="absolute top-4 left-4 rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* XP Progress Bar */}
        <div className="relative mt-6">
          <div className="flex items-center justify-between text-xs text-emerald-100/80 mb-1.5">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <AnimatedNumber value={profile.totalXp} /> XP
            </span>
            <span>المستوى {toArabicDigits(profile.levelProgress.nextLevelXp)} XP</span>
          </div>
          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-300"
              initial={{ width: 0 }}
              animate={{ width: `${profile.levelProgress.pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.section>

      {/* ── Stats Grid ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <ProfileStatCard
          icon={<Flame className="h-4 w-4" fill="currentColor" />}
          label="السلسلة الحالية"
          value={toArabicDigits(profile.currentStreak)}
          sublabel="يوم"
          color="orange"
        />
        <ProfileStatCard
          icon={<Trophy className="h-4 w-4" />}
          label="أطول سلسلة"
          value={toArabicDigits(profile.longestStreak)}
          sublabel="يوم"
          color="amber"
        />
        <ProfileStatCard
          icon={<Target className="h-4 w-4" />}
          label="الدقة الكلية"
          value={profile.overallAccuracy !== null ? formatPercent(profile.overallAccuracy) : "—"}
          sublabel={`${toArabicDigits(profile.correctAttempts)}/${toArabicDigits(profile.totalAttempts)}`}
          color="emerald"
        />
        <ProfileStatCard
          icon={<Brain className="h-4 w-4" />}
          label="المراجعات"
          value={toArabicDigits(profile.totalReviewsDone)}
          sublabel="بطاقة مكتملة"
          color="violet"
        />
      </motion.section>

      {/* ── Extended Stats ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {profile.totalExamSessions > 0 && (
          <ProfileMiniCard
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="الاختبارات"
            value={toArabicDigits(profile.totalExamSessions)}
            color="blue"
          />
        )}
        {profile.bestExamScore !== null && (
          <ProfileMiniCard
            icon={<Medal className="h-3.5 w-3.5" />}
            label="أفضل نتيجة"
            value={formatPercent(profile.bestExamScore)}
            color="amber"
          />
        )}
        {profile.avgExamScore !== null && (
          <ProfileMiniCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="متوسط الاختبارات"
            value={formatPercent(profile.avgExamScore)}
            color="emerald"
          />
        )}
        {profile.avgTimePerQuestion !== null && (
          <ProfileMiniCard
            icon={<Timer className="h-3.5 w-3.5" />}
            label="متوسط الوقت"
            value={`${toArabicDigits(profile.avgTimePerQuestion)}ث`}
            color="violet"
          />
        )}
        <ProfileMiniCard
          icon={<Shield className="h-3.5 w-3.5" />}
          label="دروع الحماية"
          value={toArabicDigits(profile.streakShields)}
          color="rose"
        />
        <ProfileMiniCard
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="المحاولات"
          value={toArabicDigits(profile.totalAttempts)}
          color="sky"
        />
      </motion.section>

      {/* ── Tabs: Stats | Achievements | Activity ── */}
      <div className="flex gap-1 rounded-full bg-muted p-1 max-w-md">
        <TabBtn active={activeTab === "stats"} onClick={() => setActiveTab("stats")} label="الفئات" />
        <TabBtn
          active={activeTab === "achievements"}
          onClick={() => setActiveTab("achievements")}
          label="الإنجازات"
        />
        <TabBtn active={activeTab === "activity"} onClick={() => setActiveTab("activity")} label="النشاط" />
      </div>

      {/* ── Category Mastery ── */}
      {activeTab === "stats" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-semibold mb-4">إتقان الفئات</h2>
          <div className="space-y-3">
            {profile.categoryMastery.map((m, i) => {
              const meta = categoryMeta(m.categorySlug);
              return (
                <div key={m.categorySlug} className="flex items-center gap-3">
                  <div className={cn("h-8 w-8 rounded-lg grid place-items-center text-xs shrink-0", meta.bg, meta.text)}>
                    {toArabicDigits(m.correct)}/{toArabicDigits(m.attempted)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{m.categoryNameAr}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatPercent(m.mastery)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${m.mastery}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
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
                  <div className="w-16 text-[10px] text-muted-foreground text-left">{masteryLabel(m.mastery)}</div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Achievements ── */}
      {activeTab === "achievements" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-semibold mb-1">الإنجازات</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {toArabicDigits(profile.unlockedSlugs.length)} من {toArabicDigits(profile.achievements.length)} مفتوح
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profile.achievements.map((ach) => {
              const unlocked = profile.unlockedSlugs.includes(ach.slug);
              return (
                <div
                  key={ach.slug}
                  className={cn(
                    "rounded-xl border p-3.5 text-center transition-all",
                    unlocked
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-border bg-muted/30 opacity-60"
                  )}
                >
                  <div className="text-2xl mb-1.5">{ach.iconAr}</div>
                  <div className={cn("text-xs font-semibold leading-tight mb-0.5", unlocked ? "text-foreground" : "text-muted-foreground")}>
                    {ach.nameAr}
                  </div>
                  <div className={cn("text-[10px] leading-tight", unlocked ? "text-muted-foreground" : "text-muted-foreground/60")}>
                    {ach.descriptionAr}
                  </div>
                  {unlocked && (
                    <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-semibold">
                      <Check className="h-2.5 w-2.5" />
                      <span>+{toArabicDigits(ach.xpReward)} XP</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Recent Activity ── */}
      {activeTab === "activity" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-semibold mb-4">آخر النشاطات</h2>
          {profile.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              لا توجد نشاطات بعد. ابدأ المذاكرة لتظهر هنا!
            </p>
          ) : (
            <div className="space-y-2">
              {profile.recentActivity.map((act, i) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Status icon */}
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                      act.isCorrect
                        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {act.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">
                      {act.categoryNameAr}
                    </div>
                    <p className="text-xs leading-relaxed line-clamp-1">{act.stem}</p>
                  </div>

                  {/* Time & mode */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {act.timeMs > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDuration(Math.round(act.timeMs / 1000))}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/70">
                      {relativeTimeAr(act.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* ── Quick Actions ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <QuickActionBtn
          icon={<BarChart3 className="h-4 w-4" />}
          label="الإحصاءات"
          onClick={() => setView({ kind: "stats" })}
          color="violet"
        />
        <QuickActionBtn
          icon={<Trophy className="h-4 w-4" />}
          label="الإنجازات"
          onClick={() => setView({ kind: "achievements" })}
          color="amber"
        />
        <QuickActionBtn
          icon={<BookOpen className="h-4 w-4" />}
          label="المذاكرة"
          onClick={() => setView({ kind: "study_setup" })}
          color="emerald"
        />
        <QuickActionBtn
          icon={<Settings className="h-4 w-4" />}
          label="الإعدادات"
          onClick={() => {}}
          color="slate"
        />
      </motion.div>

      {/* ── Theme Settings ── */}
      <ThemeSettingsSection />

      {/* ── Learning Goals ── */}
      <LearningGoalsSection
        goals={goals}
        onGoalChange={refreshGoals}
      />

      {/* ── Notification Settings ── */}
      <div ref={notifRef}>
        <NotificationSettingsSection onPrefsChange={setNotifEnabled} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme Settings Section
// ---------------------------------------------------------------------------

function ThemeSettingsSection() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const icon =
    !mounted ? null :
    theme === "dark" ? <Moon className="h-4 w-4 text-indigo-500" /> :
    theme === "light" ? <Sun className="h-4 w-4 text-amber-500" /> :
    <Monitor className="h-4 w-4 text-muted-foreground" />;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon ?? <Sun className="h-4 w-4 text-amber-500" />}
          <h2 className="font-semibold">المظهر</h2>
        </div>
        <ThemeToggle />
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
        اختر الوضع المناسب: فاتح، داكن، أو تلقائي (حسب إعدادات جهازك).
      </p>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Learning Goals Section
// ---------------------------------------------------------------------------

function LearningGoalsSection({
  goals,
  onGoalChange,
}: {
  goals: GoalsWithProgress | null;
  onGoalChange: () => void;
}) {
  const GOAL_CONFIGS: Array<{ type: GoalType; icon: string; label: string; unit: string; defaultTarget: number; presets: number[] }> = [
    { type: "attempts", icon: "📝", label: "أسئلة محلولة", unit: "سؤال", defaultTarget: 20, presets: [10, 20, 30, 50] },
    { type: "correct", icon: "✅", label: "إجابات صحيحة", unit: "إجابة", defaultTarget: 15, presets: [5, 10, 15, 25] },
    { type: "xp", icon: "⭐", label: "نقاط خبرة", unit: "XP", defaultTarget: 100, presets: [50, 100, 200, 500] },
  ];

  const [editingType, setEditingType] = useState<GoalType | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const handleEdit = useCallback((type: GoalType, currentTarget: number) => {
    setEditingType(type);
    setEditValue(currentTarget);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingType || editValue < 1) return;
    setSaving(true);
    try {
      await upsertLearningGoal(editingType, editValue);
      setEditingType(null);
      onGoalChange();
    } catch (e) {
      console.error("Failed to save goal:", e);
    } finally {
      setSaving(false);
    }
  }, [editingType, editValue, onGoalChange]);

  const handleDelete = useCallback(async (type: GoalType) => {
    try {
      await deleteLearningGoal(type);
      onGoalChange();
    } catch (e) {
      console.error("Failed to delete goal:", e);
    }
  }, [onGoalChange]);

  // Build a map of existing goals
  const goalMap = new Map<string, { target: number; current?: number; complete?: boolean }>();
  if (goals) {
    for (const g of goals.goals) {
      goalMap.set(g.type, { target: g.target });
    }
    for (const p of goals.progress) {
      const existing = goalMap.get(p.goal.type);
      if (existing) {
        existing.current = p.current;
        existing.complete = p.complete;
      }
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">الأهداف اليومية</h2>
        </div>
        {goals && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {toArabicDigits(goals.completedCount)}/{toArabicDigits(goals.totalCount)} مكتمل
          </span>
        )}
      </div>

      <div className="space-y-2">
        {GOAL_CONFIGS.map((cfg) => {
          const existing = goalMap.get(cfg.type);
          const target = existing?.target ?? cfg.defaultTarget;
          const isEditing = editingType === cfg.type;

          return (
            <div
              key={cfg.type}
              className="rounded-xl bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
            >
              {isEditing ? (
                /* Edit mode */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <span className="text-sm font-semibold">{cfg.label}</span>
                    </div>
                    <button
                      onClick={() => setEditingType(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      إلغاء
                    </button>
                  </div>

                  {/* Preset buttons */}
                  <div className="flex gap-1.5">
                    {cfg.presets.map((p) => (
                      <button
                        key={p}
                        onClick={() => setEditValue(p)}
                        className={cn(
                          "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                          editValue === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {toArabicDigits(p)} {cfg.unit}
                      </button>
                    ))}
                  </div>

                  {/* Custom value stepper */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setEditValue(Math.max(1, editValue - 5))}
                      className="h-8 w-8 rounded-lg bg-muted grid place-items-center hover:bg-muted/80"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-lg font-bold tabular-nums min-w-[4rem] text-center">
                      {toArabicDigits(editValue)}
                    </span>
                    <button
                      onClick={() => setEditValue(editValue + 5)}
                      className="h-8 w-8 rounded-lg bg-muted grid place-items-center hover:bg-muted/80"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={handleSave}
                    disabled={saving || editValue < 1}
                    className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "جارٍ الحفظ…" : "حفظ الهدف"}
                  </button>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{cfg.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {existing
                          ? `الهدف: ${toArabicDigits(target)} ${cfg.unit} يوميًا`
                          : "لم تحدّد هدفًا بعد"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {existing && existing.current !== undefined && (
                      <span className={cn(
                        "text-xs tabular-nums",
                        existing.complete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        {toArabicDigits(existing.current)}/{toArabicDigits(target)}
                      </span>
                    )}
                    {existing && existing.complete && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    <button
                      onClick={() => handleEdit(cfg.type, target)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                        existing
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {existing ? "تعديل" : "إضافة"}
                    </button>
                    {existing && (
                      <button
                        onClick={() => handleDelete(cfg.type)}
                        className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
        ستظهر أهدافك في لوحة التحكم الرئيسية ويمكنك متابعة تقدّمك اليومي.
      </p>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Notification Settings Section
// ---------------------------------------------------------------------------

function NotificationSettingsSection({
  onPrefsChange,
}: {
  onPrefsChange?: (enabled: boolean) => void;
}) {
  const [prefs, setPrefsLocal] = useState(getNotificationPrefs);
  const [permStatus, setPermStatus] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "denied")
  );

  const toggleSetting = (key: "reviewReminder" | "streakAlert") => {
    const updated = {
      ...prefs,
      [key]: !prefs[key],
    };
    setPrefsLocal(updated);
    setNotificationPrefs({ [key]: !prefs[key] });
    onPrefsChange?.(updated.reviewReminder || updated.streakAlert);
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    setPermStatus(result);
  };

  const supported = supportsNotifications();

  const notifEnabled = prefs.reviewReminder || prefs.streakAlert;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {notifEnabled && permStatus === "granted" ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          <h2 className="font-semibold">الإشعارات</h2>
        </div>

        {!supported && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            غير مدعوم في هذا المتصفح
          </span>
        )}
      </div>

      {supported && permStatus !== "granted" && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
          <p className="mb-2">
            يمكنك تفعيل الإشعارات لتذكيرك بالمراجعة اليومية والتنبيه عند خطر انقطاع السلسلة.
          </p>
          <button
            onClick={handleRequestPermission}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>تفعيل الإشعارات</span>
          </button>
        </div>
      )}

      {supported && (
        <div className="space-y-2">
          {/* Review reminder toggle */}
          <label className="flex items-center justify-between rounded-xl bg-muted/50 p-3 cursor-pointer hover:bg-muted/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg grid place-items-center",
                prefs.reviewReminder
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}>
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">تذكير المراجعة اليومية</div>
                <div className="text-[10px] text-muted-foreground">
                  إشعار يومي عند وجود بطاقات مراجعة مستحقة
                </div>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={prefs.reviewReminder}
              onClick={() => toggleSetting("reviewReminder")}
              disabled={permStatus !== "granted"}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                prefs.reviewReminder && permStatus === "granted"
                  ? "bg-emerald-500"
                  : "bg-input",
                permStatus !== "granted" && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  prefs.reviewReminder && permStatus === "granted" && "translate-x-5"
                )}
              />
            </button>
          </label>

          {/* Streak alert toggle */}
          <label className="flex items-center justify-between rounded-xl bg-muted/50 p-3 cursor-pointer hover:bg-muted/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg grid place-items-center",
                prefs.streakAlert
                  ? "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
                  : "bg-muted text-muted-foreground"
              )}>
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">تنبيه خطر السلسلة</div>
                <div className="text-[10px] text-muted-foreground">
                  إشعار عند عدم المذاكرة لليوم مع وجود سلسلة نشطة
                </div>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={prefs.streakAlert}
              onClick={() => toggleSetting("streakAlert")}
              disabled={permStatus !== "granted"}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                prefs.streakAlert && permStatus === "granted"
                  ? "bg-emerald-500"
                  : "bg-input",
                permStatus !== "granted" && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  prefs.streakAlert && permStatus === "granted" && "translate-x-5"
                )}
              />
            </button>
          </label>
        </div>
      )}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ProfileStatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  };

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="rounded-2xl bg-card border border-border p-4 text-center"
    >
      <div className={cn("inline-flex h-9 w-9 rounded-xl items-center justify-center mb-2", colorMap[color] ?? colorMap.emerald)}>
        {icon}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      <div className="text-[9px] text-muted-foreground/60">{sublabel}</div>
    </motion.div>
  );
}

function ProfileMiniCard({
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
  const colorMap: Record<string, string> = {
    blue: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    rose: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
    sky: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", colorMap[color] ?? colorMap.emerald)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}

function QuickActionBtn({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600",
    amber: "from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600",
    emerald: "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600",
    slate: "from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600",
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl bg-gradient-to-bl text-white px-4 py-3 text-xs font-semibold transition-all shadow-sm",
        colorMap[color] ?? colorMap.emerald
      )}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
