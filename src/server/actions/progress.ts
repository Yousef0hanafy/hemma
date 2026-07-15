// =====================================================================
// Server Actions — attempts, favorites, profile, gamification
// =====================================================================
"use server";

import { db } from "@/lib/db";
import {
  AttemptDTO,
  CategoryMastery,
  DailyActivityDTO,
  UserProfileDTO,
  AchievementDTO,
  ExamSessionDTO,
  ReviewScheduleDTO,
  SpeedStatDTO,
  StudyMode,
  ArabicLetter,
} from "@/lib/content/dto";
import { toAttemptDTO } from "@/lib/content/dto";
import {
  computeMastery,
  getCrossedXpMilestones,
  getCrossedStreakMilestone,
  levelForXp,
  questForDate,
  todayKey,
  updateStreak,
  weekStartKey,
  weeklyChallengeForDate,
  xpForCorrect,
  xpForExamSession,
} from "@/lib/engine/gamification";
import { getUserBucket } from "@/lib/auth-utils";

// USER_BUCKET is now derived from the authenticated user's session.
// Each Server Action resolves it via getUserBucket().

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchUserProfile(): Promise<UserProfileDTO> {
  const userBucket = await getUserBucket();
  const profile = await db.userProfile.upsert({
    where: { userBucket },
    update: {},
    create: { userBucket },
  });
  return {
    userBucket: profile.userBucket,
    totalXp: profile.totalXp,
    level: profile.level,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActiveDate: profile.lastActiveDate,
    streakShields: profile.streakShields,
    unlockedAchievements: JSON.parse(profile.unlockedAchievements) as string[],
  };
}

export async function fetchAchievements(): Promise<AchievementDTO[]> {
  const items = await db.achievement.findMany({ orderBy: { threshold: "asc" } });
  return items.map((a) => ({
    slug: a.slug,
    nameAr: a.nameAr,
    descriptionAr: a.descriptionAr,
    iconAr: a.iconAr,
    xpReward: a.xpReward,
    threshold: a.threshold,
    category: a.category,
  }));
}

// ---------------------------------------------------------------------------
// Attempts — recording + querying
// ---------------------------------------------------------------------------

export interface RecordAttemptInput {
  questionId: string;
  selectedKey: ArabicLetter | null;
  isCorrect: boolean;
  mode: StudyMode;
  sessionId?: string;
  timeMs?: number;
  confidence?: number;
}

export interface RecordAttemptResult {
  attempt: AttemptDTO;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number | null;
  unlockedAchievements: AchievementDTO[];
  streakChanged: boolean;
  shieldConsumed: boolean;
  shieldEarned: boolean;
  /** XP milestones crossed (e.g., first time reaching 1000 XP) */
  xpMilestonesHit: Array<{ xp: number; name: string; emoji: string }>;
  /** Streak milestone crossed (e.g., first time reaching 30-day streak) */
  streakMilestoneHit: { days: number; name: string; emoji: string } | null;
}

