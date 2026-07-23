"use client";

import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useExamSessionData } from "@/lib/hooks/use-data";
import { ExamReportView } from "./ExamReportView";
import { FullScreenLoader } from "./LoadingStates";
import { ChevronLeft, Archive } from "lucide-react";

export function ExamHistoryDetailView({ sessionId }: { sessionId: string }) {
  const { setView } = useViewStore();
  const { data: sessionData, loading } = useExamSessionData(sessionId);

  if (loading) {
    return <FullScreenLoader label="جارٍ تحميل تفاصيل الاختبار…" />;
  }

  if (!sessionData) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <Archive className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="font-display text-xl font-bold mb-2">بيانات الاختبار غير متوفرة</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          لم يتم العثور على تفاصيل هذا الاختبار. قد يكون من جلسة سابقة لم تُحفظ بياناتها.
        </p>
        <button
          onClick={() => setView({ kind: "exam_history" })}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/90"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>العودة للسجل</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setView({ kind: "exam_history" })}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>سجل الاختبارات</span>
      </button>

      <ExamReportView
        questionIds={sessionData.questionIds}
        selections={sessionData.selections}
        durationSec={0}
        actualDurationSec={sessionData.actualDurationSec ?? undefined}
      />
    </div>
  );
}
