"use client";

import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useAchievements, useUserProfile } from "@/lib/hooks/use-data";
import { toArabicDigits, formatPercent } from "@/lib/content/ui-helpers";
import { levelProgress } from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import { ChevronLeft, Trophy, Lock, Star } from "lucide-react";

export function AchievementsView() {
  const { setView } = useViewStore();
  const { data: achievements } = useAchievements();
  const { data: profile } = useUserProfile();

  const unlocked = new Set(profile?.unlockedAchievements ?? []);
  const lp = profile ? levelProgress(profile.totalXp) : null;

  // Group by category
  const byCategory = new Map<string, typeof achievements>();
  for (const a of achievements ?? []) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  }

  const categoryLabels: Record<string, string> = {
    volume: "الإنجاز الكمّي",
    streak: "السلاسل المتتالية",
    mastery: "الإتقان",
    speed: "السرعة",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 lg:pb-12">
      <div>
        <button
          onClick={() => setView({ kind: "stats" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>الإحصاءات</span>
        </button>
        <h1 className="font-display text-3xl font-bold mb-1">الإنجازات</h1>
        <p className="text-muted-foreground text-sm">
          كل إنجاز تفتحه يمنحك نقاط خبرة إضافية ويُوثّق رحلتك.
        </p>
      </div>

      {/* Level progress hero */}
      {lp && profile && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-bl from-amber-500 via-amber-600 to-orange-700 text-white p-6 relative overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, white 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
          <div className="relative flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur grid place-items-center">
              <Trophy className="h-8 w-8" fill="currentColor" />
            </div>
            <div className="flex-1">
              <div className="text-xs opacity-80">المستوى الحالي</div>
              <div className="text-4xl font-bold tabular-nums">{toArabicDigits(lp.level)}</div>
              <div className="text-xs opacity-90 mt-1">
                {toArabicDigits(profile.totalXp)} / {toArabicDigits(lp.nextLevelXp)} نقطة للمستوى التالي
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">التقدّم</div>
              <div className="text-2xl font-bold">{formatPercent(lp.pct)}</div>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${lp.pct}%` }}
              transition={{ duration: 0.7 }}
            />
          </div>
        </motion.div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card border border-border p-4 text-center">
          <div className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {toArabicDigits(unlocked.size)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">من {toArabicDigits(achievements?.length ?? 0)} إنجاز مفتوح</div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4 text-center">
          <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toArabicDigits(profile?.longestStreak ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">أطول سلسلة</div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4 text-center">
          <div className="text-3xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
            {toArabicDigits(profile?.totalXp ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">إجمالي النقاط</div>
        </div>
      </div>

      {/* Achievements grid by category */}
      {Array.from(byCategory.entries()).map(([cat, items], catIdx) => (
        <motion.section
          key={cat}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + catIdx * 0.05 }}
        >
          <h2 className="font-display text-xl font-bold mb-3">{categoryLabels[cat] ?? cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(items ?? []).map((a, i) => {
              const isUnlocked = unlocked.has(a.slug);
              return (
                <motion.div
                  key={a.slug}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + catIdx * 0.05 + i * 0.03 }}
                  className={cn(
                    "rounded-2xl border p-4 transition-all",
                    isUnlocked
                      ? "bg-gradient-to-bl from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-900"
                      : "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl grid place-items-center text-2xl shrink-0",
                        isUnlocked ? "bg-white dark:bg-amber-900/50 shadow-sm" : "bg-muted grayscale opacity-50"
                      )}
                    >
                      {isUnlocked ? a.iconAr : <Lock className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-semibold text-sm", !isUnlocked && "text-muted-foreground")}>
                        {a.nameAr}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {a.descriptionAr}
                      </div>
                      {isUnlocked && a.xpReward > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                          <Star className="h-3 w-3" fill="currentColor" />
                          <span>+{toArabicDigits(a.xpReward)} نقطة</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
