"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useCategories, useSources, useQuestions } from "@/lib/hooks/use-data";
import { categoryMeta } from "@/lib/content/ui-helpers";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { Shuffle, CheckCircle, ArrowLeft, BookOpen, Layers } from "lucide-react";

export function StudySetupView() {
  const { setView } = useViewStore();
  const { data: categories } = useCategories();
  const { data: sources } = useSources();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);

  // Count available questions for current selection (preview)
  const { data: preview } = useQuestions({
    categorySlug: selectedCategory,
    sourceSlug: selectedSources.length === 1 ? selectedSources[0] : undefined,
    limit: 200,
  });
  const availableCount = preview?.length ?? 0;

  const toggleSource = (slug: string) => {
    setSelectedSources((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const startStudy = () => {
    if (availableCount === 0) return;
    const ids = (preview ?? []).slice(0, Math.min(questionCount, availableCount)).map((q) => q.id);
    setView({
      kind: "study",
      categorySlug: selectedCategory,
      sourceSlugs: selectedSources,
      questionIds: ids,
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <CategoryCard
            active={!selectedCategory}
            onClick={() => setSelectedCategory(undefined)}
            nameAr="كل الفئات"
            icon="Layers"
            color="slate"
            count={categories?.reduce((s, c) => s + c.questionCount, 0) ?? 0}
          />
          {(categories ?? []).map((cat) => {
            const meta = categoryMeta(cat.slug);
            return (
              <CategoryCard
                key={cat.id}
                active={selectedCategory === cat.slug}
                onClick={() => setSelectedCategory(cat.slug)}
                nameAr={cat.nameAr}
                icon={meta.icon}
                color={meta.color}
                count={cat.questionCount}
              />
            );
          })}
        </div>
      </section>

      {/* Source selection */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">المصدر</h2>
          <span className="text-xs text-muted-foreground">(اتركه فارغًا لتضمين الكل)</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {(sources ?? []).map((src) => {
            const active = selectedSources.includes(src.slug);
            return (
              <button
                key={src.id}
                onClick={() => toggleSource(src.slug)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-right transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-md border-2 grid place-items-center shrink-0 mt-0.5",
                    active ? "bg-primary border-primary" : "border-muted-foreground/30"
                  )}
                >
                  {active && <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{src.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {src.date ?? "—"} · {toArabicDigits(src.questionCount)} سؤال
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {selectedSources.length > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            ملاحظة: التصفية تتيح مصدرًا واحدًا فقط حاليًا. سيتم استخدام كل المصادر.
          </p>
        )}
      </section>

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
              {toArabicDigits(Math.min(questionCount, availableCount))} سؤال
              {availableCount < questionCount && (
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
              availableCount === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            )}
          >
            <span>ابدأ المذاكرة</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30",  text: "text-emerald-700 dark:text-emerald-300",  ring: "ring-emerald-200 dark:ring-emerald-800" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",      text: "text-amber-700 dark:text-amber-300",      ring: "ring-amber-200 dark:ring-amber-800" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-950/30",        text: "text-rose-700 dark:text-rose-300",        ring: "ring-rose-200 dark:ring-rose-800" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-950/30",    text: "text-violet-700 dark:text-violet-300",    ring: "ring-violet-200 dark:ring-violet-800" },
  cyan:    { bg: "bg-cyan-50 dark:bg-cyan-950/30",        text: "text-cyan-700 dark:text-cyan-300",        ring: "ring-cyan-200 dark:ring-cyan-800" },
  slate:   { bg: "bg-slate-100 dark:bg-slate-800/40",     text: "text-slate-700 dark:text-slate-300",      ring: "ring-slate-200 dark:ring-slate-700" },
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shuffle: Shuffle,
  Layers: Layers,
  BookOpen: BookOpen,
};

function CategoryCard({
  active,
  onClick,
  nameAr,
  icon,
  color,
  count,
}: {
  active: boolean;
  onClick: () => void;
  nameAr: string;
  icon: string;
  color: string;
  count: number;
}) {
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;
  const Icon = ICONS[icon] ?? BookOpen;
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3.5 text-right transition-all",
        active
          ? `border-transparent ${c.bg} ring-1 ${c.ring}`
          : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("h-8 w-8 rounded-lg grid place-items-center", c.bg, c.text)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {toArabicDigits(count)}
        </span>
      </div>
      <div className="font-semibold text-sm mt-2">{nameAr}</div>
    </button>
  );
}
