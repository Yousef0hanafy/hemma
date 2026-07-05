// =====================================================================
// Pipeline Tracer — dumps text at every stage with byte-level detail
// =====================================================================

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import { validateSource, normalizeQuestion, cleanText, normalizeOptions } from "../src/lib/content/normalize";
import { toQuestionDTO } from "../src/lib/content/dto";

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Helper: dump a string with codepoints and visible markers
function dumpString(label: string, str: string): void {
  console.log(`\n── ${label} ──`);
  console.log(`  Raw length: ${str.length} chars`);
  console.log(`  Visible:    "${str}"`);

  // Codepoint breakdown
  const codepoints: string[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    const hex = cp.toString(16).toUpperCase().padStart(4, "0");
    const name = charName(cp);
    codepoints.push(`U+${hex} (${name})`);
  }
  console.log(`  Codepoints: ${codepoints.join(" ")}`);

  // Check for suspicious characters
  const suspicious = str.split("").filter((ch) => {
    const cp = ch.codePointAt(0)!;
    return (
      cp === 0x200b || // zero-width space
      cp === 0x200c || // zero-width non-joiner
      cp === 0x200d || // zero-width joiner
      cp === 0x200e || // LTR mark
      cp === 0x200f || // RTL mark
      cp === 0x202a || // LRE
      cp === 0x202b || // RLE
      cp === 0x202c || // PDF
      cp === 0x202d || // LRO
      cp === 0x202e || // RLO
      cp === 0x2066 || // LRI
      cp === 0x2067 || // RLI
      cp === 0x2068 || // FSI
      cp === 0x2069    // PDI
    );
  });
  if (suspicious.length > 0) {
    console.log(`  ⚠ SUSPICIOUS CHARS: ${suspicious.length} bidi/zero-width characters found!`);
  }
}

