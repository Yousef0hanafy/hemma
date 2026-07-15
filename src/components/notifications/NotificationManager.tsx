"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  supportsNotifications,
  getPermissionStatus,
  showReviewReminder,
  showStreakAlert,
  getNotificationPrefs,
} from "@/lib/notifications";

// =====================================================================
// NotificationManager
//
// Runs client-side checks for notification triggers while the app is
// open. Does NOT render any UI — it's a side-effect-only component.
//
// Checks:
//   1. Review reminder — once per day if there are due reviews
//   2. Streak-at-risk — once per day if the user hasn't studied
//      today and has an active streak
//
// Best-effort: silently fails if notifications aren't supported,
// permission is denied, or the fetch fails.
// =====================================================================

/**
 * Interval between checks in milliseconds (every 5 minutes while app is open).
 */
const CHECK_INTERVAL = 5 * 60 * 1000;

export function NotificationManager() {
  const { data: session, status } = useSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef<string>("");

  useEffect(() => {
    // Only run when the user is authenticated
    if (status !== "authenticated") return;
    if (!session?.user) return;

    // Check if notifications are supported and permitted
    if (!supportsNotifications()) return;
    if (getPermissionStatus() === "denied") return;

    // Check user preferences
    const prefs = getNotificationPrefs();
    if (!prefs.reviewReminder && !prefs.streakAlert) return;

    // ── Main check function ────────────────────────────────────────
    const runChecks = async () => {
      try {
        // Avoid duplicate checks within the same minute
        const now = new Date();
        const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        if (minuteKey === lastCheckRef.current) return;
        lastCheckRef.current = minuteKey;

        // We need to dynamically import server actions to check state.
        // We fetch review count and profile data in parallel.
        const { fetchDueReviewCount } = await import(
          "@/server/actions/progress"
        );
        const { fetchUserProfile } = await import(
          "@/server/actions/progress"
        );

        const [dueCount, profile] = await Promise.all([
          fetchDueReviewCount(),
          fetchUserProfile(),
        ]);

        // ── Review reminder ──────────────────────────────────────────
        if (dueCount > 0) {
          showReviewReminder(dueCount);
        }

        // ── Streak-at-risk ────────────────────────────────────────────
        if (profile.currentStreak > 0) {
          // Check if the user has studied today
          const today = new Date();
          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          if (profile.lastActiveDate !== todayKey) {
            showStreakAlert(profile.currentStreak);
          }
        }
      } catch {
        // Silently fail — not critical
      }
    };

    // Run immediately on mount (with a small delay to let the page load)
    const initialTimer = setTimeout(runChecks, 10_000);

    // Then run periodically
    intervalRef.current = setInterval(runChecks, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, session]);

  // This component renders nothing
  return null;
}
