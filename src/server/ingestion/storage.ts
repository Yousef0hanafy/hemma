// =====================================================================
// Source Storage Handler — Safe local filesystem storage for uploads
// =====================================================================

import fs from "fs/promises";
import path from "path";
import os from "os";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "text/plain": [".txt", ".md"],
  "application/json": [".json"],
};

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md", ".json"];

export interface StoredFileInfo {
  originalFilename: string;
  sanitizedFilename: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}

/**
 * Sanitizes a filename to prevent path traversal or special character exploits.
 */
export function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext)
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF\s-]/g, "")
    .trim()
    .slice(0, 80) || "source_document";
  return `${base}${ext}`;
}

/**
 * Verifies that the file meets size and extension criteria.
 */
export function validateUploadedFile(file: { name: string; size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  if (!file || !file.name) {
    return { valid: false, error: "لم يتم تقديم ملف صالح." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `حجم الملف يتجاوز الحد المسموح به (الحد الأقصى ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} ميجابايت).`,
    };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `امتداد الملف (${ext}) غير مدعوم. الصيغ المدعومة هي: PDF, DOCX, TXT, JSON.`,
    };
  }

  return { valid: true };
}

/**
 * Resolves the writable base directory for uploads.
 * Uses os.tmpdir() on Vercel / serverless environments where process.cwd() is read-only.
 */
export function getStorageBaseDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
    return path.join(os.tmpdir(), "hemma_uploads");
  }
  return path.join(process.cwd(), "uploads");
}

/**
 * Saves an uploaded file buffer to the storage directory.
 * Safely handles serverless / read-only filesystem environments.
 */
export async function storeSourceFile(
  fileBuffer: Buffer,
  originalFilename: string,
  slug: string,
  mimeType: string
): Promise<StoredFileInfo> {
  const sanitized = sanitizeFilename(originalFilename);
  const baseDir = getStorageBaseDir();
  const targetDir = path.join(baseDir, "sources", slug);
  const targetPath = path.join(targetDir, sanitized);

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, fileBuffer);
  } catch (fsErr) {
    // If mkdir/writeFile fails (e.g. read-only fs), fallback to os.tmpdir()
    try {
      const fallbackDir = path.join(os.tmpdir(), "sources", slug);
      await fs.mkdir(fallbackDir, { recursive: true });
      const fallbackPath = path.join(fallbackDir, sanitized);
      await fs.writeFile(fallbackPath, fileBuffer);
    } catch (fallbackErr) {
      console.warn("[Storage] Could not persist raw file to disk (continuing with in-memory buffer):", (fallbackErr as Error).message);
    }
  }

  const fileUrl = `/api/sources/download/${slug}/${encodeURIComponent(sanitized)}`;

  return {
    originalFilename,
    sanitizedFilename: sanitized,
    storagePath: targetPath,
    fileUrl,
    mimeType: mimeType || "application/octet-stream",
    fileSizeBytes: fileBuffer.length,
  };
}

/**
 * Reads a stored file buffer from disk.
 */
export async function readStoredSourceFile(storagePath: string): Promise<Buffer> {
  return await fs.readFile(storagePath);
}
