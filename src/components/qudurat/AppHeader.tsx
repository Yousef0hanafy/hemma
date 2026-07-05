"use client";

import { motion } from "framer-motion";
import { Flame, Star, Shield, ChevronRight } from "lucide-react";
import { useViewStore } from "@/lib/store/view-store";
import { useUserProfile } from "@/lib/hooks/use-data";
import { levelProgress, masteryLabel } from "@/lib/engine/gamification";
import { toArabicDigits, formatPercent } from "@/lib/content/ui-helpers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppHeader() {
  const { view, setView } = useViewStore();
  const { data: profile } = useUserProfile();

  const lp = profile ? levelProgress(profile.totalXp) : null;
  const onDashboard = view.kind === "dashboard";

  return (
    <header className="glass sticky top-0 z-40 border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo / Title */}
        <button
          onClick={() => setView({ kind: "dashboard" })}
          className="flex items-center gap-2.5 group"
          aria-label="الصفحة الرئيسية — منصة همّة التعليمية"
        >
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white dark:bg-white/10 grid place-items-center shadow-sm ring-1 ring-border/50 overflow-hidden transition-transform group-hover:scale-105 group-active:scale-95">
            <img
              src="/logo-splash.png"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
              draggable={false}
            />
          </div>
          <div className="text-right">
            <div className="font-display text-base sm:text-lg font-bold leading-tight text-foreground">
              منصة همّة التعليمية
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
              التحضير المتميّز لاختبار القدرات
            </div>
          </div>
        </button>

        {/* Stats chips */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Streak chip */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border ${
                    profile && profile.currentStreak > 0
                      ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Flame
                    className={`h-3.5 w-3.5 ${
                      profile && profile.currentStreak > 0 ? "flame-active" : ""
                    }`}
                    fill={profile && profile.currentStreak > 0 ? "currentColor" : "none"}
                  />
                  <span className="tabular-nums">
                    {toArabicDigits(profile?.currentStreak ?? 0)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>سلسلة الأيام المتتالية</p>
                {profile && profile.streakShields > 0 && (
                  <p className="text-xs opacity-80 flex items-center gap-1 mt-1">
                    <Shield className="h-3 w-3" /> {toArabicDigits(profile.streakShields)} درع حماية
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* XP chip */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300">
                  <Star className="h-3.5 w-3.5" fill="currentColor" />
                  <span className="tabular-nums">
                    {toArabicDigits(profile?.totalXp ?? 0)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>نقاط الخبرة</p>
                {lp && (
                  <p className="text-xs opacity-80 mt-1">
                    المستوى {toArabicDigits(lp.level)} — يتقدّم {formatPercent(lp.pct)} نحو المستوى التالي
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Level badge */}
          {lp && (
            <button
              onClick={() => setView({ kind: "achievements" })}
              className="hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border bg-primary text-primary-foreground border-primary hover:bg-primary/90 transition-colors"
              aria-label="الإنجازات"
            >
              <span>المستوى {toArabicDigits(lp.level)}</span>
              <ChevronRight className="h-3 w-3 rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* XP progress bar (thin) */}
      {lp && !onDashboard && (
        <div className="h-0.5 w-full bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${lp.pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}
    </header>
  );
}
