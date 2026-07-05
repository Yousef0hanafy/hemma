import { db } from "../src/lib/db";

async function main() {
  const source1 = await db.source.findUnique({ where: { slug: "question_set_1" } });
  const q30 = await db.question.findFirst({
    where: { sourceId: source1!.id, sourceLocalId: 30 },
  });
  console.log("Q30 stem:", JSON.stringify(q30?.stem));
  console.log("Q30 options:", q30?.options);
  console.log("Q30 explanation:", JSON.stringify(q30?.explanation?.substring(0, 100)));
  await db.$disconnect();
}
main().catch(console.error);
