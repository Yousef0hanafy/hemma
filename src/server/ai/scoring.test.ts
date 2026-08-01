// =====================================================================
// Unit Tests — AI Scoring Engine Heuristics
// =====================================================================

import { describe, it, expect } from "vitest";
import { scoreQuestion } from "./scoring";

describe("scoreQuestion", () => {
  it("returns high overall score for a complete, well-formed question", () => {
    const result = scoreQuestion({
      stem: "ما العلاقة المعنوية الدقيقة بين السيف والغماد؟",
      options: [
        { key: "أ", text: "مكانية وحماية" },
        { key: "ب", text: "سببية واقتران" },
        { key: "ج", text: "تدرج وزمان" },
        { key: "د", text: "تضاد وعكس" },
      ],
      correctKey: "أ",
      explanation: "الجواب الصحيح هو أ لأن الغماد هو الوعاء المكاني المحيط بالسيف لحمايته.",
      difficulty: "medium",
      tags: ["تناظر لفظي", "علاقة مكانية"],
    });

    expect(result.overall).toBeGreaterThanOrEqual(0.85);
    expect(result.issues).toHaveLength(0);
  });

  it("penalizes missing explanation", () => {
    const result = scoreQuestion({
      stem: "ما العلاقة المعنوية الدقيقة بين السيف والغماد؟",
      options: [
        { key: "أ", text: "مكانية وحماية" },
        { key: "ب", text: "سببية واقتران" },
      ],
      correctKey: "أ",
      explanation: "",
      difficulty: "medium",
    });

    const explDimension = result.dimensions.find((d) => d.name === "explanation");
    expect(explDimension?.score).toBe(0);
    expect(result.issues).toContain("الشرح مفقود");
  });

  it("penalizes invalid correctKey not in options", () => {
    const result = scoreQuestion({
      stem: "ما العلاقة بين النهار والليل؟",
      options: [
        { key: "أ", text: "تضاد" },
        { key: "ب", text: "ترادف" },
      ],
      correctKey: "ج", // Not in options
      explanation: "الجواب الصحيح هو أ.",
      difficulty: "easy",
    });

    expect(result.issues).toContain("مفتاح الإجابة الصحيحة غير موجود في الخيارات");
  });
});
