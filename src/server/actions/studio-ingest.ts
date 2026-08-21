"use server";

// =====================================================================
// Studio Ingest Server Actions — Unified Ingestion for PDF, DOCX, TXT, JSON
// =====================================================================

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { validateUploadedFile, storeSourceFile } from "@/server/ingestion/storage";
import { extractTextFromSource } from "@/server/ingestion/text-extractor";
import { processDocumentWithAI, persistIngestedSource } from "@/server/ingestion/ai-ingestion";
import { validateSource, normalizeQuestion } from "@/lib/content/normalize";
import { processSource } from "@/server/ai/service";
import path from "path";

export interface IngestResponse {
  ok: boolean;
  sourceId?: string;
  sourceSlug?: string;
  title?: string;
  insertedQuestions?: number;
  insertedPassages?: number;
  warnings?: string[];
  error?: string;
}

async function ensureDbColumns() {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "originalFilename" text;
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "fileUrl" text;
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "mimeType" text;
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "sourceType" text DEFAULT 'document';
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'review';
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "metadata" text DEFAULT '{}';
      ALTER TABLE sources ADD COLUMN IF NOT EXISTS "questionCount" integer DEFAULT 0;
    `);
  } catch (e) {
    console.warn("[StudioIngest] sources table schema check:", e);
  }

  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'published';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "metadata" text DEFAULT '{}';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "tags" text DEFAULT '[]';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "citation" text;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "explanation" text;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "studyTip" text;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS "passageId" text;
    `);
  } catch (e) {
    console.warn("[StudioIngest] questions table schema check:", e);
  }
}

async function safeCreateSource(data: {
  slug: string;
  title: string;
  date?: string | null;
  originalFilename?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  sourceType?: string;
  status?: string;
}) {
  await ensureDbColumns();
  try {
    return await db.source.create({
      data: {
        slug: data.slug,
        title: data.title,
        date: data.date ?? null,
        originalFilename: data.originalFilename ?? null,
        fileUrl: data.fileUrl ?? null,
        mimeType: data.mimeType ?? null,
        sourceType: data.sourceType ?? "document",
        status: data.status ?? "review",
      },
    });
  } catch (err) {
    console.warn("[StudioIngest] create source retry fallback:", err);
    return await db.source.create({
      data: {
        slug: data.slug,
        title: data.title,
        date: data.date ?? null,
      },
    });
  }
}

/**
 * Main ingestion action handling FormData file uploads.
 */
