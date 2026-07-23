"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestions, useRecentAttempts } from "@/lib/hooks/use-data";
import { toArabicDigits, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { pickAdaptiveOrder } from "@/lib/engine/gamification";
import { cn } from "@/lib/utils";
import { EmptyStateCard } from "./shared/EmptyStates";
import { Timer, BookOpen, Layers, ArrowLeft, Info, FileText, Gauge } from "lucide-react";
import { CategoryPicker } from "./shared/CategoryPicker";
import { SourcePicker } from "./shared/SourcePicker";
import { DifficultyChip, TypeChip } from "./shared/FilterChips";

const DURATIONS = [
  { value: 5,  label: "٥ دقائق",  questions: 10 },
  { value: 10, label: "١٠ دقائق", questions: 20 },
  { value: 20, label: "٢٠ دقيقة", questions: 30 },
  { value: 0,  label: "بلا وقت",   questions: 20 },
];

export function ExamSetupView() {
  const { setView } = useViewStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSource, setSelectedSource] = useState<string | undefined>(undefined);
  const [questionType, setQuestionType] = useState<"all" | "with_passage" | "without_passage">("all");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [durationIdx, setDurationIdx] = useState(1); // default 10 min

  const hasPassage =
    questionType === "all" ? undefined : questionType === "with_passage";
  const difficultyFilter = difficulty === "all" ? undefined : difficulty;

  const { data: preview, loading: previewLoading } = useQuestions({
    categorySlug: selectedCategory,
    sourceSlug: selectedSource,
    hasPassage,
    difficulty: difficultyFilter,
    limit: 200,
  });
  const available = preview?.length ?? 0;
  const isLoading = previewLoading && available === 0;

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

  const duration = DURATIONS[durationIdx];
  const targetQuestions = Math.min(duration.questions, available);

  const startExam = () => {
    if (available === 0) return;
    const reordered = pickAdaptiveOrder(preview ?? [], {
      recentIds,
      accuracyById,
      getId: (q) => q.id,
      seed: Date.now(),
    });
    const ids = reordered.slice(0, targetQuestions).map((q) => q.id);
    const sessionId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setView({
      kind: "exam_running",
      sessionId,
      questionIds: ids,
      durationSec: duration.value * 60,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">إعداد الاختبار</h1>
        <p className="text-muted-foreground text-sm">
          محاكاة لظروف الاختبار الحقيقية. لن تظهر الإجابات إلا عند الانتهاء.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-900 dark:text-emerald-100">
          <p className="font-semibold mb-1">قواعد الاختبار</p>
          <ul className="text-xs space-y-0.5 list-disc list-inside opacity-90">
            <li>الوقت يبدأ فور الضغط على «ابدأ الاختبار».</li>
            <li>يمكنك التنقل بين الأسئلة وتعديل إجاباتك قبل التسليم.</li>
            <li>تظهر النتيجة والتفسيرات بعد التسليم فقط.</li>
            <li>كل إجابة صحيحة تمنحك نقاط خبرة إضافية.</li>
          </ul>
        </div>
      </div>

      {/* Category */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">الفئة</h2>
        </div>
        <CategoryPicker
          selected={selectedCategory}
          onChange={setSelectedCategory}
          variant="simple"
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

      {/* Source */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">المصدر</h2>
        </div>
        <SourcePicker
          variant="single"
          selected={selectedSource}
          onChange={setSelectedSource}
        />
      </section>

      {/* Empty state when filters yield no results */}
      {!isLoading && available === 0 && (
        <EmptyStateCard
          illustration="filter"
          title="لا توجد أسئلة مطابقة"
          description="لم يتم العثور على أسئلة تطابق مجموعة الفلاتر التي اخترتها. جرّب توسيع نطاق التحديد أو اختيار خيارات مختلفة."
          suggestions={[
            {
              label: "مسح الكل",
              onClick: () => {
                setSelectedCategory(undefined);
                setSelectedSource(undefined);
                setQuestionType("all");
                setDifficulty("all");
              },
              variant: "primary",
            },
          ]}
          compact
        />
      )}

      {/* Duration */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">المدة والعدد</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DURATIONS.map((d, i) => (
            <button
              key={d.value}
              onClick={() => setDurationIdx(i)}
              className={cn(
                "rounded-xl border-2 p-4 text-center transition-all",
                durationIdx === i
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
            >
              <Timer className={cn("h-5 w-5 mx-auto mb-1", durationIdx === i ? "text-primary" : "text-muted-foreground")} />
              <div className="font-bold text-sm">{d.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {toArabicDigits(Math.min(d.questions, available))} سؤال
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Start bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="sticky bottom-20 lg:bottom-4 z-20"
      >
        <div className="rounded-2xl bg-card border border-border shadow-lg p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">سيبدأ الاختبار بـ</div>
            <div className="font-bold">
              {isLoading ? (
                <span className="text-muted-foreground">جاري التحميل…</span>
              ) : (
                <>{toArabicDigits(targetQuestions)} سؤال</>
              )}
              {!isLoading && duration.value > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}· {toArabicDigits(duration.value)} دقيقة
                </span>
              )}
            </div>
          </div>
          <button
            onClick={startExam}
            disabled={available === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
              available === 0 && !isLoading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : isLoading
                ? "bg-muted text-muted-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            )}
          >
            <span>{isLoading ? "جارٍ التحميل…" : "ابدأ الاختبار"}</span>
            {!isLoading && <ArrowLeft className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}


