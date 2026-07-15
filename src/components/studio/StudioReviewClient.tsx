"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Send,
  Sparkles,
  ChevronLeft,
  ArrowLeft,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toArabicDigits, DIFFICULTY_META, relativeTimeAr } from "@/lib/content/ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getReviewQueue,
  getReviewQuestion,
  submitReviewAction,
  getReviewStats,
} from "@/server/actions/studio-review";
import type {
  ReviewQueueEntry,
  ReviewQuestionDetail,
  ReviewStats,
} from "@/server/actions/studio-review";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  archived: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "مراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};

// ---------------------------------------------------------------------------
// Reject reasons
// ---------------------------------------------------------------------------

const REJECT_REASONS = [
  { value: "wrong_answer", label: "الإجابة الصحيحة خاطئة" },
  { value: "unclear_wording", label: "صياغة السؤال غير واضحة" },
  { value: "bad_options", label: "الخيارات غير مناسبة" },
  { value: "weak_explanation", label: "الشرح غير كافٍ" },
  { value: "duplicate", label: "محتوى مكرر" },
  { value: "other", label: "أخرى" },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "بانتظار المراجعة" },
  { key: "flagged", label: "ملاحظات AI" },
  { key: "approved", label: "معتمد" },
  { key: "rejected", label: "مرفوض" },
];

// ---------------------------------------------------------------------------
// Review Mode — Full Question Display
// ---------------------------------------------------------------------------

