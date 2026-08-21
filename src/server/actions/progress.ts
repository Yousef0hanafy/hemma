// =====================================================================
// Server Actions — user progress, attempts, favorites, SRS
// =====================================================================
"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { toQuestionDTO } from "@/lib/content/dto";
import { applySm2, type SrsQuality } from "@/lib/engine/srs";
import { computeMastery, levelForXp, levelProgress, todayKey, dayKeyOffset, updateStreak } from "@/lib/engine/gamification";

export interface RecordAttemptInput {
  questionId: string;
  selectedKey: string | null;
  isCorrect: boolean;
  mode: "study" | "exam" | "revision";
  sessionId?: string;
  timeMs?: number;
  confidence?: number;
}

export async function recordAttempt(input: RecordAttemptInput) {
  const userId = await requirePermission("attempt", "create");
  
  // Validate input
  if (!input.questionId || typeof input.questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }
  
  if (!["study", "exam", "revision"].includes(input.mode)) {
    throw new Error("وضع المحاولة غير صالح");
  }

  // Record the attempt
  const attempt = await db.attempt.create({
    data: {
      userBucket: userId,
      questionId: input.questionId,
      selectedKey: input.selectedKey,
      isCorrect: input.isCorrect,
      mode: input.mode,
      sessionId: input.sessionId,
      timeMs: input.timeMs ?? 0,
      confidence: input.confidence ?? 0,
    },
  });

  // Update daily activity
  const today = todayKey();
  const xpEarned = input.isCorrect ? 10 : 2; // give 2 XP for effort even if incorrect

  await db.dailyActivity.upsert({
    where: { userBucket_date: { userBucket: userId, date: today } },
    create: {
      userBucket: userId,
      date: today,
      attempts: 1,
      correct: input.isCorrect ? 1 : 0,
      xpEarned,
    },
    update: {
      attempts: { increment: 1 },
      correct: { increment: input.isCorrect ? 1 : 0 },
      xpEarned: { increment: xpEarned },
    },
  });

  // Get or create user profile
  let profile = await db.userProfile.findUnique({
    where: { userBucket: userId },
  });

  let leveledUp = false;
  let newLevel = 1;

  if (!profile) {
    profile = await db.userProfile.create({
      data: {
        userBucket: userId,
        totalXp: xpEarned,
        level: 1,
        currentStreak: 1,
        longestStreak: 1,
        streakShields: 1,
        lastActiveDate: today,
      },
    });
    newLevel = 1;
  } else {
    const streakResult = updateStreak(
      profile.currentStreak,
      profile.lastActiveDate ?? "",
      profile.streakShields
    );

    const oldLevel = profile.level;
    const newTotalXp = profile.totalXp + xpEarned;
    const computedLevel = levelForXp(newTotalXp);
    if (computedLevel > oldLevel) {
      leveledUp = true;
    }
    newLevel = computedLevel;

    profile = await db.userProfile.update({
      where: { userBucket: userId },
      data: {
        totalXp: newTotalXp,
        currentStreak: streakResult.streak,
        longestStreak: Math.max(profile.longestStreak, streakResult.streak),
        streakShields: streakResult.shields,
        lastActiveDate: today,
        level: newLevel,
      },
    });
  }

  return {
    attemptId: attempt.id,
    xpEarned,
    leveledUp,
    newLevel,
    unlockedAchievements: [] as string[],
    shieldEarned: false,
    xpMilestonesHit: [] as Array<{ xp: number; label: string }>,
    streakMilestoneHit: undefined as { streak: number; label: string } | undefined,
  };
}

