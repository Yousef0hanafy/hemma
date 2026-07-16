"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";
import {
  getGeminiClient,
  getAIModelName,
  isAIAvailable,
} from "@/server/ai/evaluator";

// ---------------------------------------------------------------------------
// System prompt cache — refresh every 60s
// ---------------------------------------------------------------------------

let cachedSystemPrompt: string | null = null;
let systemPromptFetchedAt = 0;
const SYSTEM_PROMPT_TTL = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Build system prompt with current question bank context (cached 60s)
// ---------------------------------------------------------------------------

export async function buildSystemPrompt(): Promise<string> {
  const now = Date.now();
  if (cachedSystemPrompt && now - systemPromptFetchedAt < SYSTEM_PROMPT_TTL) {
    return cachedSystemPrompt;
  }

  const [totalQuestions, totalSources, totalCategories, statusGroups, sources, recentImports] =
    await Promise.all([
      db.question.count(),
      db.source.count(),
      db.category.count(),
      db.question.groupBy({ by: ["status"], _count: true }),
      db.source.findMany({ orderBy: { importedAt: "desc" }, take: 5, select: { title: true, questionCount: true } }),
      db.source.count({ where: { importedAt: { gte: new Date(Date.now() - 86400000 * 7) } } }),
    ]);

  const statusSummary = statusGroups.map((g) => `${g.status}: ${g._count}`).join(", ");

  cachedSystemPrompt = `أنت مساعد خبير في تحليل المحتوى التعليمي وإدارة جودة الأسئلة.
تعمل ضمن منصة "همة" التعليمية التي تحتوي على بنك أسئلة متعدد الاختيارات باللغة العربية.

📊 **إحصائيات المنصة حالياً:**
- إجمالي الأسئلة: ${totalQuestions}
- عدد المصادر: ${totalSources}
- عدد التصنيفات: ${totalCategories}
- توزيع الحالات: ${statusSummary || "لا توجد بيانات"}
- آخر ٧ أيام: ${recentImports} استيرادات جديدة
- آخر ٥ مصادر: ${sources.map((s) => `${s.title} (${s.questionCount} سؤال)`).join("، ") || "لا توجد"}

🎯 **ما يمكنك فعله:**
1. تحليل جودة أسئلة معينة بناءً على نصها وخياراتها
2. اقتراح تحسينات للأسئلة والشرح
3. تقديم نصائح تعليمية وتقويمية
4. تحليل توزيع الأسئلة على التصنيفات والمستويات
5. مساعدة في صياغة أسئلة جديدة

⭐ **تعليمات مهمة:**
- استخدم اللغة العربية الفصحى المبسطة
- كن دقيقاً وموضوعياً في تحليلك
- قدم أمثلة ملموسة عند الاقتراح
- إذا سألك المستخدم عن سؤال معين، اطلب نصه لتحليله
- اسأل عن تفاصيل إضافية عند الحاجة

الهدف النهائي: مساعدة فريق المحتوى في رفع جودة الأسئلة التعليمية.`;
  systemPromptFetchedAt = now;
  return cachedSystemPrompt;
}

// ---------------------------------------------------------------------------
// Chat history type
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Send a chat message to Gemini
// ---------------------------------------------------------------------------

export async function sendChatMessage(
  history: ChatMessage[],
  message: string
): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
  await requireStudioAccess();

  const client = getGeminiClient();
  if (!client) {
    return { ok: false, error: "لم يتم إعداد مفتاح Google Gemini. تأكد من ضبط GOOGLE_API_KEY في المتغيرات البيئية." };
  }

  if (!message.trim()) {
    return { ok: false, error: "الرجاء كتابة رسالة" };
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

    const systemPrompt = await buildSystemPrompt();

    // Build conversation history for Gemini
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Add previous messages as context
    for (const msg of history.slice(-10)) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Add the new message
    contents.push({
      role: "user",
      parts: [{ text: `[السياق]\n${systemPrompt}\n\n[سؤال المستخدم]\n${message}` }],
    });

    const result = await geminiModel.generateContent({ contents });
    const response = result.response;
    const text = response.text();

    if (!text) {
      return { ok: false, error: "لم يتم الحصول على رد من Gemini" };
    }

    return { ok: true, response: text };
  } catch (e) {
    console.error("[Chat] Gemini error:", (e as Error).message);
    return { ok: false, error: `خطأ في الاتصال بـ Gemini: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Session persistence — save & load chat sessions
// ---------------------------------------------------------------------------

/// Get all sessions for the current user (title + timestamp only, no messages)
export async function getChatSessions(): Promise<
  Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>
> {
  const userId = await requireStudioAccess();

  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
  }));
}

/// Create a new chat session
export async function createChatSession(): Promise<{ id: string }> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.create({
    data: { userId },
  });

  return { id: session.id };
}

/// Load a session with all its messages (ordered by creation time)
export async function getChatSession(id: string): Promise<{
  id: string;
  title: string;
  messages: ChatMessage[];
} | null> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session || session.userId !== userId) return null;

  return {
    id: session.id,
    title: session.title,
    messages: session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  };
}

/// Delete a session and all its messages
export async function deleteChatSession(id: string): Promise<void> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  await db.chatSession.delete({ where: { id } });
}

/// Save a message to a session (user must own the session)
export async function saveChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const userId = await requireStudioAccess();

  // Verify ownership
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  await db.chatMessage.create({
    data: { sessionId, role, content },
  });

  // Touch updatedAt so session appears at top of list
  await db.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

/// Auto-generate title from first user message
async function autoTitle(text: string): Promise<string> {
  const cleaned = text.replace(/[\n\r]+/g, " ").slice(0, 50);
  if (cleaned.length <= 3) return "محادثة جديدة";
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

export async function updateChatSessionTitle(
  sessionId: string,
  firstMessage: string
): Promise<void> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  const title = await autoTitle(firstMessage);
  await db.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}

// ---------------------------------------------------------------------------
// Suggestion chips for the chat UI
// ---------------------------------------------------------------------------

export interface Suggestion {
  label: string;
  prompt: string;
}

export async function getSuggestions(): Suggestion[] {
  return [
    {
      label: "تحليل حالة الأسئلة",
      prompt: "حلل توزيع الأسئلة في المنصة وما الذي يمكن تحسينه؟",
    },
    {
      label: "كيف أحسن الشرح؟",
      prompt: "قدم نصائح لكتابة شروحات تعليمية أفضل للأسئلة",
    },
    {
      label: "معايير الجودة",
      prompt: "ما هي معايير جودة الأسئلة التعليمية التي يجب أن نتبعها؟",
    },
    {
      label: "تحليل سؤال",
      prompt: "أريد تحليل سؤال محدد. سأكتب نص السؤال والخيارات",
    },
  ];
}
