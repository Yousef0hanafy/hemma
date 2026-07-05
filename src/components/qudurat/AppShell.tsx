"use client";

import { useEffect } from "react";
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

export function AppShell() {
  const { view, back, setView } = useViewStore();

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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view.kind]);

  const isExamRunning = view.kind === "exam_running";
  const isStudyPlayer = view.kind === "study";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <AppNav />

      <main
        className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 lg:ps-64"
      >
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
      </main>

      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground">
        <p>
          منصة قُدرات التعليمية — نظام تحضير اختبار القدرات اللفظية
        </p>
        <p className="mt-1 opacity-75">
          مبنيّة بأحدث تقنيات الويب ل تجربة تعليمية متميّزة
        </p>
      </div>
    </footer>
  );
}
