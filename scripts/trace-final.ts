import { db } from "../src/lib/db";
import * as fs from "fs";

const rawJson = JSON.parse(fs.readFileSync("upload/question_set_1.json", "utf-8"));
const rawJson2 = JSON.parse(fs.readFileSync("upload/question_set_2.json", "utf-8"));

async function main() {
  const source1 = await db.source.findUnique({ where: { slug: "question_set_1" } });
  const source2 = await db.source.findUnique({ where: { slug: "question_set_2" } });
  
  if (!source1 || !source2) {
    console.log("ERROR: Sources not found in DB");
    return;
  }
  
  const testCases = [
    { source: source1, raw: rawJson.questions.find((q:any) => q.id === 1),  label: "Q1 verbal_analogy" },
    { source: source1, raw: rawJson.questions.find((q:any) => q.id === 12), label: "Q12 sentence_completion" },
    { source: source1, raw: rawJson.questions.find((q:any) => q.id === 24), label: "Q24 odd_word_out" },
    { source: source2, raw: rawJson2.questions.find((q:any) => q.id === 4),  label: "Q2-4 verbal_analogy" },
    { source: source2, raw: rawJson2.questions.find((q:any) => q.id === 15), label: "Q2-15 contextual_error" },
    { source: source2, raw: rawJson2.questions.find((q:any) => q.id === 28), label: "Q2-28 reading_comp" },
  ];
  
  let allMatch = true;
  
  for (const tc of testCases) {
    const dbQ = await db.question.findFirst({
      where: { sourceId: tc.source.id, sourceLocalId: tc.raw.id },
    });
    
    if (!dbQ) {
      console.log(`\n=== ${tc.label} === NOT FOUND IN DB`);
      continue;
    }
    
    console.log(`\n=== ${tc.label} ===`);
    
    const stemMatch = dbQ.stem === tc.raw.question;
    if (!stemMatch) allMatch = false;
    console.log(`  STEM match: ${stemMatch ? "YES" : "NO"}`);
    if (!stemMatch) {
      console.log(`    JSON:  "${tc.raw.question}"`);
      console.log(`    DB:    "${dbQ.stem}"`);
    }
    
    const dbOptions = JSON.parse(dbQ.options) as Array<{key:string; text:string}>;
    const jsonOptions = tc.raw.options;
    
    for (const opt of dbOptions) {
      const jsonText = jsonOptions[opt.key];
      const match = jsonText === opt.text;
      if (!match) allMatch = false;
      console.log(`  OPTION ${opt.key} match: ${match ? "YES" : "NO"}`);
      if (!match) {
        console.log(`    JSON:  "${jsonText}"`);
        console.log(`    DB:    "${opt.text}"`);
      }
    }
    
    const correctJsonText = jsonOptions[tc.raw.answer];
    const explanationHasCorrect = dbQ.explanation?.includes(correctJsonText) ?? false;
    console.log(`  EXPLANATION has correct text: ${explanationHasCorrect ? "YES" : "NO"}`);
    if (!explanationHasCorrect) {
      console.log(`    Expected to contain: "${correctJsonText}"`);
      console.log(`    Explanation (first 300): "${dbQ.explanation?.substring(0, 300)}"`);
    }
  }
  
  console.log(`\n${allMatch ? "ALL MATCH - DB IS CLEAN" : "MISMATCHES FOUND - DB HAS CORRUPTION"}`);
  await db.$disconnect();
}

main().catch(console.error);
