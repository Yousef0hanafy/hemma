"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, CopyCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bulkApplyField,
  previewBulkApplyCount,
} from "@/server/actions/studio-questions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkApplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current question's field values to pre-fill */
  currentValues: {
    explanation: string | null;
    studyTip: string | null;
    difficulty: string;
    status: string;
  };
  /** Available categories and sources for filters */
  meta: {
    categories: { slug: string; nameAr: string; count: number }[];
    sources: { slug: string; title: string; count: number }[];
  } | null;
  /** The current question ID to exclude from results */
  currentQuestionId: string;
  /** Callback when bulk apply completes */
  onApplied: () => void;
}

const BULKABLE_FIELDS = [
  { value: "explanation", label: "الشرح", type: "textarea" as const },
  { value: "studyTip", label: "ملاحظة دراسية", type: "textarea" as const },
  { value: "difficulty", label: "الصعوبة", type: "select" as const },
  { value: "status", label: "الحالة", type: "select" as const },
  { value: "citation", label: "المصدر (الاقتباس)", type: "text" as const },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkApplyModal({
  open,
  onOpenChange,
  currentValues,
  meta,
  currentQuestionId,
  onApplied,
}: BulkApplyModalProps) {
  const [field, setField] = useState("explanation");
  const [value, setValue] = useState(currentValues.explanation ?? "");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setField("explanation");
      setValue(currentValues.explanation ?? "");
      setCategoryFilter("");
      setSourceFilter("");
      setDifficultyFilter("");
      setStatusFilter("");
      setPreviewCount(null);
    }
  }, [open, currentValues]);

  // Update value when field changes
  const handleFieldChange = useCallback(
    (newField: string) => {
      setField(newField);
      const key = newField as keyof typeof currentValues;
      const v = currentValues[key];
      setValue(typeof v === "string" ? v : v ?? "");
    },
    [currentValues]
  );

  // Fetch preview count when filters change
  useEffect(() => {
    if (!open) return;

    const fetchCount = async () => {
      setLoadingPreview(true);
      try {
        const result = await previewBulkApplyCount({
          categorySlug: categoryFilter || undefined,
          sourceSlug: sourceFilter || undefined,
          difficulty: difficultyFilter || undefined,
          status: statusFilter || undefined,
          excludeQuestionId: currentQuestionId,
        });
        setPreviewCount(result.count);
      } catch {
        setPreviewCount(null);
      } finally {
        setLoadingPreview(false);
      }
    };

    const timeout = setTimeout(fetchCount, 300);
    return () => clearTimeout(timeout);
  }, [open, categoryFilter, sourceFilter, difficultyFilter, statusFilter, currentQuestionId]);

  const handleApply = useCallback(async () => {
    if (applying) return;
    setApplying(true);

    try {
      const result = await bulkApplyField(field, value, {
        categorySlug: categoryFilter || undefined,
        sourceSlug: sourceFilter || undefined,
        difficulty: difficultyFilter || undefined,
        status: statusFilter || undefined,
        excludeQuestionId: currentQuestionId,
      });

      toast.success(`تم تطبيق القيمة على ${result.updated} سؤال`);
      onApplied();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }, [applying, field, value, categoryFilter, sourceFilter, difficultyFilter, statusFilter, currentQuestionId, onApplied, onOpenChange]);

  const fieldConfig = BULKABLE_FIELDS.find((f) => f.value === field);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyCheck className="h-5 w-5 text-primary" />
            تطبيق جماعي
          </DialogTitle>
          <DialogDescription>
            طبق القيمة الحالية على أسئلة متعددة باستخدام التصفية
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Field selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">الحقل المراد تطبيقه</Label>
            <Select value={field} onValueChange={handleFieldChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BULKABLE_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value editor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">القيمة</Label>
            {fieldConfig?.type === "textarea" ? (
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-h-[80px] text-sm"
                dir="rtl"
                placeholder="اكتب القيمة هنا..."
              />
            ) : fieldConfig?.type === "select" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field === "difficulty" ? (
                    <>
                      <SelectItem value="easy">سهل</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="hard">صعب</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="review">قيد المراجعة</SelectItem>
                      <SelectItem value="approved">معتمد</SelectItem>
                      <SelectItem value="published">منشور</SelectItem>
                      <SelectItem value="archived">مؤرشف</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 text-sm"
                dir="rtl"
                placeholder="اكتب القيمة..."
              />
            )}
          </div>

          <Separator />

          {/* Filters */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              تصفية الأسئلة المستهدفة
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">التصنيف</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {(meta?.categories ?? []).map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.nameAr} ({c.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">المصدر</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {(meta?.sources ?? []).map((s) => (
                      <SelectItem key={s.slug} value={s.slug}>
                        {s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">الصعوبة</Label>
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    <SelectItem value="easy">سهل</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="hard">صعب</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">الحالة</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="review">مراجعة</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="published">منشور</SelectItem>
                    <SelectItem value="archived">مؤرشف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Preview count */}
          <div
            className={cn(
              "rounded-lg p-3 text-sm flex items-center gap-2",
              previewCount !== null && previewCount > 0
                ? "bg-primary/5 border border-primary/20"
                : "bg-muted/50 border border-border/50"
            )}
          >
            {loadingPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">جاري حساب العدد...</span>
              </>
            ) : previewCount !== null && previewCount > 0 ? (
              <>
                <CopyCheck className="h-4 w-4 text-primary" />
                <span>
                  سيتم تطبيق القيمة على{" "}
                  <strong>{previewCount}</strong> سؤال
                  {previewCount !== 1 ? " (باستثناء السؤال الحالي)" : ""}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {previewCount === 0
                    ? "لا توجد أسئلة تطابق التصفية المحددة"
                    : "اختر تصفية لمعرفة عدد الأسئلة"}
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleApply}
            disabled={
              applying ||
              !value.trim() ||
              (previewCount !== null && previewCount === 0)
            }
            className="gap-1"
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التطبيق...
              </>
            ) : (
              <>
                <CopyCheck className="h-4 w-4" />
                تطبيق على {previewCount ?? 0} سؤال
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
