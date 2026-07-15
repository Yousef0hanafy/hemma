"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { requireStudioAccess } from "@/lib/studio-auth";
import { computeMastery, masteryLabel } from "@/lib/engine/gamification";
import type { CategoryMastery } from "@/lib/content/dto";
import type { ViewKey } from "@/lib/store/view-store";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface StudyPlanRecommendation {
  /** The single most important action the student should take */
  primaryAction: {
    type: "study_category" | "take_exam" | "review_mistakes" | "flashcards" | "mixed";
    label: string;
    description: string;
    /** Action params to pass to setView */
    view: ViewKey;
  };

  /** Personalized insight about their performance */
  insight: string;

  /** Category priority list (ordered by recommended focus) */
  categoryPriorities: Array<{
    slug: string;
    nameAr: string;
    colorTheme: string | null;
    mastery: number;
    masteryLabel: string;
    priority: "highest" | "high" | "medium" | "low";
    reason: string;
    suggestedAction: string;
    suggestedQuestionCount: number;
  }>;

  /** Difficulty recommendation */
  difficultyRecommendation: {
    recommended: "easy" | "medium" | "hard" | "mixed";
    label: string;
    reason: string;
  };

  /** Study vs exam recommendation */
  modeRecommendation: {
    recommended: "study" | "exam" | "both";
    label: string;
    reason: string;
  };

  /** Overall stats summary */
  summary: {
    totalAttempts: number;
    overallAccuracy: number | null;
    dueReviewCount: number;
    streakDays: number;
    level: number;
    categoriesStudied: number;
    categoriesTotal: number;
  };

  /** Performance trend: improving, declining, stable, or new */
  trend: "improving" | "declining" | "stable" | "new";
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function fetchStudyPlan(): Promise<StudyPlanRecommendation | null> {
  try {
    await requireStudioAccess();
  } catch {
    return null;
  }

  const userBucket = await getUserBucket();

  // Fetch all data in parallel
  const [profile, categories, masteryData, dueReviewCount, recent30, recent7] =
    await Promise.all([
      db.userProfile.findUnique({ where: { userBucket } }),
      db.category.findMany({ orderBy: { displayOrder: "asc" } }),
      fetchCategoryMastery(userBucket),
      db.reviewSchedule.count({
        where: { userBucket, nextReviewAt: { lte: new Date() } },
      }),
      fetchRecentAttempts(userBucket, 30),
      fetchRecentAttempts(userBucket, 7),
    ]);

  if (!profile) return null;

  const totalXp = profile.totalXp;
  const level = profile.level;
  const streakDays = profile.currentStreak;
  const totalAttempts = await db.attempt.count({ where: { userBucket } });
  const correctAttempts = await db.attempt.count({
    where: { userBucket, isCorrect: true },
  });
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;

  const categoriesStudied = masteryData.filter((m) => m.attempted > 0).length;
  const categoriesTotal = categories.length;

  // ── Trend analysis ──
  let trend: "improving" | "declining" | "stable" | "new" = "new";
  if (totalAttempts >= 10) {
    const recent7Correct = recent7.filter((a) => a.isCorrect).length;
    const recent7Total = recent7.length;
    const recent7Acc = recent7Total > 0 ? recent7Correct / recent7Total : 0;

    const recent30Correct = recent30.filter((a) => a.isCorrect).length;
    const recent30Total = recent30.length;
    const recent30Acc = recent30Total > 0 ? recent30Correct / recent30Total : 0;

    if (recent7Acc > recent30Acc + 0.1) trend = "improving";
    else if (recent7Acc < recent30Acc - 0.1) trend = "declining";
    else trend = "stable";
  }

  // ── Category priority analysis ──
  const priorities = buildCategoryPriorities(
    masteryData,
    recent30,
    dueReviewCount
  );

  // ── Difficulty recommendation ──
  const difficultyRecommendation = buildDifficultyRecommendation(
    masteryData,
    recent30
  );

  // ── Mode recommendation ──
  const modeRecommendation = buildModeRecommendation(
    masteryData,
    dueReviewCount,
    recent30
  );

  // ── Primary action ──
  const primaryAction = buildPrimaryAction(
    priorities,
    dueReviewCount,
    trend,
    modeRecommendation
  );

  // ── Insight ──
  const insight = buildInsight(
    trend,
    priorities,
    streakDays,
    overallAccuracy,
    totalAttempts
  );

  return {
    primaryAction,
    insight,
    categoryPriorities: priorities,
    difficultyRecommendation,
    modeRecommendation,
    summary: {
      totalAttempts,
      overallAccuracy,
      dueReviewCount,
      streakDays,
      level,
      categoriesStudied,
      categoriesTotal,
    },
    trend,
  };
}

// ---------------------------------------------------------------------------
// Analysis functions
// ---------------------------------------------------------------------------

function buildCategoryPriorities(
  mastery: CategoryMastery[],
  recentAttempts: AttemptSummary[],
  dueReviewCount: number
): StudyPlanRecommendation["categoryPriorities"] {
  // Build recency map
  const lastAttemptByCategory = new Map<string, Date>();
  for (const a of recentAttempts) {
    const catSlug = mastery.find(
      (m) => m.categorySlug === a.categorySlug
    )?.categorySlug;
    if (catSlug && !lastAttemptByCategory.has(catSlug)) {
      lastAttemptByCategory.set(catSlug, new Date(a.createdAt));
    }
  }

  const now = new Date();
  const DAY_MS = 86400000;

  const scored = mastery
    .filter((m) => m.total > 0) // only categories with questions
    .map((m) => {
      const lastAttempt = lastAttemptByCategory.get(m.categorySlug);
      const daysSinceLastStudy = lastAttempt
        ? Math.floor((now.getTime() - lastAttempt.getTime()) / DAY_MS)
        : 999;

      // Score: lower mastery = higher priority
      // Bonus for categories not studied recently
      // Bonus for categories with many questions (high impact)
      const masteryScore = 100 - m.mastery; // 0-100, higher = weaker
      const recencyBonus = daysSinceLastStudy > 3 ? Math.min(daysSinceLastStudy * 2, 30) : 0;
      const coverageBonus = m.attempted > 0 ? 0 : 15; // new categories get a boost
      const totalScore = masteryScore + recencyBonus + coverageBonus;

      // Determine priority level
      let priority: "highest" | "high" | "medium" | "low";
      let reason: string;
      let suggestedQuestionCount: number;

      if (totalScore >= 60) {
        priority = "highest";
        suggestedQuestionCount = 15;
        if (m.attempted === 0) {
          reason = "لم تدرس هذه الفئة بعد — ابدأ بها الآن";
        } else {
          reason = `إتقان منخفض (${m.mastery}%) — تحتاج تركيزًا`;
        }
      } else if (totalScore >= 35) {
        priority = "high";
        suggestedQuestionCount = 10;
        if (daysSinceLastStudy > 7) {
          reason = `لم تدرس منذ ${daysSinceLastStudy} يوم — راجعها`;
        } else {
          reason = `إتقان ${m.mastery}% — يمكن تحسينه`;
        }
      } else if (totalScore >= 15) {
        priority = "medium";
        suggestedQuestionCount = 5;
        reason = `إتقان ${m.mastery}% — صيانة دورية`;
      } else {
        priority = "low";
        suggestedQuestionCount = 3;
        reason = `مستوى جيد (${m.mastery}%) — حافظ عليه`;
      }

      return {
        slug: m.categorySlug,
        nameAr: m.categoryNameAr,
        colorTheme: m.colorTheme,
        mastery: m.mastery,
        masteryLabel: masteryLabel(m.mastery),
        priority,
        reason,
        suggestedAction:
          priority === "highest"
            ? `ادرس ${m.categoryNameAr}`
            : priority === "high"
              ? `راجع ${m.categoryNameAr}`
              : `حافظ على ${m.categoryNameAr}`,
        suggestedQuestionCount,
      };
    });

  // Sort by priority then by mastery ascending
  const priorityOrder = { highest: 0, high: 1, medium: 2, low: 3 };
  scored.sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99) ||
      a.mastery - b.mastery
  );

  return scored;
}

