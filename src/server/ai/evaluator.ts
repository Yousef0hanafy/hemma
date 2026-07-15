// =====================================================================
// AI Evaluator — calls Google Gemini for quality assessment, falls back
// to heuristic scoring when no API key is configured
// =====================================================================

import type { ScoringResult, DimensionScore } from "./scoring";
import { scoreQuestion as heuristicScore } from "./scoring";
import {
  buildQualityCheckPrompt,
  buildExplanationPrompt,
  buildDifficultyPrompt,
} from "./prompts";

// -------------------------------------------------------------------
// Gemini client — lazy-loaded only when needed
// -------------------------------------------------------------------

let geminiClient: any = null;
let geminiInitFailed = false;

function getGeminiClientInternal() {
  const apiKey = process.env.GOOGLE_API_KEY ?? "";
  if (!apiKey || geminiInitFailed) return null;

  if (!geminiClient) {
    try {
      // Dynamic require so the app doesn't crash if package isn't installed
      const { GoogleGenerativeAI } = require("@google/generative-ai") as any;
      geminiClient = new GoogleGenerativeAI(apiKey);
      return geminiClient;
    } catch {
      console.error(
        "[AI Evaluator] @google/generative-ai not installed. Run: npm install @google/generative-ai"
      );
      geminiInitFailed = true;
      return null;
    }
  }
  return geminiClient;
}

// -------------------------------------------------------------------
// Shared exports — used by chat and other modules
// -------------------------------------------------------------------

export function getGeminiClient() {
  return getGeminiClientInternal();
}

export function getAIModelName(): string {
  return process.env.AI_MODEL ?? "gemini-2.0-flash";
}

// -------------------------------------------------------------------
// Config
// -------------------------------------------------------------------

function getConfig() {
  return {
    model: getAIModelName(),
  };
}

// -------------------------------------------------------------------
// Check if AI is available
// -------------------------------------------------------------------

export function isAIAvailable(): boolean {
  return !!process.env.GOOGLE_API_KEY;
}

// -------------------------------------------------------------------
// Parse AI response — extract JSON from response text
// -------------------------------------------------------------------

function parseJSONResponse(text: string): Record<string, unknown> | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null)
      return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }

  // Try extracting from ```json ... ``` block (Gemini sometimes wraps in markdown)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  // Try finding first { and last }
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
// Call Gemini with a prompt, return text response
// -------------------------------------------------------------------

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const { model } = getConfig();

  try {
    const geminiModel = client.getGenerativeModel({
      model,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 1024,
        responseMimeType: "application/json",
      },
    });

    const result = await geminiModel.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    return response.text();
  } catch (e) {
    console.error("[AI Evaluator] Gemini API call failed:", (e as Error).message);
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
  const content = await callGemini(
    "أنت خبير تقييم جودة أسئلة تعليمية. أجب بصيغة JSON فقط بدون أي نص إضافي.",
    prompt,
    { temperature: 0.3, maxTokens: 1024 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  const aiScore =
    typeof parsed.score === "number"
      ? Math.max(0, Math.min(1, parsed.score))
      : 0.5;

  const rawDims = parsed.dimensions as Record<string, unknown> | undefined;
  const dimensions: DimensionScore[] = [];

  const dimConfig: Array<{ key: string; label: string; weight: number }> = [
    { key: "clarity", label: "صياغة السؤال", weight: 0.2 },
    { key: "options_quality", label: "جودة الخيارات", weight: 0.25 },
    { key: "explanation_quality", label: "جودة الشرح", weight: 0.25 },
    { key: "difficulty_fit", label: "الصعوبة المناسبة", weight: 0.1 },
    { key: "educational_value", label: "القيمة التعليمية", weight: 0.2 },
  ];

  for (const dim of dimConfig) {
    const raw = rawDims?.[dim.key];
    const score = typeof raw === "number" ? Math.max(0, Math.min(1, raw)) : 0.5;
    dimensions.push({ name: dim.key, label: dim.label, score, weight: dim.weight });
  }

  const weaknesses = Array.isArray(parsed.weaknesses)
    ? (parsed.weaknesses as string[]).filter(Boolean)
    : [];
  const suggestions = Array.isArray(parsed.suggestions)
    ? (parsed.suggestions as string[]).filter(Boolean)
    : [];

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
  const content = await callGemini(
    "أنت مدرس خبير باللغة العربية. أجب بصيغة JSON فقط.",
    prompt,
    { temperature: 0.5, maxTokens: 1024 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  return {
    explanation: (parsed.explanation as string) ?? "",
    studyTip: (parsed.study_tip as string) ?? "",
    commonMistakes: Array.isArray(parsed.common_mistakes)
      ? (parsed.common_mistakes as string[])
      : [],
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
  const content = await callGemini(
    "قيّم صعوبة السؤال. أجب بصيغة JSON فقط.",
    prompt,
    { temperature: 0.3, maxTokens: 512 }
  );

  if (!content) return null;

  const parsed = parseJSONResponse(content);
  if (!parsed) return null;

  const difficulty = (parsed.difficulty as string) ?? "medium";
  const validDifficulties = ["easy", "medium", "hard"];
  return {
    difficulty: validDifficulties.includes(difficulty) ? difficulty : "medium",
    reason: (parsed.reason as string) ?? "",
    estimatedTime:
      typeof parsed.estimated_time_seconds === "number"
        ? parsed.estimated_time_seconds
        : 30,
  };
}

// -------------------------------------------------------------------
// Main scoring function — tries Gemini first, falls back to heuristic
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

  return heuristicScore(params);
}
