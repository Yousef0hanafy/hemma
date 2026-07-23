"use client";

import { motion } from "framer-motion";

/**
 * Reusable loading skeleton with subtle shimmer animation.
 * Used while server data is being fetched.
 */
export function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="rounded-full border-2 border-muted border-t-primary"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
      {label && (
        <p className="text-xs text-muted-foreground">{label}</p>
      )}
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  );
}

/**
 * Skeleton card with shimmer effect — for content placeholders.
 */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-card border border-border p-4 ${className}`}
      role="status"
      aria-label="جارٍ التحميل"
    >
      <div className="space-y-3">
        <div className="h-4 w-1/3 rounded-md bg-muted animate-pulse" />
        <div className="h-3 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Full-view loading state with branded spinner.
 */
export function FullScreenLoader({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="absolute inset-0 blur-xl opacity-40 bg-primary/30 rounded-full" />
        <motion.div
          className="relative h-12 w-12 rounded-full border-[3px] border-muted border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
    </div>
  );
}
