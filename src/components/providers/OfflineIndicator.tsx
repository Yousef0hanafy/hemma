"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Displays a dismissible banner at the top of the screen when the user
 * goes offline. Informs them that cached content is still available.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setDismissed(false);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

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
        onClick={() => setDismissed(true)}
        className="mr-3 inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}
