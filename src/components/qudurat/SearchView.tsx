"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useQuestions, useCategories, useSources } from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, DIFFICULTY_META } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import { Search as SearchIcon, X, Filter, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyStateCard } from "./shared/EmptyStates";
import { AnimatedChip } from "./shared/AnimatedChip";
import type { SuggestionAction } from "./shared/EmptyStates";

export function SearchView() {
  const { setView } = useViewStore();
  const { data: categories } = useCategories();
  const { data: sources } = useSources();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [difficultyFilter, setDifficultyFilter] = useState<string | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results, loading } = useQuestions({
    search: debouncedQuery || undefined,
    categorySlug: categoryFilter,
    sourceSlug: sourceFilter,
    difficulty: difficultyFilter,
    limit: 200,
  });

  const activeFiltersCount =
    (categoryFilter ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (difficultyFilter ? 1 : 0);

  const clearAll = () => {
    setQuery("");
    setCategoryFilter(undefined);
    setSourceFilter(undefined);
    setDifficultyFilter(undefined);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-32 lg:pb-12">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">بحث وتصفّح</h1>
        <p className="text-muted-foreground text-sm">
          ابحث عبر جميع الأسئلة بالكلمات المفتاحية، أو صفِّ بالفئة والمصدر والصعوبة.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في نص السؤال…"
          className="pr-10 pl-10 h-12 text-base rounded-xl"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
            showFilters || activeFiltersCount > 0
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover:bg-muted"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>تصفية</span>
          {activeFiltersCount > 0 && (
            <span className="bg-white/20 rounded-full px-1.5 tabular-nums">
              {toArabicDigits(activeFiltersCount)}
            </span>
          )}
        </button>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            مسح الكل
          </button>
        )}
        <div className="mr-auto text-xs text-muted-foreground tabular-nums">
          {toArabicDigits(results?.length ?? 0)} نتيجة
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-2xl bg-card border border-border p-4 space-y-3"
        >
          {/* Category */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">الفئة</div>
            <div className="flex flex-wrap gap-1.5">
              <AnimatedChip
                variant="pill"
                active={!categoryFilter}
                onClick={() => setCategoryFilter(undefined)}
                label="الكل"
              />
              {(categories ?? []).map((c) => (
                <AnimatedChip
                  key={c.id}
                  variant="pill"
                  active={categoryFilter === c.slug}
                  onClick={() => setCategoryFilter(c.slug)}
                  label={c.nameAr}
                />
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">المصدر</div>
            <div className="flex flex-wrap gap-1.5">
              <AnimatedChip
                variant="pill"
                active={!sourceFilter}
                onClick={() => setSourceFilter(undefined)}
                label="الكل"
              />
              {(sources ?? []).map((s) => (
                <AnimatedChip
                  key={s.id}
                  variant="pill"
                  active={sourceFilter === s.slug}
                  onClick={() => setSourceFilter(s.slug)}
                  label={s.title.length > 30 ? s.title.slice(0, 30) + "…" : s.title}
                />
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">الصعوبة</div>
            <div className="flex flex-wrap gap-1.5">
              <AnimatedChip
                variant="pill"
                active={!difficultyFilter}
                onClick={() => setDifficultyFilter(undefined)}
                label="الكل"
              />
              {Object.entries(DIFFICULTY_META).map(([key, meta]) => (
                <AnimatedChip
                  key={key}
                  variant="pill"
                  active={difficultyFilter === key}
                  onClick={() => setDifficultyFilter(key)}
                  label={meta.labelAr}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري البحث…</div>
      ) : !results || results.length === 0 ? (
        <EmptyStateCard
          illustration={debouncedQuery ? "search" : "filter"}
          title={debouncedQuery ? "لا توجد نتائج للبحث" : "لا توجد نتائج للتصفية المحددة"}
          description={
            debouncedQuery
              ? "لم نعثر على أسئلة تطابق كلمات البحث التي أدخلتها. جرّب كلمات مفتاحية مختلفة أو استخدم مصطلحات أوسع."
              : "لم يتم العثور على أسئلة تطابق الفلتر الذي اخترته. جرّب توسيع نطاق التصفية أو اختيار فئة أخرى."
          }
          suggestions={[
            {
              label: debouncedQuery ? "مسح البحث" : "مسح التصفية",
              onClick: () => {
                setQuery("");
                setCategoryFilter(undefined);
                setSourceFilter(undefined);
                setDifficultyFilter(undefined);
              },
              variant: "primary",
            },
            {
              label: "تصفّح كل الأسئلة",
              onClick: () => {
                setQuery("");
                setCategoryFilter(undefined);
                setSourceFilter(undefined);
                setDifficultyFilter(undefined);
                setShowFilters(true);
              },
              variant: "secondary",
            },
          ]}
        />
      ) : (
        <div className="space-y-2">
          {results.map((q, i) => {
            const meta = categoryMeta(q.categorySlug);
            const cat = categories?.find((c) => c.slug === q.categorySlug);
            const src = sources?.find((s) => s.id === q.sourceId);
            return (
              <motion.button
                key={q.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                onClick={() => setView({ kind: "study", questionIds: [q.id] })}
                className="w-full text-right rounded-xl bg-card border border-border p-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", meta.bg, meta.text)}>
                    {cat?.nameAr ?? q.categoryNameAr}
                  </span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", DIFFICULTY_META[q.difficulty].className)}>
                    {DIFFICULTY_META[q.difficulty].labelAr}
                  </span>
                  {src && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {src.title.length > 25 ? src.title.slice(0, 25) + "…" : src.title}
                    </span>
                  )}
                </div>
                <p className="font-naskh text-sm leading-relaxed line-clamp-2 mb-2">{q.stem}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>الإجابة: {q.correctKey}</span>
                  <span className="flex items-center gap-0.5">
                    <span>اعرض السؤال</span>
                    <ArrowLeft className="h-3 w-3" />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

