"use client";

import { create } from "zustand";

// ---------------------------------------------------------------------------
// View-state navigation (single-route constraint)
// ---------------------------------------------------------------------------

export type ViewKey =
  | { kind: "dashboard" }
  | { kind: "study"; categorySlug?: string; sourceSlugs?: string[]; questionIds?: string[]; purpose?: "study" | "review" }
  | { kind: "study_setup" }
  | { kind: "exam_setup" }
  | { kind: "exam_running"; sessionId: string; questionIds: string[]; durationSec: number }
  | { kind: "exam_report"; sessionId: string; questionIds: string[]; selections: Record<string, string | null>; durationSec: number; actualDurationSec?: number }
  | { kind: "revision"; tab: "mistakes" | "favorites" | "flashcards" }
  | { kind: "stats" }
  | { kind: "search" }
  | { kind: "achievements" }
  | { kind: "exam_history" }
  | { kind: "exam_history_detail"; sessionId: string }
  | { kind: "profile" }
  | { kind: "study_plan" }
  | { kind: "leaderboard" }
  | { kind: "study_buddy"; initialQuestion?: string; context?: string };

interface ViewState {
  view: ViewKey;
  history: ViewKey[];
  setView: (v: ViewKey) => void;
  back: () => void;
  canGoBack: () => boolean;
}

export const useViewStore = create<ViewState>((set, get) => ({
  view: { kind: "dashboard" },
  history: [],
  setView: (v) => {
    const cur = get().view;
    set({ view: v, history: [...get().history, cur].slice(-30) });
    // Scroll to top on view change
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Update URL hash for shareability
    if (typeof window !== "undefined") {
      const hash = viewToHash(v);
      if (hash && window.location.hash !== `#${hash}`) {
        window.history.replaceState(null, "", `#${hash}`);
      }
    }
  },
  back: () => {
    const h = get().history;
    if (h.length === 0) {
      set({ view: { kind: "dashboard" } });
      return;
    }
    const prev = h[h.length - 1];
    set({ view: prev, history: h.slice(0, -1) });
  },
  canGoBack: () => get().history.length > 0,
}));

function viewToHash(v: ViewKey): string {
  switch (v.kind) {
    case "dashboard": return "";
    case "study": return `study/${v.categorySlug ?? "all"}`;
    case "study_setup": return "study-setup";
    case "exam_setup": return "exam-setup";
    case "exam_running": return "exam";
    case "exam_report": return "exam-report";
    case "revision": return `revision/${v.tab}`;
    case "stats": return "stats";
    case "search": return "search";
    case "achievements": return "achievements";
    case "exam_history": return "exam-history";
    case "exam_history_detail": return `exam-history/${v.sessionId}`;
    case "profile": return "profile";
    case "study_plan": return "study-plan";
    case "study_buddy": return "study-buddy";
    case "leaderboard": return "leaderboard";
  }
}

/**
 * Parse a URL hash back into a ViewKey.
 * Returns null if the hash is empty (dashboard) or unrecognized.
 */
export function hashToView(hash: string): ViewKey | null {
  const clean = hash.replace(/^#/, "");
  if (!clean) return { kind: "dashboard" };

  // exam-history/:sessionId
  if (clean.startsWith("exam-history/")) {
    const sessionId = clean.slice("exam-history/".length);
    if (sessionId) return { kind: "exam_history_detail", sessionId };
    return { kind: "exam_history" };
  }

  // study/:categorySlug
  if (clean.startsWith("study/")) {
    const slug = clean.slice("study/".length);
    return { kind: "study", categorySlug: slug === "all" ? undefined : slug };
  }

  // revision/:tab
  if (clean.startsWith("revision/")) {
    const tab = clean.slice("revision/".length) as "mistakes" | "favorites" | "flashcards";
    if (tab === "mistakes" || tab === "favorites" || tab === "flashcards") {
      return { kind: "revision", tab };
    }
    return null;
  }

  // Dynamic routes (exam_running, exam_report) require internal state that
  // can't be captured in a URL hash — return null so the default dashboard shows.
  const routes: Record<string, ViewKey | null> = {
    "study-setup": { kind: "study_setup" },
    "exam-setup": { kind: "exam_setup" },
    "exam": null,
    "exam-report": null,
    "stats": { kind: "stats" },
    "search": { kind: "search" },
    "achievements": { kind: "achievements" },
    "exam-history": { kind: "exam_history" },
    "profile": { kind: "profile" },
    "study-plan": { kind: "study_plan" },
    "leaderboard": { kind: "leaderboard" },
    "study-buddy": { kind: "study_buddy" },
  };
  return routes[clean] ?? null;
}
