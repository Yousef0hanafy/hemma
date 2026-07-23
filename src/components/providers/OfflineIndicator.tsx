"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "hemma:offline-dismissed";

/**
 * Performs a lightweight fetch to check actual internet connectivity.
 * More reliable than `navigator.onLine`, which often returns `false`
 * on localhost, in development, or with certain browser extensions.
 */
async function checkReachable(signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/favicon.ico", {
      method: "HEAD",
      cache: "no-store",
      signal,
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Displays a dismissible banner at the top of the screen when the user
 * goes offline.
 *
 * Uses a fetch-based connectivity check (more reliable than
 * `navigator.onLine`) plus browser events for real-time changes.
 *
 * Dismissal is persisted to localStorage so it survives re-renders
 * and won't be reset by connectivity checks or browser events.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(DISMISSED_KEY) === "true"
      : false
  );

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch { /* private mode */ }
    setDismissed(true);
  }, []);

  // Show again on a new session (next page load) when online
  const gotOnline = useCallback(() => {
    try { localStorage.removeItem(DISMISSED_KEY); } catch { /* private mode */ }
    setOffline(false);
    setDismissed(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. FAST PATH — navigator.onLine is instant. If it says offline,
    //    show the banner immediately. The reliable fetch below will
    //    correct false positives.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
    }

    // 2. RELIABLE PATH — fetch-based check corrects navigator.onLine
    //    false positives (localhost, browser extensions, etc.)
    async function verify() {
      const online = await checkReachable(AbortSignal.timeout(5000));
      if (!cancelled) {
        setOffline(!online);
        // If we're actually online, reset the dismissed flag for next time
        if (online) {
          try { localStorage.removeItem(DISMISSED_KEY); } catch { /* private mode */ }
          setDismissed(false);
        }
      }
    }
    verify();

    // 3. REALTIME PATH — browser events for future connectivity changes
    const goOffline = () => setOffline(true);
    window.addEventListener("online", gotOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", gotOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [gotOnline]);

  if (!offline || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999]",
        "bg-amber-50 dark:bg-amber-950/80",
        "border-b border-amber-200 dark:border-amber-800",
        "px-4 py-2.5 text-center text-sm font-medium",
        "text-amber-800 dark:text-amber-200",
        "animate-slide-down"
      )}
    >
      <span>🌐 أنت غير متصل بالإنترنت. المحتوى المخزّن مؤقتًا متاح.</span>
      <button
        onClick={dismiss}
        className="mr-3 inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}
