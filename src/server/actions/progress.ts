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
  StudyMode,
  ArabicLetter,
} from "@/lib/content/dto";
import { toAttemptDTO } from "@/lib/content/dto";
import {
  computeMastery,
  levelForXp,
  questForDate,
  todayKey,
  updateStreak,
  xpForCorrect,
  xpForExamSession,
} from "@/lib/engine/gamification";

const USER_BUCKET = "default";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchUserProfile(): Promise<UserProfileDTO> {
  const profile = await db.userProfile.upsert({
    where: { userBucket: USER_BUCKET },
    update: {},
    create: { userBucket: USER_BUCKET },
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
}

export async function recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptResult> {
  // Pull question for difficulty
  const question = await db.question.findUnique({
    where: { id: input.questionId },
    select: { difficulty: true, categoryId: true },
  });
  if (!question) throw new Error("Question not found");

  // 1. Create the attempt
  const attempt = await db.attempt.create({
    data: {
      userBucket: USER_BUCKET,
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
  const profile = await db.userProfile.findUnique({ where: { userBucket: USER_BUCKET } });
  if (!profile) throw new Error("Profile missing");

  const today = todayKey();
  const streakUpdate = updateStreak(profile.currentStreak, profile.lastActiveDate, profile.streakShields);
  const newXp = profile.totalXp + xp;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > profile.level;

  const updatedProfile = await db.userProfile.update({
    where: { userBucket: USER_BUCKET },
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
    where: { userBucket_date: { userBucket: USER_BUCKET, date: today } },
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
        userBucket: USER_BUCKET,
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
  const totalAttempts = await db.attempt.count({ where: { userBucket: USER_BUCKET } });
  const totalCorrect = await db.attempt.count({ where: { userBucket: USER_BUCKET, isCorrect: true } });
  const longestStreak = updatedProfile.longestStreak;

  // Get mastery levels per category for "master_category" check
  const catStats = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });
  const attemptedByCat = await db.attempt.groupBy({
    by: ["questionId"],
    where: { userBucket: USER_BUCKET },
  });
  // Map questionId -> categoryId
  const questionCats = await db.question.findMany({
    select: { id: true, categoryId: true },
  });
  const qToCat = new Map(questionCats.map((q) => [q.id, q.categoryId]));
  const catCorrect: Record<string, { attempted: number; correct: number }> = {};
  const catTotal: Record<string, number> = {};
  for (const c of catStats) catTotal[c.categoryId] = c._count;
  // Need to count attempts per category - query with joins
  const allAttempts = await db.attempt.findMany({
    where: { userBucket: USER_BUCKET },
    select: { questionId: true, isCorrect: true },
  });
  for (const a of allAttempts) {
    const catId = qToCat.get(a.questionId);
    if (!catId) continue;
    catCorrect[catId] = catCorrect[catId] ?? { attempted: 0, correct: 0 };
    catCorrect[catId].attempted++;
    if (a.isCorrect) catCorrect[catId].correct++;
  }
  const maxMastery = Math.max(
    0,
    ...Object.entries(catTotal).map(([catId, total]) =>
      computeMastery(total, catCorrect[catId]?.attempted ?? 0, catCorrect[catId]?.correct ?? 0)
    )
  );

  for (const a of allAchievements) {
    if (alreadyUnlocked.has(a.slug)) continue;
    let unlockedNow = false;
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
        else if (a.slug === "exam_pass") {
          // threshold represents score %
          // Check if any exam session had >= threshold %
          // Simplified: skip for now, will check via session summary
        }
        break;
    }
    if (unlockedNow) {
      const xpReward = a.xpReward;
      const newAch = [...alreadyUnlocked, a.slug];
      await db.userProfile.update({
        where: { userBucket: USER_BUCKET },
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
  };
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function toggleFavorite(questionId: string): Promise<boolean> {
  const existing = await db.favorite.findUnique({
    where: { userBucket_questionId: { userBucket: USER_BUCKET, questionId } },
  });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  await db.favorite.create({
    data: { userBucket: USER_BUCKET, questionId },
  });
  return true;
}

export async function fetchFavoriteIds(): Promise<string[]> {
  const favs = await db.favorite.findMany({
    where: { userBucket: USER_BUCKET },
    select: { questionId: true },
  });
  return favs.map((f) => f.questionId);
}

// ---------------------------------------------------------------------------
// Stats & Analytics
// ---------------------------------------------------------------------------

export async function fetchCategoryMastery(): Promise<CategoryMastery[]> {
  const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
  const totals = await db.question.groupBy({ by: ["categoryId"], _count: true });
  const totalMap = new Map(totals.map((t) => [t.categoryId, t._count]));

  const allAttempts = await db.attempt.findMany({
    where: { userBucket: USER_BUCKET },
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
  const items = await db.attempt.findMany({
    where: { userBucket: USER_BUCKET },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { question: { include: { category: true, source: true } } },
  });
  return items.map(toAttemptDTO);
}

export async function fetchMistakeQuestionIds(limit = 50): Promise<string[]> {
  // Find questions where the latest attempt was wrong
  const wrongAttempts = await db.attempt.findMany({
    where: { userBucket: USER_BUCKET, isCorrect: false },
    take: limit * 2,
    orderBy: { createdAt: "desc" },
    distinct: ["questionId"],
    select: { questionId: true, createdAt: true },
  });
  // Filter out questions where there's a later correct attempt
  const correctAttempts = await db.attempt.findMany({
    where: { userBucket: USER_BUCKET, isCorrect: true },
    select: { questionId: true, createdAt: true },
  });
  const latestCorrect = new Map<string, Date>();
  for (const a of correctAttempts) {
    const cur = latestCorrect.get(a.questionId);
    if (!cur || a.createdAt > cur) latestCorrect.set(a.questionId, a.createdAt);
  }
  return wrongAttempts
    .filter((w) => {
      const correctDate = latestCorrect.get(w.questionId);
      return !correctDate || correctDate < w.createdAt;
    })
    .slice(0, limit)
    .map((w) => w.questionId);
}

export async function fetchDailyActivity(days = 84): Promise<DailyActivityDTO[]> {
  const items = await db.dailyActivity.findMany({
    where: { userBucket: USER_BUCKET },
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
  const today = todayKey();
  const quest = questForDate(today);
  const todayActivity = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket: USER_BUCKET, date: today } },
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
// Exam session
// ---------------------------------------------------------------------------

export async function finalizeExamSession(
  sessionId: string,
  questionIds: string[],
  selections: Record<string, ArabicLetter | null>
): Promise<{
  total: number;
  correct: number;
  scorePercent: number;
  xpEarned: number;
}> {
  let correct = 0;
  // We trust that attempts were already recorded during exam via recordAttempt.
  // Here we just compute the summary.
  for (const qid of questionIds) {
    const sel = selections[qid];
    if (!sel) continue;
    // Look up correct key from question
    const q = await db.question.findUnique({ where: { id: qid }, select: { correctKey: true } });
    if (!q) continue;
    if (sel === q.correctKey) correct++;
  }
  const total = questionIds.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const xpEarned = xpForExamSession(scorePercent);

  // Award session XP
  await db.userProfile.update({
    where: { userBucket: USER_BUCKET },
    data: { totalXp: { increment: xpEarned } },
  });

  // Update daily activity xp
  const today = todayKey();
  const daily = await db.dailyActivity.findUnique({
    where: { userBucket_date: { userBucket: USER_BUCKET, date: today } },
  });
  if (daily) {
    await db.dailyActivity.update({
      where: { id: daily.id },
      data: { xpEarned: { increment: xpEarned } },
    });
  }

  return { total, correct, scorePercent, xpEarned };
}
