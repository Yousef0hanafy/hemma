"use client";

import { useEffect, Suspense, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppHeader } from "./AppHeader";
import { AppNav } from "./AppNav";
import { MobileDrawer } from "./MobileDrawer";
import { useViewStore } from "@/lib/store/view-store";
import dynamic from "next/dynamic";
import { DashboardView } from "./DashboardView";
import { StudySetupView } from "./StudySetupView";
import { StudyPlayerView } from "./StudyPlayerView";
import { ExamSetupView } from "./ExamSetupView";
import { ExamRunnerView } from "./ExamRunnerView";
import { ExamReportView } from "./ExamReportView";
import { RevisionView } from "./RevisionView";
import { SearchView } from "./SearchView";

const StatsView = dynamic(() => import("./StatsView").then((m) => m.StatsView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل الإحصاءات…" />,
});
const AchievementsView = dynamic(() => import("./AchievementsView").then((m) => m.AchievementsView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل الإنجازات…" />,
});
const ExamHistoryView = dynamic(() => import("./ExamHistoryView").then((m) => m.ExamHistoryView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل سجل الاختبارات…" />,
});
const ExamHistoryDetailView = dynamic(() => import("./ExamHistoryDetailView").then((m) => m.ExamHistoryDetailView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل تفاصيل الاختبار…" />,
});
const ProfileView = dynamic(() => import("./ProfileView").then((m) => m.ProfileView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل الملف الشخصي…" />,
});
const StudyPlanView = dynamic(() => import("./StudyPlanView").then((m) => m.StudyPlanView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل خطة الدراسة…" />,
});
const LeaderboardView = dynamic(() => import("./LeaderboardView").then((m) => m.LeaderboardView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل لوحة الصدارة…" />,
});
const AiStudyBuddyView = dynamic(() => import("./AiStudyBuddyView").then((m) => m.AiStudyBuddyView), {
  loading: () => <FullScreenLoader label="جارٍ تحميل المساعد الذكي…" />,
});

import { OnboardingTour } from "./OnboardingTour";
import { NotificationManager } from "@/components/notifications/NotificationManager";
import { ErrorBoundary } from "./ErrorBoundary";
import { AuthGate } from "./AuthGate";
import { FullScreenLoader } from "./LoadingStates";
import { hashToView } from "@/lib/store/view-store";

export function AppShell() {
  const { view, back, setView } = useViewStore();
  const { data: session } = useSession();

  // Restore view from URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const restored = hashToView(hash);
      if (restored) {
        setView(restored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isAuthenticated = !!session?.user;

  // Browser back button → in-memory back
  useEffect(() => {
    const onPop = () => {
      back();
    };
    window.addEventListener("popstate", onPop);
    // Push an initial state so back has something to pop
    window.history.pushState({ initial: true }, "", window.location.href);
    return () => window.removeEventListener("popstate", onPop);
  }, [back]);

  // Scroll to top on view change
  // (view-store.setView also scrolls, but StrictMode double-fires effects,
  //  so this is kept as a safety net for the browser-back case)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view.kind]);

  const isExamRunning = view.kind === "exam_running";
  const isStudyPlayer = view.kind === "study";

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Run notification checks silently while the app is open */}
      <NotificationManager />

      {/* Single mobile drawer instance shared by hamburger + more button */}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <AppHeader onDrawerToggle={() => setDrawerOpen(!drawerOpen)} />

      {isAuthenticated && <AppNav onDrawerToggle={() => setDrawerOpen(!drawerOpen)} />}

      <main
        className={`flex-1 mx-auto w-full max-w-6xl px-4 py-6 pb-20 lg:pb-6 ${isAuthenticated ? "lg:ps-64" : ""}`}
      >
        <ErrorBoundary>
          <Suspense fallback={<FullScreenLoader label="جارٍ تحميل المحتوى…" />}>
            <OnboardingTour />
            <AuthGate>
              {view.kind === "dashboard" && <DashboardView />}

              {view.kind === "study_setup" && <StudySetupView />}

              {view.kind === "study" && view.questionIds && (
                <StudyPlayerView
                  questionIds={view.questionIds}
                  categorySlug={view.categorySlug}
                />
              )}
              {view.kind === "study" && !view.questionIds && <StudySetupView />}

              {view.kind === "exam_setup" && <ExamSetupView />}

              {view.kind === "exam_running" && (
                <ExamRunnerView
                  sessionId={view.sessionId}
                  questionIds={view.questionIds}
                  durationSec={view.durationSec}
                />
              )}

              {view.kind === "exam_report" && (
                <ExamReportView
                  questionIds={view.questionIds}
                  selections={view.selections}
                  durationSec={view.durationSec}
                />
              )}

              {view.kind === "revision" && <RevisionView initialTab={view.tab} />}

              {view.kind === "stats" && <StatsView />}

              {view.kind === "achievements" && <AchievementsView />}

              {view.kind === "search" && <SearchView />}

              {view.kind === "exam_history" && <ExamHistoryView />}

              {view.kind === "exam_history_detail" && (
                <ExamHistoryDetailView sessionId={view.sessionId} />
              )}

              {view.kind === "profile" && <ProfileView />}

              {view.kind === "study_plan" && <StudyPlanView />}

              {view.kind === "leaderboard" && <LeaderboardView />}

              {view.kind === "study_buddy" && <AiStudyBuddyView />}
            </AuthGate>
          </Suspense>
        </ErrorBoundary>
      </main>

      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-card/30 backdrop-blur-sm py-3.5">
      <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-start text-xs text-muted-foreground">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img
            src="/logo-splash.png"
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
            loading="lazy"
            className="h-4.5 w-4.5 object-contain opacity-80"
            draggable={false}
          />
          <span className="font-semibold text-foreground/85 text-xs">منصة همّة التعليمية</span>
          <span className="opacity-40 hidden sm:inline">·</span>
          <span className="text-[11px] opacity-75 hidden sm:inline">التحضير المتميّز لاختبار القدرات اللفظية</span>
        </div>

        {/* Links & Dev credits */}
        <div className="flex items-center gap-3 text-[11px]">
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            شروط الاستخدام
          </Link>
          <span className="opacity-30">·</span>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            سياسة الخصوصية
          </Link>
          <span className="opacity-30">·</span>
          <div dir="ltr" className="inline-flex items-center gap-1 text-muted-foreground/85">
            <span>© {new Date().getFullYear()}</span>
            <span className="opacity-40">·</span>
            <span>Developed by</span>
            <a
              href="https://portfolio-yousef-hanafy.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
              aria-label="Youssef Hanafy — يفتح في تبويب جديد"
            >
              Youssef Hanafy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
