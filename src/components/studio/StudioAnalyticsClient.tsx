"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import {
  Users,
  FileQuestion,
  Target,
  BarChart3,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toArabicDigits, formatPercent } from "@/lib/content/ui-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getAnalyticsOverview,
  getCategoryBreakdown,
  getDifficultyDistribution,
  getStatusDistribution,
  getQualityInsights,
  getNeedsAttention,
  getDailyActivity,
} from "@/server/actions/studio-analytics";

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------

const COLOR_HEX: Record<string, string> = {
  emerald: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
  violet: "#7c3aed",
  cyan: "#0891b2",
  slate: "#475569",
};

const DIFFICULTY_COLORS = ["#059669", "#d97706", "#e11d48"];
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  review: "#d97706",
  approved: "#059669",
  published: "#16a34a",
  archived: "#e11d48",
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground/70">{subtitle}</div>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums">{toArabicDigits(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Analytics Client
// ---------------------------------------------------------------------------

export function StudioAnalyticsClient() {
  const { data: overview } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: getAnalyticsOverview,
  });

  const { data: categoryBreakdown } = useQuery({
    queryKey: ["analytics-categories"],
    queryFn: getCategoryBreakdown,
  });

  const { data: difficultyDist } = useQuery({
    queryKey: ["analytics-difficulty"],
    queryFn: getDifficultyDistribution,
  });

  const { data: statusDist } = useQuery({
    queryKey: ["analytics-status"],
    queryFn: getStatusDistribution,
  });

  const { data: quality } = useQuery({
    queryKey: ["analytics-quality"],
    queryFn: getQualityInsights,
  });

  const { data: attention } = useQuery({
    queryKey: ["analytics-attention"],
    queryFn: () => getNeedsAttention(5),
  });

  const { data: dailyActivity } = useQuery({
    queryKey: ["analytics-daily"],
    queryFn: () => getDailyActivity(30),
  });

  const difficultyData = difficultyDist
    ? [
        { name: "سهل", value: difficultyDist.easy, fill: DIFFICULTY_COLORS[0] },
        { name: "متوسط", value: difficultyDist.medium, fill: DIFFICULTY_COLORS[1] },
        { name: "صعب", value: difficultyDist.hard, fill: DIFFICULTY_COLORS[2] },
      ]
    : [];

  const statusData = statusDist
    ? [
        { name: "مسودة", value: statusDist.draft, fill: STATUS_COLORS.draft },
        { name: "مراجعة", value: statusDist.review, fill: STATUS_COLORS.review },
        { name: "معتمد", value: statusDist.approved, fill: STATUS_COLORS.approved },
        { name: "منشور", value: statusDist.published, fill: STATUS_COLORS.published },
        { name: "مؤرشف", value: statusDist.archived, fill: STATUS_COLORS.archived },
      ]
    : [];

  const categoryChartData = categoryBreakdown?.map((c) => ({
    name: c.nameAr,
    count: c.count,
    fill: COLOR_HEX[c.color] ?? COLOR_HEX.slate,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">التحليلات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إحصائيات شاملة عن المحتوى والأداء في المنصة
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="الطلاب"
          value={toArabicDigits(overview?.totalStudents ?? 0)}
          icon={<Users className="h-5 w-5 text-violet-600" />}
          color="bg-violet-50 dark:bg-violet-950/30"
        />
        <StatCard
          label="الأسئلة"
          value={toArabicDigits(overview?.totalQuestions ?? 0)}
          icon={<FileQuestion className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-50 dark:bg-emerald-950/30"
          subtitle={`من ${toArabicDigits(overview?.totalSources ?? 0)} مصدر`}
        />
        <StatCard
          label="محاولات"
          value={toArabicDigits(overview?.totalAttempts ?? 0)}
          icon={<Target className="h-5 w-5 text-amber-600" />}
          color="bg-amber-50 dark:bg-amber-950/30"
        />
        <StatCard
          label="الدقة"
          value={overview?.avgAccuracy !== null ? formatPercent(overview!.avgAccuracy! * 100) : "—"}
          icon={<BarChart3 className="h-5 w-5 text-cyan-600" />}
          color="bg-cyan-50 dark:bg-cyan-950/30"
        />
        <StatCard
          label="جودة AI"
          value={overview?.avgQuality !== null ? `${Math.round(overview!.avgQuality! * 100)}%` : "—"}
          icon={<Sparkles className="h-5 w-5 text-rose-600" />}
          color="bg-rose-50 dark:bg-rose-950/30"
          subtitle={overview?.avgQuality !== null ? (overview.avgQuality >= 0.7 ? "ممتازة" : overview.avgQuality >= 0.4 ? "جيدة" : "بحاجة تحسين") : undefined}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">
              توزيع الأسئلة حسب التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {categoryChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                لا توجد بيانات
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => toArabicDigits(v)} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {categoryChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Difficulty distribution */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">
              توزيع الصعوبات
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex items-center justify-center">
            {difficultyData.every((d) => d.value === 0) ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                لا توجد بيانات
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width={240} height={200}>
                  <PieChart>
                    <Pie
                      data={difficultyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {difficultyData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 text-xs mt-2">
                  {difficultyData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span>{d.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {toArabicDigits(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">
              حالة المحتوى
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {statusData.every((d) => d.value === 0) ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                لا توجد بيانات
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => toArabicDigits(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily activity */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">
              النشاط اليومي (آخر ٣٠ يوم)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!dailyActivity || dailyActivity.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                لا توجد بيانات نشاط
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyActivity} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => toArabicDigits(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    name="محاولات"
                    stroke="#7c3aed"
                    fill="#7c3aed"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="correct"
                    name="صحيحة"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality insights + Needs attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality insights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              جودة المحتوى
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {quality ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">متوسط جودة AI</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {quality.avgQualityScore !== null
                      ? `${Math.round(quality.avgQualityScore * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">أسئلة بجودة منخفضة</span>
                  <span className="text-sm font-semibold tabular-nums text-rose-600">
                    {toArabicDigits(quality.lowQualityCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">أسئلة بدون شرح</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-600">
                    {toArabicDigits(quality.noExplanationCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm">أسئلة بدون محاولات</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-600">
                    {toArabicDigits(quality.lowAttemptCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">نسبة الأسئلة مع شرح</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPercent(quality.withExplanationPct)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">جاري التحميل...</div>
            )}
          </CardContent>
        </Card>

        {/* Needs attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              بحاجة للانتباه
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {!attention || attention.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">كل شيء على ما يرام</p>
                <p className="text-xs text-muted-foreground mt-1">
                  لا توجد عناصر تحتاج للانتباه
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {attention.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg p-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm line-clamp-1">{item.stem}...</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{item.categoryNameAr}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.reason}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

