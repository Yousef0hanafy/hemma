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
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `منذ ${days} أيام`;
  return d.toLocaleDateString("ar-SA");
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
        <TableCell className="py-2.5">
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground transition-transform duration-200">
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
        <TableCell className="py-2.5">
          <RoleBadge role={user.role} />
        </TableCell>
        <TableCell className="py-2.5">
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
        <TableCell className="py-2.5">
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
        <TableCell className="py-2.5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{formatDate(user.lastActiveAt)}</span>
          </div>
        </TableCell>
        <TableCell className="py-2.5 text-left">
          <div
            className="flex items-center justify-end gap-0.5"
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

export function StudioUsersClient() {
  const [searchQuery, setSearchQuery] = useState("");
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

  const filtered = users
    ? searchQuery.trim()
      ? users.filter(
          (u) =>
            (u.name ?? "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            (u.email ?? "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
        )
      : users
    : [];

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

  // ── Empty state ───────────────────────────────────────────────

  if (!filtered.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">المستخدمين</h1>
            <p className="text-muted-foreground text-sm mt-1">
              إدارة المستخدمين والصلاحيات
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium mb-1">
              {searchQuery ? "لا توجد نتائج للبحث" : "لا يوجد مستخدمين بعد"}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? "حاول تغيير كلمة البحث"
                : "المستخدمون يظهرون تلقائياً بعد تسجيل الدخول عبر Google"}
            </p>
          </CardContent>
        </Card>
      </div>
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
            {users?.length ?? 0} مستخدم — إدارة الأدوار والصلاحيات
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

      {/* Role distribution mini badges */}
      {overview && overview.byRole.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">توزيع الأدوار:</span>
          {overview.byRole.map((r) => (
            <Badge
              key={r.role}
              variant="outline"
              className={cn(
                "text-[11px] font-medium gap-1",
                ROLE_MAP[r.role]?.color ?? ""
              )}
            >
              {ROLE_MAP[r.role]?.label ?? r.role}
              <span className="font-bold">{r.count}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث في المستخدمين..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-10"
          dir="rtl"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">المستخدم</TableHead>
              <TableHead className="w-[10%]">الدور</TableHead>
              <TableHead className="w-[18%]">تغيير الدور</TableHead>
              <TableHead className="w-[15%]">النشاط</TableHead>
              <TableHead className="w-[15%]">آخر ظهور</TableHead>
              <TableHead className="w-[14%] text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
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
      </Card>
    </div>
  );
}
