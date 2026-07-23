"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toArabicDigits } from "@/lib/content/ui-helpers";

// ---------------------------------------------------------------------------
// Color theme classes for chips
// ---------------------------------------------------------------------------

const CHIP_COLORS: Record<
  string,
  { bg: string; text: string; border?: string }
> = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
  },
  slate: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
};

function chipColorClasses(color: string) {
  return CHIP_COLORS[color] ?? CHIP_COLORS.slate;
}

// Semi-transparent stat colors for the "stat" variant (works on dark gradients)
const STAT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500/20 text-emerald-100",
  rose: "bg-rose-500/20 text-rose-100",
  amber: "bg-amber-500/20 text-amber-100",
  violet: "bg-violet-500/20 text-violet-100",
  cyan: "bg-cyan-500/20 text-cyan-100",
  slate: "bg-slate-500/20 text-slate-100",
  primary: "bg-primary/20 text-primary-foreground",
};

// ---------------------------------------------------------------------------
// AnimatedChip
// ---------------------------------------------------------------------------

export interface AnimatedChipProps {
  /** Chip display variant — changes layout and default styling */
  variant?: "pill" | "stat" | "badge" | "button";
  /** Theme color name */
  color?: string;
  /** Size: sm (10px), md (12px/default), lg (14px) */
  size?: "sm" | "md" | "lg";
  /**
   * When this value changes, the chip pulses (scale 0 → 1.15 → 1).
   * Use a bucketed version of the underlying data to only pulse on
   * meaningful changes (e.g. Math.floor(accuracy / 5) * 5).
   */
  pulseKey?: string | number;
  /** Delay before the animation starts (for staggered entrance) */
  delay?: number;
  /** Optional icon element rendered before text */
  icon?: React.ReactNode;
  /** Primary text label */
  label?: string;
  /** Numeric value shown bold (pill variant only) */
  value?: number;
  /** Override children — takes precedence over label + value */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Click handler (renders as <button> when provided) */
  onClick?: () => void;
  /** Whether the chip is in an active/toggled state (button variant) */
  active?: boolean;
}

/**
 * A reusable chip component with:
 * - **Pulse animation** triggered via `pulseKey` (scale 0 → 1.15 → 1)
 * - **3 variants**: pill (inline stat), stat (icon+value), badge (small),
 *   button (toggle/filter chip)
 * - **6+ color themes** plus primary
 * - **3 sizes**: sm, md (default), lg
 * - Optional staggered `delay` for entrance animation
 *
 * Usage examples:
 * ```tsx
 * // Accuracy chip (pulses when accuracy crosses a 5% boundary)
 * <AnimatedChip
 *   pulseKey={`${Math.floor(accuracy / 5) * 5}`}
 *   color={accuracy >= 70 ? "emerald" : accuracy >= 40 ? "amber" : "rose"}
 *   label={`دقة ${toArabicDigits(accuracy)}٪`}
 *   size="sm"
 * />
 *
 * // Stat chip with icon + value
 * <AnimatedChip
 *   variant="stat"
 *   color="emerald"
 *   icon={<Check className="h-4 w-4" />}
 *   label="صحيحة"
 *   value={correct}
 * />
 *
 * // Toggle filter chip
 * <AnimatedChip
 *   variant="button"
 *   active={selected}
 *   onClick={() => setSelected(!selected)}
 *   label="تناظر لفظي"
 * />
 * ```
 */
export function AnimatedChip({
  variant = "pill",
  color = "slate",
  size = "md",
  pulseKey,
  delay = 0,
  icon,
  label,
  value,
  children,
  className,
  onClick,
  active,
}: AnimatedChipProps) {
  const colors = chipColorClasses(color);

  // ── Size classes ──────────────────────────────────────────────
  const sizeClasses = {
    sm: variant === "stat" ? "text-[10px] p-2" : "text-[10px] px-2 py-0.5",
    md:
      variant === "stat"
        ? "text-xs p-3"
        : variant === "badge"
        ? "text-[10px] px-1.5 py-0.5"
        : "text-xs px-2.5 py-1",
    lg:
      variant === "stat"
        ? "text-sm p-4"
        : "text-sm px-3 py-1.5",
  };

  // ── Variant classes ───────────────────────────────────────────
  const variantClasses =
    variant === "stat"
      ? cn("rounded-xl text-center", STAT_COLORS[color] ?? STAT_COLORS.slate)
      : variant === "badge"
      ? cn(
          "rounded-full font-semibold",
          active ? cn(colors.bg, colors.text) : "bg-muted text-muted-foreground",
          onClick && "cursor-pointer hover:opacity-80 transition-opacity"
        )
      : variant === "button"
      ? cn(
          "rounded-xl border-2 text-sm font-semibold transition-all text-center",
          active
            ? cn(colors.bg, colors.text, colors.border)
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )
      : // pill (default)
        cn(
          "rounded-full font-semibold inline-flex items-center gap-1",
          onClick
            ? // Clickable pill — filter-chip / toggle pattern
              active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            : // Static display pill — color-themed badge
              cn(colors.bg, colors.text)
        );

  // ── Animation props ───────────────────────────────────────────
  const shouldAnimate = pulseKey !== undefined;
  const motionProps = shouldAnimate
    ? {
        key: pulseKey,
        initial: { scale: 0 },
        animate: { scale: [0, 1.15, 1] },
        transition: { duration: 0.5, ease: "easeOut", delay },
      }
    : {};

  // ── Content ───────────────────────────────────────────────────
  const content = children ?? (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      {variant === "stat" ? (
        <>
          {(icon || label) && (
            <div className="flex items-center justify-center gap-1 mb-1 text-xs opacity-90">
              {icon && <span className="shrink-0">{icon}</span>}
              {label && <span>{label}</span>}
            </div>
          )}
          {value !== undefined && (
            <div className="text-2xl font-bold tabular-nums">
              {toArabicDigits(value)}
            </div>
          )}
        </>
      ) : (
        <>
          {icon && icon}
          {label && <span>{label}</span>}
          {value !== undefined && variant !== "stat" && (
            <span className="tabular-nums">{toArabicDigits(value)}</span>
          )}
        </>
      )}
    </>
  );

  const tagProps = {
    className: cn(sizeClasses[size], variantClasses, className),
    ...motionProps,
  };

  if (onClick) {
    return (
      <motion.button type="button" onClick={onClick} {...tagProps}>
        {content}
      </motion.button>
    );
  }

  return <motion.div {...tagProps}>{content}</motion.div>;
}
