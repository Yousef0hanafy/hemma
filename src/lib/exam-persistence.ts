import { ViewKey } from "@/lib/store/view-store";
import { ArabicLetter } from "@/lib/content/dto";

// ---------------------------------------------------------------------------
// Persist incomplete exam/study state to localStorage so it survives
// session expiry. Restored after re-authentication.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hemma_pending_exam";

/** 24 hours in milliseconds — saved state older than this is treated as stale. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingSession {
  /** The view key, always exam_running or study */
  view: Extract<ViewKey, { kind: "exam_running" }> | Extract<ViewKey, { kind: "study" }>;
  /** Internal progress state */
  internal: PendingExamInternal;
  /** When it was saved (epoch ms) */
  savedAt: number;
}

export interface PendingExamInternal {
  currentIndex: number;
  selections: Record<string, ArabicLetter | null>;
  timeLeft: number;
}

// ---------------------------------------------------------------------------

export function savePendingExam(state: PendingSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadPendingExam(): PendingSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSession;
    // Basic sanity check
    if (!parsed.view || !parsed.internal || typeof parsed.savedAt !== "number") {
      clearPendingExam();
      return null;
    }
    // Discard stale data older than 24 hours
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearPendingExam();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingExam(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Returns a human-friendly Arabic label for the pending session type. */
export function pendingSessionLabel(view: PendingSession["view"]): string {
  switch (view.kind) {
    case "exam_running":
      return "اختبار";
    case "study":
      return "مذاكرة";
    default:
      return "جلسة";
  }
}
