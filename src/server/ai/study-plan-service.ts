// =====================================================================
// AI Study Plan Service — calls Gemini to generate personalized study
// plans based on student performance data
// =====================================================================

import { getGeminiClient, getAIModelName, isAIAvailable } from "./evaluator";
import { buildStudyPlanPrompt, parseStudyPlanOutput } from "./study-plan-prompt";
import type { StudyPlanInput, StudyPlanOutput } from "./study-plan-prompt";

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

  // Try extracting from ```json ... ``` block
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
// Call Gemini with the study plan prompt
// -------------------------------------------------------------------

export async function generateAIStudyPlan(
  input: StudyPlanInput
): Promise<StudyPlanOutput | null> {
  if (!isAIAvailable()) return null;

  const client = getGeminiClient();
  if (!client) return null;

  const modelName = getAIModelName();
  const prompt = buildStudyPlanPrompt(input);

  try {
    const geminiModel = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const result = await geminiModel.generateContent([
      { text: "أنت مستشار تعليمي خبير باللغة العربية. حلّل بيانات الطالب وقدّم خطة دراسة JSON." },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    if (!text) return null;

    const parsed = parseJSONResponse(text);
    if (!parsed) return null;

    return parseStudyPlanOutput(parsed);
  } catch (e) {
    console.error("[AI Study Plan] Gemini API call failed:", (e as Error).message);
    return null;
  }
}
