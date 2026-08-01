"use client";

import { motion } from "framer-motion";
import { Flame, Shield, Trophy, Zap } from "lucide-react";
import { levelProgress } from "@/lib/engine/gamification";

interface Props {
  totalXp: number;
  streak: number;
  shields: number;
  level: number;
}

export function DashboardHeader({ totalXp, streak, shields, level }: Props) {
  const progress = levelProgress(totalXp);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Level & XP Info */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xl shadow-md">
            {level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-foreground">المستوى {level}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                {totalXp} XP
              </span>
            </div>
            {/* Level progress bar */}
            <div className="mt-2 w-48 sm:w-64">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>التقدم للمستوى {level + 1}</span>
                <span>{Math.round(progress.pct)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Streaks & Shields */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold shadow-xs">
            <Flame className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>{streak} يوم</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold shadow-xs">
            <Shield className="h-4 w-4 text-blue-500" />
            <span>{shields} درع</span>
          </div>
        </div>
      </div>
    </div>
  );
}
