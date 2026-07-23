"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registers the PWA service worker on the client side.
 * Shows a toast when a new version is available.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;

        // Listen for a new version being installed
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New version is waiting — notify the user
              toast.info("تم تحديث التطبيق. أعد تحميل الصفحة لأحدث إصدار.", {
                duration: 8000,
                action: {
                  label: "تحديث",
                  onClick: () => window.location.reload(),
                },
              });
            }
          });
        });
      })
      .catch(() => {
        // Silently ignore — SW not supported or HTTPS required
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
