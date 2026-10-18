import { db } from "@/lib/db";

// Not a server action module on purpose: buildSystemPrompt exposes question-bank
// statistics and must only be reachable from already-authorized server code.

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
