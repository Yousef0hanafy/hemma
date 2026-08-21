import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { levelProgress, computeMastery } from "@/lib/engine/gamification";
import type { AchievementDTO, CategoryMastery } from "@/lib/content/dto";

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface ExtendedProfile {
  // User info
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;

  // Gamification
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  streakShields: number;
  levelProgress: { level: number; pct: number; nextLevelXp: number };

  // Stats
  totalAttempts: number;
  correctAttempts: number;
  overallAccuracy: number | null;
  totalExamSessions: number;
  bestExamScore: number | null;
  avgExamScore: number | null;
  totalReviewsDone: number;
  avgTimePerQuestion: number | null; // seconds

  // Achievements
  achievements: AchievementDTO[];
  unlockedSlugs: string[];

  // Category mastery
  categoryMastery: CategoryMastery[];

  // Recent activity (last 10 attempts)
  recentActivity: Array<{
    id: string;
    questionId: string;
    stem: string;
    categoryNameAr: string;
    isCorrect: boolean;
    mode: string;
    timeMs: number;
    createdAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function fetchExtendedProfile(): Promise<ExtendedProfile | null> {
  const session = await getServerSession(authOptions).catch((err) => {
    console.error("[ExtendedProfile] Error getting session:", err);
    return null;
  });

  if (!session?.user) {
    return null;
  }

  const sessionUserId = (session.user as any).id as string | undefined;
  const sessionEmail = session.user.email as string | null | undefined;
  const sessionName = session.user.name as string | null | undefined;
  const sessionImage = session.user.image as string | null | undefined;
  const sessionRole = (session.user as any).role as string | undefined;

  // 1. Fetch user from DB
  let user: { id: string; name: string | null; email: string | null; image: string | null; role: string } | null = null;
  if (sessionUserId || sessionEmail) {
    try {
      user = await db.user.findFirst({
        where: {
          OR: [
            ...(sessionUserId ? [{ id: sessionUserId }] : []),
            ...(sessionEmail ? [{ email: sessionEmail }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      });
    } catch (err) {
      console.warn("[ExtendedProfile] Error fetching user from DB:", err);
    }
  }

  const resolvedUser = {
    id: user?.id || sessionUserId || "user",
    name: user?.name || sessionName || "طالب همة",
    email: user?.email || sessionEmail || null,
    image: user?.image || sessionImage || null,
    role: user?.role || sessionRole || "student",
  };

  const userBucket = user?.id || sessionUserId || "default";

  // 2. Fetch / Ensure UserProfile exists
  let profile: { id: string; totalXp: number; level: number; currentStreak: number; longestStreak: number; streakShields: number; unlockedAchievements: string; createdAt: Date } | null = null;
  if (user?.id) {
    try {
      profile = await db.userProfile.findUnique({ where: { userBucket } });
      if (!profile) {
        profile = await db.userProfile.create({
          data: { userBucket },
        }).catch(() => null);
      }
    } catch (err) {
      console.warn("[ExtendedProfile] Error querying/creating user profile:", err);
    }
  }

  const totalXp = profile?.totalXp ?? 0;
  const lp = levelProgress(totalXp);
  let unlockedSlugs: string[] = [];
  try {
    unlockedSlugs = JSON.parse(profile?.unlockedAchievements ?? "[]");
  } catch {
    unlockedSlugs = [];
  }

  // 3. Safe Stats & Aggregations
  let totalAttempts = 0;
  let correctAttempts = 0;
  let totalExamSessions = 0;
  let totalReviewsDone = 0;
  let avgTimePerQuestion: number | null = null;
  let bestExamScore: number | null = null;
  let avgExamScore: number | null = null;
  let recentActivity: ExtendedProfile["recentActivity"] = [];
  let achievements: AchievementDTO[] = [];
  let masteryData: CategoryMastery[] = [];

  try {
    achievements = await db.achievement.findMany({ orderBy: { threshold: "asc" } }).catch(() => []);
  } catch {}

  try {
    masteryData = await fetchCategoryMasteryData(userBucket).catch(() => []);
  } catch {}

  try {
    totalAttempts = await db.attempt.count({ where: { userBucket } }).catch(() => 0);
    correctAttempts = await db.attempt.count({ where: { userBucket, isCorrect: true } }).catch(() => 0);

    const examSessionsGroup = await db.attempt.groupBy({
      by: ["sessionId"],
      where: { userBucket, mode: "exam", sessionId: { not: null } },
      _count: true,
    }).catch(() => []);
    totalExamSessions = examSessionsGroup.length;

    totalReviewsDone = await db.reviewSchedule.count({
      where: { userBucket, lastReviewedAt: { not: null } },
    }).catch(() => 0);

    const avgTimeResult = await db.attempt.aggregate({
      where: { userBucket, timeMs: { gt: 0 } },
      _avg: { timeMs: true },
    }).catch(() => ({ _avg: { timeMs: null } }));

    if (avgTimeResult._avg?.timeMs) {
      avgTimePerQuestion = Math.round((avgTimeResult._avg.timeMs / 1000) * 10) / 10;
    }

    const recentAttemptsData = await db.attempt.findMany({
      where: { userBucket },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        question: {
          select: {
            stem: true,
            category: { select: { nameAr: true } },
          },
        },
      },
    }).catch(() => []);

    recentActivity = recentAttemptsData.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      stem: a.question?.stem ? a.question.stem.slice(0, 80) : "سؤال قدرات",
      categoryNameAr: a.question?.category?.nameAr || "عام",
      isCorrect: a.isCorrect,
      mode: a.mode,
      timeMs: a.timeMs,
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString(),
    }));

    if (totalExamSessions > 0) {
      try {
        const rawExamScores = await db.$queryRaw<{ scorePercent: number }[]>`
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

        if (rawExamScores && rawExamScores.length > 0) {
          const scores = rawExamScores.map((s) => Number(s.scorePercent) || 0);
          bestExamScore = Math.max(...scores);
          avgExamScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      } catch {}
    }
  } catch (e) {
    console.warn("[ExtendedProfile] Error querying stats:", e);
  }

  return {
    userId: resolvedUser.id,
    name: resolvedUser.name,
    email: resolvedUser.email,
    image: resolvedUser.image,
    role: resolvedUser.role,
    createdAt: profile?.createdAt ? profile.createdAt.toISOString() : new Date().toISOString(),

    totalXp,
    level: profile?.level ?? 1,
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    streakShields: profile?.streakShields ?? 0,
    levelProgress: { level: lp.level, pct: lp.pct, nextLevelXp: lp.nextLevelXp },

    totalAttempts,
    correctAttempts,
    overallAccuracy:
      totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : null,
    totalExamSessions,
    bestExamScore,
    avgExamScore,
    totalReviewsDone,
    avgTimePerQuestion,

    achievements,
    unlockedSlugs,
    categoryMastery: masteryData,
    recentActivity,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchCategoryMasteryData(
  userBucket: string
): Promise<CategoryMastery[]> {
  try {
    const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
    if (cats.length === 0) return [];

    const totals = await db.question.groupBy({ by: ["categoryId"], _count: { id: true } }).catch(() => []);
    const totalMap = new Map<string, number>();
    for (const t of totals) {
      totalMap.set(t.categoryId, t._count.id);
    }

    const statMap = new Map<string, { attempted: number; correct: number }>();
    try {
      const userStats = await db.$queryRaw<{ categoryId: string; attempted: number; correct: number }[]>`
        SELECT q."categoryId",
               COUNT(a.id)::int AS attempted,
               SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
        FROM attempts a
        JOIN questions q ON a."questionId" = q.id
        WHERE a."userBucket" = ${userBucket}
        GROUP BY q."categoryId"
      `;
      if (Array.isArray(userStats)) {
        for (const s of userStats) {
          statMap.set(s.categoryId, {
            attempted: Number(s.attempted) || 0,
            correct: Number(s.correct) || 0,
          });
        }
      }
    } catch {
      // Ignore query error for clean fallback
    }

    return cats.map((c) => {
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
  } catch {
    return [];
  }
}
