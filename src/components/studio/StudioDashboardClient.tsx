"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Upload,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  FileText,
  BookOpen,
  BarChart3,
  TrendingUp,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toArabicDigits, relativeTimeAr } from "@/lib/content/ui-helpers";
import {
  getStudioDashboardStats,
  getStudioReviewQueue,
  getRecentImports,
  getDashboardActivityTrend,
  getDashboardDistributions,
} from "@/server/actions/studio";
import type {
  StudioDashboardStats,
  ReviewQueueItem,
  RecentImport,
  DailyTrendPoint,
  StatusDistribution,
  QualityDistribution,
} from "@/server/actions/studio";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "مراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  draft: "bg-slate-300 dark:bg-slate-600",
  review: "bg-amber-400 dark:bg-amber-600",
  approved: "bg-emerald-400 dark:bg-emerald-600",
  published: "bg-emerald-500 dark:bg-emerald-500",
  archived: "bg-slate-300 dark:bg-slate-600",
};

const TREND_MAX_BAR = 12; // max height in Tailwind units (h-12)

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  href?: string;
  subtitle?: string;
  trend?: number; // optional percentage change
}

function MetricCard({ label, value, icon, color, href, subtitle, trend }: MetricCardProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 p-4 transition-all hover:shadow-sm hover:border-border",
        href && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-2xl font-bold tabular-nums">
            {toArabicDigits(value)}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground/70">{subtitle}</div>
          )}
          {trend !== undefined && (
            <div
              className={cn(
                "text-[10px] font-medium flex items-center gap-0.5",
                trend >= 0 ? "text-emerald-500" : "text-rose-500"
              )}
            >
              <TrendingUp
                className={cn(
                  "h-3 w-3",
                  trend < 0 && "rotate-180"
                )}
              />
              {trend >= 0 ? "+" : ""}
              {trend}%
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            color
          )}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ---------------------------------------------------------------------------
// Activity Trend (mini sparkline chart)
// ---------------------------------------------------------------------------

function ActivityTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.created, d.attempts)), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-16">
        {data.map((point, i) => {
          const createdHeight = Math.max((point.created / maxValue) * TREND_MAX_BAR, 1);
          const attemptsHeight = Math.max((point.attempts / maxValue) * TREND_MAX_BAR, 1);

          return (
            <div
              key={point.date}
              className="flex-1 flex flex-col items-center gap-px"
            >
              <div className="w-full flex flex-col items-center gap-px">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${attemptsHeight * 4}px` }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className="w-full rounded-t-sm bg-violet-300 dark:bg-violet-700"
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${createdHeight * 4}px` }}
                  transition={{ delay: i * 0.03 + 0.1, duration: 0.3 }}
                  className="w-full rounded-t-sm bg-sky-400 dark:bg-sky-600"
                />
              </div>
              <span className="text-[9px] text-muted-foreground mt-1">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-sky-400 dark:bg-sky-600" />
          <span>أسئلة جديدة</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-violet-300 dark:bg-violet-700" />
          <span>محاولات</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Distribution Bar
// ---------------------------------------------------------------------------

function StatusDistributionBar({ statuses }: { statuses: StatusDistribution[] }) {
  const total = statuses.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {statuses.map((s) => {
          if (s.count === 0) return null;
          return (
            <motion.div
              key={s.status}
              initial={{ width: 0 }}
              animate={{ width: `${s.percentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={STATUS_BAR_COLORS[s.status] ?? "bg-slate-300"}
              title={`${STATUS_LABELS[s.status] ?? s.status}: ${s.count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {statuses.map((s) => (
          <div key={s.status} className="flex items-center gap-1 text-[10px]">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                STATUS_BAR_COLORS[s.status] ?? "bg-slate-300"
              )}
            />
            <span className="text-muted-foreground">
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
            <span className="font-medium tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quality Distribution
// ---------------------------------------------------------------------------

function QualityDistributionBlock({ qualities }: { qualities: QualityDistribution[] }) {
  const total = qualities.reduce((a, q) => a + q.count, 0);
  if (total === 0) return null;

  const maxCount = Math.max(...qualities.map((q) => q.count), 1);

  return (
    <div className="space-y-2">
      {qualities.map((q, i) => {
        const pct = Math.max((q.count / maxCount) * 100, q.count > 0 ? 8 : 0);
        return (
          <motion.div
            key={q.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs text-muted-foreground w-20 shrink-0 text-left">
              {q.label}
            </span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={cn("h-full rounded-full", q.color)}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-8 text-right shrink-0">
              {q.count}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Queue Widget
// ---------------------------------------------------------------------------

function ReviewQueueWidget({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
        <p className="text-sm font-medium">لا توجد عناصر للمراجعة</p>
        <p className="text-xs text-muted-foreground mt-1">
          جميع المحتوى تمت مراجعته
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="group flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="shrink-0 mt-0.5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground/90 truncate">
                {item.stem}...
              </span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span>✏️ {item.authorName ?? "غير معروف"}</span>
              <span>·</span>
              <span>{relativeTimeAr(item.createdAt.toISOString())}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-7 text-xs"
            asChild
          >
            <Link href="/studio/review">مراجعة</Link>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Imports Widget
// ---------------------------------------------------------------------------

function RecentImportsWidget({ items }: { items: RecentImport[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">لا توجد استيرادات حديثة</p>
        <p className="text-xs text-muted-foreground mt-1">
          ابدأ باستيراد أول ملف أسئلة لديك
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="group flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="shrink-0 mt-0.5">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.title}</div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span>{toArabicDigits(item.questionCount)} سؤال</span>
              <span>·</span>
              <span>✓ مكتمل</span>
              <span>·</span>
              <span>{relativeTimeAr(item.importedAt.toISOString())}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live indicator
// ---------------------------------------------------------------------------

function LiveIndicator({ isStale }: { isStale: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          isStale
            ? "bg-muted-foreground/40"
            : "bg-emerald-500 animate-pulse"
        )}
      />
      {isStale ? "غير محدث" : "مباشر"}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Client
// ---------------------------------------------------------------------------

export function StudioDashboardClient() {
  // ── Queries with 30-second auto-refresh ────────────────────────

  const statsQ = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getStudioDashboardStats,
    refetchInterval: 30_000,
  });

  const reviewQ = useQuery({
    queryKey: ["dashboard-review-queue"],
    queryFn: () => getStudioReviewQueue(5),
    refetchInterval: 30_000,
  });

  const importsQ = useQuery({
    queryKey: ["dashboard-recent-imports"],
    queryFn: () => getRecentImports(5),
    refetchInterval: 30_000,
  });

  const trendQ = useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: () => getDashboardActivityTrend(7),
    refetchInterval: 60_000,
  });

  const distQ = useQuery({
    queryKey: ["dashboard-distributions"],
    queryFn: getDashboardDistributions,
    refetchInterval: 60_000,
  });

  const stats = statsQ.data;
  const reviewQueue = reviewQ.data ?? [];
  const recentImports = importsQ.data ?? [];
  const trend = trendQ.data ?? [];
  const distributions = distQ.data;

  // Check if any query is currently fetching (stale indicator)
  const isFetching =
    statsQ.isFetching ||
    reviewQ.isFetching ||
    importsQ.isFetching ||
    trendQ.isFetching ||
    distQ.isFetching;

  // ── Loading state ─────────────────────────────────────────────

  if (statsQ.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────

  if (statsQ.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل البيانات</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(statsQ.error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              statsQ.refetch();
              reviewQ.refetch();
              importsQ.refetch();
              trendQ.refetch();
              distQ.refetch();
            }}
          >
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Main view ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="بانتظار المراجعة"
          value={stats.pendingReview}
          icon={<ClipboardCheck className="h-5 w-5 text-rose-600" />}
          color="bg-rose-50 dark:bg-rose-950/30"
          href="/studio/review"
          subtitle={stats.pendingReview > 0 ? "بحاجة لانتباهك" : undefined}
        />
        <MetricCard
          label="قيد الإعداد"
          value={stats.inProgress}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          color="bg-amber-50 dark:bg-amber-950/30"
          href="/studio/library?status=draft"
        />
        <MetricCard
          label="منشور"
          value={stats.published}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-50 dark:bg-emerald-950/30"
          href="/studio/library?status=published"
          subtitle={
            stats.totalQuestions > 0
              ? `${Math.round((stats.published / stats.totalQuestions) * 100)}% من الإجمالي`
              : undefined
          }
        />
        <MetricCard
          label="استيرادات اليوم"
          value={stats.todayImports}
          icon={<Upload className="h-5 w-5 text-violet-600" />}
          color="bg-violet-50 dark:bg-violet-950/30"
          href="/studio/import"
        />
        <MetricCard
          label="جودة المحتوى"
          value={stats.avgQuality !== null ? Math.round(stats.avgQuality * 100) : 0}
          icon={<BookOpen className="h-5 w-5 text-cyan-600" />}
          color="bg-cyan-50 dark:bg-cyan-950/30"
          subtitle={
            stats.avgQuality !== null
              ? stats.avgQuality >= 0.8
                ? "ممتازة"
                : stats.avgQuality >= 0.5
                  ? "جيدة"
                  : "بحاجة تحسين"
              : "غير متاح"
          }
        />
      </div>

      {/* Middle row: Trend + Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Trend (sparkline) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-500" />
              نشاط آخر 7 أيام
            </CardTitle>
            <LiveIndicator isStale={!isFetching && trend.length === 0} />
          </CardHeader>
          <CardContent className="pt-0">
            {trend.length > 0 ? (
              <ActivityTrendChart data={trend} />
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                لا توجد بيانات نشاط للأيام السبعة الماضية
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distributions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              توزيع المحتوى
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {distributions?.statuses && distributions.statuses.length > 0 ? (
              <StatusDistributionBar statuses={distributions.statuses} />
            ) : (
              <div className="py-3 text-center text-xs text-muted-foreground">
                لا توجد بيانات
              </div>
            )}

            {distributions?.qualities && (
              <>
                <div className="border-t border-border/50 pt-3">
                  <h4 className="text-[10px] font-medium text-muted-foreground mb-2">
                    جودة المحتوى
                  </h4>
                  <QualityDistributionBlock qualities={distributions.qualities} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Review Queue + Recent Imports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Review Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-500" />
              قائمة المراجعة
            </CardTitle>
            <div className="flex items-center gap-2">
              {reviewQ.isFetching && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/studio/review" className="flex items-center gap-1">
                  عرض الكل
                  <ArrowLeft className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ReviewQueueWidget items={reviewQueue} />
          </CardContent>
        </Card>

        {/* Recent Imports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-500" />
              آخر الاستيرادات
            </CardTitle>
            <div className="flex items-center gap-2">
              {importsQ.isFetching && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/studio/import" className="flex items-center gap-1">
                  عرض الكل
                  <ArrowLeft className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentImportsWidget items={recentImports} />
          </CardContent>
        </Card>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
        <RefreshCw
          className={cn(
            "h-3 w-3",
            isFetching && "animate-spin text-primary"
          )}
        />
        <span>
          {isFetching
            ? "جاري التحديث..."
            : "يتحدث تلقائياً كل 30 ثانية"}
        </span>
      </div>
    </div>
  );
}
