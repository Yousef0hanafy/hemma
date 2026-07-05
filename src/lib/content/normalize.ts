// =====================================================================
// Content Ingestion Pipeline — Validator + Normalizer
// =====================================================================

import { z } from "zod";
import {
  ArabicLetter,
  CATEGORY_MAP,
  NormalizedQuestion,
  QuestionOption,
  RawQuestionJSON,
  RawSourceJSON,
  UNKNOWN_CATEGORY_ORDER,
} from "./types";

// ---------------------------------------------------------------------------
// 1. Validator (Zod)
// ---------------------------------------------------------------------------

const ArabicLetterSchema = z.enum(["أ", "ب", "ج", "د"]);

const RawQuestionSchema = z.object({
  id: z.number().int().positive(),
  type: z.string().min(1),
  question: z.string().min(1),
  options: z
    .record(z.string(), z.string().min(1))
    .refine(
      (opts) => Object.keys(opts).length >= 2,
      "Question must have at least 2 options"
    ),
  answer: z.string().min(1),
  citation: z.string().optional(),
});

const RawSourceSchema = z.object({
  document_title: z.string().min(1),
  date: z.string().optional(),
  questions: z.array(RawQuestionSchema).min(1),
});

export interface ValidationResult {
  ok: boolean;
  data?: RawSourceJSON;
  errors: string[];
}

export function validateSource(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const parsed = RawSourceSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { ok: false, errors };
  }
  return { ok: true, data: parsed.data, errors };
}

// ---------------------------------------------------------------------------
// 2. Normalizer — clean text + canonicalize keys
// ---------------------------------------------------------------------------

const CANONICAL_LETTERS: Record<string, ArabicLetter> = {
  // Arabic letters with various normalizations
  "أ": "أ", "ا": "أ", "إ": "أ", "آ": "أ",
  "ب": "ب",
  "ج": "ج",
  "د": "د",
  // Latin fallbacks
  "a": "أ", "A": "أ",
  "b": "ب", "B": "ب",
  "c": "ج", "C": "ج",
  "d": "د", "D": "د",
  // Numeric fallbacks
  "1": "أ",
  "2": "ب",
  "3": "ج",
  "4": "د",
};

/**
 * Strip PDF-extraction noise from text.
 * Examples removed: trailing " ١٠٠٪", " 100%", extra spaces.
 */
export function cleanText(input: string): string {
  if (!input) return "";
  return input
    // Strip trailing percentage noise like " ١٠٠٪" or " 100%"
    .replace(/\s*[١٢٣٤٥٦٧٨٩٠0-9]+٪?\s*$/u, "")
    .replace(/\s+100%\s*$/u, "")
    // Normalize multiple spaces
    .replace(/\s{2,}/g, " ")
    // Normalize Arabic punctuation
    .replace(/\.{2,}/g, "…")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+([،.؟!؛:])/g, "$1")
    .trim();
}

export function canonicalLetter(key: string): ArabicLetter | null {
  const trimmed = key.trim();
  if (CANONICAL_LETTERS[trimmed]) return CANONICAL_LETTERS[trimmed];
  // Try first char
  const first = trimmed[0];
  if (first && CANONICAL_LETTERS[first]) return CANONICAL_LETTERS[first];
  return null;
}

/**
 * Convert raw options dict to canonical ordered list.
 * Tries Arabic-letter keys first; falls back to insertion order.
 */
export function normalizeOptions(
  raw: Record<string, string>
): { options: QuestionOption[]; keyMap: Record<string, ArabicLetter> } {
  const orderedKeys = Object.keys(raw);
  const options: QuestionOption[] = [];
  const keyMap: Record<string, ArabicLetter> = {};
  const canonicalLetters: ArabicLetter[] = ["أ", "ب", "ج", "د"];

  orderedKeys.forEach((rawKey, idx) => {
    const canonical = canonicalLetter(rawKey) ?? canonicalLetters[idx];
    options.push({ key: canonical, text: cleanText(raw[rawKey]) });
    keyMap[rawKey] = canonical;
  });

  return { options, keyMap };
}

// ---------------------------------------------------------------------------
// 3. Category mapper
// ---------------------------------------------------------------------------

export function mapCategory(
  rawType: string
): { slug: string; nameAr: string; order: number; icon: string; color: string } {
  const trimmed = rawType.trim();
  if (CATEGORY_MAP[trimmed]) {
    return { nameAr: trimmed, ...CATEGORY_MAP[trimmed] };
  }
  // Unknown type → create a slugified new category
  const slug = trimmed
    .replace(/\s+/g, "_")
    .toLowerCase()
    .slice(0, 50) || "unknown";
  return {
    slug,
    nameAr: trimmed,
    order: UNKNOWN_CATEGORY_ORDER,
    icon: "CircleDashed",
    color: "slate",
  };
}

// ---------------------------------------------------------------------------
// 4. Auto-explanation generator (per-category templates)
// ---------------------------------------------------------------------------

