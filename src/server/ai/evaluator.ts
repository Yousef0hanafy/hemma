// =====================================================================
// AI Evaluator & OpenRouter Dynamic Free-Model Integration
// Automatically discovers all free models from OpenRouter (price = $0)
// and seamlessly cascades across them so operations never fail or terminate.
// =====================================================================

import type { ScoringResult, DimensionScore } from "./scoring";
import { scoreQuestion as heuristicScore } from "./scoring";
import {
  buildQualityCheckPrompt,
  buildExplanationPrompt,
  buildDifficultyPrompt,
} from "./prompts";
import { z } from "zod";

// -------------------------------------------------------------------
// Static Fallback Free Models Pool (Updated from OpenRouter Free Catalog)
// -------------------------------------------------------------------

export const STATIC_FREE_AI_MODELS = [
  "openrouter/free",
  "nvidia/nemotron-3.5-lightning:free",
  "dots-studio/dots-3-note-preview:free",
  "liquid/lfm-2.5-2.6b:free",
  "stealth/ox-alpha",
  "poolside/laguna-s-2.1:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
] as const;

export const FREE_AI_MODELS = STATIC_FREE_AI_MODELS;

let cachedDynamicFreeModels: string[] = [];
let lastModelsFetchedAt = 0;
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Dynamically queries OpenRouter API to fetch all 100% free models ($0 pricing)
 * and sorts them with high-capacity models first.
 */
export async function getAvailableFreeModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedDynamicFreeModels.length > 0 && now - lastModelsFetchedAt < MODELS_CACHE_TTL_MS) {
    return cachedDynamicFreeModels;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "https://hemma-lms.com",
        "X-Title": "Hemma LMS",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        const liveFreeIds = data.data
          .filter((m: any) => {
            const isFreePrice =
              m.pricing?.prompt === "0" &&
              m.pricing?.completion === "0";
            const isFreeSlug = typeof m.id === "string" && m.id.endsWith(":free");
            const isTextOutput =
              !m.architecture?.output_modalities ||
              m.architecture.output_modalities.includes("text");
            return (isFreePrice || isFreeSlug) && isTextOutput;
          })
          .map((m: any) => m.id as string);

        if (liveFreeIds.length > 0) {
          // Order with the most reliable instruction-tuned models first
          const preferredOrder = [
            "openrouter/free",
            "nvidia/nemotron-3.5-lightning:free",
            "dots-studio/dots-3-note-preview:free",
            "liquid/lfm-2.5-2.6b:free",
            "stealth/ox-alpha",
            "poolside/laguna-s-2.1:free",
            "google/gemma-4-26b-a4b-it:free",
            "nvidia/nemotron-3-nano-30b-a3b:free",
            "openai/gpt-oss-20b:free",
          ];

          const prioritized = [
            ...preferredOrder.filter((id) => liveFreeIds.includes(id)),
            ...liveFreeIds.filter((id: string) => !preferredOrder.includes(id)),
          ];

          cachedDynamicFreeModels = prioritized;
          lastModelsFetchedAt = now;
          return cachedDynamicFreeModels;
        }
      }
    }
  } catch (err) {
    console.warn("[OpenRouter] Could not fetch live models list, using static free pool:", (err as Error).message);
  }

  return [...STATIC_FREE_AI_MODELS];
}

export function getAIModelName(): string {
  const envModel = process.env.AI_MODEL;
  if (envModel && envModel !== "auto" && (envModel.includes("/") || envModel.includes(":free"))) {
    return envModel;
  }
  return "openrouter/free";
}

export function getAIApiKey(): string {
  return process.env.OPENROUTER_API_KEY || process.env.GOOGLE_API_KEY || "";
}

export function isAIAvailable(): boolean {
  return !!getAIApiKey();
}

// -------------------------------------------------------------------
// OpenRouter OpenAI-Compatible Caller
// -------------------------------------------------------------------

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Normalizes input prompts and contents into standard OpenAI messages.
 */
function normalizeMessages(
  promptOrContents:
    | string
    | { contents: Array<{ role: string; parts: Array<{ text: string }> }> }
    | OpenRouterMessage[],
  systemInstruction?: string
): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  if (typeof promptOrContents === "string") {
    messages.push({ role: "user", content: promptOrContents });
    return messages;
  }

  if (Array.isArray(promptOrContents)) {
    return [...messages, ...promptOrContents];
  }

  if (promptOrContents && Array.isArray(promptOrContents.contents)) {
    for (const item of promptOrContents.contents) {
      const role = item.role === "model" || item.role === "assistant" ? "assistant" : "user";
      const content = item.parts.map((p) => p.text).join("\n");
      messages.push({ role, content });
    }
  }

  return messages;
}

