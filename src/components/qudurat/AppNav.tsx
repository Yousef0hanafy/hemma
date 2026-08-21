"use client";

import { useState } from "react";
import { useViewStore, ViewKey } from "@/lib/store/view-store";
import { cn } from "@/lib/utils";
import { useDueReviewCount } from "@/lib/hooks/use-data";
import { Home, BookOpen, Timer, RefreshCw, BarChart3, Search, Trophy, Award, Bot, MoreHorizontal } from "lucide-react";

interface NavItem {
  key: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  view: ViewKey;
  matchView: (v: ViewKey) => boolean;
}

const NAV_ITEMS: NavItem[] = [
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
      v.kind === "exam_setup" ||
      v.kind === "exam_running" ||
      v.kind === "exam_report",
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

export function AppNav() {
  const { view, setView } = useViewStore();
  const { data: dueCount } = useDueReviewCount();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const badge = dueCount && dueCount > 0 ? dueCount : null;
  const primaryMobileItems = NAV_ITEMS.slice(0, 5);
  const secondaryMobileItems = NAV_ITEMS.slice(5).concat({
    key: "achievements",
    labelAr: "الإنجازات",
    icon: Trophy,
    view: { kind: "achievements" } as ViewKey,
    matchView: (v: ViewKey) => v.kind === "achievements",
  });
  const moreActive = secondaryMobileItems.some((item) => item.matchView(view));

  return (
    <>
      {/* Desktop side rail (lg+) */}
      <nav
        className="hidden lg:flex flex-col gap-1 fixed top-20 right-4 bottom-4 w-56 z-30"
        aria-label="التنقل الرئيسي"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.matchView(view);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.view)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all text-right",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-secondary text-foreground/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-right">{item.labelAr}</span>
              {item.key === "revision" && badge !== null && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-rose-500 text-[10px] font-bold text-white px-1.5 tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Achievements shortcut */}
        <button
          onClick={() => setView({ kind: "achievements" })}
          className={cn(
            "mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all text-right",
            view.kind === "achievements"
              ? "bg-accent text-accent-foreground shadow-sm"
              : "hover:bg-secondary text-foreground/80 hover:text-foreground"
          )}
        >
          <Trophy className="h-4 w-4 shrink-0" />
          <span>الإنجازات</span>
        </button>
      </nav>

      {/* Mobile bottom nav: keep primary destinations reachable, move secondary views into More. */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/60"
        aria-label="التنقل الرئيسي"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {primaryMobileItems.map((item) => {
            const active = item.matchView(view);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { setView(item.view); setMobileMoreOpen(false); }}
                className={cn(
                  "relative flex min-w-14 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("size-5", active && "scale-110")} aria-hidden="true" />
                <span>{item.labelAr}</span>
                {item.key === "revision" && badge !== null && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground tabular-nums">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((open) => !open)}
            className={cn(
              "flex min-w-14 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors",
              moreActive || mobileMoreOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={mobileMoreOpen}
            aria-controls="mobile-more-menu"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            <span>المزيد</span>
          </button>
        </div>
        {mobileMoreOpen && (
          <div id="mobile-more-menu" className="mx-auto flex max-w-md items-center justify-around border-t border-border/50 px-2 py-2" role="menu">
            {secondaryMobileItems.map((item) => {
              const active = item.matchView(view);
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => { setView(item.view); setMobileMoreOpen(false); }}
                  className={cn("flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span>{item.labelAr}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