function charName(cp: number): string {
  const names: Record<number, string> = {
    0x20: "SPACE",
    0x21: "!",
    0x22: '"',
    0x27: "'",
    0x2d: "-",
    0x2e: ".",
    0x2f: "/",
    0x3a: ":",
    0x3b: ";",
    0x3f: "?",
    0x60c: "ARABIC COMMA ،",
    0x61b: "ARABIC SEMICOLON ؛",
    0x61f: "ARABIC QUESTION MARK ؟",
    0x660: "ARABIC-INDIC DIGIT ZERO ٠",
    0x661: "ARABIC-INDIC DIGIT ONE ١",
    0x662: "ARABIC-INDIC DIGIT TWO ٢",
    0x663: "ARABIC-INDIC DIGIT THREE ٣",
    0x664: "ARABIC-INDIC DIGIT FOUR ٤",
    0x665: "ARABIC-INDIC DIGIT FIVE ٥",
    0x666: "ARABIC-INDIC DIGIT SIX ٦",
    0x667: "ARABIC-INDIC DIGIT SEVEN ٧",
    0x668: "ARABIC-INDIC DIGIT EIGHT ٨",
    0x669: "ARABIC-INDIC DIGIT NINE ٩",
    0x66a: "ARABIC PERCENT SIGN ٪",
    0x200b: "ZERO WIDTH SPACE",
    0x200c: "ZERO WIDTH NON-JOINER",
    0x200d: "ZERO WIDTH JOINER",
    0x200e: "LEFT-TO-RIGHT MARK",
    0x200f: "RIGHT-TO-LEFT MARK",
    0x202a: "LRE",
    0x202b: "RLE",
    0x202c: "PDF",
    0x202d: "LRO",
    0x202e: "RLO",
    0xfeff: "BOM/ZWNBSP",
  };
  return names[cp] ?? `CP ${cp}`;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         PIPELINE TRACER — Question Choices              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // ─── STAGE 1: Raw JSON file ───
  console.log("\n\n========== STAGE 1: RAW JSON FILE ==========");
  const jsonPath = path.resolve(PROJECT_ROOT, "upload/question_set_1.json");
  const rawBytes = fs.readFileSync(jsonPath);
  console.log(`File size: ${rawBytes.length} bytes`);
  console.log(`First 4 bytes (hex): ${Array.from(rawBytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
  console.log(`BOM check: ${rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf ? "UTF-8 BOM present" : "No BOM"}`);

  const rawText = rawBytes.toString("utf-8");
  const parsed = JSON.parse(rawText);

  // Pick a few representative questions
  const testQuestions = [
    parsed.questions.find((q: any) => q.id === 1),   // verbal analogy with " : " separator
    parsed.questions.find((q: any) => q.id === 10),  // has " ١٠٠٪" suffix
    parsed.questions.find((q: any) => q.id === 12),  // sentence completion with " - "
    parsed.questions.find((q: any) => q.id === 30),  // has " ١٠٠٪" suffix
  ];

  for (const q of testQuestions) {
    console.log(`\n\n─── Question #${q.id} (type: ${q.type}) ───`);
    console.log(`Stem: "${q.question}"`);
    dumpString("STEM raw from JSON", q.question);
    for (const [key, val] of Object.entries(q.options)) {
      dumpString(`OPTION "${key}" raw from JSON`, val as string);
    }
  }

  // ─── STAGE 2: Normalizer output ───
  console.log("\n\n========== STAGE 2: NORMALIZER OUTPUT ==========");
  const validation = validateSource(parsed);
  if (!validation.ok) {
    console.error("Validation failed:", validation.errors);
    process.exit(1);
  }

  for (const q of testQuestions) {
    const normalized = normalizeQuestion("question_set_1", q);
    console.log(`\n─── Question #${q.id} after normalizeQuestion ───`);
    dumpString("STEM after cleanText", normalized.stem);
    for (const opt of normalized.options) {
      dumpString(`OPTION "${opt.key}" after normalizeOptions`, opt.text);
    }
    console.log(`  Stored as JSON: ${JSON.stringify(normalized.options)}`);
  }

  // ─── STAGE 3: Database content ───
  console.log("\n\n========== STAGE 3: DATABASE CONTENT ==========");
  const source = await db.source.findUnique({ where: { slug: "question_set_1" } });
  if (!source) {
    console.error("Source not found!");
    process.exit(1);
  }

  for (const q of testQuestions) {
    const dbQ = await db.question.findFirst({
      where: { sourceId: source.id, sourceLocalId: q.id },
      include: { category: true, source: true },
    });
    if (!dbQ) {
      console.log(`\n─── Question #${q.id} NOT FOUND in DB ───`);
      continue;
    }
    console.log(`\n─── Question #${q.id} from DATABASE ───`);
    dumpString("STEM from DB", dbQ.stem);
    console.log(`  options column (raw JSON string): ${dbQ.options}`);
    const parsedOpts = JSON.parse(dbQ.options) as Array<{ key: string; text: string }>;
    for (const opt of parsedOpts) {
      dumpString(`OPTION "${opt.key}" from DB`, opt.text);
    }
  }

  // ─── STAGE 4: DTO deserialization (what the API returns) ───
  console.log("\n\n========== STAGE 4: DTO DESERIALIZATION (API response) ==========");
  for (const q of testQuestions) {
    const dbQ = await db.question.findFirst({
      where: { sourceId: source.id, sourceLocalId: q.id },
      include: { category: true, source: true },
    });
    if (!dbQ) continue;
    const dto = toQuestionDTO(dbQ);
    console.log(`\n─── Question #${q.id} as DTO ───`);
    dumpString("STEM (DTO)", dto.stem);
    for (const opt of dto.options) {
      dumpString(`OPTION "${opt.key}" (DTO)`, opt.text);
    }
    console.log(`  Serialized for client: ${JSON.stringify(dto.options)}`);
  }

  await db.$disconnect();
  console.log("\n\n✓ Pipeline trace complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
