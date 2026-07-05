"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import {
  useMistakeQuestionIds,
  useFavoriteIds,
  useQuestionsByIds,
  useQuestions,
  useCategories,
} from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Bookmark,
  Layers,
  ArrowLeft,
  ChevronLeft,
  Sprout,
  Heart,
  Zap,
} from "lucide-react";

type Tab = "mistakes" | "favorites" | "flashcards";

export function RevisionView({ initialTab }: { initialTab: Tab }) {
  const { setView } = useViewStore();
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">المراجعة الذكية</h1>
        <p className="text-muted-foreground text-sm">
          حديقة الأخطاء تنمو معك — كل خطأ يتحوّل إلى فرصة للتعلّم.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-muted p-1 max-w-md">
        <TabButton
          active={tab === "mistakes"}
          onClick={() => setTab("mistakes")}
          icon={<Sprout className="h-3.5 w-3.5" />}
          label="الأخطاء"
        />
        <TabButton
          active={tab === "favorites"}
          onClick={() => setTab("favorites")}
          icon={<Bookmark className="h-3.5 w-3.5" />}
          label="المفضلة"
        />
        <TabButton
          active={tab === "flashcards"}
          onClick={() => setTab("flashcards")}
          icon={<Layers className="h-3.5 w-3.5" />}
          label="بطاقات"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "mistakes" && <MistakesList />}
          {tab === "favorites" && <FavoritesList />}
          {tab === "flashcards" && <FlashcardPlayer />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function MistakesList() {
  const { setView } = useViewStore();
  const { data: mistakeIds, loading } = useMistakeQuestionIds(100);
  const { data: questions } = useQuestionsByIds(mistakeIds ?? []);
  const { data: categories } = useCategories();

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>;
  }

  if (!questions || questions.length === 0) {
    return (
      <EmptyState
        icon={<Sprout className="h-12 w-12" />}
        title="حديقة أخطائك فارغة!"
        subtitle="لم تخطئ في أي سؤال بعد. ابدأ المذاكرة وستنمو هنا بذور تحتاج عناية."
        actionLabel="ابدأ المذاكرة"
        onAction={() => setView({ kind: "study_setup" })}
      />
    );
  }

  // Group by category
  const byCat = new Map<string, typeof questions>();
  for (const q of questions) {
    if (!byCat.has(q.categorySlug)) byCat.set(q.categorySlug, []);
    byCat.get(q.categorySlug)!.push(q);
  }

  // Start a revision session with these questions
  const startRevisionSession = () => {
    setView({
      kind: "study",
      questionIds: questions.slice(0, 15).map((q) => q.id),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-bl from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/20 border border-rose-200 dark:border-rose-900 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold mb-0.5">حديقة الأخطاء</div>
          <div className="text-xs text-muted-foreground">
            لديك {toArabicDigits(questions.length)} سؤال يحتاج مراجعة. كل بذرة تنمو مع التكرار.
          </div>
        </div>
        <button
          onClick={startRevisionSession}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>راجع الآن</span>
        </button>
      </div>

      {Array.from(byCat.entries()).map(([slug, qs]) => {
        const meta = categoryMeta(slug);
        const cat = categories?.find((c) => c.slug === slug);
        return (
          <div key={slug} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", `bg-${meta.color}-500`)} style={{ backgroundColor: meta.color === "emerald" ? "#10b981" : meta.color === "amber" ? "#f59e0b" : meta.color === "rose" ? "#f43f5e" : meta.color === "violet" ? "#8b5cf6" : meta.color === "cyan" ? "#06b6d4" : "#64748b" }} />
              <span className="text-sm font-semibold">{cat?.nameAr ?? qs[0]?.categoryNameAr}</span>
              <span className="text-xs text-muted-foreground">({toArabicDigits(qs.length)})</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {qs.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setView({ kind: "study", questionIds: [q.id] })}
                  className="rounded-xl bg-card border border-border p-3 text-right hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("h-7 w-7 rounded-md grid place-items-center shrink-0 text-xs", meta.bg, meta.text)}>
                      <Sprout className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-naskh text-xs leading-relaxed line-clamp-2 flex-1">
                      {q.stem}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FavoritesList() {
  const { setView } = useViewStore();
  const { data: favIds, loading } = useFavoriteIds();
  const { data: questions } = useQuestionsByIds(favIds ?? []);
  const { data: categories } = useCategories();

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>;
  }

  if (!questions || questions.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-12 w-12" />}
        title="لا توجد أسئلة في المفضلة"
        subtitle="أضف الأسئلة المهمة إلى المفضلة أثناء المذاكرة للرجوع إليها بسهولة."
        actionLabel="ابدأ المذاكرة"
        onAction={() => setView({ kind: "study_setup" })}
      />
    );
  }

  return (
    <div className="space-y-2">
      {questions.map((q) => {
        const meta = categoryMeta(q.categorySlug);
        const cat = categories?.find((c) => c.slug === q.categorySlug);
        return (
          <button
            key={q.id}
            onClick={() => setView({ kind: "study", questionIds: [q.id] })}
            className="w-full rounded-xl bg-card border border-border p-3.5 text-right hover:border-primary/40 hover:shadow-sm transition-all flex items-start gap-3"
          >
            <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", meta.bg, meta.text)}>
              <Bookmark className="h-4 w-4" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">{cat?.nameAr ?? q.categoryNameAr}</div>
              <p className="font-naskh text-sm leading-relaxed line-clamp-2">{q.stem}</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FlashcardPlayer() {
  const { data: categories } = useCategories();
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);
  const { data: allQuestions } = useQuestions({ limit: 200 });

  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const flashcards = useMemo(() => {
    if (!allQuestions) return [];
    if (selectedCat) return allQuestions.filter((q) => q.categorySlug === selectedCat);
    return allQuestions;
  }, [allQuestions, selectedCat]);

  const current = flashcards[cardIndex];

  const next = () => {
    setFlipped(false);
    setTimeout(() => {
      setCardIndex((i) => (i + 1) % Math.max(flashcards.length, 1));
    }, 150);
  };

  if (!allQuestions || allQuestions.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={!selectedCat}
          onClick={() => { setSelectedCat(undefined); setCardIndex(0); setFlipped(false); }}
          label="الكل"
        />
        {(categories ?? []).map((c) => (
          <FilterChip
            key={c.id}
            active={selectedCat === c.slug}
            onClick={() => { setSelectedCat(c.slug); setCardIndex(0); setFlipped(false); }}
            label={c.nameAr}
          />
        ))}
      </div>

      {flashcards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد بطاقات في هذه الفئة.</div>
      ) : (
        <>
          {/* Card */}
          <div className="perspective-1000">
            <motion.button
              onClick={() => setFlipped(!flipped)}
              className="w-full h-72 relative preserve-3d"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front — question */}
              <div
                className="absolute inset-0 rounded-3xl bg-card border-2 border-border p-6 flex flex-col items-center justify-center backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="absolute top-4 right-4 text-xs text-muted-foreground">
                  {toArabicDigits(cardIndex + 1)} / {toArabicDigits(flashcards.length)}
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-3">
                    {current?.categoryNameAr}
                  </div>
                  <p className="font-naskh text-xl leading-loose">
                    {current?.stem}
                  </p>
                </div>
                <div className="absolute bottom-4 text-[10px] text-muted-foreground">
                  اضغط للقلب ←
                </div>
              </div>

              {/* Back — answer */}
              <div
                className="absolute inset-0 rounded-3xl bg-primary text-primary-foreground p-6 flex flex-col items-center justify-center backface-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="text-center">
                  <div className="text-xs opacity-80 mb-2">الإجابة الصحيحة</div>
                  <div className="text-4xl font-bold mb-3">
                    {current?.correctKey}
                  </div>
                  {current && (
                    <p className="font-naskh text-sm leading-relaxed opacity-90 max-w-md">
                      {current.options.find((o) => o.key === current.correctKey)?.text}
                    </p>
                  )}
                  {current?.explanation && (
                    <p className="font-naskh text-xs leading-relaxed opacity-75 mt-3 max-w-md line-clamp-3">
                      {current.explanation.split("\n")[0]}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setFlipped(false); setCardIndex((i) => (i - 1 + flashcards.length) % flashcards.length); }}
              className="p-3 rounded-full bg-card border border-border hover:bg-muted"
              aria-label="السابق"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setFlipped(!flipped)}
              className="rounded-full bg-card border border-border px-6 py-2 text-xs font-semibold hover:bg-muted"
            >
              {flipped ? "إخفاء" : "اقلب"}
            </button>
            <button
              onClick={next}
              className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="التالي"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex h-20 w-20 rounded-3xl bg-muted items-center justify-center text-muted-foreground mb-4">
        {icon}
      </div>
      <h3 className="font-display text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{subtitle}</p>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/90"
      >
        {actionLabel}
        <ArrowLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
