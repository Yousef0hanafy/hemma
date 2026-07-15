"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Palette,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCategories,
  updateCategory,
  reorderCategories,
  createCategory,
  deleteCategory,
} from "@/server/actions/studio-categories";
import type { CategoryEntity } from "@/server/actions/studio-categories";

// ---------------------------------------------------------------------------
// Available colors
// ---------------------------------------------------------------------------

const COLORS = [
  { value: "emerald", label: "زمردي", bg: "bg-emerald-100 dark:bg-emerald-900/40", dot: "bg-emerald-500" },
  { value: "amber", label: "عنبر", bg: "bg-amber-100 dark:bg-amber-900/40", dot: "bg-amber-500" },
  { value: "rose", label: "وردي", bg: "bg-rose-100 dark:bg-rose-900/40", dot: "bg-rose-500" },
  { value: "violet", label: "بنفسجي", bg: "bg-violet-100 dark:bg-violet-900/40", dot: "bg-violet-500" },
  { value: "cyan", label: "سماوي", bg: "bg-cyan-100 dark:bg-cyan-900/40", dot: "bg-cyan-500" },
  { value: "slate", label: "رمادي", bg: "bg-slate-100 dark:bg-slate-800/40", dot: "bg-slate-500" },
  { value: "orange", label: "برتقالي", bg: "bg-orange-100 dark:bg-orange-900/40", dot: "bg-orange-500" },
  { value: "blue", label: "أزرق", bg: "bg-blue-100 dark:bg-blue-900/40", dot: "bg-blue-500" },
];

// Available icons (emojis)
const ICONS = [
  "🧮", "📖", "🔬", "🧠", "💡", "📝", "🎯", "⚡",
  "🌍", "🔢", "✏️", "📊", "🎨", "🔤", "📐", "🧪",
];

// ---------------------------------------------------------------------------
// Sortable Category Card
// ---------------------------------------------------------------------------

function SortableCategoryCard({
  category,
  onRename,
  onColorChange,
  onIconChange,
  onDelete,
}: {
  category: CategoryEntity;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onIconChange: (id: string, icon: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(category.nameAr);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorMeta = COLORS.find((c) => c.value === category.colorTheme);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-all",
        isDragging && "shadow-lg border-primary/30 z-10 opacity-90",
        !isDragging && "hover:border-primary/30"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted cursor-grab active:cursor-grabbing shrink-0"
        aria-label="سحب لإعادة الترتيب"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Color indicator */}
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center text-lg shrink-0",
          colorMeta?.bg ?? "bg-slate-100 dark:bg-slate-800/40"
        )}
      >
        {category.icon ?? "📁"}
      </div>

      {/* Name (editable) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) {
                onRename(category.id, newName.trim());
                setEditing(false);
              }
            }}
            className="flex items-center gap-1"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm rounded-lg"
              autoFocus
              onBlur={() => {
                if (newName.trim()) {
                  onRename(category.id, newName.trim());
                }
                setEditing(false);
              }}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-sm font-medium truncate">
              {category.nameAr}
            </span>
            <button
              onClick={() => {
                setNewName(category.nameAr);
                setEditing(true);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span className="tabular-nums">{toArabicDigits(category.questionCount)} سؤال</span>
          {category.slug && <span className="opacity-50">{category.slug}</span>}
        </div>
      </div>

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted"
          aria-label="تغيير اللون"
        >
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <AnimatePresence>
          {showColorPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute left-0 bottom-full mb-2 z-20 grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"
            >
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    onColorChange(category.id, c.value);
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    "h-7 w-7 rounded-lg transition-transform hover:scale-110",
                    c.bg,
                    category.colorTheme === c.value && "ring-2 ring-primary"
                  )}
                  title={c.label}
                >
                  <div className={cn("h-3 w-3 rounded-full mx-auto", c.dot)} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Icon picker */}
      <div className="relative">
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted"
          aria-label="تغيير الأيقونة"
        >
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <AnimatePresence>
          {showIconPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute left-0 bottom-full mb-2 z-20 grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"
            >
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => {
                    onIconChange(category.id, icon);
                    setShowIconPicker(false);
                  }}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-lg text-base hover:bg-muted transition-transform hover:scale-110",
                    category.icon === icon && "ring-2 ring-primary bg-muted"
                  )}
                >
                  {icon}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete */}
      {category.questionCount === 0 && (
        <button
          onClick={() => onDelete(category.id)}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-600"
          aria-label="حذف"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Categories Client
// ---------------------------------------------------------------------------

export function StudioCategoriesClient() {
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📁");
  const [newColor, setNewColor] = useState("slate");

  // Queries
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // Mutations
  const renameMutation = useMutation({
    mutationFn: ({ id, nameAr }: { id: string; nameAr: string }) =>
      updateCategory(id, { nameAr }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const colorMutation = useMutation({
    mutationFn: ({ id, colorTheme }: { id: string; colorTheme: string }) =>
      updateCategory(id, { colorTheme }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const iconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string }) =>
      updateCategory(id, { icon }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; displayOrder: number }[]) =>
      reorderCategories(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { nameAr: string; icon?: string; colorTheme?: string }) =>
      createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowNewDialog(false);
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  // ── DnD sensors ───────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !categories) return;

      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(categories, oldIndex, newIndex);
      const updates = reordered.map((c, i) => ({
        id: c.id,
        displayOrder: (i + 1) * 10,
      }));

      reorderMutation.mutate(updates);
    },
    [categories, reorderMutation]
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التصنيفات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة وتنظيم التصنيفات — اسحب لإعادة الترتيب
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 ml-1" />
          إضافة تصنيف
        </Button>
      </div>

      {/* Categories list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium">لا توجد تصنيفات بعد</p>
          <p className="text-xs text-muted-foreground mt-1">
            أضف تصنيفاً جديداً للبدء
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map((cat) => (
                <SortableCategoryCard
                  key={cat.id}
                  category={cat}
                  onRename={(id, name) => renameMutation.mutate({ id, nameAr: name })}
                  onColorChange={(id, color) => colorMutation.mutate({ id, colorTheme: color })}
                  onIconChange={(id, icon) => iconMutation.mutate({ id, icon })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Category Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تصنيف جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                الاسم
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: تفاضل وتكامل"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                الأيقونة
              </label>
              <div className="grid grid-cols-8 gap-1">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={cn(
                      "h-9 flex items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors",
                      newIcon === icon && "ring-2 ring-primary bg-muted"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                اللون
              </label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-transform hover:scale-110",
                      c.bg,
                      newColor === c.value && "ring-2 ring-primary"
                    )}
                    title={c.label}
                  >
                    <div className={cn("h-3 w-3 rounded-full mx-auto", c.dot)} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createMutation.mutate({
                nameAr: newName,
                icon: newIcon,
                colorTheme: newColor,
              })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