export async function recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptResult> {
  const userBucket = await getUserBucket();

  // Pull question for difficulty
  const question = await db.question.findUnique({
    where: { id: input.questionId },
    select: { difficulty: true, categoryId: true },
  });
  if (!question) throw new Error("Question not found");

  // 1. Create the attempt
  const attempt = await db.attempt.create({
    data: {
      userBucket,
      questionId: input.questionId,
      selectedKey: input.selectedKey,
      isCorrect: input.isCorrect,
      mode: input.mode,
      sessionId: input.sessionId ?? null,
      timeMs: input.timeMs ?? 0,
      confidence: input.confidence ?? 0,
    },
  });

  // 2. Compute XP
  const xp = input.isCorrect
    ? xpForCorrect(question.difficulty as "easy" | "medium" | "hard", input.mode)
    : 0;

  // 3. Update profile (XP + streak)
  const profile = await db.userProfile.findUnique({ where: { userBucket } });
  if (!profile) throw new Error("Profile missing");

  const today = todayKey();
  const streakUpdate = updateStreak(profile.currentStreak, profile.lastActiveDate, profile.streakShields);
  const newXp = profile.totalXp + xp;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > profile.level;

  // Detect milestones
  const xpMilestonesHit = getCrossedXpMilestones(profile.totalXp, newXp);
  const streakMilestoneHit = getCrossedStreakMilestone(
    profile.currentStreak,
    streakUpdate.streak
  );

  const updatedProfile = await db.userProfile.update({
    where: { userBucket },
    data: {
      totalXp: newXp,
      level: newLevel,
      currentStreak: streakUpdate.streak,
      longestStreak: Math.max(profile.longestStreak, streakUpdate.streak),
      lastActiveDate: today,
      streakShields: streakUpdate.shields,
    },
  });

  // 4. Update daily activity
  const existingDaily = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket, date: today } },
  });

  if (existingDaily) {
    const catStats: Record<string, { attempts: number; correct: number }> =
      JSON.parse(existingDaily.categoryStats);
    const cur = catStats[question.categoryId] ?? { attempts: 0, correct: 0 };
    catStats[question.categoryId] = {
      attempts: cur.attempts + 1,
      correct: cur.correct + (input.isCorrect ? 1 : 0),
    };
    await db.dailyActivity.update({
      where: { id: existingDaily.id },
      data: {
        attempts: existingDaily.attempts + 1,
        correct: existingDaily.correct + (input.isCorrect ? 1 : 0),
        xpEarned: existingDaily.xpEarned + xp,
        categoryStats: JSON.stringify(catStats),
      },
    });
  } else {
    await db.dailyActivity.create({
      data: {
        userBucket,
        date: today,
        attempts: 1,
        correct: input.isCorrect ? 1 : 0,
        xpEarned: xp,
        categoryStats: JSON.stringify({
          [question.categoryId]: { attempts: 1, correct: input.isCorrect ? 1 : 0 },
        }),
      },
    });
  }

  // 5. Check for new achievements
  const unlocked: AchievementDTO[] = [];
  const alreadyUnlocked = new Set(JSON.parse(updatedProfile.unlockedAchievements) as string[]);
  const allAchievements = await db.achievement.findMany();

  // Compute aggregates for threshold checks
  const totalAttempts = await db.attempt.count({ where: { userBucket } });
  const totalCorrect = await db.attempt.count({ where: { userBucket, isCorrect: true } });
  const longestStreak = updatedProfile.longestStreak;
  const totalReviews = await db.reviewSchedule.count({
    where: { userBucket, lastReviewedAt: { not: null } },
  });

  // Get mastery levels per category for "master_category" check
  // Total questions per category (efficient groupBy aggregation)
  const catStats = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });
  const catTotal: Record<string, number> = {};
  for (const c of catStats) catTotal[c.categoryId] = c._count;

  // Aggregate attempts per category directly in the database using a JOIN,
  // instead of loading ALL attempts + ALL questions into memory.
  interface CatAttemptRow {
    categoryId: string;
    attempted: number;
    correct: number;
  }
  const catAttemptRows = await db.$queryRaw<CatAttemptRow[]>`
    SELECT q."categoryId",
           COUNT(a.id)::int AS attempted,
           SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
    FROM attempts a
    INNER JOIN questions q ON a."questionId" = q.id
    WHERE a."userBucket" = ${userBucket}
    GROUP BY q."categoryId"
  `;

  const catCorrect: Record<string, { attempted: number; correct: number }> = {};
  for (const row of catAttemptRows) {
    catCorrect[row.categoryId] = {
      attempted: row.attempted,
      correct: row.correct,
    };
  }
  const maxMastery = Math.max(
    0,
    ...Object.entries(catTotal).map(([catId, total]) =>
      computeMastery(total, catCorrect[catId]?.attempted ?? 0, catCorrect[catId]?.correct ?? 0)
    )
  );

  // Compute exam session scores once — shared by exam_pass and exam_perfect
  const examSessionScores = await db.$queryRaw<{ scorePercent: number }[]>`
    SELECT COALESCE(
      ROUND(
        SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::numeric
        / COUNT(*)::numeric * 100
      ), 0
    )::int AS "scorePercent"
    FROM attempts a
    WHERE a."userBucket" = ${userBucket}
      AND a.mode = 'exam'
      AND a."sessionId" IS NOT NULL
    GROUP BY a."sessionId"
  `;
  const maxExamScore = Math.max(0, ...examSessionScores.map((s) => s.scorePercent));

