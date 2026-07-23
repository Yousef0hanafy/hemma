"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Premium splash/loading screen shown on initial app load.
 * - Displays the official logo with a smooth fade-in + subtle scale
 * - Animated progress bar with gradient sweep
 * - Prevents layout shifts (fixed full-screen overlay)
 * - Auto-dismisses after the app signals readiness OR a max timeout
 *
 * The splash uses CSS-only animations where possible (no JS layout work)
 * to keep the loading experience smooth on low-end devices.
 */
export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Minimum display time for branding (1.4s) — feels intentional, not slow
    // Max timeout (2.5s) ensures it never hangs the user
    const MIN_DISPLAY = 1400;
    const MAX_TIMEOUT = 2500;

    const start = Date.now();

    const dismiss = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_DISPLAY - elapsed);
      setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, remaining);
    };

    // Dismiss when window is fully loaded, or after max timeout
    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }
    const fallback = setTimeout(dismiss, MAX_TIMEOUT);

    return () => {
      window.removeEventListener("load", dismiss);
      clearTimeout(fallback);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] grid place-items-center bg-gradient-to-bl from-emerald-50 via-amber-50 to-emerald-50 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950"
          role="status"
          aria-live="polite"
          aria-label="جارٍ تحميل منصة همّة التعليمية"
        >
          {/* Decorative pattern */}
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 30%, currentColor 1px, transparent 1px), radial-gradient(circle at 75% 70%, currentColor 1px, transparent 1px)",
              backgroundSize: "44px 44px, 60px 60px",
              color: "oklch(0.42 0.11 155)",
            }}
          />

          {/* Center content */}
          <div className="relative flex flex-col items-center gap-6 px-6">
            {/* Logo with entrance animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
              className="relative"
            >
              {/* Soft glow behind logo */}
              <div
                className="absolute inset-0 blur-2xl opacity-30 dark:opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.55 0.13 155) 0%, transparent 70%)",
                }}
              />
              <img
                src="/logo-splash.png"
                alt="شعار منصة همّة التعليمية"
                width={140}
                height={140}
                className="relative h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-sm"
                draggable={false}
              />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-center"
            >
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                منصة همّة التعليمية
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-medium">
                التحضير المتميّز لاختبار القدرات اللفظية
              </p>
            </motion.div>

            {/* Animated progress indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="relative h-1 w-40 sm:w-48 rounded-full bg-foreground/10 overflow-hidden"
            >
              <motion.div
                className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-emerald-500 to-amber-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 1.4,
                  ease: "easeInOut",
                  delay: 0.3,
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
