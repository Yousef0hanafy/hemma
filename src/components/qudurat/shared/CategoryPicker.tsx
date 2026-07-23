"use client";

import { BookOpen, Layers, Shuffle } from "lucide-react";
import { useCategories } from "@/lib/hooks/use-data";
import { categoryMeta, toArabicDigits, getColorPalette, getChoiceAccentColor } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";

type Variant = "rich" | "simple";

interface CategoryPickerProps {
  selected: string | undefined;
  onChange: (slug: string | undefined) => void;
  /** 
   * - "rich" — icon + color badge + question count (used in StudySetupView)
   * - "simple" — title + subtitle + optional accent ring (used in ExamSetupView)
   * @default "simple"
   */
  variant?: Variant;
}

/**
 * Shared category selector used by both StudySetupView and ExamSetupView.
 * Fetches categories automatically via useCategories().
 */
export function CategoryPicker({ selected, onChange, variant = "simple" }: CategoryPickerProps) {
  const { data: categories } = useCategories();

  const totalCount = categories?.reduce((s, c) => s + c.questionCount, 0) ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {/* "All categories" option */}
      {variant === "rich" ? (
        <RichCard
          active={!selected}
          onClick={() => onChange(undefined)}
          nameAr="كل الفئات"
          icon="Layers"
          color="slate"
          count={totalCount}
        />
      ) : (
        <SimpleCard
          active={!selected}
          onClick={() => onChange(undefined)}
          title="كل الفئات"
          subtitle="مزيج من جميع الفئات"
        />
      )}

      {/* Individual categories */}
      {(categories ?? []).map((cat) => {
        const meta = categoryMeta(cat.slug);
        if (variant === "rich") {
          return (
            <RichCard
              key={cat.id}
              active={selected === cat.slug}
              onClick={() => onChange(cat.slug)}
              nameAr={cat.nameAr}
              icon={meta.icon}
              color={meta.color}
              count={cat.questionCount}
            />
          );
        }
        return (
          <SimpleCard
            key={cat.id}
            active={selected === cat.slug}
            onClick={() => onChange(cat.slug)}
            title={cat.nameAr}
            subtitle={`${toArabicDigits(cat.questionCount)} سؤال`}
            accent={meta.color}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shuffle,
  Layers,
  BookOpen,
};

function RichCard({
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
  const c = getColorPalette(color);
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

function SimpleCard({
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
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-3.5 text-right transition-all",
        active
          ? accent
            ? `border-transparent ring-1 ${getChoiceAccentColor(accent)}`
            : "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}