function buildDifficultyRecommendation(
  mastery: CategoryMastery[],
  recentAttempts: AttemptSummary[]
): StudyPlanRecommendation["difficultyRecommendation"] {
  // Count accuracy by difficulty
  const diffStats: Record<string, { total: number; correct: number }> = {};

  for (const a of recentAttempts) {
    if (!diffStats[a.difficulty]) diffStats[a.difficulty] = { total: 0, correct: 0 };
    diffStats[a.difficulty].total++;
    if (a.isCorrect) diffStats[a.difficulty].correct++;
  }

  const diffAcc: Record<string, number> = {};
  for (const [d, s] of Object.entries(diffStats)) {
    diffAcc[d] = s.total > 0 ? s.correct / s.total : 0;
  }

  const easyAcc = diffAcc.easy ?? 1;
  const mediumAcc = diffAcc.medium ?? 0.5;
  const hardAcc = diffAcc.hard ?? 0;

  // If overall mastery is low, recommend easier difficulty
  const avgMastery =
    mastery.filter((m) => m.attempted > 0).reduce((s, m) => s + m.mastery, 0) /
    Math.max(1, mastery.filter((m) => m.attempted > 0).length);

  if (avgMastery < 40) {
    return {
      recommended: "easy",
      label: "سهل",
      reason: "إتقانك العام لا يزال في البداية. ابدأ بالأسئلة السهلة لبناء الثقة.",
    };
  }

  if (hardAcc >= 0.6) {
    return {
      recommended: "hard",
      label: "صعب",
      reason: "أداؤك في الأسئلة الصعبة ممتاز! تحدَّ نفسك بالمستوى المتقدم.",
    };
  }

  if (mediumAcc >= 0.7 && easyAcc >= 0.85) {
    return {
      recommended: "mixed",
      label: "متنوع",
      reason: "أداؤك متوازن. جرّب مزيجًا من المستويات لتنويع التحدي.",
    };
  }

  if (mediumAcc < 0.6) {
    return {
      recommended: "medium",
      label: "متوسط",
      reason: "ركّز على الأسئلة المتوسطة لتعزيز أساسياتك قبل الانتقال للصعبة.",
    };
  }

  return {
    recommended: "mixed",
    label: "متنوع",
    reason: "مزيج من المستويات يحفّز التعلّم الأمثل.",
  };
}

