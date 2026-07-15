"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestions, useRecentAttempts } from "@/lib/hooks/use-data";
import { toArabicDigits, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { pickAdaptiveOrder } from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import { EmptyStateCard } from "./shared/EmptyStates";
import { Shuffle, ArrowLeft, BookOpen, Layers, FileText, Gauge } from "lucide-react";
import { CategoryPicker } from "./shared/CategoryPicker";
import { SourcePicker } from "./shared/SourcePicker";
import { DifficultyChip, TypeChip } from "./shared/FilterChips";

export function StudySetupView() {
  const { setView } = useViewStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState<"all" | "with_passage" | "without_passage">("all");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [questionCount, setQuestionCount] = useState(10);

  // Derive filters
  const hasPassage =
    questionType === "all" ? undefined : questionType === "with_passage";
  const difficultyFilter = difficulty === "all" ? undefined : difficulty;

  // Count available questions for current selection (preview)
  const { data: preview, loading: previewLoading } = useQuestions({
    categorySlug: selectedCategory,
    sourceSlug: selectedSources.length === 1 ? selectedSources[0] : undefined,
    hasPassage,
    difficulty: difficultyFilter,
    limit: 200,
  });
  const availableCount = preview?.length ?? 0;
  const isLoading = previewLoading && availableCount === 0;

  // Adaptive ordering data
  const { data: recentAttempts } = useRecentAttempts(50);
  const recentIds = new Set(recentAttempts?.slice(0, 20).map((a) => a.questionId) ?? []);
  const accuracyById = new Map<string, number>();
  if (recentAttempts) {
    const stats = new Map<string, { correct: number; total: number }>();
    for (const a of recentAttempts) {
      const s = stats.get(a.questionId) ?? { correct: 0, total: 0 };
      s.total++;
      if (a.isCorrect) s.correct++;
      stats.set(a.questionId, s);
    }
    for (const [id, s] of stats) {
      accuracyById.set(id, s.total > 0 ? s.correct / s.total : 0);
    }
  }

  const startStudy = () => {
    if (availableCount === 0) return;
    const reordered = pickAdaptiveOrder(preview ?? [], {
      recentIds,
      accuracyById,
      getId: (q) => q.id,
      seed: Date.now(),
    });
    const ids = reordered.slice(0, Math.min(questionCount, availableCount)).map((q) => q.id);
    setView({
      kind: "study",
      categorySlug: selectedCategory,
      sourceSlugs: selectedSources,
      questionIds: ids,
      purpose: "study",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">إعداد جلسة المذاكرة</h1>
        <p className="text-muted-foreground text-sm">
          اختر الفئة والمصدر وعدد الأسئلة. ستحصل على تفسير فوري بعد كل إجابة.
        </p>
      </div>

      {/* Category selection */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">الفئة</h2>
        </div>
        <CategoryPicker
          selected={selectedCategory}
          onChange={setSelectedCategory}
          variant="rich"
        />
      </section>

      {/* Difficulty */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">مستوى الصعوبة</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <DifficultyChip
            active={difficulty === "all"}
            onClick={() => setDifficulty("all")}
            label="الكل"
          />
          {(["easy", "medium", "hard"] as const).map((d) => (
            <DifficultyChip
              key={d}
              active={difficulty === d}
              onClick={() => setDifficulty(d)}
              label={DIFFICULTY_META[d].labelAr}
              color={d === "easy" ? "emerald" : d === "medium" ? "amber" : "rose"}
            />
          ))}
        </div>
      </section>

      {/* Question type */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">نوع الأسئلة</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <TypeChip
            active={questionType === "all"}
            onClick={() => setQuestionType("all")}
            label="الكل"
          />
          <TypeChip
            active={questionType === "with_passage"}
            onClick={() => setQuestionType("with_passage")}
            label="استيعاب مقروء"
            subtitle="مع نصوص"
          />
          <TypeChip
            active={questionType === "without_passage"}
            onClick={() => setQuestionType("without_passage")}
            label="بدون نصوص"
            subtitle="أسئلة مباشرة"
          />
        </div>
      </section>

      {/* Source selection */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">المصدر</h2>
          <span className="text-xs text-muted-foreground">(اتركه فارغًا لتضمين الكل)</span>
        </div>
        <SourcePicker
          variant="multi"
          selected={selectedSources}
          onChange={setSelectedSources}
        />
      </section>

      {/* Empty state when filters yield no results */}
      {!isLoading && availableCount === 0 && (
        <EmptyStateCard
          illustration="filter"
          title="لا توجد أسئلة مطابقة"
          description="لم يتم العثور على أسئلة تطابق مجموعة الفلاتر التي اخترتها. جرّب توسيع نطاق التحديد أو اختيار خيارات مختلفة."
          suggestions={[
            {
              label: "مسح الكل",
              onClick: () => {
                setSelectedCategory(undefined);
                setSelectedSources([]);
                setQuestionType("all");
                setDifficulty("all");
              },
              variant: "primary",
            },
          ]}
          compact
        />
      )}

      {/* Question count */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Shuffle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">عدد الأسئلة</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20, 30].map((n) => (
            <button
              key={n}
              onClick={() => setQuestionCount(n)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors tabular-nums",
                questionCount === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              )}
            >
              {toArabicDigits(n)}
            </button>
          ))}
        </div>
      </section>

      {/* Summary + start */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="sticky bottom-20 lg:bottom-4 z-20"
      >
        <div className="rounded-2xl bg-card border border-border shadow-lg p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">سيتم تحضير</div>
            <div className="font-bold tabular-nums">
              {isLoading ? (
                <span className="text-muted-foreground">جاري التحميل…</span>
              ) : (
                <>{toArabicDigits(Math.min(questionCount, availableCount))} سؤال</>
              )}
              {!isLoading && availableCount < questionCount && (
                <span className="text-xs text-muted-foreground font-normal">
                  {" "}(من {toArabicDigits(availableCount)} متاح)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={startStudy}
            disabled={availableCount === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
              availableCount === 0 && !isLoading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : isLoading
                ? "bg-muted text-muted-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            )}
          >
            <span>{isLoading ? "جارٍ التحميل…" : "ابدأ المذاكرة"}</span>
            {!isLoading && <ArrowLeft className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}


