// =====================================================================
// AI Study Buddy — Streaming API Route
// Uses Gemini generateContentStream to stream responses token-by-token
// Messages are persisted to the database via ChatSession + ChatMessage
// =====================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGeminiClient, getAIModelName } from "@/server/ai/evaluator";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface BuddyMessage {
  role: "user" | "assistant";
  content: string;
}

// -------------------------------------------------------------------
// System prompt
// -------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `أنت مساعد تعليمي ذكي اسمه \"همّة\" لطالب يدرس اختبار القدرات اللفظية في المملكة العربية السعودية.

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

// -------------------------------------------------------------------
// GET — load a session's messages (for restoring on page refresh)
// -------------------------------------------------------------------

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "يجب تسجيل الدخول أولاً" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "معرّف الجلسة مطلوب" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const chatSession = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chatSession || chatSession.userId !== userId) {
    return new Response(
      JSON.stringify({ error: "الجلسة غير موجودة" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  return Response.json({
    session: { id: chatSession.id, title: chatSession.title },
    messages: chatSession.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/** Trim message to a short session title */
function autoTitle(text: string): string {
  const cleaned = text.replace(/[\n\r]+/g, " ").slice(0, 50);
  if (cleaned.length <= 3) return "محادثة جديدة";
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

// -------------------------------------------------------------------
// POST — stream AI response + persist messages
// -------------------------------------------------------------------

export async function POST(request: Request) {
  // ── Authenticate ─────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "يجب تسجيل الدخول أولاً" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const userId = session.user.id;

  // ── Parse request ─────────────────────────────────────────────
  let body: {
    history?: BuddyMessage[];
    message?: string;
    sessionId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "طلب غير صالح" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { history = [], message, sessionId: incomingSessionId } = body;

  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "الرجاء كتابة سؤال" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Check AI availability ──────────────────────────────────────
  const client = getGeminiClient();
  if (!client) {
    return new Response(
      JSON.stringify({
        error:
          "مساعد AI غير متاح حالياً. تأكد من ضبط مفتاح Google Gemini في الإعدادات.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Session management ─────────────────────────────────────────
  let activeSessionId: string;
  let isNewSession = false;

  if (incomingSessionId) {
    // Verify the session exists and belongs to this user
    const existingSession = await db.chatSession.findUnique({
      where: { id: incomingSessionId },
      select: { userId: true },
    });
    if (!existingSession || existingSession.userId !== userId) {
      return new Response(
        JSON.stringify({ error: "الجلسة غير موجودة أو غير مصرح بها" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    activeSessionId = incomingSessionId;
  } else {
    // Create a new session
    const newSession = await db.chatSession.create({
      data: { userId, title: autoTitle(message) },
    });
    activeSessionId = newSession.id;
    isNewSession = true;
  }

  // ── Save user message ──────────────────────────────────────────
  await db.chatMessage.create({
    data: {
      sessionId: activeSessionId,
      role: "user",
      content: message,
    },
  });

  // ── Build Gemini request ────────────────────────────────────────
  const modelName = getAIModelName();
  const systemPrompt = buildSystemPrompt();

  const geminiModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  // Add last 8 messages for context
  for (const msg of history.slice(-8)) {
    contents.push({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    });
  }

  // Add the new question with system context injected
  contents.push({
    role: "user" as const,
    parts: [
      {
        text: `[سياق المساعد]\n${systemPrompt}\n\n[سؤال الطالب]\n${message}`,
      },
    ],
  });

  // ── Start streaming ────────────────────────────────────────────
  const encoder = new TextEncoder();

  try {
    const streamingResult = await geminiModel.generateContentStream({
      contents,
    });

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let hasSentSessionId = !isNewSession; // only send sessionId once if new

        try {
          for await (const chunk of streamingResult) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;

              // Build SSE event with optional sessionId on first chunk
              const payload: Record<string, string> = { text };
              if (!hasSentSessionId) {
                payload.sessionId = activeSessionId;
                hasSentSessionId = true;
              }
              const event = `data: ${JSON.stringify(payload)}\n\n`;
              controller.enqueue(encoder.encode(event));
            }
          }

          // ── Save assistant message to DB ──────────────────────
          if (fullResponse) {
            await db.chatMessage.create({
              data: {
                sessionId: activeSessionId,
                role: "assistant",
                content: fullResponse,
              },
            });
            // Touch updatedAt
            await db.chatSession.update({
              where: { id: activeSessionId },
              data: { updatedAt: new Date() },
            });
          }

          // Signal completion (include sessionId for new sessions that had no text)
          const donePayload: Record<string, string> = {};
          donePayload.type = "done";
          if (!hasSentSessionId) {
            donePayload.sessionId = activeSessionId;
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(donePayload)}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          const errorMsg =
            e instanceof Error ? e.message : "حدث خطأ غير متوقع";
          const errorEvent = `data: ${JSON.stringify({ error: errorMsg })}\n\n`;
          try {
            controller.enqueue(encoder.encode(errorEvent));
          } catch {
            // controller may already be closed
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error(
      "[AI Study Buddy] Gemini streaming error:",
      (e as Error).message
    );
    return new Response(
      JSON.stringify({
        error:
          "حدث خطأ في الاتصال بالمساعد الذكي. حاول مرة أخرى.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
