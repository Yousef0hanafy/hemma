import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
} from "./storage";
import {
  normalizeExtractedText,
  extractTextFromPlainText,
} from "./text-extractor";
import {
  IngestedResultSchema,
  IngestedQuestionSchema,
} from "./ai-ingestion";

describe("Source Storage & Validation", () => {
  it("should sanitize filenames with Arabic and special characters safely", () => {
    const raw = "مذكرة_اختبار@2025 #1!.pdf";
    const sanitized = sanitizeFilename(raw);
    expect(sanitized).toBe("مذكرة_اختبار2025 1.pdf");
    expect(sanitized.endsWith(".pdf")).toBe(true);
  });

  it("should validate supported file extensions", () => {
    expect(
      validateUploadedFile({ name: "quiz.pdf", size: 1024, type: "application/pdf" }).valid
    ).toBe(true);
    expect(
      validateUploadedFile({ name: "notes.docx", size: 1024, type: "application/vnd.docx" }).valid
    ).toBe(true);
    expect(
      validateUploadedFile({ name: "data.json", size: 1024, type: "application/json" }).valid
    ).toBe(true);
    expect(
      validateUploadedFile({ name: "script.exe", size: 1024, type: "application/x-msdownload" }).valid
    ).toBe(false);
  });

  it("should reject files that exceed maximum allowed size", () => {
    const tooLarge = validateUploadedFile({
      name: "huge.pdf",
      size: MAX_FILE_SIZE_BYTES + 500,
      type: "application/pdf",
    });
    expect(tooLarge.valid).toBe(false);
    expect(tooLarge.error).toContain("الحد الأقصى");
  });
});

describe("Deterministic Text Extractor", () => {
  it("should normalize linebreaks and whitespace correctly", () => {
    const messy = "  نص تجريبي \r\n\r\n\r\n\r\n سطر ثاني   ";
    const cleaned = normalizeExtractedText(messy);
    expect(cleaned).toBe("نص تجريبي\n\nسطر ثاني");
  });

  it("should extract text from plain text buffers", () => {
    const buffer = Buffer.from("محتوى تجريبي باللغة العربية", "utf-8");
    const extracted = extractTextFromPlainText(buffer);
    expect(extracted.text).toBe("محتوى تجريبي باللغة العربية");
  });
});

describe("AI Ingestion Zod Schemas", () => {
  it("should validate valid AI question output", () => {
    const sampleQuestion = {
      stem: "ما عاصمة المملكة العربية السعودية؟",
      options: [
        { key: "أ", text: "الرياض" },
        { key: "ب", text: "جدة" },
        { key: "ج", text: "الدمام" },
        { key: "د", text: "مكة" },
      ],
      correctKey: "أ",
      explanation: "الرياض هي العاصمة الرسمية للمملكة.",
      difficulty: "easy",
      categoryNameAr: "معلومات عامة",
    };

    const parsed = IngestedQuestionSchema.safeParse(sampleQuestion);
    expect(parsed.success).toBe(true);
  });

  it("should reject AI questions with fewer than 2 options", () => {
    const invalidQuestion = {
      stem: "سؤال غير مكتمل",
      options: [{ key: "أ", text: "خيار وحيد" }],
      correctKey: "أ",
      categoryNameAr: "تناظر",
    };

    const parsed = IngestedQuestionSchema.safeParse(invalidQuestion);
    expect(parsed.success).toBe(false);
  });

  it("should validate full IngestedResult payload", () => {
    const fullResult = {
      documentTitle: "تجميعات القدرات 1446",
      documentType: "exam_questions",
      confidence: 0.95,
      passages: [
        {
          titleAr: "قطعة التجارة الإلكترونية",
          bodyAr: "شهدت التجارة الإلكترونية نمواً متسارعاً في العقد الأخير...",
        },
      ],
      questions: [
        {
          stem: "من النص، ما سبب نمو التجارة الإلكترونية؟",
          options: [
            { key: "أ", text: "تطور التقنية والاتصالات" },
            { key: "ب", text: "ارتفاع تكاليف الشحن" },
          ],
          correctKey: "أ",
          difficulty: "medium",
          categoryNameAr: "استيعاب المقروء",
          passageIndex: 0,
        },
      ],
    };

    const parsed = IngestedResultSchema.safeParse(fullResult);
    expect(parsed.success).toBe(true);
  });
});