/**
 * Execute non-streaming OpenRouter call with dynamic multi-model fallback.
 */
async function callOpenRouterWithFallback(
  messages: OpenRouterMessage[],
  options?: {
    preferredModel?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string | null> {
  const apiKey = getAIApiKey();
  if (!apiKey) return null;

  const dynamicFreePool = await getAvailableFreeModels();
  const candidateModels = Array.from(
    new Set([
      options?.preferredModel || getAIModelName(),
      ...dynamicFreePool,
      ...STATIC_FREE_AI_MODELS,
    ])
  );

  for (const model of candidateModels) {
    try {
      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: options?.temperature ?? 0.4,
        max_tokens: options?.maxTokens ?? 2048,
      };

      if (options?.jsonMode) {
        payload.response_format = { type: "json_object" };
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "https://hemma-lms.com",
          "X-Title": "Hemma LMS",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenRouter] Model ${model} failed (${response.status}): ${errorText.slice(0, 150)}`);
        continue; // Seamless fallback to next free model
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && typeof content === "string") {
        return content;
      }
    } catch (err) {
      console.warn(`[OpenRouter] Exception calling ${model}:`, (err as Error).message);
    }
  }

  console.error("[OpenRouter] All candidate free models failed to respond.");
  return null;
}

/**
 * Execute streaming OpenRouter call with dynamic multi-model fallback.
 */
async function streamOpenRouterWithFallback(
  messages: OpenRouterMessage[],
  options?: {
    preferredModel?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AsyncIterable<{ text: () => string }>> {
  const apiKey = getAIApiKey();
  if (!apiKey) {
    throw new Error("لم يتم إعداد مفتاح OpenRouter.");
  }

  const dynamicFreePool = await getAvailableFreeModels();
  const candidateModels = Array.from(
    new Set([
      options?.preferredModel || getAIModelName(),
      ...dynamicFreePool,
      ...STATIC_FREE_AI_MODELS,
    ])
  );

  for (const model of candidateModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "https://hemma-lms.com",
          "X-Title": "Hemma LMS",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
        }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.warn(`[OpenRouter Stream] Model ${model} returned ${response.status}: ${errorText.slice(0, 150)}`);
        continue;
      }

      // Return AsyncIterable over SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data:")) continue;
                const dataStr = trimmed.slice(5).trim();
                if (dataStr === "[DONE]") return;

                try {
                  const json = JSON.parse(dataStr);
                  const textChunk = json.choices?.[0]?.delta?.content || "";
                  if (textChunk) {
                    yield {
                      text: () => textChunk,
                    };
                  }
                } catch {
                  // Skip partial/unparseable json
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        },
      };

      return asyncIterable;
    } catch (e) {
      console.warn(`[OpenRouter Stream] Error connecting to ${model}:`, (e as Error).message);
    }
  }

  throw new Error("تعذر الاتصال بجميع نماذج OpenRouter المجانية.");
}

// -------------------------------------------------------------------
// Unified Gemini-Compatible Adapter for OpenRouter
// -------------------------------------------------------------------

export class OpenRouterGeminiAdapter {
  getGenerativeModel(config: {
    model?: string;
    systemInstruction?: string;
    generationConfig?: {
      temperature?: number;
      maxOutputTokens?: number;
      responseMimeType?: string;
    };
  }) {
    const model = config.model || getAIModelName();
    const systemInstruction = config.systemInstruction;
    const temperature = config.generationConfig?.temperature;
    const maxTokens = config.generationConfig?.maxOutputTokens;
    const jsonMode = config.generationConfig?.responseMimeType === "application/json";

    return {
      async generateContent(promptOrContents: any) {
        const messages = normalizeMessages(promptOrContents, systemInstruction);
        const text = await callOpenRouterWithFallback(messages, {
          preferredModel: model,
          temperature,
          maxTokens,
          jsonMode,
        });

        return {
          response: {
            text: () => text || "",
          },
        };
      },

      async generateContentStream(promptOrContents: any) {
        const messages = normalizeMessages(promptOrContents, systemInstruction);
        const stream = await streamOpenRouterWithFallback(messages, {
          preferredModel: model,
          temperature,
          maxTokens,
        });

        return {
          stream,
          [Symbol.asyncIterator]() {
            return stream[Symbol.asyncIterator]();
          },
        };
      },
    };
  }
}

const openRouterAdapterInstance = new OpenRouterGeminiAdapter();

export function getGeminiClient(): OpenRouterGeminiAdapter | null {
  if (!isAIAvailable()) return null;
  return openRouterAdapterInstance;
}

export function getOpenRouterClient(): OpenRouterGeminiAdapter | null {
  return getGeminiClient();
}

// -------------------------------------------------------------------
// Schema Validation for AI Responses
// -------------------------------------------------------------------

const QualityCheckSchema = z.object({
  score: z.number().min(0).max(1),
  dimensions: z.record(z.string(), z.number().min(0).max(1)),
  weaknesses: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});

const ExplanationSchema = z.object({
  explanation: z.string(),
  study_tip: z.string(),
  common_mistakes: z.array(z.string()),
});

const DifficultySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
  reason: z.string(),
  estimated_time_seconds: z.number().int().positive(),
});

// -------------------------------------------------------------------
// Parse AI response — extract JSON from response text
// -------------------------------------------------------------------

function parseJSONResponse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null)
      return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  return null;
}

// -------------------------------------------------------------------
// Call OpenRouter with a prompt, return text response
// -------------------------------------------------------------------

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 1024,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (e) {
    console.error("[AI Evaluator] OpenRouter call failed:", (e as Error).message);
    return null;
  }
}

// -------------------------------------------------------------------
// AI-powered quality check — returns structured score + issues
// -------------------------------------------------------------------

async function aiQualityCheck(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  explanation: string | null;
  difficulty: string;
  tags?: string[];
}): Promise<ScoringResult | null> {
  const prompt = buildQualityCheckPrompt(params);
  const content = await callAI(
    "أنت خبير تقييم جودة أسئلة تعليمية. أجب بصيغة JSON فقط بدون أي نص إضافي.",
    prompt,
    { temperature: 0.3, maxTokens: 1024 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  const validated = QualityCheckSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[AI Evaluator] Quality check response validation failed:", validated.error);
    return null;
  }

  const data = validated.data;
  const aiScore = data.score;
  const dimensions: DimensionScore[] = [];

  const dimConfig: Array<{ key: string; label: string; weight: number }> = [
    { key: "clarity", label: "صياغة السؤال", weight: 0.2 },
    { key: "options_quality", label: "جودة الخيارات", weight: 0.25 },
    { key: "explanation_quality", label: "جودة الشرح", weight: 0.25 },
    { key: "difficulty_fit", label: "الصعوبة المناسبة", weight: 0.1 },
    { key: "educational_value", label: "القيمة التعليمية", weight: 0.2 },
  ];

  for (const dim of dimConfig) {
    const raw = data.dimensions[dim.key];
    const score = typeof raw === "number" ? Math.max(0, Math.min(1, raw)) : 0.5;
    dimensions.push({ name: dim.key, label: dim.label, score, weight: dim.weight });
  }

  const weaknesses = data.weaknesses ?? [];
  const suggestions = data.suggestions ?? [];

  return {
    overall: Math.round(aiScore * 100) / 100,
    dimensions,
    issues: [...weaknesses, ...suggestions],
  };
}

// -------------------------------------------------------------------
// AI-powered explanation generator
// -------------------------------------------------------------------

export async function generateAIExplanation(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  categoryName: string;
}): Promise<{
  explanation: string;
  studyTip: string;
  commonMistakes: string[];
} | null> {
  const prompt = buildExplanationPrompt(params);
  const content = await callAI(
    "أنت مدرس خبير باللغة العربية. أجب بصيغة JSON فقط.",
    prompt,
    { temperature: 0.5, maxTokens: 1024 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  const validated = ExplanationSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[AI Evaluator] Explanation response validation failed:", validated.error);
    return null;
  }

  const data = validated.data;

  return {
    explanation: data.explanation,
    studyTip: data.study_tip,
    commonMistakes: data.common_mistakes,
  };
}

// -------------------------------------------------------------------
// AI-powered difficulty estimation
// -------------------------------------------------------------------

export async function estimateDifficultyAI(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  categoryName: string;
}): Promise<{ difficulty: string; reason: string; estimatedTime: number } | null> {
  const prompt = buildDifficultyPrompt(params);
  const content = await callAI(
    "قيّم صعوبة السؤال. أجب بصيغة JSON فقط.",
    prompt,
    { temperature: 0.3, maxTokens: 512 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  const validated = DifficultySchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[AI Evaluator] Difficulty response validation failed:", validated.error);
    return null;
  }

  const data = validated.data;

  return {
    difficulty: data.difficulty,
    reason: data.reason,
    estimatedTime: data.estimated_time_seconds,
  };
}

// -------------------------------------------------------------------
// Main scoring function — tries OpenRouter first, falls back to heuristic
// -------------------------------------------------------------------

export async function scoreQuestionWithAI(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  explanation: string | null;
  difficulty: string;
  tags?: string[];
  preferAI?: boolean;
}): Promise<ScoringResult> {
  if (isAIAvailable() && params.preferAI !== false) {
    const aiResult = await aiQualityCheck(params);
    if (aiResult) return aiResult;
  }

  return heuristicScore(params as any);
}