function buildModeRecommendation(
  mastery: CategoryMastery[],
  dueReviewCount: number,
  recentAttempts: AttemptSummary[]
): StudyPlanRecommendation["modeRecommendation"] {
  const hasMistakes = mastery.some(
    (m) => m.attempted > 0 && m.mastery < 50
  );

  if (dueReviewCount > 10) {
    return {
      recommended: "both",
      label: "مراجعة + مذاكرة",
      reason: `لديك ${dueReviewCount} بطاقة مستحقة. ابدأ بالمراجعة ثم أكمل بمذاكرة جديدة.`,
    };
  }

  if (hasMistakes) {
    return {
      recommended: "study",
      label: "مذاكرة",
      reason: "بعض الفئات تحتاج تحسينًا. المذاكرة مع التفسير الفوري أفضل خيار.",
    };
  }

  const recentExamCount = recentAttempts.filter((a) => a.mode === "exam").length;
  if (recentExamCount < 10) {
    return {
      recommended: "exam",
      label: "اختبار",
      reason: "اختبر معلوماتك باختبار وقتي لقياس مستواك الحقيقي.",
    };
  }

  return {
    recommended: "both",
    label: "متنوّع",
    reason: "وازن بين المذاكرة والاختبارات لأقصى استفادة.",
  };
}

