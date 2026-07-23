// =====================================================================
// AI Study Plan Prompt — generates personalized learning recommendations
// =====================================================================

export interface StudyPlanInput {
  /** Overall stats */
  totalAttempts: number;
  overallAccuracy: number | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  dueReviewCount: number;

  /** Category mastery breakdown */
  categories: Array<{
    slug: string;
    nameAr: string;
    mastery: number;
    attempted: number;
    correct: number;
    total: number;
  }>;

  /** Recent performance by difficulty */
  difficultyStats: Array<{
    name: string;
    total: number;
    correct: number;
    accuracy: number;
  }>;

  /** Last 30 days trend */
  recentAccuracy: number | null;
  priorAccuracy: number | null;
  trend: "improving" | "declining" | "stable" | "new";

  /** Time spent stats */
  avgTimePerQuestion: number | null;

  /** Weekly challenge */
  weeklyChallenge: {
    description: string;
    current: number;
    target: number;
  } | null;
}

export interface StudyPlanOutput {
  insight: string;
  primaryAction: {
    type: "study_category" | "take_exam" | "review_mistakes" | "flashcards" | "mixed";
    label: string;
    description: string;
    categorySlug?: string;
  };
  weeklySchedule: Array<{
    day: string;
    focus: string;
    category: string;
    mode: "study" | "exam" | "review" | "flashcards";
    targetQuestions: number;
    note: string;
  }>;
  categoryPriorities: Array<{
    slug: string;
    priority: "highest" | "high" | "medium" | "low";
    reason: string;
    suggestedQuestions: number;
  }>;
  difficultyRecommendation: {
    recommended: "easy" | "medium" | "hard" | "mixed";
    reason: string;
  };
  modeRecommendation: {
    recommended: "study" | "exam" | "both";
    reason: string;
  };
  learningStyle: string;
  motivation: string;
}

// -------------------------------------------------------------------
// Parse AI JSON response into typed StudyPlanOutput
// -------------------------------------------------------------------

const VALID_PRIORITIES = ["highest", "high", "medium", "low"] as const;
const VALID_MODES = ["study", "exam", "review", "flashcards"] as const;
const VALID_DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;
const VALID_ACTION_TYPES = ["study_category", "take_exam", "review_mistakes", "flashcards", "mixed"] as const;
const VALID_MODE_RECS = ["study", "exam", "both"] as const;

function asEnum<T extends readonly string[]>(val: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof val === "string" && (allowed as readonly string[]).includes(val)) return val as T[number];
  return fallback;
}

