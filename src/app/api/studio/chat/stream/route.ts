// =====================================================================
// Gemini Chat Stream — token-by-token streaming via Server-Sent Events
// POST /api/studio/chat/stream
// Body: { history: ChatMessage[], message: string }
// Response: ReadableStream of JSON lines: { type: "chunk"|"done"|"error", ... }
// =====================================================================

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, getAIModelName } from "@/server/ai/evaluator";
import { buildSystemPrompt } from "@/server/actions/studio-chat";
import type { ChatMessage } from "@/server/actions/studio-chat";
import { aiRateLimiter, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limiter";

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 20;
const MAX_TOTAL_HISTORY_CHARS = 10000;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Validate and sanitize message content */
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "الرجاء كتابة رسالة" };
  }
  
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "الرجاء كتابة رسالة" };
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `الرسالة طويلة جداً (الحد الأقصى ${MAX_MESSAGE_LENGTH} حرف)` };
  }
  
  return { valid: true };
}

/** Validate and sanitize history */
function validateHistory(history: ChatMessage[]): { valid: boolean; error?: string } {
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

// ---------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "غير مصرح به" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Rate limiting ──────────────────────────────────────────────
  const clientIdentifier = getClientIdentifier(req);
  const rateLimitResult = aiRateLimiter.check(clientIdentifier);
  const rateLimitResponseResult = rateLimitResponse(rateLimitResult);
  if (rateLimitResponseResult) return rateLimitResponseResult;

  // ── Input validation ──────────────────────────────────────────────
  let history: ChatMessage[];
  let message: string;

  try {
    const body = await req.json();
    history = body.history ?? [];
    message = body.message?.trim() ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "طلب غير صالح" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Validate inputs ────────────────────────────────────────────────
  const messageValidation = validateMessage(message);
  if (!messageValidation.valid) {
    return new Response(JSON.stringify({ error: messageValidation.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const historyValidation = validateHistory(history);
  if (!historyValidation.valid) {
    return new Response(JSON.stringify({ error: historyValidation.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Gemini client ─────────────────────────────────────────────────
  const client = getGeminiClient();
  if (!client) {
    return new Response(
      JSON.stringify({
        error: "لم يتم إعداد مفتاح Google Gemini. تأكد من ضبط GOOGLE_API_KEY في المتغيرات البيئية.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const modelName = getAIModelName();

  // ── Build the stream ──────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        const geminiModel = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });

        const systemPrompt = await buildSystemPrompt();

        // Build conversation contents
        const contents: Array<{
          role: "user" | "model";
          parts: Array<{ text: string }>;
        }> = [];

        // Last 10 messages as context
        for (const msg of history.slice(-10)) {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }

        // New message with system prompt prepended
        contents.push({
          role: "user",
          parts: [
            {
              text: `[السياق]\n${systemPrompt}\n\n[سؤال المستخدم]\n${message}`,
            },
          ],
        });

        // Stream from Gemini
        const result = await geminiModel.generateContentStream({ contents });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            send({ type: "chunk", text });
          }
        }

        send({ type: "done" });
      } catch (e) {
        const error = (e as Error).message;
        
        // Log the error with context for monitoring
        console.error(
          `[Studio Chat Stream] Gemini error for user ${session.user.id}:`,
          error
        );
        
        send({ type: "error", error });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