/**
 * Generate an Arabic explanation + study tip for a question based on its category.
 * These are template-based; can be edited in DB or upgraded to AI later.
 */
export function generateExplanation(
  categorySlug: string,
  stem: string,
  options: QuestionOption[],
  correctKey: ArabicLetter
): { explanation: string; studyTip: string } {
  const correctOption = options.find((o) => o.key === correctKey);
  const correctText = correctOption?.text ?? "";

  switch (categorySlug) {
    case "verbal_analogy":
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.\n` +
          `في التناظر اللفظي، نبحث عن العلاقة نفسها بين كلمتي السؤال في كلمتي الإجابة. ` +
          `حلّل العلاقة بين الكلمتين الأصلتين (سبب-نتيجة، جزء-كل، نقيض، تتابع زمني…) ثم ابحث عن الزوج الذي يحقق العلاقة ذاتها.`,
        studyTip:
          "حدّد نوع العلاقة بكلمة واحدة قبل النظر إلى الخيارات، فهذا يحميك من الانخداع بالتشابه السطحي.",
      };

    case "sentence_completion":
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.\n` +
          `في إكمال الجمل، ينبغي أن يحقق المختار معنى متسقًا وتركيبًا نحويًا سليمًا. ` +
          `انتبه إلى أداة الربط (كلما، لكي، رغم…) فإنها تحدد اتجاه المعنى (تضاد، تتابع، شرط).`,
        studyTip:
          "جرّب تعويض الفراغين بكلمتين من عندك قبل قراءة الخيارات، ثم اختر الأقرب لمعناك.",
      };

    case "contextual_error":
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.\n` +
          `في الخطأ السياقي، الكلمة الخطأ تكسر انساق المعنى أو المنطق رغم صحة لفظها. ` +
          `اقرأ الجملة كاملة وتساءل: هل هذه الكلمة تخدم المعنى المُراد أم تناقضه؟`,
        studyTip:
          "استبدل كل كلمة بمترادفها قبل الحكم؛ الكلمة الشاذة لا يقبلها السياق حتى لو أُبدلت.",
      };

    case "odd_word_out":
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.\n` +
          `في المفردة الشاذة، ثلاث كلمات تشترك في معنى أو مجال واحد، والرابعة خارجة عنه. ` +
          `حدّد الجامع المشترك بين ثلاث منها فإن لم تجده للرابعة فهي الشاذة.`,
        studyTip:
          "ابحث عن تصنيف واحد يجمع ثلاثًا (مجال طبّي، زمني، مكاني…) قبل النظر إلى الرابعة.",
      };

    case "reading_comprehension":
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.\n` +
          `في استيعاب المقروء، ارجع إلى النص ولا تعتمد على ذاكرتك. ` +
          `حدّد الكلمات المفتاحية في السؤال ثم ابحث عنها أو عن مرادفاتها في النص.`,
        studyTip:
          "اقرأ السؤال أولًا ثم اقرأ النص بنيّة البحث عن الإجابة؛ هذا يوفر الوقت ويصوّب الانتباه.",
      };

    default:
      return {
        explanation: `الإجابة الصحيحة هي «${correctKey}» — ${correctText}.`,
        studyTip: "راجع هذا النوع من الأسئلة بانتظام لترسيخ المهارة.",
      };
  }
}

// ---------------------------------------------------------------------------
// 5. Difficulty estimator (heuristic)
// ---------------------------------------------------------------------------

export function estimateDifficulty(
  stem: string,
  options: QuestionOption[]
): Difficulty {
  const stemLen = stem.length;
  const avgOptionLen =
    options.reduce((acc, o) => acc + o.text.length, 0) / Math.max(options.length, 1);

  // Simple heuristic
  if (stemLen < 30 && avgOptionLen < 15) return "easy";
  if (stemLen > 100 || avgOptionLen > 30) return "hard";
  return "medium";
}

// ---------------------------------------------------------------------------
// 6. Full normalizer
// ---------------------------------------------------------------------------

export function normalizeQuestion(
  sourceSlug: string,
  raw: RawQuestionJSON
): NormalizedQuestion {
  const { options, keyMap } = normalizeOptions(raw.options);
  const correctKey = keyMap[raw.answer] ?? canonicalLetter(raw.answer) ?? "أ";
  const cat = mapCategory(raw.type);
  const stem = cleanText(raw.question);
  const { explanation, studyTip } = generateExplanation(
    cat.slug,
    stem,
    options,
    correctKey
  );
  const difficulty = estimateDifficulty(stem, options);

  return {
    sourceSlug,
    sourceLocalId: raw.id,
    rawType: raw.type,
    categorySlug: cat.slug,
    categoryNameAr: cat.nameAr,
    stem,
    options,
    correctKey,
    explanation,
    studyTip,
    difficulty,
    tags: [],
    citation: raw.citation,
    metadata: {},
  };
}