for (const a of allAchievements) {
    if (alreadyUnlocked.has(a.slug)) continue;
    let unlockedNow = false;

    // بداية الـ switch الصحيحة
    switch (a.category) {
      case "volume":
        if (a.slug === "first_correct") unlockedNow = totalCorrect >= a.threshold;
        else if (a.slug.includes("questions")) unlockedNow = totalAttempts >= a.threshold;
        break;

      case "streak":
        unlockedNow = longestStreak >= a.threshold;
        break;

      case "mastery":
        if (a.slug === "master_category") unlockedNow = maxMastery >= a.threshold;
        else if (a.slug === "all_rounder") {
          // Check if ALL categories have mastery >= threshold
          const allAbove = Object.entries(catTotal).every(([catId, total]) => {
            const stats = catCorrect[catId];
            if (!stats || stats.attempted === 0) return false;
            return computeMastery(total, stats.attempted, stats.correct) >= a.threshold;
          });
          unlockedNow = allAbove;
        }
        else if (a.slug === "exam_pass" || a.slug === "exam_perfect") {
          // threshold represents score %
          // Use pre-computed maxExamScore from shared query
          unlockedNow = maxExamScore >= a.threshold;
        }
        break;

      case "speed": // تم دمجها الآن بشكل سليم داخل الـ switch
        if (a.slug === "speed_3s" || a.slug === "lightning") {
          // Check if current attempt was answered fast enough
          // Guard against timeMs = 0 (unset) by requiring > 0
          const timeMs = input.timeMs ?? 9999;
          const timeSec = timeMs / 1000;
          unlockedNow = timeMs > 0 && timeSec <= a.threshold && input.isCorrect;
        } else if (a.slug === "speed_10") {
          // Check if last 10 attempts have average time under 15s
          const recentAttemptTimes = await db.attempt.findMany({
            where: { userBucket, isCorrect: true },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { timeMs: true },
          });
          if (recentAttemptTimes.length >= 10) {
            const avgTime = recentAttemptTimes.reduce((s, t) => s + t.timeMs, 0) / recentAttemptTimes.length;
            unlockedNow = avgTime <= 15000;
          }
        }
        break;

      case "revision":
        unlockedNow = totalReviews >= a.threshold;
        break;
    } // نهاية الـ switch الصحيحة والوحيدة

    if (unlockedNow) {
      const xpReward = a.xpReward;
      const newAch = [...alreadyUnlocked, a.slug];
      await db.userProfile.update({
        where: { userBucket },
        data: {
          unlockedAchievements: JSON.stringify(newAch),
          totalXp: { increment: xpReward },
          level: levelForXp(updatedProfile.totalXp + xpReward),
        },
      });
      alreadyUnlocked.add(a.slug);
      unlocked.push({
        slug: a.slug,
        nameAr: a.nameAr,
        descriptionAr: a.descriptionAr,
        iconAr: a.iconAr,
        xpReward: a.xpReward,
        threshold: a.threshold,
        category: a.category,
      });
    }
  }

  return {
    attempt: toAttemptDTO(attempt),
    xpEarned: xp + unlocked.reduce((s, a) => s + a.xpReward, 0),
    leveledUp,
    newLevel: leveledUp ? newLevel : null,
    unlockedAchievements: unlocked,
    streakChanged: streakUpdate.streak !== profile.currentStreak,
    shieldConsumed: streakUpdate.shieldConsumed,
    shieldEarned: streakUpdate.shieldEarned,
    xpMilestonesHit,
    streakMilestoneHit,
  };
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function toggleFavorite(questionId: string): Promise<boolean> {
  const userBucket = await getUserBucket();
  const existing = await db.favorite.findUnique({
    where: { userBucket_questionId: { userBucket, questionId } },
  });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  await db.favorite.create({
    data: { userBucket, questionId },
  });
  return true;
}

