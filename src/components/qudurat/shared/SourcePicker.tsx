"use client";

import { CheckCircle } from "lucide-react";
import { useSources } from "@/lib/hooks/use-data";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";

type Variant = "multi" | "single";

interface MultiSelectProps {
  variant: "multi";
  selected: string[];
  onChange: (slugs: string[]) => void;
}

interface SingleSelectProps {
  variant: "single";
  selected: string | undefined;
  onChange: (slug: string | undefined) => void;
}

type SourcePickerProps = MultiSelectProps | SingleSelectProps;

/**
 * Shared source selector used by both StudySetupView (multi-select with checkboxes)
 * and ExamSetupView (single-select with choice cards).
 * Fetches sources automatically via useSources().
 */
export function SourcePicker(props: SourcePickerProps) {
  const { data: sources } = useSources();

  if (props.variant === "multi") {
    const { selected, onChange } = props;
    const toggleSource = (slug: string) => {
      onChange(
        selected.includes(slug)
          ? selected.filter((s) => s !== slug)
          : [...selected, slug]
      );
    };

    return (
      <div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {(sources ?? []).map((src) => {
            const active = selected.includes(src.slug);
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
        {selected.length > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            ملاحظة: التصفية تتيح مصدرًا واحدًا فقط حاليًا. سيتم استخدام كل المصادر.
          </p>
        )}
      </div>
    );
  }

  // Single-select variant (exam)
  const { selected, onChange } = props;
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      {/* "All sources" option */}
      <SimpleSourceCard
        active={!selected}
        onClick={() => onChange(undefined)}
        title="كل المصادر"
        subtitle="من جميع الملفات المُستوردة"
      />
      {(sources ?? []).map((src) => (
        <SimpleSourceCard
          key={src.id}
          active={selected === src.slug}
          onClick={() => onChange(src.slug)}
          title={src.title}
          subtitle={`${src.date ?? "—"} · ${toArabicDigits(src.questionCount)} سؤال`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SimpleSourceCard({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-3.5 text-right transition-all",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}
