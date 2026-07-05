// =====================================================================
// Client-side types & deserialization helpers
// =====================================================================

import type { Question, Category, Source, Attempt } from "@prisma/client";

export type ArabicLetter = "أ" | "ب" | "ج" | "د";
export type Difficulty = "easy" | "medium" | "hard";
export type StudyMode = "study" | "exam" | "revision" | "flashcard";

export interface QuestionOption {
  key: ArabicLetter;
  text: string;
}

export interface QuestionDTO {
  id: string;
  sourceId: string;
  sourceSlug: string;
  sourceTitle: string;
  categoryId: string;
  categorySlug: string;
  categoryNameAr: string;
  sourceLocalId: number;
  type: string;
  stem: string;
  options: QuestionOption[];
  correctKey: ArabicLetter;
  explanation: string | null;
  studyTip: string | null;
  difficulty: Difficulty;
  tags: string[];
  citation: string | null;
}

export interface CategoryDTO {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string | null;
  icon: string | null;
  colorTheme: string | null;
  displayOrder: number;
  questionCount: number;
}

export interface SourceDTO {
  id: string;
  slug: string;
  title: string;
  date: string | null;
  questionCount: number;
  importedAt: string;
}

export interface AttemptDTO {
  id: string;
  questionId: string;
  selectedKey: ArabicLetter | null;
  isCorrect: boolean;
  mode: StudyMode;
  sessionId: string | null;
  timeMs: number;
  confidence: number;
  createdAt: string;
}

export interface UserProfileDTO {
  userBucket: string;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakShields: number;
  unlockedAchievements: string[];
}

export interface AchievementDTO {
  slug: string;
  nameAr: string;
  descriptionAr: string;
  iconAr: string;
  xpReward: number;
  threshold: number;
  category: string;
}

export interface CategoryMastery {
  categorySlug: string;
  categoryNameAr: string;
  colorTheme: string | null;
  icon: string | null;
  total: number;
  attempted: number;
  correct: number;
  mastery: number; // 0..100
}

export interface DailyActivityDTO {
  date: string;
  attempts: number;
  correct: number;
  xpEarned: number;
}

// ---------------------------------------------------------------------------
// Deserialization helpers — convert Prisma rows to DTOs
// ---------------------------------------------------------------------------

export function toQuestionDTO(
  q: Question & { category: Category; source: Source }
): QuestionDTO {
  return {
    id: q.id,
    sourceId: q.sourceId,
    sourceSlug: q.source.slug,
    sourceTitle: q.source.title,
    categoryId: q.categoryId,
    categorySlug: q.category.slug,
    categoryNameAr: q.category.nameAr,
    sourceLocalId: q.sourceLocalId,
    type: q.type,
    stem: q.stem,
    options: JSON.parse(q.options) as QuestionOption[],
    correctKey: q.correctKey as ArabicLetter,
    explanation: q.explanation,
    studyTip: q.studyTip,
    difficulty: q.difficulty as Difficulty,
    tags: JSON.parse(q.tags) as string[],
    citation: q.citation,
  };
}

export function toCategoryDTO(
  c: Category,
  questionCount = 0
): CategoryDTO {
  return {
    id: c.id,
    slug: c.slug,
    nameAr: c.nameAr,
    descriptionAr: c.descriptionAr,
    icon: c.icon,
    colorTheme: c.colorTheme,
    displayOrder: c.displayOrder,
    questionCount,
  };
}

export function toSourceDTO(s: Source): SourceDTO {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    date: s.date,
    questionCount: s.questionCount,
    importedAt: s.importedAt.toISOString(),
  };
}

export function toAttemptDTO(a: Attempt): AttemptDTO {
  return {
    id: a.id,
    questionId: a.questionId,
    selectedKey: a.selectedKey as ArabicLetter | null,
    isCorrect: a.isCorrect,
    mode: a.mode as StudyMode,
    sessionId: a.sessionId,
    timeMs: a.timeMs,
    confidence: a.confidence,
    createdAt: a.createdAt.toISOString(),
  };
}
