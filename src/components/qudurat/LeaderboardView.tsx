"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useServerData } from "@/lib/hooks/use-data";
import { fetchLeaderboard } from "@/server/actions/leaderboard";
import type { LeaderboardData, LeaderboardMode } from "@/server/actions/leaderboard";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { FullScreenLoader } from "./LoadingStates";
import {
  Trophy,
  Zap,
  Flame,
  TrendingUp,
  ChevronLeft,
  Crown,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Leaderboard View
// ---------------------------------------------------------------------------

export function LeaderboardView() {
  const { setView } = useViewStore();
  const [mode, setMode] = useState<LeaderboardMode>("xp");
  const { data: lb, loading } = useServerData<LeaderboardData | null>(
    `leaderboard-${mode}`,
    () => fetchLeaderboard(mode)
  );

  const modes: Array<{ key: LeaderboardMode; label: string; icon: React.ReactNode }> = [
    { key: "xp", label: "نقاط الخبرة", icon: <Zap className="h-3.5 w-3.5" /> },
    { key: "weekly", label: "أسبوعي", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "streak", label: "السلسلة", icon: <Flame className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 lg:pb-12">
      {/* ── Header ── */}
      <div>
        <button
          onClick={() => setView({ kind: "stats" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>الإحصاءات</span>
        </button>
        <h1 className="font-display text-3xl font-bold mb-1">لوحة المتصدرين</h1>
        <p className="text-muted-foreground text-sm">
          تنافس مع زملائك وتعقّد تقدّمك بين المتعلّمين.
        </p>
      </div>

      {/* ── Mode tabs ── */}
      <div className="flex gap-1 rounded-full bg-muted p-1 max-w-md">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all",
              mode === m.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <FullScreenLoader label="جارٍ تحميل المتصدرين…" />
      ) : !lb || lb.entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p>لا يوجد متصدرون بعد. ابدأ المذاكرة لتظهر في القائمة!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* ── Podium (top 3) ── */}
          {mode === "xp" && lb.entries.length >= 3 && (
            <PodiumSection entries={lb.entries.slice(0, 3)} mode={mode} />
          )}

          {/* ── Current user highlight (if not in top) ── */}
          {lb.currentUser && !lb.entries.slice(0, 10).some((e) => e.isMe) && (
            <div className="rounded-2xl bg-gradient-to-bl from-primary/10 to-primary/5 border border-primary/30 p-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center text-xs font-bold tabular-nums text-primary">
                  {toArabicDigits(lb.currentUser.rank)}
                </div>
                <UserAvatar entry={lb.currentUser} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {lb.currentUser.name ?? "مستخدم"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    المستوى {toArabicDigits(lb.currentUser.level)}
                  </div>
                </div>
                <ScoreBadge entry={lb.currentUser} mode={mode} />
              </div>
            </div>
          )}

          {/* ── Leader list ── */}
          {lb.entries.map((entry, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className={cn(
                  "rounded-xl border p-3.5 flex items-center gap-3 transition-colors",
                  entry.isMe
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "h-9 w-9 rounded-xl grid place-items-center text-sm font-bold shrink-0 tabular-nums",
                  i === 0
                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    : i === 1
                    ? "bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    : i === 2
                    ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  {medal ?? toArabicDigits(entry.rank)}
                </div>

                {/* Avatar + Name */}
                <UserAvatar entry={entry} size="sm" />

                {/* Name + level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">
                      {entry.name ?? "مستخدم"}
                    </span>
                    {entry.isMe && (
                      <span className="text-[9px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 font-semibold">
                        أنت
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>المستوى {toArabicDigits(entry.level)}</span>
                    {mode === "streak" && (
                      <>
                        <span className="opacity-30">·</span>
                        <span>أطول: {toArabicDigits(entry.longestStreak)} يوم</span>
                      </>
                    )}
                    {mode === "weekly" && entry.totalXp > 0 && (
                      <>
                        <span className="opacity-30">·</span>
                        <span>إجمالي: {toArabicDigits(entry.totalXp)} XP</span>
                      </>
                    )}
                    {mode === "xp" && entry.currentStreak > 0 && (
                      <>
                        <span className="opacity-30">·</span>
                        <span>السلسلة: {toArabicDigits(entry.currentStreak)} يوم</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score */}
                <ScoreBadge entry={entry} mode={mode} />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Stats summary ── */}
      {lb && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-card border border-border p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              إجمالي {toArabicDigits(lb.totalUsers)} متعلّم في المنصة
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PodiumSection({
  entries,
  mode,
}: {
  entries: LeaderboardData["entries"];
  mode: LeaderboardMode;
}) {
  // Visual order: 2nd, 1st, 3rd (left to right in RTL)
  const [second, first, third] = [entries[1], entries[0], entries[2]];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-gradient-to-bl from-amber-600 via-amber-700 to-orange-800 text-white p-6 sm:p-8 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-center gap-1.5 text-amber-200 text-sm font-medium mb-1">
          <Crown className="h-4 w-4" />
          <span>أفضل المتعلّمين</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-center mb-8">
          {first.name ?? "المتصدّر"}
        </h2>

        {/* Podium cards */}
        <div className="flex items-end justify-center gap-4">
          {/* 2nd place */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-2xl bg-white/15 ring-2 ring-white/20 grid place-items-center text-2xl">
              🥈
            </div>
            <span className="text-xs font-semibold text-white/80 truncate max-w-[80px] text-center">
              {second?.name ?? ""}
            </span>
            <div className="h-16 w-20 rounded-t-xl bg-white/10" />
          </div>

          {/* 1st place */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-2xl bg-amber-400/20 ring-2 ring-amber-400/50 grid place-items-center text-3xl">
              👑
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[80px] text-center">
              {first.name ?? ""}
            </span>
            <div className="h-24 w-20 rounded-t-xl bg-white/15 flex items-end justify-center pb-3">
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">
                  {mode === "xp"
                    ? toArabicDigits(first.totalXp)
                    : mode === "weekly"
                    ? toArabicDigits(first.weeklyXp)
                    : toArabicDigits(first.currentStreak)}
                </div>
                <div className="text-[9px] text-white/70">
                  {mode === "xp" ? "XP" : mode === "weekly" ? "هذا الأسبوع" : "يوم"}
                </div>
              </div>
            </div>
          </div>

          {/* 3rd place */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-2xl bg-white/15 ring-2 ring-white/20 grid place-items-center text-2xl">
              🥉
            </div>
            <span className="text-xs font-semibold text-white/80 truncate max-w-[80px] text-center">
              {third?.name ?? ""}
            </span>
            <div className="h-12 w-20 rounded-t-xl bg-white/10" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UserAvatar({
  entry,
  size = "sm",
}: {
  entry: {
    name: string | null;
    image: string | null;
  };
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const initial = entry.name?.charAt(0) ?? "?";

  return (
    <div className={cn("rounded-xl shrink-0 overflow-hidden grid place-items-center bg-muted font-bold", sizeClasses)}>
      {entry.image ? (
        <img
          src={entry.image}
          alt={entry.name ?? ""}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-muted-foreground">{initial}</span>
      )}
    </div>
  );
}

function ScoreBadge({
  entry,
  mode,
}: {
  entry: LeaderboardData["entries"][number];
  mode: LeaderboardMode;
}) {
  const score =
    mode === "xp"
      ? entry.totalXp
      : mode === "weekly"
      ? entry.weeklyXp
      : entry.currentStreak;

  const unit = mode === "xp" ? "XP" : mode === "weekly" ? "XP" : "يوم";

  return (
    <div className="shrink-0 text-right">
      <div className="text-base font-bold tabular-nums">
        {toArabicDigits(score)}
      </div>
      <div className="text-[9px] text-muted-foreground">{unit}</div>
    </div>
  );
}