function ReviewMode({
  question,
  currentIndex,
  total,
  onApprove,
  onReject,
  onApprovePublish,
  onBack,
  submitting,
}: {
  question: ReviewQuestionDetail;
  currentIndex: number;
  total: number;
  onApprove: () => void;
  onReject: () => void;
  onApprovePublish: () => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const correctOption = question.options.find(
    (o) => o.key === question.correctKey
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 ml-1" />
          العودة للقائمة
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {toArabicDigits(currentIndex + 1)} / {toArabicDigits(total)}
        </span>
      </div>

      {/* Question card */}
      <Card>
        <CardContent className="pt-6">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-muted-foreground">
              {question.categoryNameAr}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                DIFFICULTY_CLASSES[question.difficulty]
              )}
            >
              {DIFFICULTY_LABELS[question.difficulty]}
            </span>
            <span className="text-xs text-muted-foreground">
              {question.sourceTitle}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                STATUS_CLASSES[question.status]
              )}
            >
              {STATUS_LABELS[question.status]}
            </span>
          </div>

          {/* Stem */}
          <p className="font-naskh text-lg leading-relaxed mb-6">
            {question.stem}
          </p>

          {/* Options */}
          <div className="space-y-2 mb-6">
            {question.options.map((opt) => {
              const isCorrect = opt.key === question.correctKey;
              return (
                <div
                  key={opt.key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors",
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900"
                      : "border-border bg-card"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shrink-0",
                      isCorrect
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {opt.key}
                  </span>
                  <span>{opt.text}</span>
                  {isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-auto" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div className="rounded-xl bg-muted/30 border border-border p-4 mb-4">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                الشرح
              </div>
              <p className="text-sm leading-relaxed">{question.explanation}</p>
            </div>
          )}

          {/* AI Review */}
          {question.aiQualityScore !== null && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                  تقييم AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {Math.round(question.aiQualityScore * 100)}%
                </span>
                <div className="flex-1 h-2 rounded-full bg-violet-200 dark:bg-violet-900">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      question.aiQualityScore >= 0.7
                        ? "bg-emerald-500"
                        : question.aiQualityScore >= 0.4
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${question.aiQualityScore * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {question.aiQualityScore >= 0.7
                    ? "جودة عالية"
                    : question.aiQualityScore >= 0.4
                    ? "متوسطة"
                    : "منخفضة"}
                </span>
              </div>
            </div>
          )}

          {/* Previous reviews */}
          {question.previousReviews.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                سجل المراجعات
              </div>
              <div className="space-y-2">
                {question.previousReviews.map((rev, i) => (
                  <div
                    key={i}
                    className="text-xs flex items-start gap-2 text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "shrink-0 mt-0.5",
                        rev.action === "approved" || rev.action === "approved_published"
                          ? "text-emerald-500"
                          : "text-rose-500"
                      )}
                    >
                      {rev.action === "approved" || rev.action === "approved_published"
                        ? "✓"
                        : "✗"}
                    </span>
                    <span>
                      {rev.reviewerName ?? "مجهول"} —{" "}
                      {rev.action === "approved"
                        ? "اعتماد"
                        : rev.action === "approved_published"
                        ? "نشر"
                        : "طلب تعديل"}
                      {rev.notes && `: ${rev.notes}`}
                    </span>
                    <span className="mr-auto">
                      {relativeTimeAr(rev.createdAt.toISOString())}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Study tip */}
          {question.studyTip && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                نصيحة دراسية
              </div>
              <p className="text-sm text-muted-foreground">{question.studyTip}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons — keyboard shortcuts shown */}
      <div className="flex items-center justify-center gap-3 p-4 bg-card border border-border rounded-xl">
        <button
          onClick={onReject}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 px-5 py-3 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ThumbsDown className="h-4 w-4" />
          <span>رفض</span>
          <kbd className="mr-2 rounded border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 text-[10px]">
            1
          </kbd>
        </button>
        <button
          onClick={onApprove}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-5 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ThumbsUp className="h-4 w-4" />
          <span>اعتماد</span>
          <kbd className="mr-2 rounded border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 text-[10px]">
            2
          </kbd>
        </button>
        <Button onClick={onApprovePublish} disabled={submitting} className="h-11 px-5">
          <Send className="h-4 w-4 ml-1" />
          <span>اعتماد ونشر</span>
          <kbd className="mr-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
            3
          </kbd>
        </Button>
      </div>

      {/* Navigation hint */}
      <div className="text-center text-[10px] text-muted-foreground">
        ←  السابق · التالي →
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reject Dialog
// ---------------------------------------------------------------------------

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => void;
}) {
  const [reason, setReason] = useState("unclear_wording");
  const [customNotes, setCustomNotes] = useState("");

  const handleConfirm = () => {
    const reasonLabel =
      REJECT_REASONS.find((r) => r.value === reason)?.label ?? reason;
    const notes = reason === "other" ? customNotes : `${reasonLabel}${customNotes ? `: ${customNotes}` : ""}`;
    onConfirm(notes);
    onOpenChange(false);
    setCustomNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رفض السؤال</DialogTitle>
          <DialogDescription>
            اختر سبب الرفض وسيتم إعلام منشئ المحتوى
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {REJECT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                "w-full text-right rounded-lg border p-3 text-sm transition-colors",
                reason === r.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              )}
            >
              {r.label}
            </button>
          ))}
          {reason === "other" && (
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="اشرح سبب الرفض بالتفصيل..."
              className="w-full rounded-lg border border-border p-3 text-sm resize-y h-24 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
          >
            <ThumbsDown className="h-4 w-4 ml-1" />
            تأكيد الرفض
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Queue Item Row
// ---------------------------------------------------------------------------

function QueueItemRow({
  entry,
  selected,
  onClick,
}: {
  entry: ReviewQueueEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-right rounded-xl border p-4 transition-all hover:shadow-sm",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* AI indicator */}
        {entry.aiWarning && (
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium line-clamp-1">
              {entry.stem}...
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              {entry.categoryNameAr}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                DIFFICULTY_CLASSES[entry.difficulty]
              )}
            >
              {DIFFICULTY_LABELS[entry.difficulty]}
            </span>
            {entry.waitingDays > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {toArabicDigits(entry.waitingDays)} يوم
              </span>
            )}
            {entry.previousReviews > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {toArabicDigits(entry.previousReviews)} مراجعة
              </span>
            )}
            {entry.aiWarning && (
              <span className="text-[10px] text-amber-600">
                ⚠️ {entry.aiWarning}
              </span>
            )}
          </div>
        </div>
        <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Review Client
// ---------------------------------------------------------------------------

export function StudioReviewClient() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [reviewMode, setReviewMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Queries
  const { data: queue, isLoading } = useQuery({
    queryKey: ["review-queue", tab],
    queryFn: () => getReviewQueue(tab),
  });

  const { data: stats } = useQuery({
    queryKey: ["review-stats"],
    queryFn: getReviewStats,
  });

  const currentId = queue?.[currentIndex]?.id;

  const { data: questionDetail } = useQuery({
    queryKey: ["review-question", currentId],
    queryFn: () => (currentId ? getReviewQuestion(currentId) : Promise.resolve(null)),
    enabled: reviewMode && !!currentId,
  });

  // ── Actions (defined before useEffect to avoid stale closure) ──

  const navigateNext = useCallback(() => {
    if (queue && currentIndex < queue.length - 1) {
      setCurrentIndex((p) => p + 1);
    } else {
      setReviewMode(false);
    }
  }, [queue, currentIndex]);

  const handleApprove = useCallback(async () => {
    if (!currentId || submitting) return;
    setSubmitting(true);
    try {
      await submitReviewAction(currentId, "approved");
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["review-stats"] });
      navigateNext();
    } finally {
      setSubmitting(false);
    }
  }, [currentId, submitting, queryClient, navigateNext]);

  const handleReject = useCallback(
    async (notes: string) => {
      if (!currentId || submitting) return;
      setSubmitting(true);
      try {
        await submitReviewAction(currentId, "rejected", notes);
        queryClient.invalidateQueries({ queryKey: ["review-queue"] });
        queryClient.invalidateQueries({ queryKey: ["review-stats"] });
        navigateNext();
      } finally {
        setSubmitting(false);
      }
    },
    [currentId, submitting, queryClient, navigateNext]
  );

  const handleApprovePublish = useCallback(async () => {
    if (!currentId || submitting) return;
    setSubmitting(true);
    try {
      await submitReviewAction(currentId, "approved_published");
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["review-stats"] });
      navigateNext();
    } finally {
      setSubmitting(false);
    }
  }, [currentId, submitting, queryClient, navigateNext]);

  // ── Keyboard shortcuts ─────────────────────────────────────

  useEffect(() => {
    if (!reviewMode || !queue || queue.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setCurrentIndex((p) => Math.min(queue.length - 1, p + 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex((p) => Math.max(0, p - 1));
          break;
        case "1":
          e.preventDefault();
          setShowRejectDialog(true);
          break;
        case "2":
          e.preventDefault();
          handleApprove();
          break;
        case "3":
          e.preventDefault();
          handleApprovePublish();
          break;
        case "Escape":
          e.preventDefault();
          setReviewMode(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewMode, queue, currentIndex, handleApprove, handleApprovePublish]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">قائمة المراجعة</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مراجعة الأسئلة قبل نشرها — استخدم لوحة المفاتيح للسرعة
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 py-2">
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold tabular-nums">
              {toArabicDigits(stats.pending)}
            </span>
            <span className="text-xs text-muted-foreground">بانتظار المراجعة</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 py-2">
            <AlertCircle className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-semibold tabular-nums">
              {toArabicDigits(stats.flagged)}
            </span>
            <span className="text-xs text-muted-foreground">ملاحظات AI</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold tabular-nums">
              {toArabicDigits(stats.approved)}
            </span>
            <span className="text-xs text-muted-foreground">معتمد</span>
          </div>
        </div>
      )}

      {/* ────────────── REVIEW MODE ────────────── */}
      {reviewMode && questionDetail && queue ? (
        <ReviewMode
          question={questionDetail}
          currentIndex={currentIndex}
          total={queue.length}
          onApprove={handleApprove}
          onReject={() => setShowRejectDialog(true)}
          onApprovePublish={handleApprovePublish}
          onBack={() => setReviewMode(false)}
          submitting={submitting}
        />
      ) : reviewMode && !questionDetail ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        /* ────────────── QUEUE LIST ────────────── */
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setCurrentIndex(0);
                }}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Queue */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : !queue || queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-medium">لا توجد عناصر في هذه القائمة</p>
              <p className="text-xs text-muted-foreground mt-1">
                جميع الأسئلة تمت مراجعتها
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((entry, i) => (
                <QueueItemRow
                  key={entry.id}
                  entry={entry}
                  selected={i === currentIndex}
                  onClick={() => {
                    setCurrentIndex(i);
                    setReviewMode(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject dialog */}
      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleReject}
      />
    </div>
  );
}
