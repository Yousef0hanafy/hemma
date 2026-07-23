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

  if (!message) {
    return new Response(JSON.stringify({ error: "الرجاء كتابة رسالة" }), {
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
        console.error("[Chat Stream] Gemini error:", error);
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
