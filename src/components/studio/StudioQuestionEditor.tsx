"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateQuestionField,
  updateQuestionTags,
  updateQuestionOptions,
  getAdjacentQuestionIds,
  getQuestionDetail,
  generateExplanationForQuestion,
  estimateDifficultyForQuestion,
} from "@/server/actions/studio-questions";
import { fetchLibraryMeta } from "@/server/actions/studio-library";
import type { QuestionDetail, QuestionVersionInfo } from "@/server/actions/studio-questions";
import { QuestionPreviewModal } from "./QuestionPreviewModal";
import { BulkApplyModal } from "./BulkApplyModal";
import {
  ArrowRight,
  ArrowLeft,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Tags,
  BookOpen,
  FileText,
  MessageSquare,
  Lightbulb,
  Edit3,
  History,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Eye,
  CopyCheck,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-500" },
  review: { label: "قيد المراجعة", color: "bg-amber-500" },
  approved: { label: "معتمد", color: "bg-emerald-500" },
  published: { label: "منشور", color: "bg-sky-500" },
  archived: { label: "مؤرشف", color: "bg-rose-500" },
};

const FIELD_LABELS: Record<string, string> = {
  stem: "نص السؤال",
  explanation: "الشرح",
  studyTip: "ملاحظة دراسية",
  difficulty: "الصعوبة",
  status: "الحالة",
  correctKey: "الإجابة الصحيحة",
  citation: "المصدر",
  tags: "الوسوم",
  options: "الخيارات",
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} ي`;
  return new Date(date).toLocaleDateString("ar-SA");
}

const ARABIC_LETTERS = ["أ", "ب", "ج", "د"] as const;

// ---------------------------------------------------------------------------
// InlineEdit — click to edit any text/textarea value
// ---------------------------------------------------------------------------

function InlineEdit({
  value,
  field,
  label,
  onSave,
  type = "text",
  className,
  placeholder,
  externalTrigger,
  onRegisterSave,
}: {
  value: string;
  field: string;
  label: string;
  onSave: (field: string, value: string) => Promise<boolean>;
  type?: "text" | "textarea";
  className?: string;
  placeholder?: string;
  /** External counter — incrementing triggers edit mode */
  externalTrigger?: number;
  /** Register a save handler for external keyboard shortcut */
  onRegisterSave?: (fn: (() => Promise<void>) | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Ref that always points to the latest save logic (for external `s` key)
  const saveFnRef = useRef<() => Promise<void>>(async () => {});
  saveFnRef.current = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(field, draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  // Register/unregister save handler when editing state changes
  useEffect(() => {
    onRegisterSave?.(editing ? () => saveFnRef.current() : null);
    return () => onRegisterSave?.(null);
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // External trigger: enter edit mode
  useEffect(() => {
    if (externalTrigger && externalTrigger > 0) {
      setDraft(value);
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [externalTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
    }
  }, [editing, value]);

  const handleSave = saveFnRef.current;

  const handleCancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && type === "text") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel, type]
  );

  if (editing) {
    return (
      <div className="space-y-2">
        {type === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[80px] bg-background border border-primary/40 rounded-lg p-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
            dir="rtl"
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-background border border-primary/40 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            dir="rtl"
            placeholder={placeholder}
          />
        )}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="default"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            حفظ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={saving}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 ml-1" />
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  const displayValue = value || (placeholder ?? "لا يوجد");

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        "group cursor-pointer rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/30 transition-all px-2 py-1 -mx-2",
        !value && "text-muted-foreground/60 italic",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm whitespace-pre-wrap leading-relaxed">{displayValue}</span>
        <Edit3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    color: "bg-slate-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white",
        config.color
      )}
    >
      <Shield className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// QualityBar
// ---------------------------------------------------------------------------

function QualityBar({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="text-xs text-muted-foreground">لم يتم تحليل الجودة بعد</div>
    );
  }

  const color =
    score >= 0.7
      ? "bg-emerald-500"
      : score >= 0.4
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", score >= 0.7 ? "text-emerald-600" : score >= 0.4 ? "text-amber-600" : "text-rose-600")}>
          {Math.round(score * 100)}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OptionEditor
// ---------------------------------------------------------------------------

function OptionEditor({
  options,
  correctKey,
  onSave,
  questionId,
  onCorrectKeyChange,
}: {
  options: { key: string; text: string }[];
  correctKey: string;
  onSave: (options: { key: string; text: string }[]) => Promise<void>;
  questionId: string;
  onCorrectKeyChange: (newCorrectKey: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(options);
  const [saving, setSaving] = useState(false);

  const handleUpdate = useCallback(
    async (newOptions: { key: string; text: string }[]) => {
      setSaving(true);
      await onSave(newOptions);
      setSaving(false);
      setEditing(false);
    },
    [onSave]
  );

  if (!editing) {
    return (
      <div className="space-y-1.5">
        {options.map((opt) => (
          <div
            key={opt.key}
            onClick={() => setEditing(true)}
            className={cn(
              "group cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all",
              opt.key === correctKey
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                : "border-border/50 hover:border-border"
            )}
          >
            <span
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                opt.key === correctKey
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {opt.key}
            </span>
            <span className="flex-1 text-sm">{opt.text}</span>
            {opt.key === correctKey && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
            {opt.key !== correctKey && (
              <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {draft.map((opt, i) => (
        <div key={opt.key} className="flex items-center gap-2">
          <button
            onClick={() => {
              // When saving, just mark which key is correct — the onSave handler receives all options + the correct key
            }}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border",
              opt.key === correctKey ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted border-muted-foreground/30"
            )}
            title={opt.key === correctKey ? "صحيح" : "تعيين كصحيح"}
          >
            {opt.key === correctKey ? <CheckCircle2 className="h-3 w-3" /> : opt.key}
          </button>
          <input
            value={opt.text}
            onChange={(e) => {
              const updated = [...draft];
              updated[i] = { ...updated[i], text: e.target.value };
              setDraft(updated);
            }}
            className="flex-1 bg-background border border-border/50 rounded px-2 py-1 text-sm"
            dir="rtl"
          />
          {/* Correct-key toggle */}
          <button
            onClick={() => {
              onCorrectKeyChange(opt.key);
            }}
            className={cn(
              "text-xs px-2 py-1 rounded",
              opt.key === correctKey
                ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="تعيين كإجابة صحيحة"
          >
            {opt.key === correctKey ? "صحيح" : "تحديد"}
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          onClick={() => handleUpdate(draft)}
          disabled={saving}
          className="h-7 text-xs gap-1"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          حفظ
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(options);
            setEditing(false);
          }}
          className="h-7 text-xs"
        >
          إلغاء
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagsEditor
// ---------------------------------------------------------------------------

function TagsEditor({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join("، "));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const newTags = draft
      .split(/[،,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    setSaving(true);
    await onSave(newTags);
    setSaving(false);
    setEditing(false);
  }, [draft, onSave]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="group cursor-pointer flex flex-wrap gap-1.5"
      >
        {tags.length > 0 ? (
          tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">لا توجد وسوم</span>
        )}
        <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-40 transition-opacity self-center" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="وسوم مفصولة بـ ،"
        className="text-sm"
        dir="rtl"
      />
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="default" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          حفظ
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft(tags.join("، ")); setEditing(false); }} className="h-7 text-xs">
          إلغاء
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StudioQuestionEditor({
  question: initialQuestion,
}: {
  question: QuestionDetail;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [showPreview, setShowPreview] = useState(false);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [editTrigger, setEditTrigger] = useState(0);
  const [bulkMeta, setBulkMeta] = useState<{
    categories: { slug: string; nameAr: string; count: number }[];
    sources: { slug: string; title: string; count: number }[];
  } | null>(null);
  const [showVersions, setShowVersions] = useState(true);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [commonMistakes, setCommonMistakes] = useState<string[]>([]);
  const [estimatingDifficulty, setEstimatingDifficulty] = useState(false);
  const [difficultyEstimate, setDifficultyEstimate] = useState<{
    difficulty: string;
    reason: string;
    estimatedTime: number;
  } | null>(null);
  const [showAiLogs, setShowAiLogs] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [nav, setNav] = useState<{ prevId: string | null; nextId: string | null }>({
    prevId: null,
    nextId: null,
  });
  const [loadingNav, setLoadingNav] = useState(true);

  // Ref-based save handler tracker for the `s` keyboard shortcut
  const activeSaveRef = useRef<(() => Promise<void>) | null>(null);

  // Load adjacent IDs on mount
  useEffect(() => {
    getAdjacentQuestionIds(question.id).then(setNav).finally(() => setLoadingNav(false));
  }, [question.id]);

  // Fetch meta (categories & sources) for bulk apply filters
  useEffect(() => {
    fetchLibraryMeta().then(setBulkMeta);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  // j/k — prev/next, Escape — close modals, p — toggle preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "j":
        case "ArrowRight":
          if (nav.nextId) goTo(nav.nextId);
          break;
        case "k":
        case "ArrowLeft":
          if (nav.prevId) goTo(nav.prevId);
          break;
        case "Escape":
          if (showPreview) setShowPreview(false);
          if (showBulkApply) setShowBulkApply(false);
          break;
        case "e":
          // Edit focused field — enters edit mode on the stem
          setEditTrigger((prev) => prev + 1);
          break;
        case "s":
          // Save the currently-active InlineEdit (if any)
          activeSaveRef.current?.();
          break;
        case "p":
          setShowPreview((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nav, showPreview, showBulkApply, goTo]);

  // ── Field save handler ────────────────────────────────────────

  const handleFieldSave = useCallback(
    async (field: string, value: string): Promise<boolean> => {
      const result = await updateQuestionField(question.id, field, value);
      if (result.ok) {
        setQuestion((prev) => ({ ...prev, [field]: value }));
        toast.success(`تم حفظ ${FIELD_LABELS[field] ?? field}`);
        return true;
      }
      toast.error(result.error);
      return false;
    },
    [question.id]
  );

  const handleTagsSave = useCallback(
    async (tags: string[]) => {
      const result = await updateQuestionTags(question.id, tags);
      if (result.ok) {
        setQuestion((prev) => ({ ...prev, tags }));
        toast.success("تم حفظ الوسوم");
      } else {
        toast.error(result.error);
      }
    },
    [question.id]
  );

  const handleOptionsSave = useCallback(
    async (options: { key: string; text: string }[]) => {
      const result = await updateQuestionOptions(question.id, options);
      if (result.ok) {
        setQuestion((prev) => ({ ...prev, options }));
        toast.success("تم حفظ الخيارات");
      } else {
        toast.error(result.error);
      }
    },
    [question.id]
  );

  // ── AI Generation ───────────────────────────────────────────┐

  const handleGenerateExplanation = useCallback(async () => {
    setGeneratingExplanation(true);
    setCommonMistakes([]);
    try {
      const result = await generateExplanationForQuestion(question.id);
      if (result.ok) {
        setQuestion((prev) => ({
          ...prev,
          explanation: result.explanation,
          studyTip: result.studyTip,
        }));
        setCommonMistakes(result.commonMistakes);
        toast.success("تم توليد الشرح بنجاح");
        if (result.commonMistakes.length > 0) {
          toast(
            `الأخطاء الشائعة: ${result.commonMistakes.slice(0, 3).join("، ")}${result.commonMistakes.length > 3 ? "..." : ""}`,
            { duration: 5000 }
          );
        }
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("فشل توليد الشرح: " + (e as Error).message);
    } finally {
      setGeneratingExplanation(false);
    }
  }, [question.id]);

  // ── AI Difficulty Estimation ─────────────────────────────────

  const handleEstimateDifficulty = useCallback(async () => {
    setEstimatingDifficulty(true);
    setDifficultyEstimate(null);
    try {
      const result = await estimateDifficultyForQuestion(question.id);
      if (result.ok) {
        setDifficultyEstimate({
          difficulty: result.difficulty,
          reason: result.reason,
          estimatedTime: result.estimatedTime,
        });
        toast.success(
          `AI تقترح: ${result.difficulty === "easy" ? "سهل" : result.difficulty === "medium" ? "متوسط" : "صعب"}`
        );
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("فشل تقدير الصعوبة: " + (e as Error).message);
    } finally {
      setEstimatingDifficulty(false);
    }
  }, [question.id]);

  // ── Navigation ────────────────────────────────────────────────

  const goTo = useCallback(
    (id: string) => {
      router.push(`/studio/questions/${id}`);
    },
    [router]
  );

  // ── Render ────────────────────────────────────────────────────

  const status = STATUS_CONFIG[question.status] ?? {
    label: question.status,
    color: "bg-slate-500",
  };

  return (
    <div className="flex gap-4 h-full">
      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loadingNav ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!nav.prevId}
                  onClick={() => nav.prevId && goTo(nav.prevId)}
                  className="h-8 w-8"
                  title="السابق"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!nav.nextId}
                  onClick={() => nav.nextId && goTo(nav.nextId)}
                  className="h-8 w-8"
                  title="التالي"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </>
            )}
            <span className="text-sm text-muted-foreground">
              سؤال #{question.sourceLocalId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="h-8 text-xs gap-1"
              title="معاينة كطالب"
            >
              <Eye className="h-3.5 w-3.5" />
              معاينة
            </Button>
            <StatusBadge status={question.status} />
            <QuickStatusMenu
              currentStatus={question.status}
              onSave={handleFieldSave}
            />
          </div>
        </div>

        {/* Stem */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">نص السؤال</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {question.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <InlineEdit
              value={question.stem}
              field="stem"
              label="نص السؤال"
              onSave={handleFieldSave}
              type="textarea"
              placeholder="اكتب نص السؤال هنا..."
              externalTrigger={editTrigger}
              onRegisterSave={(fn) => { activeSaveRef.current = fn; }}
            />
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">الخيارات</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <OptionEditor
              options={question.options}
              correctKey={question.correctKey}
              onSave={handleOptionsSave}
              questionId={question.id}
              onCorrectKeyChange={async (newKey) => {
                await handleFieldSave("correctKey", newKey);
              }}
            />
          </CardContent>
        </Card>

        {/* Explanation + Study Tip in a 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">الشرح</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateExplanation}
                  disabled={generatingExplanation}
                  className="h-7 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
                  title="توليد شرح بالذكاء الاصطناعي"
                >
                  {generatingExplanation ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generatingExplanation ? "جارٍ التوليد..." : "AI"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <InlineEdit
                value={question.explanation ?? ""}
                field="explanation"
                label="الشرح"
                onSave={handleFieldSave}
                type="textarea"
                placeholder="اكتب شرحاً للسؤال..."
                onRegisterSave={(fn) => { activeSaveRef.current = fn; }}
              />
              {commonMistakes.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    الأخطاء الشائعة التي حددها AI
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-300 space-y-1 pr-4">
                    {commonMistakes.map((m, i) => (
                      <li key={i} className="list-disc">{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">ملاحظة دراسية</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <InlineEdit
                value={question.studyTip ?? ""}
                field="studyTip"
                label="ملاحظة دراسية"
                onSave={handleFieldSave}
                type="textarea"
                placeholder="أضف ملاحظة دراسية..."
                onRegisterSave={(fn) => { activeSaveRef.current = fn; }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Tags */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">الوسوم</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <TagsEditor tags={question.tags} onSave={handleTagsSave} />
          </CardContent>
        </Card>

        {/* Metadata row */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">معلومات إضافية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">المصدر</span>
                <p className="font-medium">{question.source.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">التصنيف</span>
                <p className="font-medium">{question.category.nameAr}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">الصعوبة</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <select
                    value={question.difficulty}
                    onChange={(e) => handleFieldSave("difficulty", e.target.value)}
                    className="text-sm bg-transparent border border-border/50 rounded px-1 py-0.5"
                  >
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                  <button
                    onClick={handleEstimateDifficulty}
                    disabled={estimatingDifficulty}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 transition-colors shrink-0"
                    title="تقدير الصعوبة بالذكاء الاصطناعي"
                  >
                    {estimatingDifficulty ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {difficultyEstimate && (
                  <div className="mt-1.5 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded px-2 py-1 space-y-0.5">
                    <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400 flex items-center justify-between">
                      <span>
                        تقدير AI:{' '}
                        <span
                          className={
                            difficultyEstimate.difficulty === "easy"
                              ? "text-emerald-600"
                              : difficultyEstimate.difficulty === "medium"
                                ? "text-amber-600"
                                : "text-rose-600"
                          }
                        >
                          {difficultyEstimate.difficulty === "easy"
                            ? "سهل"
                            : difficultyEstimate.difficulty === "medium"
                              ? "متوسط"
                              : "صعب"}
                        </span>
                        {difficultyEstimate.estimatedTime > 0 && (
                          <span className="text-muted-foreground font-normal">
                            {' · '}~{difficultyEstimate.estimatedTime}ث
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          handleFieldSave("difficulty", difficultyEstimate.difficulty);
                          setDifficultyEstimate(null);
                        }}
                        className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 underline-offset-2 hover:underline"
                      >
                        تطبيق
                      </button>
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {difficultyEstimate.reason}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground text-xs">تاريخ الإنشاء</span>
                <p className="font-medium">{timeAgo(question.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passage (if applicable) */}
        {question.passage && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">
                  {question.passage.titleAr || "نص الاستيعاب"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {question.passage.bodyAr}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-8rem)] pb-4">
        {/* AI Quality */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-xs font-semibold">جودة AI</CardTitle>
              </div>
              {question.aiQualityScore !== null && (
                <span
                  className={cn(
                    "text-xs font-bold",
                    question.aiQualityScore >= 0.7
                      ? "text-emerald-600"
                      : question.aiQualityScore >= 0.4
                        ? "text-amber-600"
                        : "text-rose-600"
                  )}
                >
                  {Math.round(question.aiQualityScore * 100)}%
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <QualityBar score={question.aiQualityScore} />
            {question.aiProcessedAt && (
              <p className="text-[10px] text-muted-foreground mt-1">
                آخر تحليل: {timeAgo(question.aiProcessedAt)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-semibold">الإحصائيات</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">إجمالي المحاولات</span>
                <span className="font-medium">{question.attemptCount}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">نسبة الدقة</span>
                <span
                  className={cn(
                    "font-medium",
                    question.attemptAccuracy !== null &&
                      (question.attemptAccuracy >= 70
                        ? "text-emerald-600"
                        : question.attemptAccuracy >= 40
                          ? "text-amber-600"
                          : "text-rose-600")
                  )}
                >
                  {question.attemptAccuracy !== null
                    ? `${question.attemptAccuracy}%`
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">مراجعات</span>
                <span className="font-medium">{question.reviewCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card>
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setShowReviews(!showReviews)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold">المراجعات</CardTitle>
              </div>
              {showReviews ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <AnimatePresence>
            {showReviews && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent>
                  {question.lastReview ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        {question.lastReview.action === "approved" ? (
                          <ThumbsUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <ThumbsDown className="h-3 w-3 text-rose-500" />
                        )}
                        <span className="font-medium">
                          {question.lastReview.action === "approved"
                            ? "تمت الموافقة"
                            : question.lastReview.action === "rejected"
                              ? "مرفوض"
                              : "طلب تعديل"}
                        </span>
                      </div>
                      {question.lastReview.notes && (
                        <p className="text-muted-foreground">
                          {question.lastReview.notes}
                        </p>
                      )}
                      <p className="text-muted-foreground/60">
                        {question.lastReview.reviewerName ?? "مستخدم"} ·{" "}
                        {timeAgo(question.lastReview.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">لا توجد مراجعات</p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* AI Processing Logs */}
        <Card>
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setShowAiLogs(!showAiLogs)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold">سجل AI</CardTitle>
              </div>
              {showAiLogs ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <AnimatePresence>
            {showAiLogs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent>
                  {question.aiProcessingLogs.length > 0 ? (
                    <ScrollArea className="max-h-40">
                      <div className="space-y-1.5">
                        {question.aiProcessingLogs.map((log, i) => (
                          <div key={i} className="text-xs flex items-center gap-1.5">
                            {log.status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            ) : log.status === "failed" ? (
                              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                            ) : (
                              <Loader2 className="h-3 w-3 text-amber-500 animate-spin shrink-0" />
                            )}
                            <span className="text-muted-foreground">{log.operation}</span>
                            <span className="text-muted-foreground/60">
                              {timeAgo(log.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-muted-foreground">لا توجد عمليات AI</p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Bulk Apply */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CopyCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-semibold">تطبيق جماعي</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              طبق قيمة الحقل الحالي (الشرح، الملاحظة، الصعوبة، الحالة) على
              مجموعة من الأسئلة باستخدام التصفية
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkApply(true)}
              className="w-full text-xs gap-1 h-8"
            >
              <CopyCheck className="h-3.5 w-3.5" />
              فتح التطبيق الجماعي
            </Button>
          </CardContent>
        </Card>

        {/* Version History */}
        <Card>
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setShowVersions(!showVersions)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold">سجل التعديلات</CardTitle>
                {question.versions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {question.versions.length}
                  </span>
                )}
              </div>
              {showVersions ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <AnimatePresence>
            {showVersions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent>
                  {question.versions.length > 0 ? (
                    <ScrollArea className="max-h-60">
                      <div className="space-y-1.5">
                        {question.versions.map((v) => (
                          <div key={v.id} className="text-xs border-b border-border/30 pb-1.5 last:border-0">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium">
                                {FIELD_LABELS[v.field] ?? v.field}
                              </span>
                              <span className="text-muted-foreground/60">
                                {timeAgo(v.createdAt)}
                              </span>
                            </div>
                            {v.oldValue && v.newValue && v.field !== "options" && (
                              <div className="mt-0.5 mr-4 text-muted-foreground truncate">
                                {v.oldValue.slice(0, 60)}
                                {v.oldValue.length > 60 ? "…" : ""}
                                <ArrowLeft className="h-2.5 w-2.5 inline mx-0.5" />
                                <span className="text-foreground">
                                  {v.newValue.slice(0, 60)}
                                  {v.newValue.length > 60 ? "…" : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-muted-foreground">لا توجد تعديلات سابقة</p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* ── Bulk Apply modal ─────────────────────────────────────── */}
      <BulkApplyModal
        open={showBulkApply}
        onOpenChange={setShowBulkApply}
        currentValues={{
          explanation: question.explanation,
          studyTip: question.studyTip,
          difficulty: question.difficulty,
          status: question.status,
        }}
        meta={bulkMeta}
        currentQuestionId={question.id}
        onApplied={() => {
          getQuestionDetail(question.id).then((q) => {
            if (q) setQuestion(q);
          });
        }}
      />

      {/* ── Preview modal ───────────────────────────────────────── */}
      <QuestionPreviewModal
        question={question}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickStatusMenu
// ---------------------------------------------------------------------------

function QuickStatusMenu({
  currentStatus,
  onSave,
}: {
  currentStatus: string;
  onSave: (field: string, value: string) => Promise<boolean>;
}) {
  const statusOptions = [
    { value: "draft", label: "مسودة" },
    { value: "review", label: "قيد المراجعة" },
    { value: "approved", label: "معتمد" },
    { value: "published", label: "منشور" },
    { value: "archived", label: "مؤرشف" },
  ];

  return (
    <select
      value={currentStatus}
      onChange={(e) => onSave("status", e.target.value)}
      className="text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {statusOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
