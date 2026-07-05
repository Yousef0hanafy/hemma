// =====================================================================
// UI helpers — Arabic numerals, category metadata, formatting
// =====================================================================

import { CategoryDTO } from "./dto";

// Convert Latin digits to Arabic-Indic digits (for display only)
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

// Format a percentage as Arabic-Indic with %
export function formatPercent(value: number): string {
  return `${toArabicDigits(Math.round(value))}٪`;
}

// Map category slug → color theme + icon (mirrors ingestion-time mapping)
export const CATEGORY_META: Record<
  string,
  { color: string; bg: string; text: string; ring: string; icon: string }
> = {
  verbal_analogy:        { color: "emerald", bg: "bg-emerald-50 dark:bg-emerald-950/40",  text: "text-emerald-700 dark:text-emerald-300",  ring: "ring-emerald-200 dark:ring-emerald-800",  icon: "Shuffle"     },
  sentence_completion:   { color: "amber",   bg: "bg-amber-50 dark:bg-amber-950/40",      text: "text-amber-700 dark:text-amber-300",      ring: "ring-amber-200 dark:ring-amber-800",      icon: "AlignRight"  },
  contextual_error:      { color: "rose",    bg: "bg-rose-50 dark:bg-rose-950/40",        text: "text-rose-700 dark:text-rose-300",        ring: "ring-rose-200 dark:ring-rose-800",        icon: "AlertCircle" },
  odd_word_out:          { color: "violet",  bg: "bg-violet-50 dark:bg-violet-950/40",    text: "text-violet-700 dark:text-violet-300",    ring: "ring-violet-200 dark:ring-violet-800",    icon: "Diff"        },
  reading_comprehension: { color: "cyan",    bg: "bg-cyan-50 dark:bg-cyan-950/40",        text: "text-cyan-700 dark:text-cyan-300",        ring: "ring-cyan-200 dark:ring-cyan-800",        icon: "BookOpen"    },
};

export function categoryMeta(slug: string) {
  return (
    CATEGORY_META[slug] ?? {
      color: "slate",
      bg: "bg-slate-50 dark:bg-slate-900/40",
      text: "text-slate-700 dark:text-slate-300",
      ring: "ring-slate-200 dark:ring-slate-800",
      icon: "CircleDashed",
    }
  );
}

// Convert seconds → "MM:SS" Arabic
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${toArabicDigits(m)}:${toArabicDigits(String(s).padStart(2, "0"))}`;
}

// Format a Date as Arabic relative time
export function relativeTimeAr(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${toArabicDigits(min)} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${toArabicDigits(hr)} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `قبل ${toArabicDigits(day)} يوم`;
  return d.toLocaleDateString("ar");
}

// Map difficulty → Arabic label + color
export const DIFFICULTY_META: Record<string, { labelAr: string; className: string }> = {
  easy:   { labelAr: "سهل",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  medium: { labelAr: "متوسط", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  hard:   { labelAr: "صعب",   className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

// Map category slug → display name fallback
export function categoryDisplayName(slug: string, categories?: CategoryDTO[]): string {
  const cat = categories?.find((c) => c.slug === slug);
  if (cat) return cat.nameAr;
  const fallbacks: Record<string, string> = {
    verbal_analogy: "تناظر لفظي",
    sentence_completion: "إكمال جمل",
    contextual_error: "خطأ سياقي",
    odd_word_out: "المفردة الشاذة",
    reading_comprehension: "استيعاب المقروء",
  };
  return fallbacks[slug] ?? slug;
}
