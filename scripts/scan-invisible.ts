import { db } from "../src/lib/db";
import * as fs from "fs";

const INVISIBLE_RANGES: Array<[number, number, string]> = [
  [0x200b, 0x200f, "Zero-width/Bidi mark"],
  [0x202a, 0x202e, "Bidi embedding"],
  [0x2066, 0x2069, "Bidi isolate"],
  [0xfeff, 0xfeff, "BOM/ZWNBSP"],
  [0x00ad, 0x00ad, "Soft hyphen"],
];

function scanInvisible(label: string, text: string): number[] {
  const found: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    for (const [start, end, name] of INVISIBLE_RANGES) {
      if (cp >= start && cp <= end) {
        found.push(cp);
      }
    }
  }
  return found;
}

async function main() {
  // 1. Check JSON files
  console.log("=== SCANNING JSON FILES ===");
  for (const file of ["upload/question_set_1.json", "upload/question_set_2.json"]) {
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw);
    let totalInvisible = 0;
    for (const q of data.questions) {
      totalInvisible += scanInvisible("stem", q.question).length;
      for (const opt of Object.values(q.options)) {
        totalInvisible += scanInvisible("option", opt as string).length;
      }
    }
    console.log(`${file}: ${data.questions.length} questions, ${totalInvisible} invisible chars`);
  }

  // 2. Check Neon DB
  console.log("\n=== SCANNING NEON DATABASE ===");
  const questions = await db.question.findMany({ include: { source: true } });
  console.log(`Total questions in DB: ${questions.length}`);
  
  let dbInvisible = 0;
  let dbMismatches = 0;
  
  for (const q of questions) {
    // Check stem
    const stemInvisible = scanInvisible("stem", q.stem);
    dbInvisible += stemInvisible.length;
    
    // Check options
    const opts = JSON.parse(q.options) as Array<{key:string; text:string}>;
    for (const opt of opts) {
      dbInvisible += scanInvisible("option", opt.text).length;
    }
    
    // Check explanation
    if (q.explanation) {
      dbInvisible += scanInvisible("explanation", q.explanation).length;
    }
    
    // Check study tip
    if (q.studyTip) {
      dbInvisible += scanInvisible("studyTip", q.studyTip).length;
    }
  }
  
  console.log(`Invisible characters found in DB: ${dbInvisible}`);
  
  // 3. Cross-check JSON vs DB for ALL questions
  console.log("\n=== CROSS-CHECKING JSON vs DB (ALL QUESTIONS) ===");
  const sources = await db.source.findMany();
  const sourceMap = new Map(sources.map(s => [s.slug, s]));
  
  let allMatch = true;
  for (const file of ["upload/question_set_1.json", "upload/question_set_2.json"]) {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const slug = file.includes("set_1") ? "question_set_1" : "question_set_2";
    const source = sourceMap.get(slug);
    if (!source) continue;
    
    for (const jsonQ of data.questions) {
      const dbQ = questions.find(q => q.sourceId === source.id && q.sourceLocalId === jsonQ.id);
      if (!dbQ) {
        console.log(`MISSING: ${slug} Q${jsonQ.id}`);
        allMatch = false;
        continue;
      }
      
      // Compare stem
      if (dbQ.stem !== jsonQ.question) {
        console.log(`STEM MISMATCH: ${slug} Q${jsonQ.id}`);
        console.log(`  JSON: ${JSON.stringify(jsonQ.question)}`);
        console.log(`  DB:   ${JSON.stringify(dbQ.stem)}`);
        allMatch = false;
      }
      
      // Compare options
      const dbOpts = JSON.parse(dbQ.options) as Array<{key:string; text:string}>;
      for (const opt of dbOpts) {
        const jsonText = jsonQ.options[opt.key];
        if (jsonText !== opt.text) {
          console.log(`OPTION MISMATCH: ${slug} Q${jsonQ.id} key=${opt.key}`);
          console.log(`  JSON: ${JSON.stringify(jsonText)}`);
          console.log(`  DB:   ${JSON.stringify(opt.text)}`);
          allMatch = false;
        }
      }
    }
  }
  
  console.log(`\n${allMatch ? "✓ ALL 60 QUESTIONS MATCH JSON EXACTLY" : "✗ MISMATCHES FOUND"}`);
  console.log(`Invisible chars total: ${dbInvisible}`);
  
  await db.$disconnect();
}

main().catch(console.error);