function buildPrimaryAction(
  priorities: StudyPlanRecommendation["categoryPriorities"],
  dueReviewCount: number,
  trend: string,
  modeRec: StudyPlanRecommendation["modeRecommendation"]
): StudyPlanRecommendation["primaryAction"] {
  const topPriority = priorities[0];

  if (dueReviewCount > 10) {
    return {
      type: "flashcards",
      label: `راجع ${dueReviewCount} بطاقة مستحقة`,
      description: "بطاقات التكرار المتباعد في انتظارك. حان وقت المراجعة!",
      view: { kind: "revision", tab: "flashcards" },
    };
  }

  if (topPriority && topPriority.priority === "highest") {
    return {
      type: "study_category",
      label: `ادرس ${topPriority.nameAr}`,
      description: `${topPriority.reason}. جرّب ${topPriority.suggestedQuestionCount} سؤالًا`,
      view: {
        kind: "study",
        categorySlug: topPriority.slug,
      },
    };
  }

  if (modeRec.recommended === "exam") {
    return {
      type: "take_exam",
      label: "ابدأ اختبارًا",
      description: "اختبر معلوماتك وقيّس تقدّمك",
      view: { kind: "exam_setup" },
    };
  }

  if (modeRec.recommended === "study") {
    return {
      type: "study_category",
      label: "مذاكرة عامة",
      description: "ادرس كل الفئات لتعزيز إتقانك",
      view: { kind: "study_setup" },
    };
  }

  return {
    type: "mixed",
    label: "مزيج مثالي",
    description: "ادرس الفئات التي تحتاج تحسينًا واختبر نفسك",
    view: { kind: "study_setup" },
  };
}

function buildInsight(
  trend: string,
  priorities: StudyPlanRecommendation["categoryPriorities"],
  streakDays: number,
  accuracy: number | null,
  totalAttempts: number
): string {
  const topPriority = priorities[0];

  if (totalAttempts === 0) {
    return "لم تبدأ بعد! ادرس أول فئة لتنطلق في رحلتك التعليمية 🚀";
  }

  if (trend === "improving" && accuracy && accuracy >= 70) {
    return `أداؤك في تحسّن مستمر! دقتك ${accuracy}% — استمر على هذا المنوال 💪`;
  }

  if (trend === "declining") {
    return "لاحظنا انخفاضًا في أدائك مؤخرًا. لا تقلق — ركّز على الأساسيات وستعود أقوى 📈";
  }

  if (streakDays >= 7) {
    return `سلسلتك ${streakDays} يوم متواصل! الالتزام هو سر النجاح 🔥`;
  }

  if (topPriority && topPriority.mastery < 30) {
    return `فئة "${topPriority.nameAr}" تحتاج اهتمامك — إتقانها ${topPriority.mastery}%. ابدأ بها اليوم 🎯`;
  }

  if (totalAttempts < 50) {
    return `بداية قوية! واصل التدريب اليومي لبناء زخمك التعلّمي 📚`;
  }

  return "أنت في المسار الصحيح. الاستمرارية أهم من الكثافة — خُطوة بخطوة 🎯";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AttemptSummary {
  id: string;
  questionId: string;
  isCorrect: boolean;
  mode: string;
  difficulty: string;
  categorySlug: string;
  createdAt: string;
}

async function fetchRecentAttempts(
  userBucket: string,
  limit: number
): Promise<AttemptSummary[]> {
  const attempts = await db.attempt.findMany({
    where: { userBucket },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      question: {
        select: {
          difficulty: true,
          category: { select: { slug: true } },
        },
      },
    },
  });

  return attempts.map((a) => ({
    id: a.id,
    questionId: a.questionId,
    isCorrect: a.isCorrect,
    mode: a.mode,
    difficulty: a.question.difficulty,
    categorySlug: a.question.category.slug,
    createdAt: a.createdAt.toISOString(),
  }));
}

async function fetchCategoryMastery(
  userBucket: string
): Promise<CategoryMastery[]> {
  const cats = await db.category.findMany({ orderBy: { displayOrder: "asc" } });
  const totals = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });
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
