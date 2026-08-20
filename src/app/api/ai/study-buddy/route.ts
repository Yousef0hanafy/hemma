// =====================================================================
// AI Study Buddy — Streaming API Route
// Uses Gemini generateContentStream to stream responses token-by-token
// Messages are persisted to the database via ChatSession + ChatMessage
// =====================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGeminiClient, getAIModelName } from "@/server/ai/evaluator";
import { aiRateLimiter, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limiter";

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 20;
const MAX_TOTAL_HISTORY_CHARS = 10000;
const AI_TIMEOUT_MS = 30000; // 30 second timeout for AI operations
const MAX_REQUEST_BODY_SIZE = 100 * 1024; // 100KB max request body

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

  // ── Rate limiting ──────────────────────────────────────────────
  const clientIdentifier = getClientIdentifier(request);
  const rateLimitResult = aiRateLimiter.check(clientIdentifier);
  const rateLimitResponseResult = rateLimitResponse(rateLimitResult);
  if (rateLimitResponseResult) return rateLimitResponseResult;

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

/** Validate and sanitize message content */
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "الرجاء كتابة سؤال" };
  }
  
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "الرجاء كتابة سؤال" };
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `الرسالة طويلة جداً (الحد الأقصى ${MAX_MESSAGE_LENGTH} حرف)` };
  }
  
  return { valid: true };
}

/** Validate and sanitize history */
function validateHistory(history: BuddyMessage[]): { valid: boolean; error?: string } {
  if (!Array.isArray(history)) {
    return { valid: false, error: "بيانات المحادثة غير صالحة" };
  }
  
  if (history.length > MAX_HISTORY_LENGTH) {
    return { valid: false, error: "المحادثة طويلة جداً" };
  }
  
  let totalChars = 0;
  for (const msg of history) {
    if (!msg.content || typeof msg.content !== "string") {
      return { valid: false, error: "رسالة غير صالحة في المحادثة" };
    }
    totalChars += msg.content.length;
  }
  
  if (totalChars > MAX_TOTAL_HISTORY_CHARS) {
    return { valid: false, error: "المحادثة طويلة جداً" };
  }
  
  return { valid: true };
}

/**
 * Wraps a promise with a timeout to prevent hanging requests
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * Validates request body size to prevent DoS attacks
 * Reads the stream with a size limit
 */
async function validateAndParseBody(request: Request): Promise<any> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_REQUEST_BODY_SIZE) {
      throw new Error("حجم الطلب كبير جداً");
    }
  }

  // Read the body with size limit
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error("طلب غير صالح");
  }

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      receivedLength += value.length;
      if (receivedLength > MAX_REQUEST_BODY_SIZE) {
        throw new Error("حجم الطلب كبير جداً");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(receivedLength);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.length;
  }

  const bodyText = new TextDecoder().decode(bodyBytes);
  return JSON.parse(bodyText);
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

  // ── Rate limiting ──────────────────────────────────────────────
  const clientIdentifier = getClientIdentifier(request);
  const rateLimitResult = aiRateLimiter.check(clientIdentifier);
  const rateLimitResponseResult = rateLimitResponse(rateLimitResult);
  if (rateLimitResponseResult) return rateLimitResponseResult;

  // ── Parse request with size validation ─────────────────────────
  let body: {
    history?: BuddyMessage[];
    message?: string;
    sessionId?: string | null;
  };
  try {
    body = await validateAndParseBody(request);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "طلب غير صالح";
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const { history = [], message, sessionId: incomingSessionId } = body;

  // ── Validate inputs ──────────────────────────────────────────
  const messageValidation = validateMessage(message ?? "");
  if (!messageValidation.valid) {
    return new Response(
      JSON.stringify({ error: messageValidation.error }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const historyValidation = validateHistory(history);
  if (!historyValidation.valid) {
    return new Response(
      JSON.stringify({ error: historyValidation.error }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Check AI availability ──────────────────────────────────────
  const client = getGeminiClient();
  if (!client) {
    return new Response(
      JSON.stringify({
        error:
          "مساعد AI غير متاح حالياً. تأكد من ضبط مفتاح OpenRouter في الإعدادات.",
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
      data: { userId, title: autoTitle(message ?? "") },
    });
    activeSessionId = newSession.id;
    isNewSession = true;
  }

  // ── Save user message ──────────────────────────────────────────
  await db.chatMessage.create({
    data: {
      sessionId: activeSessionId,
      role: "user",
      content: message ?? "",
    },
  });

  // ── Load verified conversation history from database ───────────
  let verifiedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (!isNewSession) {
    // Fetch verified history directly from DB for existing sessions
    const previousMessages = await db.chatMessage.findMany({
      where: { sessionId: activeSessionId },
      orderBy: { createdAt: "desc" },
      skip: 1, // Skip the message just inserted
      take: 8,
      select: { role: true, content: true },
    });
    verifiedHistory = previousMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  } else if (history && history.length > 0) {
    // Sanitize any client-provided bootstrap history for brand new sessions
    verifiedHistory = history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  }

  // ── Build OpenRouter / Gemini request ───────────────────────────
  const modelName = getAIModelName();
  const systemPrompt = buildSystemPrompt();

  const geminiModel = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  // Add verified history messages for context
  for (const msg of verifiedHistory) {
    contents.push({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    });
  }

  // Add the new question
  contents.push({
    role: "user" as const,
    parts: [
      {
        text: message ?? "",
      },
    ],
  });

  // ── Start streaming ────────────────────────────────────────────
  const encoder = new TextEncoder();

  try {
    // Wrap the streaming initialization with a timeout
    const streamingResult = await withTimeout(
      geminiModel.generateContentStream({ contents }),
      AI_TIMEOUT_MS,
      "انتهى وقت الاتصال بخدمة AI. حاول مرة أخرى."
    );

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let hasSentSessionId = !isNewSession; // only send sessionId once if new

        try {
          for await (const chunk of streamingResult as AsyncIterable<any>) {
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
          
          // Log the error with context for monitoring
          console.error(
            `[AI Study Buddy] Streaming error for user ${userId}, session ${activeSessionId}:`,
            errorMsg
          );
          
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
    const errorMsg = (e as Error).message;
    
    // Log the error with context for monitoring
    console.error(
      `[AI Study Buddy] Gemini streaming initialization error for user ${userId}:`,
      errorMsg
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
