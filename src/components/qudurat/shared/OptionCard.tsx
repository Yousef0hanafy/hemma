"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArabicLetter } from "@/lib/content/dto";

export interface OptionCardProps {
  opt: { key: ArabicLetter; text: string };
  selected: boolean;
  /** Whether this option is the correct answer (shown green after submit). */
  correct?: boolean;
  /** Whether this option was the user's wrong pick (shown red after submit). */
  wrong?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * A single-option button used in StudyPlayerView (with correct/wrong feedback)
 * and ExamRunnerView (selection only — correct/wrong are always false).
 *
 * States:
 * - correct  → green border + bg, checkmark icon
 * - wrong    → red border + bg, X icon
 * - selected → primary border + bg (before submit)
 * - default  → neutral border, letter key icon
 */
export function OptionCard({
  opt,
  selected,
  correct = false,
  wrong = false,
  disabled = false,
  onClick,
}: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-right transition-all",
        correct
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
          : wrong
          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
          : selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/50",
        !disabled && "cursor-pointer active:scale-[0.99]"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 shrink-0 rounded-lg grid place-items-center font-bold text-sm transition-colors",
          correct
            ? "bg-emerald-500 text-white"
            : wrong
            ? "bg-rose-500 text-white"
            : selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {correct ? <Check className="h-5 w-5" /> : wrong ? <X className="h-5 w-5" /> : opt.key}
      </div>
      <span className="font-naskh text-base leading-relaxed flex-1">{opt.text}</span>
    </button>
  );
}
