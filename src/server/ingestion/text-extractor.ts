// =====================================================================
// Deterministic Text Extractor — Supports PDF, DOCX, TXT, MD, JSON
// =====================================================================

import path from "path";

export interface ExtractedDocument {
  text: string;
  format: "pdf" | "docx" | "text" | "json" | "unknown";
  pageCount?: number;
  wordCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Normalizes extracted text by standardizing line breaks, trimming extra spaces,
 * and preserving Arabic characters and punctuation.
 */
export function normalizeExtractedText(raw: string): string {
  if (!raw) return "";

  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Replace null bytes or control characters except tabs/newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // Normalize excessive consecutive blank lines (max 2)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts raw text from a PDF buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount?: number }> {
  try {
    const pdfModule = await import("pdf-parse");
    if ("PDFParse" in pdfModule && typeof pdfModule.PDFParse === "function") {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const pageCount = textResult.pages?.length;
      await parser.destroy().catch(() => {});
      return {
        text: normalizeExtractedText(textResult.text),
        pageCount,
      };
    } else {
      const fn = (pdfModule as unknown as { default?: (buf: Buffer) => Promise<{ text: string; numpages?: number }> }).default || (pdfModule as unknown as (buf: Buffer) => Promise<{ text: string; numpages?: number }>);
      const data = await fn(buffer);
      return {
        text: normalizeExtractedText(data.text),
        pageCount: data.numpages,
      };
    }
  } catch (error) {
    console.error("[TextExtractor] PDF extraction error:", (error as Error).message);
    throw new Error(`تعذر استخراج النص من ملف PDF: ${(error as Error).message}`);
  }
}

/**
 * Extracts raw text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string }> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: normalizeExtractedText(result.value),
    };
  } catch (error) {
    console.error("[TextExtractor] DOCX extraction error:", (error as Error).message);
    throw new Error(`تعذر استخراج النص من ملف Word (DOCX): ${(error as Error).message}`);
  }
}

/**
 * Extracts text from plain text or markdown buffer.
 */
export function extractTextFromPlainText(buffer: Buffer): { text: string } {
  const text = buffer.toString("utf-8");
  return {
    text: normalizeExtractedText(text),
  };
}

/**
 * Main unified extraction dispatcher.
 */
export async function extractTextFromSource(
  fileBuffer: Buffer,
  filename: string,
  _mimeType?: string
): Promise<ExtractedDocument> {
  const ext = path.extname(filename).toLowerCase();

  let extractedText = "";
  let pageCount: number | undefined;
  let format: ExtractedDocument["format"] = "unknown";

  if (ext === ".pdf") {
    format = "pdf";
    const res = await extractTextFromPdf(fileBuffer);
    extractedText = res.text;
    pageCount = res.pageCount;
  } else if (ext === ".docx" || ext === ".doc") {
    format = "docx";
    const res = await extractTextFromDocx(fileBuffer);
    extractedText = res.text;
  } else if (ext === ".json") {
    format = "json";
    const raw = fileBuffer.toString("utf-8");
    extractedText = raw;
  } else if (ext === ".txt" || ext === ".md") {
    format = "text";
    const res = extractTextFromPlainText(fileBuffer);
    extractedText = res.text;
  } else {
    // Fallback: try plain text
    format = "text";
    const res = extractTextFromPlainText(fileBuffer);
    extractedText = res.text;
  }

  const words = extractedText.split(/\s+/).filter(Boolean);

  if (words.length < 5 && format !== "json") {
    throw new Error("الملف لا يحتوي على نص كافٍ للمعالجة (قد يكون ملفاً فارغاً أو مستند صور ممسوح ضوئياً يتطلب OCR).");
  }

  return {
    text: extractedText,
    format,
    pageCount,
    wordCount: words.length,
  };
}
