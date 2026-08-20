"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { getGeminiClient, getAIModelName } from "@/server/ai/evaluator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuddyMessage {
  role: "user" | "assistant";
  content: string;
}

export type BuddyResult =
  | { ok: true; response: string; sessionId?: string }
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
  message: string,
  sessionId?: string
): Promise<BuddyResult> {
  let userId: string;
  try {
    userId = await getUserBucket();
  } catch {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }

  const client = getGeminiClient();
  if (!client) {
    return {
      ok: false,
      error: "مساعد AI غير متاح حالياً. تأكد من ضبط مفتاح OpenRouter في الإعدادات.",
    };
  }

  if (!message.trim()) {
    return { ok: false, error: "الرجاء كتابة سؤال" };
  }

  const modelName = getAIModelName();

  try {
    let activeSessionId = sessionId;
    let verifiedHistory: BuddyMessage[] = [];

    if (activeSessionId) {
      // Validate user owns this session and load verified messages
      const session = await db.chatSession.findUnique({
        where: { id: activeSessionId },
        select: { userId: true },
      });

      if (session && session.userId === userId) {
        const dbMsgs = await db.chatMessage.findMany({
          where: { sessionId: activeSessionId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { role: true, content: true },
        });
        verifiedHistory = dbMsgs.reverse().map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      }
    }

    // Fallback to sanitized client history if no session history
    if (verifiedHistory.length === 0 && history && history.length > 0) {
      for (const msg of history.slice(-8)) {
        if (msg && typeof msg.content === "string") {
          verifiedHistory.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content.slice(0, 2000),
          });
        }
      }
    }

    const systemPrompt = buildSystemPrompt();

    const geminiModel = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of verifiedHistory) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const result = await geminiModel.generateContent({ contents });
    const text = result.response.text();

    if (!text) {
      return { ok: false, error: "لم يتم الحصول على رد. حاول مرة أخرى." };
    }

    // Persist messages if a session is attached
    if (activeSessionId) {
      await db.chatMessage.createMany({
        data: [
          { sessionId: activeSessionId, role: "user", content: message },
          { sessionId: activeSessionId, role: "assistant", content: text },
        ],
      });
      await db.chatSession.update({
        where: { id: activeSessionId },
        data: { updatedAt: new Date() },
      });
    }

    return { ok: true, response: text, sessionId: activeSessionId };
  } catch (e) {
    console.error("[AI Study Buddy] OpenRouter error:", (e as Error).message);
    return { ok: false, error: "حدث خطأ في الاتصال. حاول مرة أخرى." };
  }
}
