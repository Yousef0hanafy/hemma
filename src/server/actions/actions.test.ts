import { describe, it, expect } from "vitest";
import { toQuestionDTO, toCategoryDTO, toSourceDTO } from "@/lib/content/dto";
import { normalizeQuestion } from "@/lib/content/normalize";
import { goalLabel, goalIcon } from "./learning-goals";

describe("Content Normalization & DTO Conversion Pipeline", () => {
  it("normalizes Arabic question set with valid options and correct answer key", () => {
    const rawQuestion = {
      id: 1,
      type: "تناظر لفظي",
      question: "شمس : نهار",
      options: { أ: "قمر : ليل", ب: "نجم : سماء", ج: "ماء : نهر", د: "شجر : غابة" },
      answer: "أ",
      citation: "[cite: 1, 2]",
    };

    const normalized = normalizeQuestion("test_set", rawQuestion);
    expect(normalized.stem).toBe("شمس : نهار");
    expect(normalized.correctKey).toBe("أ");
    expect(normalized.options).toHaveLength(4);
    expect(normalized.categorySlug).toBe("verbal_analogy");
  });

  it("converts raw category entity to CategoryDTO with question count", () => {
    const categoryEntity = {
      id: "cat_1",
      slug: "analogy",
      nameAr: "تناظر لفظي",
      descriptionAr: "العلاقة بين الكلمات",
      icon: "Scale",
      colorTheme: "amber",
      displayOrder: 1,
    };

    const dto = toCategoryDTO(categoryEntity, 42);
    expect(dto.id).toBe("cat_1");
    expect(dto.slug).toBe("analogy");
    expect(dto.questionCount).toBe(42);
  });

  it("converts raw question entity to QuestionDTO format", () => {
    const questionEntity = {
      id: "q_101",
      sourceId: "src_1",
      categoryId: "cat_1",
      passageId: null,
      sourceLocalId: 1,
      type: "تناظر لفظي",
      stem: "شمس : نهار",
      options: JSON.stringify([
        { key: "أ", text: "قمر : ليل" },
        { key: "ب", text: "نجم : سماء" },
      ]),
      correctKey: "أ",
      explanation: "الشرح",
      studyTip: "نصيحة",
      difficulty: "medium",
      tags: JSON.stringify(["تناظر", "سهل"]),
      citation: null,
      status: "published",
      aiProcessedAt: null,
      aiQualityScore: 0.9,
      metadata: "{}",
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: "cat_1",
        slug: "analogy",
        nameAr: "تناظر لفظي",
        descriptionAr: null,
        icon: null,
        colorTheme: "amber",
        displayOrder: 1,
      },
      source: {
        id: "src_1",
        slug: "set_1",
        title: "الملف الأول",
        date: "2026",
        importedAt: new Date(),
        questionCount: 1,
        metadata: "{}",
      },
      passage: null,
    };

    const dto = toQuestionDTO(questionEntity);
    expect(dto.id).toBe("q_101");
    expect(dto.stem).toBe("شمس : نهار");
    expect(dto.options).toHaveLength(2);
    expect(dto.options[0].key).toBe("أ");
    expect(dto.categorySlug).toBe("analogy");
  });

  it("returns human-readable Arabic labels and icons for goal types", async () => {
    expect(await goalLabel("attempts")).toBe("أسئلة محلولة");
    expect(await goalLabel("correct")).toBe("إجابات صحيحة");
    expect(await goalLabel("xp")).toBe("نقاط خبرة");

    expect(await goalIcon("attempts")).toBe("📝");
    expect(await goalIcon("correct")).toBe("✅");
    expect(await goalIcon("xp")).toBe("⭐");
  });
});
