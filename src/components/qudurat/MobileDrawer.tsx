"use client";

import { useViewStore, type ViewKey } from "@/lib/store/view-store";
import { cn } from "@/lib/utils";
import { useDueReviewCount } from "@/lib/hooks/use-data";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Home,
  BookOpen,
  Timer,
  RefreshCw,
  BarChart3,
  Search,
  Trophy,
  Award,
  Bot,
  Sparkles,
  User,
  ChevronLeft,
} from "lucide-react";
import { prefetchViewData } from "@/lib/prefetch-view-data";

interface DrawerItem {
  key: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  view: ViewKey;
  matchView: (v: ViewKey) => boolean;
}

const DRAWER_ITEMS: DrawerItem[] = [
  {
    key: "dashboard",
    labelAr: "الرئيسية",
    icon: Home,
    view: { kind: "dashboard" },
    matchView: (v) => v.kind === "dashboard",
  },
  {
    key: "study",
    labelAr: "مذاكرة",
    icon: BookOpen,
    view: { kind: "study_setup" },
    matchView: (v) => v.kind === "study_setup" || v.kind === "study",
  },
  {
    key: "exam",
    labelAr: "اختبار",
    icon: Timer,
    view: { kind: "exam_setup" },
    matchView: (v) =>
      v.kind === "exam_setup" || v.kind === "exam_running" || v.kind === "exam_report",
  },
  {
    key: "revision",
    labelAr: "مراجعة",
    icon: RefreshCw,
    view: { kind: "revision", tab: "mistakes" },
    matchView: (v) => v.kind === "revision",
  },
  {
    key: "stats",
    labelAr: "إحصاءات",
    icon: BarChart3,
    view: { kind: "stats" },
    matchView: (v) => v.kind === "stats" || v.kind === "achievements",
  },
  {
    key: "search",
    labelAr: "بحث",
    icon: Search,
    view: { kind: "search" },
    matchView: (v) => v.kind === "search",
  },
  {
    key: "leaderboard",
    labelAr: "المتصدرون",
    icon: Award,
    view: { kind: "leaderboard" },
    matchView: (v) => v.kind === "leaderboard",
  },
  {
    key: "study_buddy",
    labelAr: "المساعد الذكي",
    icon: Bot,
    view: { kind: "study_buddy" },
    matchView: (v) => v.kind === "study_buddy",
  },
];

const SECONDARY_ITEMS: DrawerItem[] = [
  {
    key: "achievements",
    labelAr: "الإنجازات",
    icon: Trophy,
    view: { kind: "achievements" },
    matchView: (v) => v.kind === "achievements",
  },
  {
    key: "study_plan",
    labelAr: "الخطة الذكية",
    icon: Sparkles,
    view: { kind: "study_plan" },
    matchView: (v) => v.kind === "study_plan",
  },
  {
    key: "profile",
    labelAr: "الملف الشخصي",
    icon: User,
    view: { kind: "profile" },
    matchView: (v) => v.kind === "profile",
  },
];

export function MobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { view, setView } = useViewStore();
  const { data: dueCount } = useDueReviewCount();
  const badge = dueCount && dueCount > 0 ? dueCount : null;

  const handleNavigate = (item: DrawerItem) => {
    setView(item.view);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-right">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center">
              <Home className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold">التنقل السريع</SheetTitle>
              <SheetDescription className="text-[10px]">
                تصفّح جميع أقسام المنصة
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Main nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="قائمة التنقل">
          <div className="mb-2 px-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              الأقسام الرئيسية
            </span>
          </div>
          {DRAWER_ITEMS.map((item) => {
            const active = item.matchView(view);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item)}
                onMouseEnter={() => prefetchViewData(item.key)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all text-right",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-secondary text-foreground/80 hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-right">{item.labelAr}</span>
                {/* Due review badge on revision item */}
                {item.key === "revision" && badge !== null && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-rose-500 text-[10px] font-bold text-white px-1.5 tabular-nums">
                    {badge}
                  </span>
                )}
                {/* Active indicator */}
                {!active && (
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </button>
            );
          })}

          {/* Divider + secondary items */}
          <div className="my-3 border-t border-border/60" />
          <div className="mb-2 px-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              المزيد
            </span>
          </div>
          {SECONDARY_ITEMS.map((item) => {
            const active = item.matchView(view);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item)}
                onMouseEnter={() => prefetchViewData(item.key)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all text-right",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "hover:bg-secondary text-foreground/80 hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-right">{item.labelAr}</span>
                {!active && (
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-3">
          <p className="text-[10px] text-muted-foreground text-center">
            منصة همّة التعليمية
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
