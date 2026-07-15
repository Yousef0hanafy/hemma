"use client";

import { Check, X, Lightbulb, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArabicLetter } from "@/lib/content/dto";

export interface FeedbackPanelProps {
  isCorrect: boolean;
  correctKey: ArabicLetter;
  explanation: string | null;
  studyTip: string | null;
  confidence: number;
  setConfidence: (n: number) => void;
}

/**
 * Post-submission feedback for study mode.
 * Shows verdict (correct/wrong), explanation, study tip, and a
 * confidence-rating widget for metacognitive tracking.
 */
export function FeedbackPanel({
  isCorrect,
  correctKey,
  explanation,
  studyTip,
  confidence,
  setConfidence,
}: FeedbackPanelProps) {
  return (
    <div className="space-y-3">
      {/* Verdict */}
      <div
        className={cn(
          "rounded-2xl p-4 border-2",
          isCorrect
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {isCorrect ? (
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <X className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          )}
          <h3 className="font-bold text-sm">
            {isCorrect ? "إجابة صحيحة!" : `الإجابة الصحيحة: ${correctKey}`}
          </h3>
        </div>
        {explanation && (
          <p className="font-naskh text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {explanation}
          </p>
        )}
      </div>

      {/* Study tip */}
      {studyTip && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
            <Lightbulb className="h-4 w-4" />
            <span className="font-semibold text-xs">نصيحة للدراسة</span>
          </div>
          <p className="font-naskh text-sm leading-relaxed text-foreground/90">{studyTip}</p>
        </div>
      )}

      {/* Confidence rating (metacognition) */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-xs text-muted-foreground mb-2">
          كيف تقيّم ثقتك بهذا السؤال؟ (يساعد على تحسين توصية الأسئلة)
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setConfidence(n)}
              className={cn(
                "p-1 rounded transition-colors",
                confidence >= n
                  ? "text-amber-500"
                  : "text-muted-foreground/30 hover:text-muted-foreground"
              )}
            >
              <Star className="h-6 w-6" fill={confidence >= n ? "currentColor" : "none"} />
            </button>
          ))}
          <span className="text-xs text-muted-foreground mr-2">
            {confidence === 0
              ? "لم أقيّم"
              : confidence === 1
              ? "لست متأكدًا"
              : confidence === 2
              ? "متأكد نسبيًا"
              : "متأكد جدًا"}
          </span>
        </div>
      </div>
    </div>
  );
}
