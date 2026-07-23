"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  /** The target number to animate to */
  value: number;
  /** Optional: format function. Defaults to toArabicDigits */
  format?: (n: number) => string;
  /** Additional class names for the span */
  className?: string;
  /** Animation duration in seconds (applied to spring stiffness) */
  duration?: number;
}

/**
 * Smoothly animates between numeric values using framer-motion spring physics.
 * Displays the animated value formatted with Arabic digits.
 *
 * Usage:
 * ```tsx
 * <AnimatedNumber value={profile.totalXp} />
 * ```
 */
export function AnimatedNumber({
  value,
  format = toArabicDigits,
  className,
  duration = 0.5,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: 80 / duration,
    damping: 18,
  });
  const rounded = useTransform(spring, (v) => Math.round(v));
  const displayValue = useTransform(rounded, (v) => format(v));

  // Animate to new value whenever it changes
  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return (
    <motion.span className={cn("tabular-nums", className)}>
      {displayValue}
    </motion.span>
  );
}
