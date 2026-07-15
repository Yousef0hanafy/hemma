"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  updateSetting,
  resetSetting,
  resetAllSettings,
  DEFAULT_SETTINGS,
} from "@/server/actions/studio-settings";
import type { SettingsDTO } from "@/server/actions/studio-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  ClipboardCheck,
  BrainCircuit,
  Globe,
  RotateCcw,
  Undo2,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Setting definitions — metadata for each setting
// ---------------------------------------------------------------------------

interface SettingDef {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "select" | "number" | "text";
  options?: { value: string; label: string }[];
}

const SETTING_GROUPS: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  settings: SettingDef[];
}[] = [
  {
    id: "publishing",
    title: "النشر",
    icon: Upload,
    description: "إعدادات النشر الافتراضية وسير عمل الموافقة على المحتوى",
    settings: [
      {
        key: "default_import_status",
        label: "الحالة الافتراضية للاستيراد",
        description: "الحالة التي تُعطى للأسئلة الجديدة عند استيرادها",
        type: "select",
        options: [
          { value: "draft", label: "مسودة" },
          { value: "review", label: "مراجعة" },
          { value: "published", label: "منشور" },
        ],
      },
      {
        key: "require_review_before_publish",
        label: "طلب مراجعة قبل النشر",
        description: "يتطلب مراجعة بشرية قبل نشر الأسئلة",
        type: "boolean",
      },
      {
        key: "auto_approve_high_quality",
        label: "موافقة تلقائية للجودة العالية",
        description: "اعتماد الأسئلة عالية الجودة تلقائياً دون مراجعة بشرية",
        type: "boolean",
      },
      {
        key: "auto_approve_threshold",
        label: "حد الموافقة التلقائية",
        description:
          "الحد الأدنى لدرجة الجودة المطلوبة للموافقة التلقائية (0.0 - 1.0)",
        type: "number",
      },
    ],
  },
  {
    id: "review",
    title: "المراجعة",
    icon: ClipboardCheck,
    description: "إعدادات سير عمل مراجعة المحتوى",
    settings: [
      {
        key: "min_reviewers_to_approve",
        label: "الحد الأدنى من المراجعين",
        description: "عدد المراجعين المطلوبين لاعتماد السؤال (1 - 10)",
        type: "number",
      },
      {
        key: "ai_quality_flag_threshold",
        label: "حد الإبلاغ عن الجودة المنخفضة",
        description: "الدرجة التي تقل عنها تعتبر السؤال بحاجة للانتباه (0.0 - 1.0)",
        type: "number",
      },
      {
        key: "ai_quality_good_threshold",
        label: "حد الجودة المقبولة",
        description: "الدرجة التي تعتبر السؤال ذو جودة جيدة (0.0 - 1.0)",
        type: "number",
      },
    ],
  },
  {
    id: "ai",
    title: "الذكاء الاصطناعي",
    icon: BrainCircuit,
    description: "إعدادات معالجة الذكاء الاصطناعي للمحتوى",
    settings: [
      {
        key: "auto_process_on_import",
        label: "معالجة تلقائية عند الاستيراد",
        description: "تشغيل فحص الجودة بالذكاء الاصطناعي تلقائياً عند استيراد مصدر جديد",
        type: "boolean",
      },
      {
        key: "auto_estimate_difficulty_on_import",
        label: "تقدير الصعوبة عند الاستيراد",
        description: "تقدير مستوى صعوبة جميع الأسئلة تلقائياً باستخدام AI بعد كل استيراد",
        type: "boolean",
      },
      {
        key: "auto_generate_explanations_on_import",
        label: "توليد الشروحات عند الاستيراد",
        description: "إنشاء شروحات تلقائية للأسئلة التي تفتقر إلى شرح بعد كل استيراد",
        type: "boolean",
      },
      {
        key: "enable_ai_quality_check",
        label: "تفعيل فحص الجودة بالذكاء الاصطناعي",
        description: "تقييم جودة الأسئلة تلقائياً باستخدام الذكاء الاصطناعي",
        type: "boolean",
      },
      {
        key: "enable_ai_explanation",
        label: "توليد الشروحات بالذكاء الاصطناعي",
        description: "إنشاء شروحات تلقائية للأسئلة التي تفتقر إلى شرح",
        type: "boolean",
      },
      {
        key: "ai_provider",
        label: "مزود الذكاء الاصطناعي",
        description: "المحرك المستخدم لتقييم الجودة — يتطلب مفتاح API في المتغيرات البيئية",
        type: "select",
        options: [
          { value: "auto", label: "تلقائي (Gemini ↔ تقييم محلي)" },
          { value: "gemini", label: "Google Gemini فقط" },
          { value: "heuristic", label: "تقييم محلي فقط" },
        ],
      },
      {
        key: "ai_model",
        label: "نموذج الذكاء الاصطناعي",
        description: "اسم النموذج المستخدم (مثل gemini-2.0-flash, gemini-2.5-pro) — يتطلب مفتاح API",
        type: "text",
      },
    ],
  },
  {
    id: "system",
    title: "النظام",
    icon: Globe,
    description: "إعدادات النظام العامة",
    settings: [
      {
        key: "site_name",
        label: "اسم المنصة",
        description: "اسم المنصة الذي يظهر في واجهة الاستوديو",
        type: "text",
      },
      {
        key: "maintenance_mode",
        label: "وضع الصيانة",
        description: "تفعيل وضع الصيانة — تعطيل الوصول للمستخدمين العاديين",
        type: "boolean",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Individual setting row component
// ---------------------------------------------------------------------------

function SettingRow({
  def,
  value,
  isDefault,
  onUpdate,
  onReset,
  updating,
}: {
  def: SettingDef;
  value: string;
  isDefault: boolean;
  onUpdate: (key: string, value: string) => void;
  onReset: (key: string) => void;
  updating: boolean;
}) {
  const [dirty, setDirty] = useState(value);
  // Sync dirty when value changes externally (e.g., after a reset)
  useEffect(() => {
    setDirty(value);
  }, [value]);
  const synced = dirty === value;

  // Render the appropriate input based on type
  const renderInput = () => {
    switch (def.type) {
      case "boolean": {
        const checked = value === "true";
        return (
          <Switch
            checked={checked}
            onCheckedChange={(v) => onUpdate(def.key, v ? "true" : "false")}
            disabled={updating}
          />
        );
      }
      case "select": {
        return (
          <Select
            value={value}
            onValueChange={(v) => onUpdate(def.key, v)}
            disabled={updating}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {def.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "number": {
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={dirty}
              onChange={(e) => setDirty(e.target.value)}
              className="h-8 w-24 text-xs text-left tabular-nums"
              dir="ltr"
              step={def.key.includes("threshold") ? "0.05" : "1"}
              min={def.key.includes("threshold") ? "0" : "1"}
              max={def.key.includes("threshold") ? "1" : "10"}
            />
            {!synced && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onUpdate(def.key, dirty)}
                disabled={updating}
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </Button>
            )}
          </div>
        );
      }
      case "text": {
        return (
          <div className="flex items-center gap-2" dir="rtl">
            <Input
              value={dirty}
              onChange={(e) => setDirty(e.target.value)}
              className="h-8 w-48 text-xs"
              dir="rtl"
            />
            {!synced && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onUpdate(def.key, dirty)}
                disabled={updating}
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </Button>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{def.label}</p>
          {isDefault && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 text-muted-foreground border-dashed"
            >
              افتراضي
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {def.description}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {renderInput()}
        {!isDefault && (
          <button
            onClick={() => onReset(def.key)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
            title="إعادة للافتراضي"
          >
            <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StudioSettingsClient() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [updating, setUpdating] = useState<string | null>(null);

  const handleUpdate = useCallback(
    async (key: string, value: string) => {
      setUpdating(key);
      try {
        await updateSetting(key, value);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        toast.success("تم حفظ الإعداد");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUpdating(null);
      }
    },
    [queryClient]
  );

  const handleReset = useCallback(
    async (key: string) => {
      setUpdating(key);
      try {
        await resetSetting(key);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        toast.success("تم إعادة الإعداد للافتراضي");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUpdating(null);
      }
    },
    [queryClient]
  );

  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

  const handleResetAll = async () => {
    setResettingAll(true);
    try {
      await resetAllSettings();
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("تم إعادة جميع الإعدادات للافتراضي");
      setResetAllOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResettingAll(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-72" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل الإعدادات</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["settings"] })
            }
          >
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Main view ─────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ضبط إعدادات المنصة، النشر، المراجعة، والذكاء الاصطناعي
          </p>
        </div>
        <Dialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 ml-2" />
              إعادة الكل للافتراضي
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إعادة جميع الإعدادات</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من إعادة جميع الإعدادات إلى القيم الافتراضية؟
                <br />
                <span className="text-amber-500 font-medium">
                  لا يمكن التراجع عن هذا الإجراء.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResetAllOpen(false)}
                disabled={resettingAll}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetAll}
                disabled={resettingAll}
              >
                {resettingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الإعادة...
                  </>
                ) : (
                  "إعادة الكل للافتراضي"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings groups */}
      {SETTING_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    group.id === "publishing" && "bg-sky-50 dark:bg-sky-950",
                    group.id === "review" && "bg-amber-50 dark:bg-amber-950",
                    group.id === "ai" && "bg-violet-50 dark:bg-violet-950",
                    group.id === "system" && "bg-slate-50 dark:bg-slate-950"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      group.id === "publishing" && "text-sky-500",
                      group.id === "review" && "text-amber-500",
                      group.id === "ai" && "text-violet-500",
                      group.id === "system" && "text-slate-500"
                    )}
                  />
                </div>
                <div>
                  <CardTitle className="text-base">{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {group.settings.map((def, idx) => {
                const currentValue = settings?.[def.key] ?? DEFAULT_SETTINGS[def.key];
                const isDefault = currentValue === DEFAULT_SETTINGS[def.key];

                return (
                  <div key={def.key}>
                    {idx > 0 && <Separator className="bg-border/50" />}
                    <SettingRow
                      def={def}
                      value={currentValue}
                      isDefault={isDefault}
                      onUpdate={handleUpdate}
                      onReset={handleReset}
                      updating={updating === def.key}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center pb-8 mt-8">
        <p>
          بعض الإعدادات تتطلب صلاحيات المدير لتعديلها.
          <br />
          قد تحتاج إلى تحديث الصفحة بعد تغيير بعض الإعدادات.
        </p>
      </div>
    </div>
  );
}
