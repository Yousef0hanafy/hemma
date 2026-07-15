"use client";

import { BookOpen } from "lucide-react";
import type { PassageInfo } from "@/lib/content/dto";

/**
 * Renders a reading passage (استيعاب المقروء) with proper Arabic typography.
 * Shows the passage title (if any) and body, styled for comfortable reading.
 */
export function PassageView({ passage }: { passage: PassageInfo }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.03] to-primary/[0.06] dark:from-primary/[0.06] dark:to-primary/[0.03] p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary/10">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">
          ق
        </span>
        <span className="text-xs font-semibold text-primary/70">
          النص
        </span>
        {passage.titleAr && (
          <>
            <span className="text-primary/20">·</span>
            <span className="text-xs font-semibold text-foreground">
              {passage.titleAr}
            </span>
          </>
        )}
      </div>

      {/* Body */}
      <div className="passage-text text-foreground/90 whitespace-pre-line leading-[2.2]">
        {passage.bodyAr}
      </div>

      {/* Footer label */}
      <div className="mt-4 pt-3 border-t border-primary/10 text-[10px] text-primary/40 flex items-center gap-1.5">
        <BookOpen className="h-3 w-3" />
        <span>اقرأ النص ثم أجب عن الأسئلة</span>
      </div>
    </div>
  );
}
