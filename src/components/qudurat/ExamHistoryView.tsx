"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useExamHistory } from "@/lib/hooks/use-data";
import {
  toArabicDigits,
  formatPercent,
  relativeTimeAr,
} from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  Target,
  Check,
  X,
  ChevronLeft,
  BarChart3,
  LineChartIcon,
  Eye,
} from "lucide-react";
import { EmptyStateCard } from "./shared/EmptyStates";

export function ExamHistoryView() {
  const { setView } = useViewStore();
  const { data: sessions, loading } = useExamHistory();

  // Chart data: oldest → newest, with running average
  const chartData = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    // Reverse to chronological order for the chart
    const sorted = [...sessions].reverse();
    let runningSum = 0;
    return sorted.map((s, i) => {
      runningSum += s.scorePercent;
      return {
        label: `#${toArabicDigits(i + 1)}`,
        score: s.scorePercent,
        avg: Math.round(runningSum / (i + 1)),
        date: s.date,
      };
    });
  }, [sessions]);

  const stats = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const total = sessions.length;
    const avgScore = sessions.reduce((s, sess) => s + sess.scorePercent, 0) / total;
    const best = [...sessions].sort((a, b) => b.scorePercent - a.scorePercent)[0];
    const recent = sessions.slice(0, 5);
    const recentAvg = recent.reduce((s, sess) => s + sess.scorePercent, 0) / recent.length;
    const trend = recentAvg - (sessions.length > 5
      ? sessions.slice(5, 10).reduce((s, sess) => s + sess.scorePercent, 0) / Math.min(5, sessions.length - 5)
      : avgScore);
    return { total, avgScore, best, recentAvg, trend };
  }, [sessions]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32 lg:pb-12">
      <div>
        <button
          onClick={() => setView({ kind: "stats" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>الإحصاءات</span>
        </button>
        <h1 className="font-display text-3xl font-bold mb-1">سجل الاختبارات</h1>
        <p className="text-muted-foreground text-sm">
          تتبّع أداءك في الاختبارات عبر الزمن ولاحظ تحسّنك.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          جارٍ تحميل سجل الاختبارات…
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <EmptyStateCard
          illustration="exam"
          title="لا توجد اختبارات بعد"
          description="ابدأ اختبارًا لتظهر نتائجه هنا وتتبّع تقدّمك عبر الزمن. الاختبارات المنتظمة هي مفتاح التحسّن المستمر."
          suggestions={[
            {
              label: "ابدأ اختبارًا",
              onClick: () => setView({ kind: "exam_setup" }),
              variant: "primary",
            },
            {
              label: "ابدأ مذاكرة",
              onClick: () => setView({ kind: "study_setup" }),
              variant: "secondary",
            },
          ]}
        />
      ) : (
        <>
          {/* Stats summary */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-medium">إجمالي الاختبارات</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {toArabicDigits(stats.total)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">متوسط الدرجات</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatPercent(stats.avgScore)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 mb-2">
                  <Target className="h-4 w-4" />
                  <span className="text-xs font-medium">أفضل نتيجة</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatPercent(stats.best.scorePercent)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "rounded-2xl border p-4",
                  stats.trend >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                )}
              >
                <div className={cn(
                  "flex items-center gap-2 mb-2",
                  stats.trend >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                )}>
                  <LineChartIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">اتجاه آخر ٥</span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {stats.trend >= 0 ? "↑" : "↓"}{" "}
                  {toArabicDigits(Math.abs(Math.round(stats.trend)))}
                </div>
              </motion.div>
            </div>
          )}

          {/* Trend chart */}
          {chartData.length >= 2 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-card border border-border p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">منحنى الأداء</h2>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.55 0.13 155)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="oklch(0.55 0.13 155)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.70 0.13 75)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="oklch(0.70 0.13 75)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl bg-card border border-border shadow-lg p-3 text-xs space-y-1">
                            <div className="font-semibold">الاختبار {data.label}</div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>الدرجة: <strong>{toArabicDigits(data.score)}%</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              <span>المتوسط: <strong>{toArabicDigits(data.avg)}%</strong></span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg"
                      stroke="oklch(0.70 0.13 75)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      fill="url(#avgGradient)"
                      name="المتوسط"
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="oklch(0.55 0.13 155)"
                      strokeWidth={2.5}
                      fill="url(#scoreGradient)"
                      name="الدرجة"
                      dot={{ r: 4, fill: "oklch(0.55 0.13 155)", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "oklch(0.55 0.13 155)", stroke: "var(--card)", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          )}

          {/* Session list */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h2 className="font-semibold mb-3">قائمة الاختبارات</h2>
            {sessions.map((sess, i) => (
              <motion.button
                key={sess.sessionId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.03 }}
                onClick={() => setView({ kind: "exam_history_detail", sessionId: sess.sessionId })}
                className={cn(
                  "w-full text-right rounded-xl border p-4 cursor-pointer group",
                  sess.scorePercent >= 70
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-300 dark:hover:border-emerald-700"
                    : sess.scorePercent >= 50
                    ? "border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10 hover:border-amber-300 dark:hover:border-amber-700"
                    : "border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10 hover:border-rose-300 dark:hover:border-rose-700"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl grid place-items-center text-lg shrink-0",
                        sess.scorePercent >= 70
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                          : sess.scorePercent >= 50
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                          : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                      )}
                    >
                      {sess.scorePercent >= 70 ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <X className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="font-semibold text-sm">
                        {sess.scorePercent >= 70
                          ? "ممتاز 🎉"
                          : sess.scorePercent >= 50
                          ? "مقبول 💪"
                          : "بحاجة لتحسين 🌱"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>{relativeTimeAr(sess.date)}</span>
                        <span className="opacity-50">·</span>
                        <span>
                          {toArabicDigits(sess.correct)}/{toArabicDigits(sess.total)} صحيحة
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-2xl font-bold tabular-nums">
                      {formatPercent(sess.scorePercent)}
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.section>
        </>
      )}
    </div>
  );
}
