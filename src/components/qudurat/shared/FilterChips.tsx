"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DifficultyChip — color-coded chip for easy/medium/hard filters
// Accepts optional color prop (emerald, amber, rose) for themed styling.
// ---------------------------------------------------------------------------

export function DifficultyChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  const activeStyle = color
    ? color === "emerald"
      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
      : color === "amber"
      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
      : "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
    : "border-primary bg-primary/5 text-primary";
  const inactiveStyle = color
    ? color === "emerald"
      ? "border-emerald-200 dark:border-emerald-900 bg-card text-muted-foreground hover:border-emerald-400 hover:text-foreground"
      : color === "amber"
      ? "border-amber-200 dark:border-amber-900 bg-card text-muted-foreground hover:border-amber-400 hover:text-foreground"
      : "border-rose-200 dark:border-rose-900 bg-card text-muted-foreground hover:border-rose-400 hover:text-foreground"
    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all text-center",
        active ? activeStyle : inactiveStyle
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TypeChip — chip for question type filters (passage / no passage / all)
// Supports an optional subtitle for extra description.
// ---------------------------------------------------------------------------

export function TypeChip({
  active,
  onClick,
  label,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  subtitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all text-right",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      <div>{label}</div>
      {subtitle && (
        <div className="text-[10px] opacity-60 font-normal mt-0.5">{subtitle}</div>
      )}
    </button>
  );
}
