"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

// Re-export server action wrappers as React Query-style hooks for ergonomics
import {
  fetchSources,
  fetchCategories,
  fetchQuestions,
  fetchQuestionById,
  fetchQuestionsByIds,
  type QuestionFilter,
} from "@/server/actions/questions";
import {
  fetchUserProfile,
  fetchAchievements,
  fetchCategoryMastery,
  fetchRecentAttempts,
  fetchMistakeQuestionIds,
  fetchDailyActivity,
  fetchDailyQuestProgress,
  fetchFavoriteIds,
  fetchExamHistory,
  fetchExamSessionData,
  fetchDueReviewIds,
  fetchDueReviewCount,
  fetchNextReviewDate,
  fetchTodayReviewCount,
  fetchSpeedStats,
  fetchRecentlyStudiedCategories,
  submitSrsReview,
  autoRegisterMistake,
  recordAttempt,
  toggleFavorite,
  finalizeExamSession,
  type RecordAttemptInput,
} from "@/server/actions/progress";
import type { SrsQuality } from "@/lib/engine/srs";
import {
  AchievementDTO,
  AttemptDTO,
  CategoryDTO,
  CategoryMastery,
  DailyActivityDTO,
  ExamSessionDTO,
  QuestionDTO,
  RecentCategoryInfo,
  ReviewScheduleDTO,
  SourceDTO,
  UserProfileDTO,
  SpeedStatDTO,
} from "@/lib/content/dto";

// Simple cache + invalidation pattern
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000; // 30s
const subs = new Map<string, Set<() => void>>();

/**
 * Pre-populate the data cache so useServerData hooks find the data instantly
 * on the next render. Called on hover to make navigation feel instant.
 */
export function setCacheValue(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

function subscribe(key: string, cb: () => void) {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key)!.add(cb);
  return () => {
    subs.get(key)?.delete(cb);
  };
}

function invalidate(keyPrefix: string) {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(keyPrefix)) cache.delete(k);
  }
  for (const [k, set] of subs) {
    if (k.startsWith(keyPrefix)) set.forEach((cb) => cb());
  }
}