export async function ingestSourceDocument(formData: FormData): Promise<IngestResponse> {
  await requirePermission("import", "create");

  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { ok: false, error: "لم يتم استلام أي ملف." };
    }

    const validation = validateUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return { ok: false, error: validation.error || "الملف غير صالح." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const slug = `source_${Date.now()}`;
    const ext = path.extname(file.name).toLowerCase();

    // -----------------------------------------------------------------
    // 1. Backward Compatibility: Native JSON Handling
    // -----------------------------------------------------------------
    if (ext === ".json") {
      let jsonParsed: unknown;
      try {
        jsonParsed = JSON.parse(fileBuffer.toString("utf-8"));
      } catch {
        return { ok: false, error: "الملف لا يحتوي على JSON صالح." };
      }

      const jsonValidation = validateSource(jsonParsed);
      if (!jsonValidation.ok || !jsonValidation.data) {
        return {
          ok: false,
          error: `فشل التحقق من صحة ملف JSON:\n${jsonValidation.errors.join("\n")}`,
        };
      }

      const rawSource = jsonValidation.data;

      // Store file
      const stored = await storeSourceFile(fileBuffer, file.name, slug, file.type || "application/json");

      const sourceRecord = await safeCreateSource({
        slug,
        title: rawSource.document_title || file.name.replace(/\.json$/i, ""),
        date: rawSource.date ?? null,
        originalFilename: stored.originalFilename,
        fileUrl: stored.fileUrl,
        mimeType: stored.mimeType,
        sourceType: "legacy_json",
        status: "review",
      });

      let inserted = 0;
      const warnings: string[] = [];

      for (const rawQ of rawSource.questions) {
        try {
          const nq = normalizeQuestion(slug, rawQ);
          const cat = await db.category.upsert({
            where: { slug: nq.categorySlug },
            update: { nameAr: nq.categoryNameAr },
            create: { slug: nq.categorySlug, nameAr: nq.categoryNameAr },
          });

          await db.question.create({
            data: {
              sourceId: sourceRecord.id,
              categoryId: cat.id,
              sourceLocalId: nq.sourceLocalId,
              type: nq.rawType,
              stem: nq.stem,
              options: JSON.stringify(nq.options),
              correctKey: nq.correctKey,
              explanation: nq.explanation,
              studyTip: nq.studyTip,
              difficulty: nq.difficulty,
              tags: JSON.stringify(nq.tags),
              citation: nq.citation ?? null,
              metadata: JSON.stringify(nq.metadata),
              status: "review",
            },
          });
          inserted++;
        } catch (e) {
          warnings.push(`السؤال #${rawQ.id}: ${(e as Error).message}`);
        }
      }

      await db.source.update({
        where: { id: sourceRecord.id },
        data: { questionCount: inserted },
      }).catch(() => {});

      return {
        ok: true,
        sourceId: sourceRecord.id,
        sourceSlug: slug,
        title: sourceRecord.title,
        insertedQuestions: inserted,
        insertedPassages: 0,
        warnings,
      };
    }

    // -----------------------------------------------------------------
    // 2. Document Ingestion (PDF, DOCX, TXT, MD)
    // -----------------------------------------------------------------

    // Save physical file
    const stored = await storeSourceFile(
      fileBuffer,
      file.name,
      slug,
      file.type || "application/octet-stream"
    );

    // Create initial tracking record in DB
    const initialTitle = path.basename(file.name, ext).replace(/[-_]/g, " ");
    const sourceRecord = await safeCreateSource({
      slug,
      title: initialTitle,
      originalFilename: stored.originalFilename,
      fileUrl: stored.fileUrl,
      mimeType: stored.mimeType,
      sourceType: "document",
      status: "processing",
    });

    try {
      // Step A: Deterministic text extraction
      const extracted = await extractTextFromSource(fileBuffer, file.name, file.type);

      // Step B: AI Semantic understanding & question/passage extraction
      const aiResult = await processDocumentWithAI(extracted.text, file.name);

      // Step C: Atomic DB persistence
      const persistResult = await persistIngestedSource({
        sourceId: sourceRecord.id,
        ingested: aiResult,
      });

      // Optional: Kick off background quality check
      try {
        const autoSetting = await db.studioSetting.findUnique({
          where: { key: "auto_process_on_import" },
        });
        if (autoSetting?.value === "true") {
          processSource(sourceRecord.id).catch(() => {});
        }
      } catch {}

      return {
        ok: true,
        sourceId: sourceRecord.id,
        sourceSlug: slug,
        title: aiResult.documentTitle || initialTitle,
        insertedQuestions: persistResult.insertedQuestions,
        insertedPassages: persistResult.insertedPassages,
        warnings: persistResult.warnings,
      };
    } catch (processError) {
      // Mark source as failed if extraction or AI failed
      await db.source.update({
        where: { id: sourceRecord.id },
        data: {
          status: "failed",
          metadata: JSON.stringify({ error: (processError as Error).message }),
        },
      });

      return {
        ok: false,
        sourceId: sourceRecord.id,
        error: (processError as Error).message,
      };
    }
  } catch (error) {
    console.error("[Studio Ingest Action] Uncaught error:", error);
    return {
      ok: false,
      error: (error as Error).message || "حدث خطأ غير متوقع أثناء معالجة الملف.",
    };
  }
}

/**
 * Get current ingestion status for a source.
 */
export async function getSourceStatus(sourceId: string) {
  await requirePermission("import", "read");

  const source = await db.source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      sourceType: true,
      questionCount: true,
      importedAt: true,
      originalFilename: true,
      fileUrl: true,
      metadata: true,
    },
  });

  return source;
}