export async function fetchFavoriteIds(): Promise<string[]> {
  const userBucket = await getUserBucket();
  const favs = await db.favorite.findMany({
    where: { userBucket },
    select: { questionId: true },
  });
  return favs.map((f) => f.questionId);
}

// ---------------------------------------------------------------------------
// Stats & Analytics
// ---------------------------------------------------------------------------

export async function fetchCategoryMastery(): Promise<CategoryMastery[]> {
  const userBucket = await getUserBucket();
  const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
  const totals = await db.question.groupBy({ by: ["categoryId"], _count: true });
  const totalMap = new Map(totals.map((t) => [t.categoryId, t._count]));

  const allAttempts = await db.attempt.findMany({
    where: { userBucket },
    include: { question: { select: { categoryId: true } } },
  });

  const stats: Record<string, { attempted: number; correct: number }> = {};
  for (const a of allAttempts) {
    const cid = a.question.categoryId;
    stats[cid] = stats[cid] ?? { attempted: 0, correct: 0 };
    stats[cid].attempted++;
    if (a.isCorrect) stats[cid].correct++;
  }

  return cats.map((c) => {
    const total = totalMap.get(c.id) ?? 0;
    const s = stats[c.id] ?? { attempted: 0, correct: 0 };
    return {
      categorySlug: c.slug,
      categoryNameAr: c.nameAr,
      colorTheme: c.colorTheme,
      icon: c.icon,
      total,
      attempted: s.attempted,
      correct: s.correct,
      mastery: computeMastery(total, s.attempted, s.correct),
    };
  });
}

export async function fetchRecentAttempts(limit = 20): Promise<AttemptDTO[]> {
  const userBucket = await getUserBucket();
  const items = await db.attempt.findMany({
    where: { userBucket },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { question: { include: { category: true, source: true } } },
  });
  return items.map(toAttemptDTO);
}

export async function fetchMistakeQuestionIds(limit = 50): Promise<string[]> {
  const userBucket = await getUserBucket();
  // Load most recent attempts, deduplicate in-memory (first = most recent),
  // then return questions whose latest attempt was wrong.
  // Using a generous take cap instead of loading ALL rows (old behavior).
  const latestAttempts = await db.attempt.findMany({
    where: { userBucket },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { questionId: true, isCorrect: true },
  });
  const seen = new Set<string>();
  const mistakes: string[] = [];
  for (const a of latestAttempts) {
    if (seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    if (!a.isCorrect && mistakes.length < limit) {
      mistakes.push(a.questionId);
    }
  }
  return mistakes;
}

export async function fetchDailyActivity(days = 84): Promise<DailyActivityDTO[]> {
  const userBucket = await getUserBucket();
  const items = await db.dailyActivity.findMany({
    where: { userBucket },
    orderBy: { date: "asc" },
    take: days,
  });
  return items.map((a) => ({
    date: a.date,
    attempts: a.attempts,
    correct: a.correct,
    xpEarned: a.xpEarned,
  }));
}

export async function fetchDailyQuestProgress() {
  const userBucket = await getUserBucket();
  const today = todayKey();
  const quest = questForDate(today);
  const todayActivity = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket, date: today } },
  });
  if (!todayActivity) {
    return { quest, current: 0, target: quest.target, complete: false };
  }
  let current = 0;
  switch (quest.metric) {
    case "attempts":
      current = todayActivity.attempts;
      break;
    case "correct":
      current = todayActivity.correct;
      break;
    case "xp":
      current = todayActivity.xpEarned;
      break;
    case "categories": {
      const stats = JSON.parse(todayActivity.categoryStats) as Record<string, unknown>;
      current = Object.keys(stats).length;
      break;
    }
  }
  return {
    quest,
    current,
    target: quest.target,
    complete: current >= quest.target,
  };
}

// ---------------------------------------------------------------------------
// Spaced Repetition (SM-2)
// ---------------------------------------------------------------------------

