"use client";

import { create } from "zustand";

// ---------------------------------------------------------------------------
// View-state navigation (single-route constraint)
// ---------------------------------------------------------------------------

export type ViewKey =
  | { kind: "dashboard" }
  | { kind: "study"; categorySlug?: string; sourceSlugs?: string[]; questionIds?: string[] }
  | { kind: "study_setup" }
  | { kind: "exam_setup" }
  | { kind: "exam_running"; sessionId: string; questionIds: string[]; durationSec: number }
  | { kind: "exam_report"; sessionId: string; questionIds: string[]; selections: Record<string, string | null>; durationSec: number }
  | { kind: "revision"; tab: "mistakes" | "favorites" | "flashcards" }
  | { kind: "stats" }
  | { kind: "search" }
  | { kind: "achievements" };

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
  }
}
