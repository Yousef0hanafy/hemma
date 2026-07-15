"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CategoryEntity {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string | null;
  icon: string | null;
  colorTheme: string | null;
  displayOrder: number;
  questionCount: number;
}

// ---------------------------------------------------------------------------
// List categories with question counts
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<CategoryEntity[]> {
  await requireStudioAccess();

  const cats = await db.category.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const counts = await db.question.groupBy({
    by: ["categoryId"],
    _count: true,
  });

  const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));

  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    nameAr: c.nameAr,
    descriptionAr: c.descriptionAr,
    icon: c.icon,
    colorTheme: c.colorTheme,
    displayOrder: c.displayOrder,
    questionCount: countMap.get(c.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Update a category
// ---------------------------------------------------------------------------

export async function updateCategory(
  id: string,
  data: {
    nameAr?: string;
    descriptionAr?: string | null;
    icon?: string | null;
    colorTheme?: string | null;
  }
): Promise<CategoryEntity> {
  await requireStudioAccess();

  const updated = await db.category.update({
    where: { id },
    data: {
      ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
      ...(data.descriptionAr !== undefined && { descriptionAr: data.descriptionAr }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.colorTheme !== undefined && { colorTheme: data.colorTheme }),
    },
  });

  const count = await db.question.count({ where: { categoryId: id } });

  return {
    id: updated.id,
    slug: updated.slug,
    nameAr: updated.nameAr,
    descriptionAr: updated.descriptionAr,
    icon: updated.icon,
    colorTheme: updated.colorTheme,
    displayOrder: updated.displayOrder,
    questionCount: count,
  };
}

// ---------------------------------------------------------------------------
// Batch reorder categories
// ---------------------------------------------------------------------------

export async function reorderCategories(
  items: { id: string; displayOrder: number }[]
): Promise<{ success: boolean }> {
  await requireStudioAccess();

  await db.$transaction(
    items.map((item) =>
      db.category.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    )
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Add a new category
// ---------------------------------------------------------------------------

export async function createCategory(data: {
  nameAr: string;
  slug?: string;
  icon?: string;
  colorTheme?: string;
}): Promise<CategoryEntity> {
  await requireStudioAccess();

  const slug =
    data.slug ??
    data.nameAr
      .replace(/\s+/g, "_")
      .replace(/[^\w\u0600-\u06FF]/g, "")
      .toLowerCase()
      .slice(0, 50) || `cat_${Date.now()}`;

  // Get the max display order for new category
  const maxOrder = await db.category.aggregate({
    _max: { displayOrder: true },
  });

  const created = await db.category.create({
    data: {
      slug,
      nameAr: data.nameAr,
      icon: data.icon ?? null,
      colorTheme: data.colorTheme ?? "slate",
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
    },
  });

  return {
    id: created.id,
    slug: created.slug,
    nameAr: created.nameAr,
    descriptionAr: null,
    icon: created.icon,
    colorTheme: created.colorTheme,
    displayOrder: created.displayOrder,
    questionCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Delete a category (reassign questions to uncategorized first if needed)
// ---------------------------------------------------------------------------

export async function deleteCategory(id: string): Promise<{ success: boolean }> {
  await requireStudioAccess();

  // Find or create "uncategorized" fallback
  let uncategorized = await db.category.findUnique({
    where: { slug: "uncategorized" },
  });

  if (!uncategorized) {
    uncategorized = await db.category.create({
      data: {
        slug: "uncategorized",
        nameAr: "غير مصنف",
        displayOrder: 999,
      },
    });
  }

  // Reassign questions to uncategorized
  await db.question.updateMany({
    where: { categoryId: id },
    data: { categoryId: uncategorized.id },
  });

  // Delete the category
  await db.category.delete({ where: { id } });

  return { success: true };
}
