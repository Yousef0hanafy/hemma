"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUsers,
  getUsersOverview,
  updateUserRole,
  deleteUser,
} from "@/server/actions/studio-users";
import type { UserListItem } from "@/server/actions/studio-users";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  Users,
  Search,
  Star,
  BookOpen,
  AlertTriangle,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  Target,
  MessageSquare,
  LogIn,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: "student", label: "طالب", color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300" },
  { value: "editor", label: "محرر", color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300" },
  { value: "reviewer", label: "مراجع", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
  { value: "admin", label: "مدير", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" },
];

const ROLE_MAP = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r])
);

function RoleBadge({ role }: { role: string }) {
  const info = ROLE_MAP[role];
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] font-medium px-2 py-0.5",
        info?.color ?? "bg-slate-50 text-slate-600 border-slate-200"
      )}
    >
      {info?.label ?? role}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "لم يسجل نشاطاً";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 5) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Role Select
// ---------------------------------------------------------------------------

function RoleSelect({
  userId,
  currentRole,
  onRoleChanged,
}: {
  userId: string;
  currentRole: string;
  onRoleChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (newRole: string) => {
    if (newRole === currentRole) return;
    setSaving(true);
    try {
      await updateUserRole(userId, newRole);
      toast.success("تم تحديث الدور بنجاح");
      onRoleChanged();
    } catch {
      toast.error("فشل تحديث الدور — قد لا تملك الصلاحية");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        defaultValue={currentRole}
        onValueChange={handleChange}
        disabled={saving}
      >
        <SelectTrigger className="h-7 w-[110px] text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              <span className="flex items-center gap-2">
                <span>{opt.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete User Dialog
// ---------------------------------------------------------------------------

function DeleteUserDialog({
  user,
  onDeleted,
}: {
  user: UserListItem;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      await deleteUser(user.id);
      toast.success(`تم حذف المستخدم "${user.name ?? user.email}"`);
      onDeleted(user.id);
      setOpen(false);
    } catch {
      toast.error("فشل حذف المستخدم — قد لا تملك الصلاحية");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف المستخدم</DialogTitle>
          <DialogDescription>
            هل أنت متأكد من حذف المستخدم &quot;{user.name ?? user.email}&quot;؟
            <br />
            <span className="text-rose-500 font-medium">
              سيتم حذف {user.totalAttempts} محاولة، {user.reviewsCount} مراجعة،
              وجميع البيانات المرتبطة بهذا المستخدم نهائياً.
            </span>
            <br />
            لا يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري الحذف...
              </>
            ) : (
              "حذف نهائي"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// User Detail Panel (expandable row)
// ---------------------------------------------------------------------------

function UserDetailPanel({ user }: { user: UserListItem }) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4 text-cyan-500" />}
          label="إجمالي المحاولات"
          value={user.totalAttempts.toLocaleString()}
        />
        <StatCard
          icon={<Target className="h-4 w-4 text-emerald-500" />}
          label="الدقة"
          value={user.accuracy !== null ? `${user.accuracy}%` : "—"}
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4 text-violet-500" />}
          label="المراجعات"
          value={user.reviewsCount.toLocaleString()}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4 text-amber-500" />}
          label="آخر نشاط"
          value={formatDate(user.lastActiveAt)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">البريد الإلكتروني</p>
          <p className="text-sm font-medium truncate" dir="ltr">
            {user.email ?? "—"}
          </p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">طريقة التسجيل</p>
          <p className="text-sm font-medium">
            {user.provider === "google"
              ? "Google"
              : user.provider ?? "—"}
          </p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">حالة البريد</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            {user.emailVerified ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>مؤكد</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span>غير مؤكد</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Row
// ---------------------------------------------------------------------------

function UserRow({
  user,
  expanded,
  onToggle,
  onDeleted,
}: {
  user: UserListItem;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const handleRoleChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["users-overview"] });
  };

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/50",
          expanded && "bg-muted/30 border-b-0"
        )}
        onClick={onToggle}
      >
        <TableCell className="w-[32%] py-3 text-right">
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground transition-transform duration-200 shrink-0">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            <Avatar className="h-8 w-8 border border-border/50 shrink-0">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="text-xs bg-muted">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate max-w-[180px]">
                {user.name ?? "بدون اسم"}
              </p>
              {user.email && (
                <p className="text-[11px] text-muted-foreground truncate max-w-[180px]" dir="ltr">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="w-[12%] py-3 text-right">
          <RoleBadge role={user.role} />
        </TableCell>
        <TableCell className="w-[18%] py-3 text-right">
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            <RoleSelect
              userId={user.id}
              currentRole={user.role}
              onRoleChanged={handleRoleChanged}
            />
          </div>
        </TableCell>
        <TableCell className="w-[14%] py-3 text-right">
          <div className="flex items-center gap-1.5 text-sm">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold tabular-nums">
              {user.totalAttempts}
            </span>
            {user.accuracy !== null && (
              <span
                className={cn(
                  "text-[11px]",
                  user.accuracy >= 70
                    ? "text-emerald-500"
                    : user.accuracy >= 40
                      ? "text-amber-500"
                      : "text-rose-500"
                )}
              >
                ({user.accuracy}%)
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="w-[14%] py-3 text-right">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LogIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span className="text-xs whitespace-nowrap">{formatDate(user.lastActiveAt)}</span>
          </div>
        </TableCell>
        <TableCell className="w-[10%] py-3 text-center">
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <DeleteUserDialog user={user} onDeleted={onDeleted} />
          </div>
        </TableCell>
      </TableRow>
      <AnimatePresence initial={false}>
        {expanded && (
          <TableRow>
            <TableCell colSpan={6} className="p-0 border-b">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/50">
                  <UserDetailPanel user={user} />
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export function StudioUsersClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const { data: overview } = useQuery({
    queryKey: ["users-overview"],
    queryFn: getUsersOverview,
  });

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  const filtered = users
    ? users.filter((u) => {
        const matchesSearch =
          !searchQuery.trim() ||
          (u.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email ?? "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole =
          roleFilter === "all" || u.role === roleFilter;

        return matchesSearch && matchesRole;
      })
    : [];

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleDeleted = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users-overview"] });
      if (expandedId === id) setExpandedId(null);
    },
    [queryClient, expandedId]
  );

  // ── Loading state ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg font-medium">حدث خطأ أثناء تحميل المستخدمين</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["users"] });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users?.length ?? 0} مستخدم مسجل — إدارة الأدوار والصلاحيات
          </p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-sky-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
              <p className="text-lg font-bold tabular-nums">
                {overview?.totalUsers ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">نشط اليوم</p>
              <p className="text-lg font-bold tabular-nums">
                {overview?.activeToday ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center shrink-0">
              <Star className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">نشط هذا الأسبوع</p>
              <p className="text-lg font-bold tabular-nums">
                {overview?.activeThisWeek ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الدقة الإجمالية</p>
              <p className="text-lg font-bold tabular-nums">
                {overview?.overallAccuracy !== null
                  ? `${overview?.overallAccuracy}%`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role filter buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={roleFilter === "all" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs rounded-lg"
          onClick={() => handleRoleFilterChange("all")}
        >
          الكل ({users?.length ?? 0})
        </Button>
        {ROLE_OPTIONS.map((r) => {
          const count = users?.filter((u) => u.role === r.value).length ?? 0;
          return (
            <Button
              key={r.value}
              variant={roleFilter === r.value ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs rounded-lg gap-1"
              onClick={() => handleRoleFilterChange(r.value)}
            >
              <span>{r.label}</span>
              <span className="opacity-70 font-bold">({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pr-10 h-10"
          dir="rtl"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-base font-medium mb-1">
              {searchQuery ? "لا توجد نتائج مطابقة للبحث" : "لا يوجد مستخدمون في هذا القسم"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery
                ? "جرب البحث بكلمة أو بريد إلكتروني آخر"
                : "المستخدمون يظهرون تلقائياً بعد تسجيل الدخول"}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[32%] text-right font-semibold">المستخدم</TableHead>
                  <TableHead className="w-[12%] text-right font-semibold">الدور الحالي</TableHead>
                  <TableHead className="w-[18%] text-right font-semibold">تعديل الدور</TableHead>
                  <TableHead className="w-[14%] text-right font-semibold">النشاط</TableHead>
                  <TableHead className="w-[14%] text-right font-semibold">آخر ظهور</TableHead>
                  <TableHead className="w-[10%] text-center font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    expanded={expandedId === user.id}
                    onToggle={() => handleToggle(user.id)}
                    onDeleted={handleDeleted}
                  />
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  عرض {(page - 1) * PAGE_SIZE + 1} إلى {Math.min(page * PAGE_SIZE, filtered.length)} من {filtered.length} مستخدم
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <span className="text-xs font-medium px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
