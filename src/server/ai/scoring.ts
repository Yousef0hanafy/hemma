// =====================================================================
// AI Scoring Engine — local heuristic quality evaluation
// =====================================================================
//
// Evaluates question quality across multiple dimensions without requiring
// an external AI API. Each dimension returns a score (0–1), and the
// overall quality score is their weighted average.
//
// In the future, individual dimensions can be swapped for actual AI API
// calls (e.g., OpenAI) without changing the overall architecture.

import type { QuestionOption } from "@/lib/content/types";

// -------------------------------------------------------------------
// Scoring dimensions
// -------------------------------------------------------------------

export interface ScoringResult {
  /** Overall quality score (0–1) */
  overall: number;
  /** Per-dimension breakdown */
  dimensions: DimensionScore[];
  /** Human-readable summary of issues found */
  issues: string[];
}

export interface DimensionScore {
  name: string;
  label: string;
  score: number;
  weight: number;
}

// -------------------------------------------------------------------
// Dimension: Stem quality
// -------------------------------------------------------------------

function scoreStem(stem: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1.0;

  if (!stem || stem.length < 5) {
    score -= 0.5;
    issues.push("نص السؤال قصير جداً");
  } else if (stem.length < 15) {
    score -= 0.2;
    issues.push("نص السؤال قصير نسبياً");
  }

  if (stem.length > 500) {
    score -= 0.1;
    issues.push("نص السؤال طويل جداً");
  }

  return { score: Math.max(0, score), issues };
}

// -------------------------------------------------------------------
// Dimension: Options quality
// -------------------------------------------------------------------

function scoreOptions(
  options: QuestionOption[],
  correctKey: string
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1.0;

  if (!options || options.length < 2) {
    return { score: 0.2, issues: ["يحتاج السؤال إلى خيارين على الأقل"] };
  }

  // Check for duplicate option texts
  const texts = options.map((o) => o.text.trim().toLowerCase());
  const uniqueTexts = new Set(texts);
  if (texts.length !== uniqueTexts.size) {
    score -= 0.4;
    issues.push("يوجد خياران متطابقان أو أكثر");
  }

  // Check option length consistency
  const lengths = options.map((o) => o.text.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const maxDeviation = Math.max(...lengths.map((l) => Math.abs(l - avgLen)));

  if (maxDeviation > avgLen * 1.5 && avgLen > 10) {
    score -= 0.15;
    issues.push("تفاوت كبير في أطوال الخيارات");
  }

  // Check that all options are non-empty
  const emptyCount = options.filter((o) => !o.text.trim()).length;
  if (emptyCount > 0) {
    score -= 0.3;
    issues.push(`يوجد ${emptyCount} خيار/خيارات فارغ/ة`);
  }

  // Verify correct key exists in options
  const validKeys = options.map((o) => o.key);
  if (!validKeys.includes(correctKey as any)) {
    score -= 0.5;
    issues.push("مفتاح الإجابة الصحيحة غير موجود في الخيارات");
  }

  return { score: Math.max(0, score), issues };
}

// -------------------------------------------------------------------
// Dimension: Explanation quality
// -------------------------------------------------------------------

function scoreExplanation(
  explanation: string | null | undefined
): { score: number; issues: string[] } {
  const issues: string[] = [];

  if (!explanation || explanation.trim().length === 0) {
    return { score: 0, issues: ["الشرح مفقود"] };
  }

  let score = 1.0;
  const trimmed = explanation.trim();

  if (trimmed.length < 20) {
    score -= 0.5;
    issues.push("الشرح قصير جداً");
  } else if (trimmed.length < 50) {
    score -= 0.2;
    issues.push("الشرح قصير نسبياً");
  }

  // Check if explanation mentions the correct answer
  if (!trimmed.includes("الصحيحة") && !trimmed.includes("الجواب")) {
    score -= 0.1;
  }

  return { score: Math.max(0, score), issues };
}

// -------------------------------------------------------------------
// Dimension: Difficulty balance
// -------------------------------------------------------------------

function scoreDifficulty(
  difficulty: string
): { score: number; issues: string[] } {
  // No quality issue with any difficulty — just check it's valid
  const valid = ["easy", "medium", "hard"];
  if (!valid.includes(difficulty)) {
    return { score: 0.5, issues: ["مستوى الصعوبة غير معروف"] };
  }
  return { score: 1.0, issues: [] };
}

// -------------------------------------------------------------------
// Dimension: Tags & metadata
// -------------------------------------------------------------------

function scoreTags(
  tags: string[]
): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (!tags || tags.length === 0) {
    return { score: 0.5, issues: ["لا توجد وسوم تصنيف"] };
  }
  return { score: 1.0, issues: [] };
}

// -------------------------------------------------------------------
// Main scoring function
// -------------------------------------------------------------------

export function scoreQuestion(params: {
  stem: string;
  options: QuestionOption[];
  correctKey: string;
  explanation: string | null | undefined;
  difficulty: string;
  tags?: string[];
}): ScoringResult {
  const dimensions: DimensionScore[] = [];
  const allIssues: string[] = [];

  // 1. Stem quality (weight: 0.25)
  const stemResult = scoreStem(params.stem);
  dimensions.push({
    name: "stem",
    label: "نص السؤال",
    score: stemResult.score,
    weight: 0.25,
  });
  allIssues.push(...stemResult.issues);

  // 2. Options quality (weight: 0.30)
  const optionsResult = scoreOptions(params.options, params.correctKey);
  dimensions.push({
    name: "options",
    label: "الخيارات",
    score: optionsResult.score,
    weight: 0.30,
  });
  allIssues.push(...optionsResult.issues);

  // 3. Explanation quality (weight: 0.30)
  const explResult = scoreExplanation(params.explanation);
  dimensions.push({
    name: "explanation",
    label: "الشرح",
    score: explResult.score,
    weight: 0.30,
  });
  allIssues.push(...explResult.issues);

  // 4. Difficulty (weight: 0.05)
  const diffResult = scoreDifficulty(params.difficulty);
  dimensions.push({
    name: "difficulty",
    label: "الصعوبة",
    score: diffResult.score,
    weight: 0.05,
  });
  allIssues.push(...diffResult.issues);

  // 5. Tags (weight: 0.10)
  const tagsResult = scoreTags(params.tags ?? []);
  dimensions.push({
    name: "tags",
    label: "الوسوم",
    score: tagsResult.score,
    weight: 0.10,
  });
  allIssues.push(...tagsResult.issues);

  // Weighted average
  const totalWeight = dimensions.reduce((a, d) => a + d.weight, 0);
  const overall =
    dimensions.reduce((a, d) => a + d.score * d.weight, 0) / totalWeight;

  return {
    overall: Math.round(overall * 100) / 100,
    dimensions,
    issues: allIssues,
  };
}