export async function toggleFavorite(questionId: string) {
  const userId = await requirePermission("favorite", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Check if already favorited
  const existing = await db.favorite.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (existing) {
    await db.favorite.delete({
      where: { userBucket_questionId: { userBucket: userId, questionId } },
    });
    return { favorited: false };
  } else {
    await db.favorite.create({
      data: { userBucket: userId, questionId },
    });
    return { favorited: true };
  }
}

export async function submitSrsReview(questionId: string, quality: SrsQuality) {
  const userId = await requirePermission("review", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Update SRS schedule
  const schedule = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (schedule) {
    const { newState, nextReviewAt } = applySm2(
      {
        easiness: schedule.easiness,
        interval: schedule.interval,
        repetitions: schedule.repetitions,
      },
      quality
    );

    await db.reviewSchedule.update({
      where: { userBucket_questionId: { userBucket: userId, questionId } },
      data: {
        easiness: newState.easiness,
        interval: newState.interval,
        repetitions: newState.repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  } else {
    // Create new schedule
    const { newState, nextReviewAt } = applySm2(
      { easiness: 2.5, interval: 0, repetitions: 0 },
      quality
    );
    
    await db.reviewSchedule.create({
      data: {
        userBucket: userId,
        questionId,
        easiness: newState.easiness,
        interval: newState.interval,
        repetitions: newState.repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  }

  return { success: true };
}

export async function autoRegisterMistake(questionId: string) {
  const userId = await requirePermission("attempt", "create");
  
  if (!questionId || typeof questionId !== "string") {
    throw new Error("معرّف السؤال غير صالح");
  }

  // Ensure SRS schedule exists
  const existing = await db.reviewSchedule.findUnique({
    where: { userBucket_questionId: { userBucket: userId, questionId } },
  });

  if (!existing) {
    const nextReviewAt = new Date();
    nextReviewAt.setHours(nextReviewAt.getHours() + 1);
    
    await db.reviewSchedule.create({
      data: {
        userBucket: userId,
        questionId,
        easiness: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewAt,
      },
    });
  }

  return { success: true };
}

export async function finalizeExamSession(
  sessionId: string,
  questionIds: string[],
  selections: Record<string, "أ" | "ب" | "ج" | "د" | null>,
  actualDurationSec?: number
) {
  const userId = await requirePermission("attempt", "create");
  
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("معرّف الجلسة غير صالح");
  }

  // Save exam session data
  await db.examSessionData.create({
    data: {
      sessionId,
      userBucket: userId,
      questionIds: JSON.stringify(questionIds),
      selections: JSON.stringify(selections),
      durationSec: actualDurationSec ?? 0,
      actualDurationSec: actualDurationSec ?? 0,
    },
  });

  return { success: true };
}

// ── Data Fetching Functions ─────────────────────────────────────

export async function fetchUserProfile() {
  const userId = await requirePermission("profile", "read");
  
  let profile = await db.userProfile.findUnique({
    where: { userBucket: userId },
  });

  if (!profile) {
    // Create default profile if it doesn't exist
    profile = await db.userProfile.create({
      data: {
        userBucket: userId,
        totalXp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        streakShields: 1,
      },
    });
  }

  return {
    userBucket: profile.userBucket,
    totalXp: profile.totalXp,
    level: profile.level,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActiveDate: profile.lastActiveDate,
    streakShields: profile.streakShields,
    unlockedAchievements: JSON.parse(profile.unlockedAchievements || "[]") as string[],
  };
}

export async function fetchAchievements() {
  await requirePermission("achievement", "read");
  return await db.achievement.findMany();
}

export async function fetchCategoryMastery() {
  const userId = await requirePermission("question", "read");
  
  const [categories, totals, userStats] = await Promise.all([
    db.category.findMany({ orderBy: { displayOrder: "asc" } }),
    db.question.groupBy({ by: ["categoryId"], _count: { id: true } }),
    db.$queryRaw<{ categoryId: string; attempted: number; correct: number }[]>`
      SELECT q."categoryId",
             COUNT(a.id)::int AS attempted,
             SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
      FROM attempts a
      JOIN questions q ON a."questionId" = q.id
      WHERE a."userBucket" = ${userId}
      GROUP BY q."categoryId"
    `.catch(() => [] as { categoryId: string; attempted: number; correct: number }[]),
  ]);

  const totalMap = new Map<string, number>();
  for (const t of totals) {
    totalMap.set(t.categoryId, t._count.id);
  }

  const statMap = new Map<string, { attempted: number; correct: number }>();
  for (const s of userStats) {
    statMap.set(s.categoryId, { attempted: s.attempted, correct: s.correct });
  }

  return categories.map((c) => {
    const total = totalMap.get(c.id) ?? 0;
    const s = statMap.get(c.id) ?? { attempted: 0, correct: 0 };
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

export async function fetchRecentAttempts(limit = 20) {
  const userId = await requirePermission("attempt", "read");
  
  const attempts = await db.attempt.findMany({
    where: { userBucket: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { question: true },
  });

  return attempts.map(a => ({
    id: a.id,
    questionId: a.questionId,
    selectedKey: a.selectedKey as any,
    isCorrect: a.isCorrect,
    mode: a.mode as any,
    sessionId: a.sessionId,
    timeMs: a.timeMs,
    confidence: a.confidence,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function fetchMistakeQuestionIds(limit = 50) {
  const userId = await requirePermission("attempt", "read");
  
  const attempts = await db.attempt.findMany({
    where: { userBucket: userId, isCorrect: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { questionId: true },
  });

  return [...new Set(attempts.map(a => a.questionId))];
}

export async function fetchDailyActivity(days = 84) {
  const userId = await requirePermission("attempt", "read");
  
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const activities = await db.dailyActivity.findMany({
    where: { 
      userBucket: userId,
      date: { gte: since.toISOString().split('T')[0] }
    },
    orderBy: { date: "asc" },
  });

  return activities.map(a => ({
    date: a.date,
    attempts: a.attempts,
    correct: a.correct,
    xpEarned: a.xpEarned,
  }));
}

export async function fetchDailyQuestProgress() {
  const userId = await requirePermission("attempt", "read");
  
  const today = todayKey();
  const activity = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket: userId, date: today } },
  });

  // Default quests
  const quests = [
    { slug: "q10_attempts", target: 10, metric: "attempts" as const, descriptionAr: "أكمل 10 محاولات" },
    { slug: "q7_correct", target: 7, metric: "correct" as const, descriptionAr: "أجب على 7 أسئلة صحيحة" },
    { slug: "q3_categories", target: 3, metric: "categories" as const, descriptionAr: "درّب على 3 فئات" },
    { slug: "q5_attempts", target: 5, metric: "attempts" as const, descriptionAr: "أكمل 5 محاولات" },
    { slug: "q30_xp", target: 30, metric: "xp" as const, descriptionAr: "اكسب 30 نقطة خبرة" },
  ];

  const dayOfYear = Math.floor(new Date().getTime() / 86400000);
  let userHash = 0;
  for (let i = 0; i < userId.length; i++) {
    userHash += userId.charCodeAt(i);
  }
  const questIndex = (dayOfYear + userHash) % quests.length;
  const currentQuest = quests[questIndex];

  let categoriesCount = 0;
  if (activity?.categoryStats) {
    try {
      categoriesCount = Object.keys(JSON.parse(activity.categoryStats)).length;
    } catch {}
  }

  const progress = {
    attempts: activity?.attempts ?? 0,
    correct: activity?.correct ?? 0,
    xp: activity?.xpEarned ?? 0,
    categories: categoriesCount,
  };

  return {
    quest: currentQuest,
    progress,
    completed: progress[currentQuest.metric] >= currentQuest.target,
  };
}

export async function fetchFavoriteIds() {
  const userId = await requirePermission("favorite", "read");
  
  const favorites = await db.favorite.findMany({
    where: { userBucket: userId },
    select: { questionId: true },
  });

  return favorites.map(f => f.questionId);
}

export async function fetchExamHistory() {
  const userId = await requirePermission("attempt", "read");
  
  const sessions = await db.examSessionData.findMany({
    where: { userBucket: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const allQuestionIds = new Set<string>();
  sessions.forEach(s => {
    const qids = JSON.parse(s.questionIds) as string[];
    qids.forEach(id => allQuestionIds.add(id));
  });

  const questions = await db.question.findMany({
    where: { id: { in: Array.from(allQuestionIds) } },
    select: { id: true, correctKey: true }
  });

  const correctKeys = new Map(questions.map(q => [q.id, q.correctKey]));

  return sessions.map(s => {
    const questionIds = JSON.parse(s.questionIds) as string[];
    const selections = JSON.parse(s.selections) as Record<string, string | null>;
    
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let total = questionIds.length;
    
    for (const qid of questionIds) {
      const selection = selections[qid];
      if (!selection) {
        skipped++;
      } else if (selection === correctKeys.get(qid)) {
        correct++;
      } else {
        wrong++;
      }
    }

    return {
      sessionId: s.sessionId,
      date: s.createdAt.toISOString(),
      total,
      correct,
      wrong,
      skipped,
      scorePercent: total > 0 ? Math.round((correct / total) * 100) : 0,
      durationSec: s.durationSec,
    };
  });
}

export async function fetchExamSessionData(sessionId: string) {
  const userId = await requirePermission("attempt", "read");
  
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("معرّف الجلسة غير صالح");
  }

  const session = await db.examSessionData.findUnique({
    where: { sessionId },
  });

  if (!session || session.userBucket !== userId) {
    return null;
  }

  return {
    questionIds: JSON.parse(session.questionIds) as string[],
    selections: JSON.parse(session.selections) as Record<string, string | null>,
    actualDurationSec: session.actualDurationSec,
  };
}

export async function fetchDueReviewIds(limit = 50) {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const schedules = await db.reviewSchedule.findMany({
    where: { 
      userBucket: userId,
      nextReviewAt: { lte: now }
    },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    select: { questionId: true },
  });

  return schedules.map(s => s.questionId);
}

export async function fetchDueReviewCount() {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const count = await db.reviewSchedule.count({
    where: { 
      userBucket: userId,
      nextReviewAt: { lte: now }
    },
  });

  return count;
}

export async function fetchNextReviewDate() {
  const userId = await requirePermission("review", "read");
  
  const now = new Date();
  const next = await db.reviewSchedule.findFirst({
    where: { 
      userBucket: userId,
      nextReviewAt: { gt: now }
    },
    orderBy: { nextReviewAt: "asc" },
    select: { nextReviewAt: true },
  });

  return next ? next.nextReviewAt.toISOString() : null;
}

export async function fetchTodayReviewCount() {
  const userId = await requirePermission("review", "read");
  
  const today = todayKey();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const count = await db.reviewSchedule.count({
    where: { 
      userBucket: userId,
      nextReviewAt: { gte: startOfDay, lte: endOfDay }
    },
  });

  return count;
}

export async function fetchSpeedStats() {
  const userId = await requirePermission("attempt", "read");
  
  const stats = await db.$queryRaw<{ categoryId: string; avgTimeMs: number; count: number }[]>`
    SELECT q."categoryId",
           AVG(a."timeMs")::int AS "avgTimeMs",
           COUNT(a.id)::int AS count
    FROM attempts a
    JOIN questions q ON a."questionId" = q.id
    WHERE a."userBucket" = ${userId} AND a."timeMs" > 0
    GROUP BY q."categoryId"
  `;

  if (stats.length === 0) return [];

  const categoryIds = stats.map(s => s.categoryId);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } }
  });
  
  const catMap = new Map(categories.map(c => [c.id, c]));

  return stats.map(stat => {
    const cat = catMap.get(stat.categoryId);
    return {
      categorySlug: cat?.slug || "",
      categoryNameAr: cat?.nameAr || "",
      colorTheme: cat?.colorTheme || null,
      attempted: stat.count,
      avgTimeSec: Math.round(stat.avgTimeMs / 1000),
    };
  });
}

export async function fetchRecentlyStudiedCategories(limit = 5) {
  const userId = await requirePermission("attempt", "read");
  
  const stats = await db.$queryRaw<{ categoryId: string; attempts: number; correct: number; lastAttempt: Date }[]>`
    WITH recent_attempts AS (
      SELECT a.id, a."questionId", a."isCorrect", a."createdAt"
      FROM attempts a
      WHERE a."userBucket" = ${userId}
      ORDER BY a."createdAt" DESC
      LIMIT 100
    )
    SELECT q."categoryId",
           COUNT(r.id)::int AS attempts,
           SUM(CASE WHEN r."isCorrect" THEN 1 ELSE 0 END)::int AS correct,
           MAX(r."createdAt") AS "lastAttempt"
    FROM recent_attempts r
    JOIN questions q ON r."questionId" = q.id
    GROUP BY q."categoryId"
    ORDER BY "lastAttempt" DESC
  `;

  if (stats.length === 0) return [];

  const categoryIds = stats.slice(0, limit).map(s => s.categoryId);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } }
  });
  
  const catMap = new Map(categories.map(c => [c.id, c]));

  return stats.slice(0, limit).map(stat => {
    const cat = catMap.get(stat.categoryId);
    return {
      categorySlug: cat?.slug || "",
      categoryNameAr: cat?.nameAr || "",
      colorTheme: cat?.colorTheme || null,
      icon: cat?.icon || null,
      lastAttemptAt: stat.lastAttempt.toISOString(),
      attempted: stat.attempts,
      correct: stat.correct,
      accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
    };
  });
}

export async function fetchWeeklyChallenge() {
  const userId = await requirePermission("challenge", "read");
  
  const today = todayKey();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Get weekly activity
  const weeklyActivity = await db.dailyActivity.findMany({
    where: {
      userBucket: userId,
      date: {
        gte: startOfWeek.toISOString().split('T')[0],
        lte: endOfWeek.toISOString().split('T')[0]
      }
    }
  });
  
  // Define weekly challenge
  const challenge = {
    descriptionAr: "أكمل 30 محاولة خلال هذا الأسبوع",
    rewardLabel: "🔥 درع حماية",
  };
  
  const target = 30;
  const current = weeklyActivity.reduce((sum, activity) => sum + activity.attempts, 0);
  const complete = current >= target;
  
  return {
    challenge,
    current,
    target,
    complete,
  };
}
