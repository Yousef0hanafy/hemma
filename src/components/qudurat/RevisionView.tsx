"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import {
  useMistakeQuestionIds,
  useFavoriteIds,
  useQuestionsByIds,
  useQuestions,
  useCategories,
  useDueReviewIds,
  useDueReviewCount,
  useSubmitSrsReview,
  useTodayReviewCount,
} from "@/lib/hooks/use-data";
import type { SrsQuality } from "@/lib/engine/srs";
import { categoryMeta, toArabicDigits, getColorHex } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Bookmark,
  Layers,
  ChevronLeft,
  Sprout,
  Heart,
  Brain,
  Play,
  Target,
} from "lucide-react";
import { EmptyStateCard } from "./shared/EmptyStates";
import { AnimatedChip } from "./shared/AnimatedChip";
import { FullScreenLoader } from "./LoadingStates";

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

      {/* Daily Review Goal */}
      <DailyReviewGoal />

      {/* SRS Due Review Banner */}
      <DueReviewBanner />

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

function DueReviewBanner() {
  const { setView } = useViewStore();
  const { data: dueCount } = useDueReviewCount();
  const { data: dueIds } = useDueReviewIds(100);

  if (!dueCount || dueCount === 0) return null;

  const startReview = () => {
    if (!dueIds || dueIds.length === 0) return;
    setView({
      kind: "study",
      questionIds: dueIds.slice(0, 50),
      purpose: "review",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 dark:from-violet-700 dark:to-indigo-800 p-5 text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center shrink-0">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold mb-0.5">
              مراجعة التكرار المتباعد
            </div>
            <div className="text-sm text-white/80">
              لديك{" "}
              <span className="font-bold text-white tabular-nums">
                {toArabicDigits(dueCount)}
              </span>{" "}
              بطاقة مستحقة للمراجعة الآن
            </div>
          </div>
        </div>
        <button
          onClick={startReview}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white text-violet-700 px-5 py-2.5 text-sm font-bold hover:bg-white/90 active:scale-95 transition-all shadow-sm"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>ابدأ المراجعة</span>
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function DailyReviewGoal() {
  const { data: todayCount } = useTodayReviewCount();

  if (todayCount === null) return null; // still loading

  const DAILY_GOAL = 10;
  const count = todayCount ?? 0;
  const percent = Math.min(100, Math.round((count / DAILY_GOAL) * 100));
  const complete = count >= DAILY_GOAL;

  const progressColor = complete
    ? "bg-emerald-500"
    : percent >= 70
    ? "bg-violet-500"
    : percent >= 30
    ? "bg-amber-500"
    : "bg-violet-400";

  const message = complete
    ? "أكملت هدف اليوم! 🎉"
    : `${toArabicDigits(DAILY_GOAL - count)} مراجعات متبقية`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-border p-3"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">هدف المراجعة اليومي</span>
        </div>
        <span className="text-xs tabular-nums font-bold">
          {toArabicDigits(count)} / {toArabicDigits(DAILY_GOAL)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${progressColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground mt-1.5">
        {message}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function MistakesList() {
  const { setView } = useViewStore();
  const { data: mistakeIds, loading } = useMistakeQuestionIds(100);
  const { data: questions } = useQuestionsByIds(mistakeIds ?? []);
  const { data: categories } = useCategories();

  if (loading) {
    return <FullScreenLoader label="جارٍ تحميل الأخطاء…" />;
  }

  if (!questions || questions.length === 0) {
    return (
      <EmptyStateCard
        illustration="mistakes"
        title="حديقة أخطائك فارغة! 🌱"
        description="لم تخطئ في أي سؤال بعد — وهذا رائع! ابدأ المذاكرة وستنمو هنا البذور التي تحتاج عناية. الأخطاء هي فرصتك الحقيقية للتعلّم."
        suggestions={[
          {
            label: "ابدأ المذاكرة",
            onClick: () => setView({ kind: "study_setup" }),
            variant: "primary",
          },
          {
            label: "اختبر نفسك",
            onClick: () => setView({ kind: "exam_setup" }),
            variant: "secondary",
          },
        ]}
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
      purpose: "review",
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
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getColorHex(meta.color).stroke }} />
              <span className="text-sm font-semibold">{cat?.nameAr ?? qs[0]?.categoryNameAr}</span>
              <span className="text-xs text-muted-foreground">({toArabicDigits(qs.length)})</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {qs.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setView({ kind: "study", questionIds: [q.id], purpose: "review" })}
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
    return <FullScreenLoader label="جارٍ تحميل المفضلة…" />;
  }

  if (!questions || questions.length === 0) {
    return (
      <EmptyStateCard
        illustration="favorites"
        title="لا توجد أسئلة في المفضلة"
        description="أضف الأسئلة المُهمّة إلى المفضلة أثناء المذاكرة بالضغط على علامة النجمة 🌟. المفضلة تساعدك على العودة للأسئلة البارزة بسرعة."
        suggestions={[
          {
            label: "ابدأ المذاكرة",
            onClick: () => setView({ kind: "study_setup" }),
            variant: "primary",
          },
        ]}
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
            onClick={() => setView({ kind: "study", questionIds: [q.id], purpose: "review" })}
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
  const { data: mistakeIds, loading: mistakesLoading } = useMistakeQuestionIds(100);
  const { data: dueIds, loading: dueLoading } = useDueReviewIds(100);
  const { data: allQuestions, loading: questionsLoading } = useQuestions({ limit: 200 });
  const submitReview = useSubmitSrsReview();
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(false);

  // Build the card queue: first due reviews, then mistakes that aren't yet scheduled
  const flashcards = useMemo(() => {
    if (!allQuestions) return [];

    const dueSet = new Set(dueIds ?? []);
    const mistakeSet = new Set(mistakeIds ?? []);
    const seen = new Set<string>();
    const queue: typeof allQuestions = [];

    // 1. Due reviews first
    for (const id of dueIds ?? []) {
      const q = allQuestions.find((q) => q.id === id);
      if (q && !seen.has(q.id)) {
        if (!selectedCat || q.categorySlug === selectedCat) {
          queue.push(q);
          seen.add(q.id);
        }
      }
    }

    // 2. Mistakes not yet scheduled
    for (const id of mistakeIds ?? []) {
      if (dueSet.has(id)) continue; // already in queue
      const q = allQuestions.find((q) => q.id === id);
      if (q && !seen.has(q.id)) {
        if (!selectedCat || q.categorySlug === selectedCat) {
          queue.push(q);
          seen.add(q.id);
        }
      }
    }

    // 3. All other questions (up to a reasonable limit)
    if (queue.length < 30) {
      for (const q of allQuestions) {
        if (seen.has(q.id)) continue;
        if (!selectedCat || q.categorySlug === selectedCat) {
          queue.push(q);
          seen.add(q.id);
          if (queue.length >= 50) break;
        }
      }
    }

    return queue;
  }, [allQuestions, dueIds, mistakeIds, selectedCat]);

  const current = flashcards[cardIndex];
  const isDue = dueIds?.includes(current?.id ?? "") ?? false;

  // Keyboard shortcut: Space/Enter to flip card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped]);

  const handleRate = async (quality: SrsQuality) => {
    if (!current || rated) return;
    setRated(true);
    try {
      await submitReview(current.id, quality);
      // Auto-advance after a brief moment
      setTimeout(() => {
        nextCard();
      }, 400);
    } catch (e) {
      console.error(e);
      setRated(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    setRated(false);
    setTimeout(() => {
      setCardIndex((i) => (i + 1) % Math.max(flashcards.length, 1));
    }, 150);
  };

  if (!allQuestions || allQuestions.length === 0) {
    return <FullScreenLoader label="جارٍ تحضير البطاقات…" />;
  }

  // Show loader while any data source is still loading
  // (prevents briefly flashing the "لا توجد بطاقات" empty state when
  // allQuestions loaded but dueIds/mistakeIds haven't arrived yet)
  if (questionsLoading || mistakesLoading || dueLoading) {
    return <FullScreenLoader label="جارٍ تحضير البطاقات…" />;
  }

  const dueCount = dueIds?.length ?? 0;
  const totalCards = flashcards.length;

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <AnimatedChip
          variant="pill"
          active={!selectedCat}
          onClick={() => { setSelectedCat(undefined); setCardIndex(0); setFlipped(false); setRated(false); }}
          label="الكل"
        />
        {(categories ?? []).map((c) => (
          <AnimatedChip
            key={c.id}
            variant="pill"
            active={selectedCat === c.slug}
            onClick={() => { setSelectedCat(c.slug); setCardIndex(0); setFlipped(false); setRated(false); }}
            label={c.nameAr}
          />
        ))}
      </div>

      {/* Due count badge */}
      {dueCount > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="font-semibold text-violet-700 dark:text-violet-300">
              {toArabicDigits(dueCount)} بطاقة للمراجعة
            </span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {toArabicDigits(cardIndex + 1)} / {toArabicDigits(totalCards)}
          </span>
        </div>
      )}

      {flashcards.length === 0 ? (
        <EmptyStateCard
          illustration="flashcards"
          title="لا توجد بطاقات للمراجعة"
          description="ابدأ المذاكرة أو الاختبارات لتظهر هنا البطاقات المستحقة للمراجعة بناءً على نظام التكرار المتباعد (SM-2). كل بطاقة تظهر في وقتها المثالي لتثبيت المعلومة."
          suggestions={[
            {
              label: "ابدأ المذاكرة",
              onClick: () => setView({ kind: "study_setup" }),
              variant: "primary",
            },
            {
              label: "اختبر نفسك",
              onClick: () => setView({ kind: "exam_setup" }),
              variant: "secondary",
            },
          ]}
        />
      ) : !current ? null : (
        <>
          {/* Card */}
          <div className="perspective-1000">
            <motion.button
              onClick={() => !flipped && setFlipped(true)}
              className="w-full h-80 relative preserve-3d cursor-pointer"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Front — question */}
              <div className="absolute inset-0 rounded-3xl bg-card border-2 border-border p-6 flex flex-col items-center justify-center backface-hidden">
                <div className="absolute top-4 left-4 text-xs text-muted-foreground">
                  {isDue ? (
                    <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
                      <Brain className="h-3 w-3" />
                      <span>مراجعة</span>
                    </span>
                  ) : null}
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-3">
                    {current.categoryNameAr}
                  </div>
                  <p className="font-naskh text-xl leading-loose">
                    {current.stem}
                  </p>
                </div>
                <div className="absolute bottom-4 text-[10px] text-muted-foreground">
                  اضغط للقلب ←
                </div>
              </div>

              {/* Back — answer */}
              <div
                className="absolute inset-0 rounded-3xl bg-primary text-primary-foreground p-6 flex flex-col items-center justify-center backface-hidden"
                style={{ transform: "rotateY(180deg)" }}
              >
                <div className="text-center">
                  <div className="text-xs opacity-80 mb-2">الإجابة الصحيحة</div>
                  <div className="text-4xl font-bold mb-3">
                    {current.correctKey}
                  </div>
                  <p className="font-naskh text-sm leading-relaxed opacity-90 max-w-md">
                    {current.options.find((o) => o.key === current.correctKey)?.text}
                  </p>
                  {current.explanation && (
                    <p className="font-naskh text-xs leading-relaxed opacity-75 mt-3 max-w-md line-clamp-3">
                      {current.explanation.split("\n")[0]}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          </div>

          {/* Rating buttons — shown after flip */}
          {flipped && !rated && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap justify-center gap-2"
            >
              <RatingButton
                label="مرة أخرى"
                sublabel="نسيت"
                quality={1}
                color="rose"
                onClick={() => handleRate(1)}
              />
              <RatingButton
                label="صعب"
                sublabel="بصعوبة تذكرت"
                quality={2}
                color="amber"
                onClick={() => handleRate(2)}
              />
              <RatingButton
                label="جيد"
                sublabel="تذكرت بعد جهد"
                quality={3}
                color="emerald"
                onClick={() => handleRate(3)}
              />
              <RatingButton
                label="سهل"
                sublabel="تذكرت فورًا"
                quality={5}
                color="primary"
                onClick={() => handleRate(5)}
              />
            </motion.div>
          )}

          {/* Rated confirmation */}
          {rated && (
            <div className="text-center text-sm text-muted-foreground">
              جارٍ الانتقال إلى البطاقة التالية…
            </div>
          )}

          {/* Navigation controls (when not flipped or after rating) */}
          {(!flipped || rated) && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { setFlipped(false); setRated(false); setCardIndex((i) => (i - 1 + flashcards.length) % flashcards.length); }}
                className="p-3 rounded-full bg-card border border-border hover:bg-muted"
                aria-label="السابق"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextCard}
                className="rounded-full bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90"
              >
                تخطي
              </button>
              <button
                onClick={nextCard}
                className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="التالي"
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const RATING_COLORS: Record<string, string> = {
  rose: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50",
  amber: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50",
  emerald: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
  primary: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
};

function RatingButton({
  label,
  sublabel,
  quality,
  color,
  onClick,
}: {
  label: string;
  sublabel: string;
  quality: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${RATING_COLORS[color] ?? RATING_COLORS.primary}`}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-70">{sublabel}</span>
    </button>
  );
}


