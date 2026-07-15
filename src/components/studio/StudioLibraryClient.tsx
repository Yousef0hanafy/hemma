"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Row,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { Fragment } from "react";
import Link from "next/link";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Tag,
  Eye,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toArabicDigits, DIFFICULTY_META, relativeTimeAr } from "@/lib/content/ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchLibraryQuestions,
  fetchLibraryMeta,
  bulkUpdateStatus,
  bulkUpdateCategory,
  bulkUpdateDifficulty,
  bulkDeleteQuestions,
} from "@/server/actions/studio-library";
import type {
  LibraryQuestionRow,
  LibraryFilter,
  LibraryMeta,
} from "@/server/actions/studio-library";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  review: { label: "مراجعة", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "معتمد", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  published: { label: "منشور", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  archived: { label: "مؤرشف", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

function statusBadge(status: string) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        meta.color
      )}
    >
      {meta.label}
    </span>
  );
}

function difficultyBadge(difficulty: string) {
  const meta = DIFFICULTY_META[difficulty];
  if (!meta) return <span>{difficulty}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        meta.className
      )}
    >
      {meta.labelAr}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bulk action modals
// ---------------------------------------------------------------------------

function BulkStatusDialog({
  open,
  onOpenChange,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  onConfirm: (status: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("published");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغيير حالة {toArabicDigits(selected.length)} سؤال</DialogTitle>
          <DialogDescription>
            سيتم تغيير حالة جميع الأسئلة المحددة إلى الحالة الجديدة
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="review">مراجعة</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="published">منشور</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={async () => {
              setLoading(true);
              await onConfirm(status);
              setLoading(false);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            {loading ? "جاري التطبيق..." : "تطبيق"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCategoryDialog({
  open,
  onOpenChange,
  selected,
  categories,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  categories: LibraryMeta["categories"];
  onConfirm: (slug: string) => Promise<void>;
}) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغيير التصنيف لـ {toArabicDigits(selected.length)} سؤال</DialogTitle>
          <DialogDescription>
            سيتم تغيير تصنيف جميع الأسئلة المحددة
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={slug} onValueChange={setSlug}>
            <SelectTrigger>
              <SelectValue placeholder="اختر التصنيف" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.nameAr} ({toArabicDigits(c.count)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={async () => {
              if (!slug) return;
              setLoading(true);
              await onConfirm(slug);
              setLoading(false);
              onOpenChange(false);
            }}
            disabled={loading || !slug}
          >
            {loading ? "جاري التطبيق..." : "تطبيق"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد الحذف</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="h-4 w-4" />
            أنت على وشك حذف {toArabicDigits(selected.length)} سؤال. هذا الإجراء لا يمكن التراجع عنه.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setLoading(true);
              await onConfirm();
              setLoading(false);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            {loading ? "جاري الحذف..." : "نعم، احذف الكل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Inline preview (expanded row)
// ---------------------------------------------------------------------------

function QuestionPreview({ row }: { row: LibraryQuestionRow }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-border/50 bg-muted/30 px-6 py-4"
    >
      <div className="max-w-3xl space-y-3">
        <p className="font-naskh text-base leading-relaxed">{row.stem}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>المصدر: {row.sourceTitle}</span>
          <span>الإجابة الصحيحة: {row.correctKey}</span>
          <span>
            {row.hasExplanation ? (
              <span className="text-emerald-600">✓ يوجد شرح</span>
            ) : (
              <span className="text-amber-600">✗ لا يوجد شرح</span>
            )}
          </span>
          <span>آخر تحديث: {relativeTimeAr(row.updatedAt.toISOString())}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Library Client
// ---------------------------------------------------------------------------

export function StudioLibraryClient() {
  // ── Filters ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // ── Pagination ───────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sourceLocalId", desc: false },
  ]);

  // ── Bulk selection ───────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkCategory, setShowBulkCategory] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // ── Expanded rows ────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────
  const filter: LibraryFilter = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      categorySlug: categoryFilter || undefined,
      sourceSlug: sourceFilter || undefined,
      difficulty: difficultyFilter || undefined,
      status: statusFilter || undefined,
      page,
      pageSize,
      sortField: sorting[0]?.id ?? "sourceLocalId",
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    }),
    [
      debouncedSearch,
      categoryFilter,
      sourceFilter,
      difficultyFilter,
      statusFilter,
      page,
      pageSize,
      sorting,
    ]
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["library", filter],
    queryFn: () => fetchLibraryQuestions(filter),
  });

  const { data: meta } = useQuery({
    queryKey: ["library-meta"],
    queryFn: fetchLibraryMeta,
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, sourceFilter, difficultyFilter, statusFilter]);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  // ── Columns ──────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<LibraryQuestionRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const allIds = table.getCoreRowModel().rows.map((r) => r.original.id);
          const allSelected = allIds.every((id) => selectedIds.has(id));
          return (
            <button
              onClick={() => {
                if (allSelected) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(allIds));
                }
              }}
              className="flex items-center justify-center"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => {
          const id = row.original.id;
          const checked = selectedIds.has(id);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = new Set(selectedIds);
                if (checked) next.delete(id);
                else next.add(id);
                setSelectedIds(next);
              }}
              className="flex items-center justify-center"
            >
              {checked ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        size: 40,
      },
      {
        id: "sourceLocalId",
        header: "#",
        accessorFn: (r) => r.sourceLocalId,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground text-xs">
            {toArabicDigits(getValue<number>())}
          </span>
        ),
        size: 50,
      },
      {
        id: "stem",
        header: "السؤال",
        accessorFn: (r) => r.stem,
        cell: ({ row }) => (
          <Link
            href={`/studio/questions/${row.original.id}`}
            className="text-sm leading-relaxed line-clamp-1 hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.stem}
          </Link>
        ),
        size: 300,
      },
      {
        id: "categoryNameAr",
        header: "التصنيف",
        accessorFn: (r) => r.categoryNameAr,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue<string>()}
          </span>
        ),
        size: 100,
      },
      {
        id: "difficulty",
        header: "الصعوبة",
        accessorFn: (r) => r.difficulty,
        cell: ({ getValue }) => difficultyBadge(getValue<string>()),
        size: 80,
      },
      {
        id: "status",
        header: "الحالة",
        accessorFn: (r) => r.status,
        cell: ({ getValue }) => statusBadge(getValue<string>()),
        size: 80,
      },
      {
        id: "sourceTitle",
        header: "المصدر",
        accessorFn: (r) => r.sourceTitle,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
            {getValue<string>()}
          </span>
        ),
        size: 120,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(
                    expandedId === row.original.id ? null : row.original.id
                  );
                }}
              >
                <Eye className="h-3.5 w-3.5 ml-2" />
                معاينة
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/studio/questions/${row.original.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Edit3 className="h-3.5 w-3.5 ml-2" />
                  تحرير
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set([row.original.id]));
                  setShowBulkDelete(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 ml-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 50,
      },
    ],
    [selectedIds, expandedId]
  );

  // ── Table ────────────────────────────────────────────────────
  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? -1,
  });

  // ── Refresh after bulk ops ───────────────────────────────────
  const refresh = useCallback(() => {
    refetch();
    setSelectedIds(new Set());
  }, [refetch]);

  // ── Render ───────────────────────────────────────────────────
  const activeFiltersCount = [categoryFilter, sourceFilter, difficultyFilter, statusFilter].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">مكتبة المحتوى</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تصفح وجدول وإدارة جميع الأسئلة في المنصة
        </p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في نص السؤال..."
            className="pr-10 h-10 rounded-xl text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-10 w-[120px] text-xs rounded-xl">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">الكل</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="review">مراجعة</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="published">منشور</SelectItem>
                <SelectItem value="archived">مؤرشف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Select value={difficultyFilter} onValueChange={(v) => setDifficultyFilter(v)}>
              <SelectTrigger className="h-10 w-[100px] text-xs rounded-xl">
                <SelectValue placeholder="الصعوبة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">الكل</SelectItem>
                <SelectItem value="easy">سهل</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="hard">صعب</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
              <SelectTrigger className="h-10 w-[130px] text-xs rounded-xl">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">الكل</SelectItem>
                {(meta?.categories ?? []).map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.nameAr} ({toArabicDigits(c.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v)}>
              <SelectTrigger className="h-10 w-[130px] text-xs rounded-xl">
                <SelectValue placeholder="المصدر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">الكل</SelectItem>
                {(meta?.sources ?? []).map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results summary + active filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {isLoading ? (
              "جاري التحميل..."
            ) : (
              <>
                {toArabicDigits(data?.total ?? 0)} نتيجة
                {selectedIds.size > 0 && (
                  <span className="mr-2 text-primary font-medium">
                    · {toArabicDigits(selectedIds.size)} محددة
                  </span>
                )}
              </>
            )}
          </span>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setCategoryFilter("");
                setSourceFilter("");
                setDifficultyFilter("");
                setStatusFilter("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              مسح التصفية
            </button>
          )}
        </div>

        {/* Page size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">عرض</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20"
          >
            <span className="text-sm font-medium text-primary ml-2">
              {toArabicDigits(selectedIds.size)} سؤال محدد:
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowBulkStatus(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
              تغيير الحالة
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowBulkCategory(true)}
            >
              <Tag className="h-3.5 w-3.5 ml-1" />
              تغيير التصنيف
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowBulkDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 ml-1 text-destructive" />
              حذف
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs mr-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              إلغاء التحديد
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/50 bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-right text-xs font-semibold text-muted-foreground",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                      )}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: <ChevronUp className="h-3 w-3" />,
                          desc: <ChevronDown className="h-3 w-3" />,
                        }[header.column.getIsSorted() as string] ?? (
                          header.column.getCanSort() && (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (data?.rows ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">
                        لا توجد نتائج للتصفية المحددة
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCategoryFilter("");
                          setSourceFilter("");
                          setDifficultyFilter("");
                          setStatusFilter("");
                          setSearch("");
                        }}
                      >
                        مسح الكل
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {table.getRowModel().rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          "border-b border-border/30 transition-colors hover:bg-muted/30 cursor-pointer",
                          expandedId === row.original.id && "bg-muted/40"
                        )}
                        onClick={() =>
                          setExpandedId(
                            expandedId === row.original.id
                              ? null
                              : row.original.id
                          )
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-3"
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                      {expandedId === row.original.id && (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="p-0"
                          >
                            <QuestionPreview row={row.original} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {data && data.totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
            <span className="text-xs text-muted-foreground tabular-nums">
              الصفحة {toArabicDigits(data.page)} من {toArabicDigits(data.totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                {toArabicDigits(data.page)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action modals */}
      <BulkStatusDialog
        open={showBulkStatus}
        onOpenChange={setShowBulkStatus}
        selected={Array.from(selectedIds)}
        onConfirm={async (status) => {
          await bulkUpdateStatus(Array.from(selectedIds), status);
          refresh();
        }}
      />
      {meta && (
        <BulkCategoryDialog
          open={showBulkCategory}
          onOpenChange={setShowBulkCategory}
          selected={Array.from(selectedIds)}
          categories={meta.categories}
          onConfirm={async (slug) => {
            await bulkUpdateCategory(Array.from(selectedIds), slug);
            refresh();
          }}
        />
      )}
      <BulkDeleteDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        selected={Array.from(selectedIds)}
        onConfirm={async () => {
          await bulkDeleteQuestions(Array.from(selectedIds));
          refresh();
        }}
      />
    </div>
  );
}