function asNumber(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

function asString(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

export function parseStudyPlanOutput(raw: Record<string, unknown>): StudyPlanOutput {
  const pa = (raw.primaryAction as Record<string, unknown>) ?? {};
  const schedule = asArray(raw.weeklySchedule).map((d: unknown) => {
    const day = d as Record<string, unknown>;
    return {
      day: asString(day.day, ""),
      focus: asString(day.focus, ""),
      category: asString(day.category, ""),
      mode: asEnum(day.mode, VALID_MODES, "study"),
      targetQuestions: asNumber(day.targetQuestions, 5),
      note: asString(day.note, ""),
    };
  });

  const priorities = asArray(raw.categoryPriorities).map((p: unknown) => {
    const pri = p as Record<string, unknown>;
    return {
      slug: asString(pri.slug, ""),
      priority: asEnum(pri.priority, VALID_PRIORITIES, "medium"),
      reason: asString(pri.reason, ""),
      suggestedQuestions: asNumber(pri.suggestedQuestions, 5),
    };
  });

  return {
    insight: asString(raw.insight, "تحليل أدائك قيد التجهيز…"),
    primaryAction: {
      type: asEnum(pa.type, VALID_ACTION_TYPES, "mixed"),
      label: asString(pa.label, "ادرس الآن"),
      description: asString(pa.description, "خطة مصمّمة خصّيصًا لك"),
      categorySlug: typeof pa.categorySlug === "string" ? pa.categorySlug : undefined,
    },
    weeklySchedule: schedule,
    categoryPriorities: priorities,
    difficultyRecommendation: {
      recommended: asEnum(
        (raw.difficultyRecommendation as Record<string, unknown>)?.recommended,
        VALID_DIFFICULTIES,
        "mixed"
      ),
      reason: asString((raw.difficultyRecommendation as Record<string, unknown>)?.reason, ""),
    },
    modeRecommendation: {
      recommended: asEnum(
        (raw.modeRecommendation as Record<string, unknown>)?.recommended,
        VALID_MODE_RECS,
        "study"
      ),
      reason: asString((raw.modeRecommendation as Record<string, unknown>)?.reason, ""),
    },
    learningStyle: asString(raw.learningStyle, ""),
    motivation: asString(raw.motivation, "استمر في التقدّم! 🚀"),
  };
}

// -------------------------------------------------------------------
// Build the AI prompt
// -------------------------------------------------------------------

export function buildStudyPlanPrompt(input: StudyPlanInput): string {
  const catsSection = input.categories
    .map(
      (c) =>
        `- "${c.nameAr}" (slug: ${c.slug}): إتقان ${c.mastery}%, ${c.attempted} محاولة, ${c.correct} صحيحة, ${c.total} سؤال متاح`
    )
    .join("\n");

  const diffSection = input.difficultyStats
    .map(
      (d) => `- ${d.name}: ${d.total} محاولة, دقة ${Math.round(d.accuracy * 100)}%`
    )
    .join("\n");

  const trendText =
    input.trend === "new"
      ? "مستخدم جديد — لا توجد بيانات كافية للاتجاه"
      : input.trend === "improving"
        ? `متحسّن — دقة آخر 7 أيام ${input.recentAccuracy != null ? Math.round(input.recentAccuracy) : "?"}%, بينما كانت ${input.priorAccuracy != null ? Math.round(input.priorAccuracy) : "?"}% قبل ذلك`
        : input.trend === "declining"
          ? `منخفض — دقة آخر 7 أيام ${input.recentAccuracy != null ? Math.round(input.recentAccuracy) : "?"}%, بينما كانت ${input.priorAccuracy != null ? Math.round(input.priorAccuracy) : "?"}% قبل ذلك`
          : `مستقر — دقة آخر 7 أيام ${input.recentAccuracy != null ? Math.round(input.recentAccuracy) : "?"}%`;

  return `أنت مستشار تعليمي خبير باللغة العربية. حلّل بيانات أداء الطالب التالية وقدّم خطة دراسة شخصية.

⚠️ أعد JSON فقط — لا نص إضافي، لا markdown.

# معلومات الطالب
- المستوى: ${input.level}
- إجمالي النقاط: ${input.totalXp}
- السلسلة الحالية: ${input.currentStreak} يوم
- أطول سلسلة: ${input.longestStreak} يوم
- إجمالي المحاولات: ${input.totalAttempts}
- الدقة الكلية: ${input.overallAccuracy != null ? `${input.overallAccuracy}%` : "\u2014"}
- بطاقات المراجعة المستحقة: ${input.dueReviewCount}
- متوسط الوقت لكل سؤال: ${input.avgTimePerQuestion != null ? `${input.avgTimePerQuestion} ثانية` : "\u2014"}

# الاتجاه
${trendText}

# الفئات (مرتبة حسب الإتقان)
${catsSection}

# الأداء حسب مستوى الصعوبة
${diffSection}

${
  input.weeklyChallenge
    ? `# التحدي الأسبوعي\n- ${input.weeklyChallenge.description}\n- التقدّم: ${input.weeklyChallenge.current} من ${input.weeklyChallenge.target}`
    : ""
}

# مطلوب منك
1. حلّل نقاط القوة والضعف بناءً على البيانات
2. قدّم خطة أسبوعية (أسبوع دراسي عربي: السبت\u2192الجمعة) مقسّمة على 7 أيام
3. حدّد الفئات التي تحتاج تركيزًا فوريًا
4. اقترح مستوى الصعوبة المناسب
5. اقترح نمط الدراسة المناسب (مذاكرة/اختبار/كلاهما)
6. لاحظ أسلوب التعلّم (سرعاته، أنماطه)
7. قدّم رسالة تحفيزية

# صيغة JSON المطلوبة (اتبعها بدقة)
{
  "insight": "<تقييم شخصي لمسار الطالب حالياً \u2014 جملة أو جملتين>",
  "primaryAction": {
    "type": "study_category|take_exam|review_mistakes|flashcards|mixed",
    "label": "<زر الإجراء \u2014 3-5 كلمات>",
    "description": "<شرح مختصر>",
    "categorySlug": "<إذا كان النوع study_category>"
  },
  "weeklySchedule": [
    {
      "day": "<اسم اليوم>",
      "focus": "<محور اليوم>",
      "category": "<اسم الفئة>",
      "mode": "study|exam|review|flashcards",
      "targetQuestions": <عدد>,
      "note": "<ملاحظة>"
    }
  ],
  "categoryPriorities": [
    {
      "slug": "<category slug>",
      "priority": "highest|high|medium|low",
      "reason": "<سبب التصنيف>",
      "suggestedQuestions": <عدد>
    }
  ],
  "difficultyRecommendation": {
    "recommended": "easy|medium|hard|mixed",
    "reason": "<سبب الاقتراح>"
  },
  "modeRecommendation": {
    "recommended": "study|exam|both",
    "reason": "<سبب الاقتراح>"
  },
  "learningStyle": "<ملاحظة عن أسلوب تعلّم الطالب \u2014 جملة واحدة>",
  "motivation": "<رسالة تحفيزية قصيرة>"
}`;
}
