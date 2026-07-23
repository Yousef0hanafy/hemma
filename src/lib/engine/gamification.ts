// =====================================================================
// Gamification Engine — pure functions, no DB or React deps
// =====================================================================

import { Difficulty } from "../content/dto";

// ---------------------------------------------------------------------------
// XP & Leveling
// ---------------------------------------------------------------------------

/** XP earned per correct answer, modulated by difficulty. */
export function xpForCorrect(difficulty: Difficulty, mode: string): number {
  const base = mode === "exam" ? 15 : 10;
  const mult = difficulty === "hard" ? 1.5 : difficulty === "easy" ? 0.8 : 1;
  return Math.round(base * mult);
}

/** XP for completing an exam session, scaled by score. */
export function xpForExamSession(scorePercent: number): number {
  return Math.round(50 + scorePercent * 1.5); // 50..200
}

/** Level threshold — gentle quadratic curve.
 *  Level N requires totalXp >= 50 * N^2
 */
export function levelForXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 50)) + 1;
}

/** XP required to reach a given level. */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

/** Progress to next level: { current, next, pct }. */
export function levelProgress(totalXp: number) {
  const level = levelForXp(totalXp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = next > cur ? ((totalXp - cur) / (next - cur)) * 100 : 100;
  return { level, current: totalXp, nextLevelXp: next, pct: Math.min(100, Math.max(0, pct)) };
}

// ---------------------------------------------------------------------------
// Mastery — per-category mastery score (0..100)
// ---------------------------------------------------------------------------

/**
 * Computes a mastery score for a category given attempts.
 * Formula: weighted blend of accuracy and coverage, with recency decay.
 * - accuracy = correct / attempted
 * - coverage = attempted / total
 * - mastery = (accuracy * 0.6 + coverage * 0.4) * 100, with a minimum bar
 *
 * If fewer than 3 attempts, mastery is capped at 30% to avoid false confidence.
 */
export function computeMastery(
  total: number,
  attempted: number,
  correct: number
): number {
  if (total === 0) return 0;
  if (attempted === 0) return 0;
  const accuracy = correct / attempted;
  const coverage = Math.min(1, attempted / Math.max(total, 1));
  let mastery = (accuracy * 0.6 + coverage * 0.4) * 100;
  if (attempted < 3) mastery = Math.min(mastery, 30);
  return Math.round(Math.max(0, Math.min(100, mastery)));
}

/** Returns a humanized mastery label in Arabic. */
export function masteryLabel(score: number): string {
  if (score >= 85) return "متمكّن";
  if (score >= 65) return "متقدّم";
  if (score >= 40) return "في الطريق";
  if (score >= 15) return "مبتدئ";
  return "غير مُختبَر";
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM-DD" in user-local timezone. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the date key N days before the given date. */
export function dayKeyOffset(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return todayKey(d);
}

/**
 * Compute the new streak given the previous streak + lastActiveDate.
 * - If lastActiveDate is today: no change.
 * - If lastActiveDate is yesterday: +1.
 * - If lastActiveDate is older and shields > 0: shield consumed (no change).
 * - Otherwise: streak resets to 1 (today's activity counts).
 */
export function updateStreak(
  prevStreak: number,
  prevLastActive: string | null,
  shields: number
): { streak: number; shields: number; shieldConsumed: boolean; shieldEarned: boolean } {
  const today = todayKey();
  if (prevLastActive === today) {
    return { streak: prevStreak, shields, shieldConsumed: false, shieldEarned: false };
  }
  const yesterday = dayKeyOffset(1);
  if (prevLastActive === yesterday) {
    const newStreak = prevStreak + 1;
    // Earn a shield every 7-day streak milestone (7, 14, 21, …)
    const shieldEarned = newStreak % 7 === 0 && prevStreak % 7 !== 0;
    const newShields = shields + (shieldEarned ? 1 : 0);
    return { streak: newStreak, shields: newShields, shieldConsumed: false, shieldEarned };
  }
  // Gap detected
  if (shields > 0 && prevStreak > 0) {
    return { streak: prevStreak, shields: shields - 1, shieldConsumed: true, shieldEarned: false };
  }
  return { streak: 1, shields, shieldConsumed: false, shieldEarned: false };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** XP thresholds that trigger celebratory toasts when crossed. */
export const XP_MILESTONES = [
  { xp: 100, label: "نقطة خبرة", emoji: "🌟", name: "١٠٠ نقطة خبرة" },
  { xp: 500, label: "نقطة خبرة", emoji: "⭐", name: "٥٠٠ نقطة خبرة" },
  { xp: 1000, label: "نقطة", emoji: "💫", name: "١٠٠٠ نقطة خبرة" },
  { xp: 2000, label: "نقطة", emoji: "🎯", name: "٢٠٠٠ نقطة خبرة" },
  { xp: 5000, label: "نقطة", emoji: "🏆", name: "٥٠٠٠ نقطة خبرة" },
  { xp: 10000, label: "نقطة", emoji: "👑", name: "١٠٠٠٠ نقطة خبرة" },
  { xp: 25000, label: "نقطة", emoji: "💎", name: "٢٥٠٠٠ نقطة خبرة" },
  { xp: 50000, label: "نقطة", emoji: "🔥", name: "٥٠٠٠٠ نقطة خبرة" },
];

/** Streak thresholds that trigger celebrations. */
export const STREAK_MILESTONES = [
  { days: 7, emoji: "🔥", name: "أسبوع متواصل" },
  { days: 14, emoji: "💪", name: "١٤ يوم متواصل" },
  { days: 21, emoji: "⭐", name: "٢١ يوم متواصل" },
  { days: 30, emoji: "👑", name: "٣٠ يوم متواصل — شهر كامل!" },
  { days: 60, emoji: "💎", name: "٦٠ يوم متواصل — شهرين!" },
  { days: 100, emoji: "🏆", name: "١٠٠ يوم متواصل — إنجاز أسطوري!" },
];

/** Check which XP milestones were crossed. */
export function getCrossedXpMilestones(
  oldXp: number,
  newXp: number
): Array<{ xp: number; name: string; emoji: string }> {
  return XP_MILESTONES.filter(
    (m) => oldXp < m.xp && newXp >= m.xp
  );
}

/** Check if a streak milestone was crossed. */
export function getCrossedStreakMilestone(
  oldStreak: number,
  newStreak: number
): { days: number; name: string; emoji: string } | null {
  return (
    STREAK_MILESTONES.find(
      (m) => oldStreak < m.days && newStreak >= m.days
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Weekly Challenge
// ---------------------------------------------------------------------------

export interface WeeklyChallenge {
  slug: string;
  descriptionAr: string;
  target: number;
  metric: "attempts" | "correct" | "xp";
  rewardLabel: string;
}

const WEEKLY_CHALLENGE_POOL: WeeklyChallenge[] = [
  { slug: "w50_attempts", descriptionAr: "حُل ٥٠ سؤالًا هذا الأسبوع", target: 50, metric: "attempts", rewardLabel: "+١٠٠ XP" },
  { slug: "w30_correct", descriptionAr: "أجب ٣٠ إجابة صحيحة", target: 30, metric: "correct", rewardLabel: "+١٢٠ XP" },
  { slug: "w100_xp", descriptionAr: "اجمع ١٠٠ نقطة خبرة", target: 100, metric: "xp", rewardLabel: "+١٥٠ XP" },
  { slug: "w80_attempts", descriptionAr: "حُل ٨٠ سؤالًا", target: 80, metric: "attempts", rewardLabel: "+٢٠٠ XP + درع 🔥" },
  { slug: "w50_correct", descriptionAr: "٥٠ إجابة صحيحة", target: 50, metric: "correct", rewardLabel: "+٢٥٠ XP 🎯" },
];

/**
 * Get the weekly challenge for a given ISO week.
 * Deterministic — same challenge for the entire week.
 */
export function weeklyChallengeForDate(dateStr: string): WeeklyChallenge {
  let sum = 0;
  for (let i = 0; i < dateStr.length; i++) sum += dateStr.charCodeAt(i);
  return WEEKLY_CHALLENGE_POOL[sum % WEEKLY_CHALLENGE_POOL.length];
}

/**
 * Compute the start of the current ISO week (Monday).
 * Returns "YYYY-MM-DD".
 */
export function weekStartKey(d = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d);
  monday.setDate(diff);
  return todayKey(monday);
}

/**
 * Compute the end of the current ISO week (Sunday).
 * Returns "YYYY-MM-DD".
 */
export function weekEndKey(d = new Date()): string {
  const monday = new Date(weekStartKey(d));
  monday.setDate(monday.getDate() + 6);
  return todayKey(monday);
}

// ---------------------------------------------------------------------------
// Daily Quest
// ---------------------------------------------------------------------------

export interface DailyQuest {
  slug: string;
  descriptionAr: string;
  target: number;
  metric: "attempts" | "correct" | "xp" | "categories";
}

const QUEST_POOL: DailyQuest[] = [
  { slug: "q10_attempts",  descriptionAr: "حُل ١٠ أسئلة اليوم",                target: 10, metric: "attempts" },
  { slug: "q7_correct",    descriptionAr: "أجب ٧ إجابات صحيحة",                target: 7,  metric: "correct" },
  { slug: "q3_categories", descriptionAr: "تدرّب على ٣ فئات مختلفة",            target: 3,  metric: "categories" },
  { slug: "q5_attempts",   descriptionAr: "حُل ٥ أسئلة في وضع المذاكرة",        target: 5,  metric: "attempts" },
  { slug: "q30_xp",        descriptionAr: "اجمع ٣٠ نقطة خبرة اليوم",           target: 30, metric: "xp" },
];

/** Deterministic quest for a given date — same quest all day, varies by date. */
export function questForDate(dateKey: string): DailyQuest {
  // Sum char codes of dateKey mod pool length
  let sum = 0;
  for (let i = 0; i < dateKey.length; i++) sum += dateKey.charCodeAt(i);
  return QUEST_POOL[sum % QUEST_POOL.length];
}

// ---------------------------------------------------------------------------
// Question selection — adaptive (basic heuristic for MVP)
// ---------------------------------------------------------------------------

/**
 * Pick next question indices for a session.
 * - Pool: all question IDs that match the filters
 * - Avoid recently-asked (last 10)
 * - Prefer questions with low accuracy or no attempts (weakness detection)
 * - Shuffle a small slice for variety
 */
export function pickAdaptiveOrder<T>(
  pool: T[],
  opts: {
    recentIds?: Set<string>;
    accuracyById?: Map<string, number>;
    getId: (item: T) => string;
    seed?: number;
  }
): T[] {
  if (pool.length === 0) return [];
  const recent = opts.recentIds ?? new Set<string>();
  const acc = opts.accuracyById ?? new Map<string, number>();

  // Bucket: unseen first, then by ascending accuracy
  const unseen: T[] = [];
  const seen: T[] = [];
  for (const item of pool) {
    if (recent.has(opts.getId(item))) continue;
    if (acc.has(opts.getId(item))) seen.push(item);
    else unseen.push(item);
  }
  seen.sort((a, b) => {
    const aA = acc.get(opts.getId(a)) ?? 1;
    const bA = acc.get(opts.getId(b)) ?? 1;
    return aA - bA; // ascending accuracy = weakest first
  });

  // Shuffle unseen for variety
  const shuffledUnseen = shuffle(unseen, opts.seed);

  // Add recent back at the end if pool is small
  const recentItems = pool.filter((item) => recent.has(opts.getId(item)));
  return [...shuffledUnseen, ...seen, ...recentItems];
}

/** Simple seeded shuffle (mulberry32-like). */
export function shuffle<T>(arr: T[], seed?: number): T[] {
  const out = [...arr];
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