import { applySm2, DEFAULT_SRS_STATE, type SrsQuality } from "@/lib/engine/srs";

/**
 * Fetch all question IDs that are due for review (nextReviewAt <= now),
 * ordered by nextReviewAt ascending (most overdue first).
 */
export async function fetchDueReviewIds(limit = 50): Promise<string[]> {
  const userBucket = await getUserBucket();
  const now = new Date();
  const schedules = await db.reviewSchedule.findMany({
    where: { userBucket, nextReviewAt: { lte: now } },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    select: { questionId: true },
  });
  return schedules.map((s) => s.questionId);
}

/**
 * Fetch the total count of due reviews for dashboard badges.
 */
export async function fetchDueReviewCount(): Promise<number> {
  const userBucket = await getUserBucket();
  const now = new Date();
  return db.reviewSchedule.count({
    where: { userBucket, nextReviewAt: { lte: now } },
  });
}

/**
 * Record a review rating and update the SM-2 schedule.
 * If no schedule exists yet, creates one with default values.
 */
export async function submitSrsReview(
  questionId: string,
  quality: SrsQuality
): Promise<ReviewScheduleDTO> {
  const userBucket = await getUserBucket();

  // Upsert: get existing or create default
  let schedule = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket, questionId } },
  });

  const currentState = schedule
    ? {
        easiness: schedule.easiness,
        interval: schedule.interval,
        repetitions: schedule.repetitions,
      }
    : DEFAULT_SRS_STATE;

  const { newState, nextReviewAt } = applySm2(currentState, quality);

  schedule = await db.reviewSchedule.upsert({
    where: { userBucket_questionId: { userBucket, questionId } },
    create: {
      userBucket,
      questionId,
      easiness: newState.easiness,
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt,
      lastReviewedAt: new Date(),
    },
    update: {
      easiness: newState.easiness,
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt,
      lastReviewedAt: new Date(),
    },
  });

  return {
    questionId: schedule.questionId,
    easiness: schedule.easiness,
    interval: schedule.interval,
    repetitions: schedule.repetitions,
    nextReviewAt: schedule.nextReviewAt.toISOString(),
    lastReviewedAt: schedule.lastReviewedAt?.toISOString() ?? null,
  };
}

/**
 * Auto-register questions for SRS when the user gets them wrong in study mode.
 * Creates a review schedule if one doesn't exist yet.
 */
export async function autoRegisterMistake(questionId: string): Promise<void> {
  const userBucket = await getUserBucket();
  const existing = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket, questionId } },
  });
  if (existing) return; // Already tracked

  await db.reviewSchedule.create({
    data: {
      userBucket,
      questionId,
      easiness: DEFAULT_SRS_STATE.easiness,
      interval: DEFAULT_SRS_STATE.interval,
      repetitions: DEFAULT_SRS_STATE.repetitions,
      nextReviewAt: new Date(), // Due immediately
      lastReviewedAt: null,
    },
  });
}

/**
 * Fetch the date of the next upcoming SRS review (the soonest future review).
 * Returns null if there are no upcoming reviews scheduled.
 */
export async function fetchNextReviewDate(): Promise<string | null> {
  const userBucket = await getUserBucket();
  const now = new Date();
  const schedule = await db.reviewSchedule.findFirst({
    where: { userBucket, nextReviewAt: { gte: now } },
    orderBy: { nextReviewAt: "asc" },
    select: { nextReviewAt: true },
  });
  return schedule?.nextReviewAt.toISOString() ?? null;
}

/**
 * Fetch stored exam session data (questionIds, selections) for the detail view.
 */
export async function fetchExamSessionData(sessionId: string): Promise<{
  questionIds: string[];
  selections: Record<string, string | null>;
  actualDurationSec: number | null;
} | null> {
  const userBucket = await getUserBucket();
  const data = await db.examSessionData.findUnique({
    where: { sessionId },
  });
  if (!data) return null;
  return {
    questionIds: JSON.parse(data.questionIds) as string[],
    selections: JSON.parse(data.selections) as Record<string, string | null>,
    actualDurationSec: data.actualDurationSec,
  };
}

