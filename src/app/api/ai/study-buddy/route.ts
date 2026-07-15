// =====================================================================
// AI Study Buddy — Streaming API Route
// Uses Gemini generateContentStream to stream responses token-by-token
// =====================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

// -------------------------------------------------------------------
// POST — stream AI response
// -------------------------------------------------------------------

export async function POST(request: Request) {
  // ── Authenticate ─────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: "يجب تسجيل الدخول أولاً" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Parse request ─────────────────────────────────────────────
  let body: { history?: BuddyMessage[]; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "طلب غير صالح" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { history = [], message } = body;

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
        try {
          for await (const chunk of streamingResult) {
            const text = chunk.text();
            if (text) {
              // SSE format: data: <text>\n\n
              const event = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }
          }
          // Signal completion
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          const errorMsg =
            e instanceof Error ? e.message : "حدث خطأ غير متوقع";
          // Send error as a data: event so the client's SSE parser can read it
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
    console.error("[AI Study Buddy] Gemini streaming error:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في الاتصال بالمساعد الذكي. حاول مرة أخرى." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
