// =====================================================================
// UI helpers — Arabic numerals, category metadata, formatting, color themes
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

// ---------------------------------------------------------------------------
// Centralized Color Palette
// Single source of truth for the 6 named colors used across all components.
// ---------------------------------------------------------------------------

export interface ColorPalette {
  hex: { stroke: string; track: string; text: string };
  bg: string;
  text: string;
  ring: string;
  chip: string;          // bg + text for inline badges
  chipBorder: string;    // bg + text + border for bordered badges
  cardStat: string;      // stat card icon container
  cardAction: string;    // quick action card (bg + text + border)
  choiceAccent: string;  // choice card accent (bg + ring)
}

export const COLOR_PALETTE: Record<string, ColorPalette> = {
  emerald: {
    hex: { stroke: "#059669", track: "#d1fae5", text: "#047857" },
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    chip: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    chipBorder: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    cardStat: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
    cardAction: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    choiceAccent: "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200 dark:ring-emerald-800",
  },
  amber: {
    hex: { stroke: "#d97706", track: "#fef3c7", text: "#b45309" },
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-800",
    chip: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    chipBorder: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    cardStat: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30",
    cardAction: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    choiceAccent: "bg-amber-50 dark:bg-amber-950/30 ring-amber-200 dark:ring-amber-800",
  },
  rose: {
    hex: { stroke: "#e11d48", track: "#ffe4e6", text: "#be123c" },
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200 dark:ring-rose-800",
    chip: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
    chipBorder: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900",
    cardStat: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30",
    cardAction: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900",
    choiceAccent: "bg-rose-50 dark:bg-rose-950/30 ring-rose-200 dark:ring-rose-800",
  },
  violet: {
    hex: { stroke: "#7c3aed", track: "#ede9fe", text: "#6d28d9" },
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-200 dark:ring-violet-800",
    chip: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    chipBorder: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900",
    cardStat: "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30",
    cardAction: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900",
    choiceAccent: "bg-violet-50 dark:bg-violet-950/30 ring-violet-200 dark:ring-violet-800",
  },
  cyan: {
    hex: { stroke: "#0891b2", track: "#cffafe", text: "#0e7490" },
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-200 dark:ring-cyan-800",
    chip: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
    chipBorder: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
    cardStat: "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/30",
    cardAction: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
    choiceAccent: "bg-cyan-50 dark:bg-cyan-950/30 ring-cyan-200 dark:ring-cyan-800",
  },
  slate: {
    hex: { stroke: "#475569", track: "#e2e8f0", text: "#334155" },
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
    ring: "ring-slate-200 dark:ring-slate-700",
    chip: "bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300",
    chipBorder: "bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    cardStat: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/40",
    cardAction: "bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    choiceAccent: "bg-slate-100 dark:bg-slate-800/40 ring-slate-200 dark:ring-slate-700",
  },
};

/** Get the full ColorPalette for a named color. Falls back to emerald. */
export function getColorPalette(color: string): ColorPalette {
  return COLOR_PALETTE[color] ?? COLOR_PALETTE.emerald;
}

/** Convenience: get just the hex values for a named color. */
export function getColorHex(color: string): { stroke: string; track: string; text: string } {
  return getColorPalette(color).hex;
}

/** Convenience: get a className string for a stat-card icon container. */
export function getStatCardColor(color: string): string {
  return getColorPalette(color).cardStat;
}

/** Convenience: get a className string for a quick-action card. */
export function getActionCardColor(color: string): string {
  return getColorPalette(color).cardAction;
}

/** Convenience: get a className string for a choice-card accent. */
export function getChoiceAccentColor(color: string): string {
  return getColorPalette(color).choiceAccent;
}

/** Convenience: get a className string for an inline chip/badge. */
export function getChipColor(color: string): string {
  return getColorPalette(color).chip;
}

// Convert seconds → "MM:SS" Arabic
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${toArabicDigits(m)}:${toArabicDigits(String(s).padStart(2, "0"))}`;
}

// Format a Date as Arabic relative time (handles both past and future dates)
export function relativeTimeAr(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absSec = Math.floor(Math.abs(diffMs) / 1000);

  if (absSec < 60) return "الآن";

  const prefix = diffMs > 0 ? "بعد" : "قبل";

  const absMin = Math.floor(absSec / 60);
  if (absMin < 60) return `${prefix} ${toArabicDigits(absMin)} دقيقة`;

  const absHr = Math.floor(absMin / 60);
  if (absHr < 24) return `${prefix} ${toArabicDigits(absHr)} ساعة`;

  const absDay = Math.floor(absHr / 24);
  if (absDay < 30) return `${prefix} ${toArabicDigits(absDay)} يوم`;

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
