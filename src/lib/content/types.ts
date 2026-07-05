// =====================================================================
// Content Ingestion Pipeline — Types
// =====================================================================

export type ArabicLetter = "أ" | "ب" | "ج" | "د";
export type Difficulty = "easy" | "medium" | "hard";

export interface RawQuestionJSON {
  id: number;
  type: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  citation?: string;
}

export interface RawSourceJSON {
  document_title: string;
  date?: string;
  questions: RawQuestionJSON[];
}

export interface QuestionOption {
  key: ArabicLetter;
  text: string;
}

export interface NormalizedQuestion {
  sourceSlug: string;
  sourceLocalId: number;
  rawType: string;
  categorySlug: string;
  categoryNameAr: string;
  stem: string;
  options: QuestionOption[];
  correctKey: ArabicLetter;
  explanation: string;
  studyTip: string;
  difficulty: Difficulty;
  tags: string[];
  citation?: string;
  metadata: Record<string, unknown>;
}

export interface IngestionResult {
  sourceSlug: string;
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
  categories: string[];
}

// Map of known category type strings → slugs
export const CATEGORY_MAP: Record<string, { slug: string; order: number; icon: string; color: string }> = {
  "تناظر لفظي":     { slug: "verbal_analogy",        order: 1, icon: "Shuffle",     color: "emerald" },
  "إكمال جمل":      { slug: "sentence_completion",   order: 2, icon: "AlignRight",  color: "amber"   },
  "خطأ سياقي":      { slug: "contextual_error",      order: 3, icon: "AlertCircle", color: "rose"    },
  "المفردة الشاذة": { slug: "odd_word_out",          order: 4, icon: "Diff",        color: "violet"  },
  "استيعاب المقروء": { slug: "reading_comprehension", order: 5, icon: "BookOpen",    color: "cyan"    },
};

export const UNKNOWN_CATEGORY_ORDER = 99;
