"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useCategories, useSources, useQuestions } from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { Timer, BookOpen, Layers, ArrowLeft, Info } from "lucide-react";

const DURATIONS = [
  { value: 5,  label: "٥ دقائق",  questions: 10 },
  { value: 10, label: "١٠ دقائق", questions: 20 },
  { value: 20, label: "٢٠ دقيقة", questions: 30 },
  { value: 0,  label: "بلا وقت",   questions: 20 },
];

export function ExamSetupView() {
  const { setView } = useViewStore();
  const { data: categories } = useCategories();
  const { data: sources } = useSources();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSource, setSelectedSource] = useState<string | undefined>(undefined);
  const [durationIdx, setDurationIdx] = useState(1); // default 10 min

  const { data: preview } = useQuestions({
    categorySlug: selectedCategory,
    sourceSlug: selectedSource,
    limit: 200,
  });
  const available = preview?.length ?? 0;
  const duration = DURATIONS[durationIdx];
  const targetQuestions = Math.min(duration.questions, available);

  const startExam = () => {
    if (available === 0) return;
    const ids = (preview ?? [])
      .slice(0, targetQuestions)
      .map((q) => q.id);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <ChoiceCard
            active={!selectedCategory}
            onClick={() => setSelectedCategory(undefined)}
            title="كل الفئات"
            subtitle="مزيج من جميع الفئات"
          />
          {(categories ?? []).map((cat) => (
            <ChoiceCard
              key={cat.id}
              active={selectedCategory === cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              title={cat.nameAr}
              subtitle={`${toArabicDigits(cat.questionCount)} سؤال`}
              accent={categoryMeta(cat.slug).color}
            />
          ))}
        </div>
      </section>

      {/* Source */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">المصدر</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <ChoiceCard
            active={!selectedSource}
            onClick={() => setSelectedSource(undefined)}
            title="كل المصادر"
            subtitle="من جميع الملفات المُستوردة"
          />
          {(sources ?? []).map((src) => (
            <ChoiceCard
              key={src.id}
              active={selectedSource === src.slug}
              onClick={() => setSelectedSource(src.slug)}
              title={src.title}
              subtitle={`${src.date ?? "—"} · ${toArabicDigits(src.questionCount)} سؤال`}
            />
          ))}
        </div>
      </section>

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
              {toArabicDigits(targetQuestions)} سؤال
              {duration.value > 0 && (
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
              available === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            )}
          >
            <span>ابدأ الاختبار</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChoiceCard({
  active,
  onClick,
  title,
  subtitle,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  accent?: string;
}) {
  const accentBg: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200 dark:ring-emerald-800",
    amber:   "bg-amber-50 dark:bg-amber-950/30 ring-amber-200 dark:ring-amber-800",
    rose:    "bg-rose-50 dark:bg-rose-950/30 ring-rose-200 dark:ring-rose-800",
    violet:  "bg-violet-50 dark:bg-violet-950/30 ring-violet-200 dark:ring-violet-800",
    cyan:    "bg-cyan-50 dark:bg-cyan-950/30 ring-cyan-200 dark:ring-cyan-800",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-3.5 text-right transition-all",
        active
          ? accent
            ? `border-transparent ring-1 ${accentBg[accent] ?? accentBg.emerald}`
            : "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}
