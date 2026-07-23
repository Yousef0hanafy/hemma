"use server";

import { getUserBucket } from "@/lib/auth-utils";
import { getGeminiClient, getAIModelName, isAIAvailable } from "@/server/ai/evaluator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuddyMessage {
  role: "user" | "assistant";
  content: string;
}

export type BuddyResult =
  | { ok: true; response: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `أنت مساعد تعليمي ذكي اسمه "همّة" لطالب يدرس اختبار القدرات اللفظية في المملكة العربية السعودية.

📚 **تخصصك:**
- التناظر اللفظي (Verbal Analogy)
- إكمال الجمل (Sentence Completion)
- الخطأ السياقي (Contextual Error)
- المفردة الشاذة (Odd Word Out)
- استيعاب المقروء (Reading Comprehension)

🎯 **مهمتك:**
- شرح المفاهيم والأسئلة بطريقة مبسطة
- تقديم أمثلة توضيحية
- تحليل إجابات الطالب وتصحيح الأخطاء
- تقديم نصائح دراسية وحلول ذكية
- تحفيز الطالب وتشجيعه

⭐ **تعليمات مهمة:**
- استخدم اللغة العربية الفصحى المبسطة والواضحة
- اشرح خطوة بخطوة عند تحليل سؤال
- قدّم أمثلة ملموسة من الحياة الواقعية
- كن مشجعاً ولطيفاً في ردودك
- إذا سألك الطالب عن معنى كلمة، اشرحها في سياق القدرات اللفظية
- لا تعطي الإجابة مباشرة — علّم الطالب كيف يفكر

الهدف: مساعدة الطالب على فهم المادة بعمق والاستعداد لاختبار القدرات بثقة.`;
}

// ---------------------------------------------------------------------------
// Send a message to the AI Study Buddy
// ---------------------------------------------------------------------------

export async function askStudyBuddy(
  history: BuddyMessage[],
  message: string
): Promise<BuddyResult> {
  try {
    await getUserBucket();
  } catch {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }

  const client = getGeminiClient();
  if (!client) {
    return {
      ok: false,
      error: "مساعد AI غير متاح حالياً. تأكد من ضبط مفتاح Google Gemini في الإعدادات.",
    };
  }

  if (!message.trim()) {
    return { ok: false, error: "الرجاء كتابة سؤال" };
  }

  const modelName = getAIModelName();

  try {
    const geminiModel = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const systemPrompt = buildSystemPrompt();

    // Build conversation history
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Add last 8 messages for context (avoids token limits)
    for (const msg of history.slice(-8)) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Add the new question with system context
    contents.push({
      role: "user",
      parts: [{ text: `[سياق المساعد]\n${systemPrompt}\n\n[سؤال الطالب]\n${message}` }],
    });

    const result = await geminiModel.generateContent({ contents });
    const text = result.response.text();

    if (!text) {
      return { ok: false, error: "لم يتم الحصول على رد. حاول مرة أخرى." };
    }

    return { ok: true, response: text };
  } catch (e) {
    console.error("[AI Study Buddy] Gemini error:", (e as Error).message);
    return { ok: false, error: "حدث خطأ في الاتصال. حاول مرة أخرى." };
  }
}