/**
 * Count how many SRS reviews were submitted today.
 * Used for the daily review goal progress bar.
 */
export async function fetchTodayReviewCount(): Promise<number> {
  const userBucket = await getUserBucket();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  return db.reviewSchedule.count({
    where: {
      userBucket,
      lastReviewedAt: { gte: startOfDay, lt: endOfDay },
    },
  });
}

// ---------------------------------------------------------------------------
// Recently Studied Categories — for "continue learning" dashboard section
// ---------------------------------------------------------------------------

export interface RecentCategoryInfo {
  categorySlug: string;
  categoryNameAr: string;
  colorTheme: string | null;
  icon: string | null;
  lastAttemptAt: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

/**
 * Fetch the most recently studied categories, ordered by most recent attempt.
 * Returns up to `limit` categories with attempt stats and the latest attempt date.
 */
export async function fetchRecentlyStudiedCategories(limit = 5): Promise<RecentCategoryInfo[]> {
  const userBucket = await getUserBucket();

  const rows = await db.$queryRaw<{
    categorySlug: string;
    categoryNameAr: string;
    colorTheme: string | null;
    icon: string | null;
    lastAttemptAt: Date;
    attempted: number;
    correct: number;
  }[]>`
    SELECT
      c.slug AS "categorySlug",
      c."nameAr" AS "categoryNameAr",
      c."colorTheme",
      c.icon,
      MAX(a."createdAt") AS "lastAttemptAt",
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
    FROM attempts a
    INNER JOIN questions q ON a."questionId" = q.id
    INNER JOIN categories c ON q."categoryId" = c.id
    WHERE a."userBucket" = ${userBucket}
    GROUP BY c.slug, c."nameAr", c."colorTheme", c.icon
    ORDER BY MAX(a."createdAt") DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    categorySlug: r.categorySlug,
    categoryNameAr: r.categoryNameAr,
    colorTheme: r.colorTheme,
    icon: r.icon,
    lastAttemptAt: r.lastAttemptAt.toISOString(),
    attempted: r.attempted,
    correct: r.correct,
    accuracy: r.attempted > 0 ? Math.round((r.correct / r.attempted) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// Weekly Challenge
// ---------------------------------------------------------------------------

/** Fetch the current weekly challenge with progress. */
export async function fetchWeeklyChallenge(): Promise<{
  challenge: { slug: string; descriptionAr: string; target: number; metric: string; rewardLabel: string };
  current: number;
  target: number;
  complete: boolean;
} | null> {
  const userBucket = await getUserBucket();

  const start = weekStartKey();
  const end = weekEndKey();
  const challenge = weeklyChallengeForDate(start);

  const weekActivity = await db.dailyActivity.findMany({
    where: {
      userBucket,
      date: { gte: start, lte: end },
    },
  });

  let current = 0;
  for (const day of weekActivity) {
    switch (challenge.metric) {
      case "attempts": current += day.attempts; break;
      case "correct": current += day.correct; break;
      case "xp": current += day.xpEarned; break;
    }
  }

  return {
    challenge,
    current,
    target: challenge.target,
    complete: current >= challenge.target,
  };
}

// ---------------------------------------------------------------------------
// Speed Stats — average answer time per category
// ---------------------------------------------------------------------------

export async function fetchSpeedStats(): Promise<SpeedStatDTO[]> {
  const userBucket = await getUserBucket();

  const rows = await db.$queryRaw<{
    categoryId: string;
    categorySlug: string;
    categoryNameAr: string;
    colorTheme: string | null;
    attempted: number;
    avgTimeMs: number;
  }[]>`
    SELECT
      q."categoryId",
      c.slug AS "categorySlug",
      c."nameAr" AS "categoryNameAr",
      c."colorTheme",
      COUNT(a.id)::int AS attempted,
      COALESCE(ROUND(AVG(a."timeMs")::numeric), 0)::int AS "avgTimeMs"
    FROM attempts a
    INNER JOIN questions q ON a."questionId" = q.id
    INNER JOIN categories c ON q."categoryId" = c.id
    WHERE a."userBucket" = ${userBucket}
      AND a."timeMs" > 0
    GROUP BY q."categoryId", c.slug, c."nameAr", c."colorTheme"
    ORDER BY "avgTimeMs" ASC
  `;

  return rows.map((r) => ({
    categorySlug: r.categorySlug,
    categoryNameAr: r.categoryNameAr,
    colorTheme: r.colorTheme,
    attempted: r.attempted,
    avgTimeSec: r.avgTimeMs > 0 ? Math.round(r.avgTimeMs / 100) / 10 : 0,
  }));
}

// ---------------------------------------------------------------------------
// Exam history
// ---------------------------------------------------------------------------

/**
 * Fetch all completed exam sessions grouped by sessionId, ordered newest first.
 * Each session is built from the Attempt rows sharing the same sessionId
 * where mode = 'exam'.
 */
export async function fetchExamHistory(): Promise<ExamSessionDTO[]> {
  const userBucket = await getUserBucket();

  // Get all exam attempts with sessionId, grouped by sessionId
  const attempts = await db.attempt.findMany({
    where: { userBucket, mode: "exam", sessionId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      sessionId: true,
      isCorrect: true,
      createdAt: true,
    },
  });

  // Group by sessionId
  const groups = new Map<
    string,
    { createdAt: Date; total: number; correct: number }
  >();
  for (const a of attempts) {
    if (!a.sessionId) continue;
    if (!groups.has(a.sessionId)) {
      groups.set(a.sessionId, {
        createdAt: a.createdAt,
        total: 0,
        correct: 0,
      });
    }
    const g = groups.get(a.sessionId)!;
    g.total++;
    if (a.isCorrect) g.correct++;
  }

  return Array.from(groups.entries())
    .map(([sessionId, g]) => ({
      sessionId,
      date: g.createdAt.toISOString(),
      total: g.total,
      correct: g.correct,
      wrong: g.total - g.correct,
      skipped: 0, // We can't determine skipped from attempt records alone
      scorePercent: g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0,
      durationSec: 0, // Not stored per-session yet
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ---------------------------------------------------------------------------
// Exam session (finalize)
// ---------------------------------------------------------------------------

export async function finalizeExamSession(
  sessionId: string,
  questionIds: string[],
  selections: Record<string, ArabicLetter | null>,
  actualDurationSec?: number
): Promise<{
  total: number;
  correct: number;
  scorePercent: number;
  xpEarned: number;
}> {
  // Batch-fetch all correct keys in a single query instead of N individual ones
  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, correctKey: true },
  });
  const correctKeyMap = new Map(questions.map((q) => [q.id, q.correctKey]));

  let correct = 0;
  for (const qid of questionIds) {
    const sel = selections[qid];
    if (!sel) continue;
    const correctKey = correctKeyMap.get(qid);
    if (!correctKey) continue;
    if (sel === correctKey) correct++;
  }
  const total = questionIds.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const xpEarned = xpForExamSession(scorePercent);

  const userBucket = await getUserBucket();

  // Award session XP
  await db.userProfile.update({
    where: { userBucket },
    data: { totalXp: { increment: xpEarned } },
  });

  // Update daily activity xp
  const today = todayKey();
  const daily = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket, date: today } },
  });
  if (daily) {
    await db.dailyActivity.update({
      where: { id: daily.id },
      data: { xpEarned: { increment: xpEarned } },
    });
  }

  // Store session data for history detail view
  await db.examSessionData.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userBucket,
      questionIds: JSON.stringify(questionIds),
      selections: JSON.stringify(selections),
      durationSec: 0, // We don't store the scheduled duration separately
      actualDurationSec: actualDurationSec ?? null,
    },
    update: {
      questionIds: JSON.stringify(questionIds),
      selections: JSON.stringify(selections),
      actualDurationSec: actualDurationSec ?? null,
    },
  });

  return { total, correct, scorePercent, xpEarned };
}
