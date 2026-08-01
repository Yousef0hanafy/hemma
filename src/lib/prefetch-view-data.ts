"use client";

// -----------------------------------------------------------------------------
// Data-level prefetching for SPA navigation.
// When the user hovers over a nav button, we call the relevant server actions
// and populate the useServerData cache. By the time they click, the data is
// already cached and the view renders instantly.
//
// This is an SPA-appropriate alternative to the Speculation Rules API (which
// only works for MPA page loads).
// -----------------------------------------------------------------------------

import { setCacheValue } from "@/lib/hooks/use-data";

// Lazy import all fetchers so the module loads only on first hover
import type {
  fetchUserProfile,
  fetchCategoryMastery,
  fetchAchievements,
  fetchDueReviewCount,
  fetchMistakeQuestionIds,
  fetchFavoriteIds,
  fetchDailyActivity,
  fetchRecentlyStudiedCategories,
  fetchWeeklyChallenge,
} from "@/server/actions/progress";

import type { fetchSources, fetchCategories } from "@/server/actions/questions";
import type { fetchLearningGoals } from "@/server/actions/learning-goals";

import type { fetchLeaderboard } from "@/server/actions/leaderboard";
import type { fetchExtendedProfile } from "@/server/actions/student-profile";
import type { fetchAIStudyPlan } from "@/server/actions/ai-study-plan";

type ViewKind = string;

// Map view kinds → data cache keys + fetchers
const VIEW_PREFETCH_MAP: Record<
  string,
  Array<{ key: string; fetcher: () => Promise<unknown> }>
> = {
  dashboard: [
    { key: "profile", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchUserProfile()) },
    { key: "mastery", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchCategoryMastery()) },
    { key: "sources", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchSources()) },
    { key: "categories", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchCategories()) },
    { key: "due-review-count", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchDueReviewCount()) },
    { key: "daily:84", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchDailyActivity(84)) },
    { key: "recent-categories:5", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchRecentlyStudiedCategories(5)) },
  ],
  study_setup: [
    { key: "sources", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchSources()) },
    { key: "categories", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchCategories()) },
  ],
  exam_setup: [
    { key: "sources", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchSources()) },
    { key: "categories", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchCategories()) },
  ],
  revision: [
    { key: "due-review-count", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchDueReviewCount()) },
    { key: "mistakes:50", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchMistakeQuestionIds(50)) },
    { key: "favorites", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchFavoriteIds()) },
  ],
  stats: [
    { key: "profile", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchUserProfile()) },
    { key: "mastery", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchCategoryMastery()) },
    { key: "speed-stats", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchSpeedStats()) },
  ],
  achievements: [
    { key: "profile", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchUserProfile()) },
    { key: "achievements", fetcher: () => import("@/server/actions/progress").then((m) => m.fetchAchievements()) },
  ],
  search: [
    { key: "sources", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchSources()) },
    { key: "categories", fetcher: () => import("@/server/actions/questions").then((m) => m.fetchCategories()) },
  ],
  leaderboard: [
    { key: "leaderboard-xp", fetcher: () => import("@/server/actions/leaderboard").then((m) => m.fetchLeaderboard("xp")) },
  ],
  profile: [
    { key: "extended-profile", fetcher: () => import("@/server/actions/student-profile").then((m) => m.fetchExtendedProfile()) },
    { key: "learning-goals", fetcher: () => import("@/server/actions/learning-goals").then((m) => m.fetchLearningGoals()) },
  ],
  study_plan: [
    { key: "ai-study-plan", fetcher: () => import("@/server/actions/ai-study-plan").then((m) => m.fetchAIStudyPlan()) },
  ],
};

/**
 * Called on mouse-enter of a nav button. Pre-populates the data cache
 * for the target view so useServerData hooks find the data instantly
 * when the view renders.
 */
export function prefetchViewData(viewKind: string): void {
  const entries = VIEW_PREFETCH_MAP[viewKind];
  if (!entries || entries.length === 0) return;

  for (const { key, fetcher } of entries) {
    fetcher()
      .then((data) => setCacheValue(key, data))
      // Silently ignore prefetch errors — the real fetch on view load will handle them
      .catch(() => {});
  }
}
