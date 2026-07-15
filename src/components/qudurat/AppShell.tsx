"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppHeader } from "./AppHeader";
import { AppNav } from "./AppNav";
import { useViewStore } from "@/lib/store/view-store";
import { DashboardView } from "./DashboardView";
import { StudySetupView } from "./StudySetupView";
import { StudyPlayerView } from "./StudyPlayerView";
import { ExamSetupView } from "./ExamSetupView";
import { ExamRunnerView } from "./ExamRunnerView";
import { ExamReportView } from "./ExamReportView";
import { RevisionView } from "./RevisionView";
import { StatsView } from "./StatsView";
import { AchievementsView } from "./AchievementsView";
import { SearchView } from "./SearchView";
import { ExamHistoryView } from "./ExamHistoryView";
import { ExamHistoryDetailView } from "./ExamHistoryDetailView";
import { ProfileView } from "./ProfileView";
import { StudyPlanView } from "./StudyPlanView";
import { LeaderboardView } from "./LeaderboardView";
import { AiStudyBuddyView } from "./AiStudyBuddyView";
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Run notification checks silently while the app is open */}
      <NotificationManager />
      <AppHeader />

      {isAuthenticated && <AppNav />}

      <main
        className={`flex-1 mx-auto w-full max-w-6xl px-4 py-6 ${isAuthenticated ? "lg:ps-64" : ""}`}
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
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-5 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src="/logo-splash.png"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
            className="h-5 w-5 object-contain opacity-80"
            draggable={false}
          />
          <span className="font-semibold">منصة همّة التعليمية</span>
          <span className="opacity-50">·</span>
          <span>التحضير المتميّز لاختبار القدرات اللفظية</span>
        </div>

        {/* Legal links */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/80">
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
        </div>

        <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5">
          <span>Developed By</span>
          <a
            href="https://portfolio-yousef-hanafy.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground/80 hover:text-primary underline-offset-2 hover:underline transition-colors"
            aria-label="Youssef Hanafy — يفتح في تبويب جديد"
          >
            Youssef Hanafy
          </a>
          <span className="opacity-50">·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
