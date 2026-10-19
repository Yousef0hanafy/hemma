"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { failStuckSources } from "@/server/ingestion/stuck-sources";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ImportHistoryItem {
  id: string;
  title: string;
  slug: string;
  questionCount: number;
  importedAt: Date;
}

// ---------------------------------------------------------------------------
// Import history
// ---------------------------------------------------------------------------

export async function getImportHistory(): Promise<ImportHistoryItem[]> {
  await requirePermission("import", "read");
  await failStuckSources();

  const sources = await db.source.findMany({
    orderBy: { importedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      questionCount: true,
      importedAt: true,
    },
  });

  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    questionCount: s.questionCount,
    importedAt: s.importedAt,
  }));
}
