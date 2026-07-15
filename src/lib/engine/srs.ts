// =====================================================================
// Spaced Repetition — SM-2 Algorithm
// Pure functions, no DB or React dependencies.
// =====================================================================

/**
 * Quality of recall (SM-2 scale):
 * 0 — complete blackout
 * 1 — incorrect, but upon seeing answer it felt familiar
 * 2 — incorrect, but answer seemed easy to remember
 * 3 — correct with serious difficulty
 * 4 — correct after hesitation
 * 5 — perfect response
 */
export type SrsQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsState {
  easiness: number;
  interval: number;      // days until next review
  repetitions: number;   // consecutive correct answers
}

/** Minimum easiness factor (prevents intervals from growing too fast). */
const MIN_EF = 1.3;

/** Maximum easiness factor (safety cap). */
const MAX_EF = 4.0;

/**
 * Apply the SM-2 algorithm to compute the new SRS state after a review.
 *
 * @param state  Current SRS state before review.
 * @param quality  Quality of recall (0–5).
 * @returns New SRS state + the computed next-review date.
 */
export function applySm2(
  state: SrsState,
  quality: SrsQuality
): { newState: SrsState; nextReviewAt: Date } {
  let { easiness, interval, repetitions } = state;

  // Update easiness factor
  easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easiness = Math.max(MIN_EF, Math.min(MAX_EF, easiness));

  if (quality < 3) {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  } else {
    // Correct — increase interval
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
  }

  // Clamp interval to a reasonable max (365 days = 1 year)
  interval = Math.min(interval, 365);

  const now = new Date();
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { newState: { easiness, interval, repetitions }, nextReviewAt };
}

/** Returns the label in Arabic for each quality level. */
export function qualityLabel(quality: SrsQuality): string {
  const labels: Record<SrsQuality, string> = {
    0: "لا أتذكر",
    1: "مألوف",
    2: "صعب",
    3: "بصعوبة",
    4: "بعد تردّد",
    5: "ممتاز",
  };
  return labels[quality];
}

/** Default initial SRS state for a new card. */
export const DEFAULT_SRS_STATE: SrsState = {
  easiness: 2.5,
  interval: 0,
  repetitions: 0,
};

/** Human-readable label for how soon a card is due. */
export function dueLabel(nextReviewAt: Date): string {
  const now = new Date();
  const diffMs = nextReviewAt.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "مستحق الآن";
  if (diffDays === 1) return "غدًا";
  if (diffDays <= 7) return `بعد ${diffDays} أيام`;
  if (diffDays <= 30) return `بعد ${Math.round(diffDays / 7)} أسابيع`;
  return `بعد ${Math.round(diffDays / 30)} أشهر`;
}
