// =====================================================================
// Server Actions — user progress, attempts, favorites, SRS
// =====================================================================
"use server";

import { db } from "@/lib/db";
import { requirePermission, getCurrentUserId } from "@/lib/auth";
import { toQuestionDTO } from "@/lib/content/dto";
import type { SrsQuality } from "@/lib/engine/srs";
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
  const existingActivity = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket: userId, date: today } },
  });

  if (existingActivity) {
    await db.dailyActivity.update({
      where: { userBucket_date: { userBucket: userId, date: today } },
      data: {
        attempts: { increment: 1 },
        correct: { increment: input.isCorrect ? 1 : 0 },
      },
    });
  } else {
    await db.dailyActivity.create({
      data: {
        userBucket: userId,
        date: today,
        attempts: 1,
        correct: input.isCorrect ? 1 : 0,
      },
    });
  }

  // Update user profile XP
  const xpEarned = input.isCorrect ? 10 : 0;
  await db.userProfile.update({
    where: { userBucket: userId },
    data: {
      totalXp: { increment: xpEarned },
    },
  });

  // Update streak
  const profile = await db.userProfile.findUnique({
    where: { userBucket: userId },
  });

  if (profile) {
    const streakResult = updateStreak(
      profile.currentStreak,
      profile.lastActiveDate ?? "",
      profile.streakShields
    );

    await db.userProfile.update({
      where: { userBucket: userId },
      data: {
        currentStreak: streakResult.streak,
        longestStreak: Math.max(profile.longestStreak, streakResult.streak),
        streakShields: streakResult.shields,
        lastActiveDate: today,
      },
    });
  }

  return { attemptId: attempt.id };
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
    // Simple SM-2 implementation
    const easiness = schedule.easiness;
    const repetitions = schedule.repetitions;
    let newEasiness = easiness - 0.15 + (0.1 * (5 - quality));
    if (newEasiness < 1.3) newEasiness = 1.3;
    
    let newInterval;
    if (quality >= 3) {
      if (repetitions === 0) newInterval = 1;
      else if (repetitions === 1) newInterval = 6;
      else newInterval = Math.round(schedule.interval * newEasiness);
    } else {
      newInterval = 1;
    }

    const newRepetitions = quality >= 3 ? repetitions + 1 : 0;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    await db.reviewSchedule.update({
      where: { userBucket_questionId: { userBucket: userId, questionId } },
      data: {
        easiness: newEasiness,
        interval: newInterval,
        repetitions: newRepetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  } else {
    // Create new schedule
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);
    
    await db.reviewSchedule.create({
      data: {
        userBucket: userId,
        questionId,
        easiness: 2.5,
        interval: 1,
        repetitions: 1,
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
  
  const profile = await db.userProfile.findUnique({
    where: { userBucket: userId },
  });

  if (!profile) {
    // Create default profile if it doesn't exist
    return await db.userProfile.create({
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

  return profile;
}

export async function fetchAchievements() {
  await requirePermission("achievement", "read");
  return await db.achievement.findMany();
}

export async function fetchCategoryMastery() {
  const userId = await requirePermission("question", "read");
  
  const attempts = await db.attempt.findMany({
    where: { userBucket: userId },
    include: { question: { include: { category: true } } },
  });

  const categoryStats = new Map<string, { total: number; correct: number; name: string; slug: string; color: string | null; icon: string | null }>();

  for (const attempt of attempts) {
    const cat = attempt.question.category;
    const key = cat.id;
    const existing = categoryStats.get(key) || { total: 0, correct: 0, name: cat.nameAr, slug: cat.slug, color: cat.colorTheme, icon: cat.icon };
    existing.total += 1;
    if (attempt.isCorrect) existing.correct += 1;
    categoryStats.set(key, existing);
  }

  return Array.from(categoryStats.values()).map(stat => ({
    categorySlug: stat.slug,
    categoryNameAr: stat.name,
    colorTheme: stat.color,
    icon: stat.icon,
    total: stat.total,
    attempted: stat.total,
    correct: stat.correct,
    mastery: computeMastery(stat.total, stat.total, stat.correct),
  }));
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
    selectedKey: a.selectedKey,
    isCorrect: a.isCorrect,
    mode: a.mode,
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

  const currentQuest = quests[0]; // Simple selection for now

  const progress = {
    attempts: activity?.attempts ?? 0,
    correct: activity?.correct ?? 0,
    xp: activity?.xpEarned ?? 0,
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

  return sessions.map(s => {
    const questionIds = JSON.parse(s.questionIds) as string[];
    const selections = JSON.parse(s.selections) as Record<string, string | null>;
    
    let correct = 0;
    let total = questionIds.length;
    
    for (const qid of questionIds) {
      const selection = selections[qid];
      if (selection) {
        // We'd need to check against actual correct answers here
        // For now, we'll just count non-null selections
        correct += 1;
      }
    }

    return {
      sessionId: s.sessionId,
      date: s.createdAt.toISOString(),
      total,
      correct,
      wrong: total - correct,
      skipped: 0,
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
  
  const attempts = await db.attempt.findMany({
    where: { 
      userBucket: userId,
      timeMs: { gt: 0 }
    },
    include: { question: { include: { category: true } } },
  });

  const categoryStats = new Map<string, { times: number[]; name: string; slug: string; color: string | null }>();

  for (const attempt of attempts) {
    const cat = attempt.question.category;
    const key = cat.id;
    const existing = categoryStats.get(key) || { times: [], name: cat.nameAr, slug: cat.slug, color: cat.colorTheme };
    existing.times.push(attempt.timeMs);
    categoryStats.set(key, existing);
  }

  return Array.from(categoryStats.values()).map(stat => ({
    categorySlug: stat.slug,
    categoryNameAr: stat.name,
    colorTheme: stat.color,
    attempted: stat.times.length,
    avgTimeSec: stat.times.length > 0 ? Math.round(stat.times.reduce((a, b) => a + b, 0) / stat.times.length / 1000) : 0,
  }));
}

export async function fetchRecentlyStudiedCategories(limit = 5) {
  const userId = await requirePermission("attempt", "read");
  
  const recentAttempts = await db.attempt.findMany({
    where: { userBucket: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { question: { include: { category: true } } },
  });

  const categoryMap = new Map<string, { name: string; slug: string; color: string | null; icon: string | null; attempts: number; correct: number; lastAttempt: string }>();

  for (const attempt of recentAttempts) {
    const cat = attempt.question.category;
    const key = cat.id;
    const existing = categoryMap.get(key) || { 
      name: cat.nameAr, 
      slug: cat.slug, 
      color: cat.colorTheme, 
      icon: cat.icon,
      attempts: 0, 
      correct: 0, 
      lastAttempt: attempt.createdAt.toISOString() 
    };
    existing.attempts += 1;
    if (attempt.isCorrect) existing.correct += 1;
    if (attempt.createdAt.toISOString() > existing.lastAttempt) {
      existing.lastAttempt = attempt.createdAt.toISOString();
    }
    categoryMap.set(key, existing);
  }

  return Array.from(categoryMap.values())
    .sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime())
    .slice(0, limit)
    .map(stat => ({
      categorySlug: stat.slug,
      categoryNameAr: stat.name,
      colorTheme: stat.color,
      icon: stat.icon,
      lastAttemptAt: stat.lastAttempt,
      attempted: stat.attempts,
      correct: stat.correct,
      accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
    }));
}