export function useServerData<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: Error | null; refresh: () => void } {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  const scopedKey = `${userId}:${key}`;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cached = cache.get(scopedKey);
    if (cached && Date.now() - cached.ts < TTL) {
      setData(cached.data as T);
      setLoading(false);
      return;
    }
    try {
      const result = await fetcher();
      cache.set(scopedKey, { data: result, ts: Date.now() });
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [scopedKey]);

  useEffect(() => {
    load();
    return subscribe(scopedKey, load);
  }, [load, scopedKey, ...deps]);

  return { data, loading, error, refresh: load };
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

export function useSources() {
  return useServerData<SourceDTO[]>("sources", fetchSources);
}

export function useCategories() {
  return useServerData<CategoryDTO[]>("categories", fetchCategories);
}

export function useQuestions(filter: QuestionFilter = {}) {
  const key = `questions:${JSON.stringify(filter)}`;
  return useServerData<QuestionDTO[]>(key, () => fetchQuestions(filter), [
    JSON.stringify(filter),
  ]);
}

export function useQuestion(id: string | null) {
  return useServerData<QuestionDTO | null>(
    `question:${id}`,
    () => (id ? fetchQuestionById(id) : Promise.resolve(null)),
    [id]
  );
}

export function useQuestionsByIds(ids: string[]) {
  const key = `questions-by-ids:${ids.join(",")}`;
  return useServerData<QuestionDTO[]>(
    key,
    () => (ids.length > 0 ? fetchQuestionsByIds(ids) : Promise.resolve([])),
    [ids.join(",")]
  );
}

export function useUserProfile() {
  return useServerData<UserProfileDTO>("profile", fetchUserProfile);
}

export function useAchievements() {
  return useServerData<AchievementDTO[]>("achievements", fetchAchievements);
}

export function useCategoryMastery() {
  return useServerData<CategoryMastery[]>("mastery", fetchCategoryMastery);
}

export function useRecentAttempts(limit = 20) {
  return useServerData<AttemptDTO[]>(
    `recent-attempts:${limit}`,
    () => fetchRecentAttempts(limit),
    [limit]
  );
}

export function useMistakeQuestionIds(limit = 50) {
  return useServerData<string[]>(
    `mistakes:${limit}`,
    () => fetchMistakeQuestionIds(limit),
    [limit]
  );
}

export function useDailyActivity(days = 84) {
  return useServerData<DailyActivityDTO[]>(
    `daily:${days}`,
    () => fetchDailyActivity(days),
    [days]
  );
}

export function useDailyQuest() {
  return useServerData("daily-quest", fetchDailyQuestProgress);
}

export function useFavoriteIds() {
  return useServerData<string[]>("favorites", fetchFavoriteIds);
}

export function useExamHistory() {
  return useServerData<ExamSessionDTO[]>("exam-history", fetchExamHistory);
}

export function useDueReviewIds(limit = 50) {
  return useServerData<string[]>(
    `due-reviews:${limit}`,
    () => fetchDueReviewIds(limit),
    [limit]
  );
}

export function useDueReviewCount() {
  return useServerData<number>("due-review-count", fetchDueReviewCount);
}

export function useNextReviewDate() {
  return useServerData<string | null>(
    "next-review-date",
    fetchNextReviewDate
  );
}

export function useTodayReviewCount() {
  return useServerData<number>(
    "today-review-count",
    fetchTodayReviewCount
  );
}

export function useSpeedStats() {
  return useServerData<SpeedStatDTO[]>(
    "speed-stats",
    fetchSpeedStats
  );
}

export function useRecentlyStudiedCategories(limit = 5) {
  return useServerData<RecentCategoryInfo[]>(
    `recent-categories:${limit}`,
    () => fetchRecentlyStudiedCategories(limit),
    [limit]
  );
}

export function useExamSessionData(sessionId: string | null) {
  return useServerData<{
    questionIds: string[];
    selections: Record<string, string | null>;
    actualDurationSec: number | null;
  } | null>(
    `exam-session-data:${sessionId}`,
    () => (sessionId ? fetchExamSessionData(sessionId) : Promise.resolve(null)),
    [sessionId]
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRecordAttempt() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  return useCallback(async (input: RecordAttemptInput) => {
    const result = await recordAttempt(input);
    invalidate(`${userId}:mastery`);
    invalidate(`${userId}:recent-attempts`);
    invalidate(`${userId}:mistakes`);
    invalidate(`${userId}:daily`);
    invalidate(`${userId}:daily-quest`);
    invalidate(`${userId}:profile`);
    invalidate(`${userId}:recent-categories`);
    return result;
  }, [userId]);
}

export function useToggleFavorite() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  return useCallback(async (questionId: string) => {
    const result = await toggleFavorite(questionId);
    invalidate(`${userId}:favorites`);
    return result;
  }, [userId]);
}

export function useSubmitSrsReview() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  return useCallback(async (questionId: string, quality: SrsQuality) => {
    const result = await submitSrsReview(questionId, quality);
    invalidate(`${userId}:due-reviews`);
    invalidate(`${userId}:due-review-count`);
    return result;
  }, [userId]);
}

export function useAutoRegisterMistake() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  return useCallback(async (questionId: string) => {
    await autoRegisterMistake(questionId);
    invalidate(`${userId}:due-reviews`);
    invalidate(`${userId}:due-review-count`);
  }, [userId]);
}

export function useFinalizeExam() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || "guest";
  return useCallback(
    async (
      sessionId: string,
      questionIds: string[],
      selections: Record<string, string | null>,
      actualDurationSec?: number
    ) => {
      const result = await finalizeExamSession(
        sessionId,
        questionIds,
        selections as Record<string, "أ" | "ب" | "ج" | "د" | null>,
        actualDurationSec
      );
      invalidate(`${userId}:profile`);
      invalidate(`${userId}:daily`);
      invalidate(`${userId}:daily-quest`);
      invalidate(`${userId}:mastery`);
      return result;
    },
    [userId]
  );
}
