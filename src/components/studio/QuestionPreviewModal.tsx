"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { OptionCard } from "@/components/qudurat/shared/OptionCard";
import { PassageView } from "@/components/qudurat/shared/PassageView";
import { FeedbackPanel } from "@/components/qudurat/shared/FeedbackPanel";
import { categoryMeta, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import type { ArabicLetter } from "@/lib/content/dto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewQuestion {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string | null;
  studyTip: string | null;
  difficulty: string;
  type: string;
  category: { slug: string; nameAr: string; icon: string | null };
  source: { title: string };
  passage: { id: string; titleAr: string | null; bodyAr: string } | null;
}

interface Props {
  question: PreviewQuestion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestionPreviewModal({ question, open, onOpenChange }: Props) {
  const [mode, setMode] = useState<"study" | "exam">("study");
  const [selectedKey, setSelectedKey] = useState<ArabicLetter | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confidence, setConfidence] = useState(0);

  // Reset state when modal opens or question changes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedKey(null);
        setSubmitted(false);
        setConfidence(0);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  const handleSelect = useCallback(
    (key: ArabicLetter) => {
      if (mode === "study") {
        if (!submitted) {
          setSelectedKey(key);
          setSubmitted(true);
        }
      } else {
        // Exam mode: just select, no submit
        setSelectedKey((prev) => (prev === key ? null : key));
      }
    },
    [mode, submitted]
  );

  const handleRetry = useCallback(() => {
    setSelectedKey(null);
    setSubmitted(false);
  }, []);

  const meta = categoryMeta(question.category.slug);
  const diffMeta = DIFFICULTY_META[question.difficulty] ?? {
    labelAr: question.difficulty,
    className: "bg-slate-100 text-slate-700",
  };

  const isCorrect = selectedKey === question.correctKey;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">معاينة السؤال</DialogTitle>

            {/* Mode switcher */}
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as "study" | "exam");
                setSelectedKey(null);
                setSubmitted(false);
              }}
              className="shrink-0"
            >
              <TabsList className="h-8">
                <TabsTrigger value="study" className="text-xs px-3 py-1">
                  دراسة
                </TabsTrigger>
                <TabsTrigger value="exam" className="text-xs px-3 py-1">
                  اختبار
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Mode description */}
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "study"
              ? "اختر إجابة لترى النتيجة والشرح — كما في وضع المذاكرة"
              : "اختر إجابة بدون تغذية راجعة — كما في وضع الاختبار"}
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Category + difficulty + source badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                meta.bg,
                meta.text
              )}
            >
              {question.category.nameAr}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
                diffMeta.className
              )}
            >
              {diffMeta.labelAr}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {question.source.title}
            </span>
          </div>

          {/* Passage */}
          {question.passage && (
            <PassageView
              passage={{
                id: question.passage.id,
                titleAr: question.passage.titleAr,
                bodyAr: question.passage.bodyAr,
              }}
            />
          )}

          {/* Stem */}
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
            <p className="question-stem text-foreground leading-loose">
              {question.stem}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {question.options.map((opt) => (
              <OptionCard
                key={opt.key}
                opt={{
                  key: opt.key as ArabicLetter,
                  text: opt.text,
                }}
                selected={selectedKey === opt.key}
                correct={submitted && opt.key === question.correctKey}
                wrong={
                  submitted &&
                  selectedKey === opt.key &&
                  opt.key !== question.correctKey
                }
                disabled={submitted && mode === "study"}
                onClick={() => handleSelect(opt.key as ArabicLetter)}
              />
            ))}
          </div>

          {/* Feedback panel (study mode only) */}
          <AnimatePresence>
            {submitted && mode === "study" && (
              <motion.div
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                className="overflow-hidden"
              >
                <FeedbackPanel
                  isCorrect={isCorrect}
                  correctKey={question.correctKey}
                  explanation={question.explanation}
                  studyTip={question.studyTip}
                  confidence={confidence}
                  setConfidence={setConfidence}
                />

                {/* Retry button */}
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Exam mode indicator (empty state when no selection) */}
          {mode === "exam" && !submitted && (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">
                {selectedKey
                  ? `تم اختيار ${selectedKey}`
                  : "اختر إجابة من الخيارات أعلاه"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
