// =====================================================================
// AI Prompt Templates — Arabic educational content quality assessment
// =====================================================================
//
// These prompts are designed for GPT-4o-mini (or equivalent) to evaluate
// Arabic-language multiple-choice questions. They return structured JSON
// that the evaluator parses into scoring results.

/**
 * Prompt for quality assessment of a single multiple-choice question.
 * Asks the AI to evaluate on defined dimensions and return structured JSON.
 */
export function buildQualityCheckPrompt(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  explanation: string | null;
  difficulty: string;
  tags?: string[];
}): string {
  const optionsText = params.options
    .map((o) => `  "${o.key}": "${o.text}"`)
    .join("\n");

  return `أنت خبير تقييم جودة أسئلة تعليمية باللغة العربية. قيّم السؤال التالي حسب الأبعاد المحددة وأعد النتيجة بصيغة JSON فقط.

⚠️ التعليمات:
- قيّم السؤال بموضوعية وفق معايير الجودة التربوية
- استخدم اللغة العربية في التعليقات
- أعد JSON فقط (لا نص إضافي، لا markdown)

# السؤال
النص: "${params.stem}"

# الخيارات
{
${optionsText}
}

الإجابة الصحيحة: "${params.correctKey}"
الشرح: ${params.explanation ?? "(غير موجود)"}
مستوى الصعوبة: ${params.difficulty === "easy" ? "سهل" : params.difficulty === "medium" ? "متوسط" : "صعب"}
الوسوم: ${(params.tags ?? []).length > 0 ? params.tags.join(", ") : "(بدون)"}

# أبعاد التقييم (كل بعد من 0.0 إلى 1.0)
1. صياغة السؤال (clarity): وضوح الصياغة وسلامتها اللغوية، هل السؤال واضح ومباشر؟
2. جودة الخيارات (options_quality): توزيع الخيارات، عدم التكرار، دقة المضللات
3. جودة الشرح (explanation_quality): وضوح الشرح، تغطيته للمادة، دقته العلمية
4. الصعوبة المناسبة (difficulty_fit): هل مستوى الصعوبة مناسب للسؤال؟
5. القيمة التعليمية (educational_value): هل السؤال ينمي التفكير أم يحفظ المعلومات فقط؟

# صيغة JSON المطلوبة
{
  "score": <number 0.0–1.0>,
  "dimensions": {
    "clarity": <number>,
    "options_quality": <number>,
    "explanation_quality": <number>,
    "difficulty_fit": <number>,
    "educational_value": <number>
  },
  "strengths": ["<نقطة قوة>", "..."],
  "weaknesses": ["<نقطة ضعف>", "..."],
  "suggestions": ["<اقتراح للتحسين>", "..."],
  "estimated_difficulty": "easy|medium|hard",
  "summary": "<تقييم عام مختصر بالعربية>"
}`;
}

/**
 * Prompt for generating an educational explanation for a question.
 */
export function buildExplanationPrompt(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  categoryName: string;
}): string {
  const correctOption = params.options.find((o) => o.key === params.correctKey);
  const optionsText = params.options
    .map((o) => `  ${o.key}. ${o.text}`)
    .join("\n");

  return `أنت مدرس خبير باللغة العربية. اكتب شرحاً تعليمياً لسؤال من فئة "${params.categoryName}".

# السؤال
${params.stem}

# الخيارات
${optionsText}

الإجابة الصحيحة: "${params.correctKey}" — ${correctOption?.text ?? ""}

# المطلوب
1. اشرح لماذا الإجابة صحيحة بلغة واضحة ومناسبة للطلاب
2. اشرح لماذا الخيارات الأخرى خاطئة (باختصار)
3. أضف نصيحة تعليمية قصيرة للطالب
4. اجعل الشرح بالفصحى المبسطة

أعد النتيجة بصيغة JSON فقط:
{
  "explanation": "<الشرح المفصل>",
  "study_tip": "<نصيحة تعليمية>",
  "common_mistakes": ["<خطأ شائع>", "..."]
}`;
}

/**
 * Prompt for difficulty estimation based on question content.
 */
export function buildDifficultyPrompt(params: {
  stem: string;
  options: Array<{ key: string; text: string }>;
  categoryName: string;
}): string {
  const optionsText = params.options
    .map((o) => `  ${o.key}. ${o.text}`)
    .join("\n");

  return `قيّم مستوى صعوبة هذا السؤال التعليمي بالعربية.

نص السؤال: "${params.stem}"
الخيارات:
${optionsText}
التصنيف: ${params.categoryName}

أعد JSON فقط:
{
  "difficulty": "easy|medium|hard",
  "reason": "<سبب التقييم بالعربية>",
  "estimated_time_seconds": <عدد صحيح>
}`;
}
