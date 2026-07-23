// =====================================================================
// Seeder Script — runs the full ingestion pipeline for all manifest entries
// Usage: bun run scripts/seed-content.ts
// =====================================================================

import { db } from "../src/lib/db";
import { SOURCE_MANIFEST } from "../src/lib/content/manifest";
import { normalizeQuestion } from "../src/lib/content/normalize";
import { validateSource } from "../src/lib/content/normalize";
import { IngestionResult, NormalizedQuestion } from "../src/lib/content/types";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Default achievements to seed once
const DEFAULT_ACHIEVEMENTS = [
  { slug: "first_correct",   nameAr: "البداية الموفقة",   descriptionAr: "أجبت إجابة صحيحة لأول مرة",             iconAr: "🌱", xpReward: 20,  threshold: 1,   category: "volume" },
  { slug: "streak_3",        nameAr: "شُعلة ثلاثة أيام",  descriptionAr: "حافظ على سلسلة ٣ أيام متتالية",          iconAr: "🔥", xpReward: 50,  threshold: 3,   category: "streak" },
  { slug: "streak_7",        nameAr: "أسبوع متوقد",       descriptionAr: "حافظ على سلسلة ٧ أيام متتالية",          iconAr: "⚡", xpReward: 120, threshold: 7,   category: "streak" },
  { slug: "streak_14",       nameAr: "نصف شهر متقد",      descriptionAr: "حافظ على سلسلة ١٤ يومًا متتالية",        iconAr: "🌟", xpReward: 250, threshold: 14,  category: "streak" },
  { slug: "streak_30",       nameAr: "شهر من الإتقان",    descriptionAr: "حافظ على سلسلة ٣٠ يومًا متتالية",        iconAr: "👑", xpReward: 500, threshold: 30,  category: "streak" },
  { slug: "streak_60",       nameAr: "شهران متوهجان",     descriptionAr: "حافظ على سلسلة ٦٠ يومًا متتالية",        iconAr: "💎", xpReward: 800, threshold: 60,  category: "streak" },
  { slug: "streak_100",      nameAr: "مئة يوم من التميز", descriptionAr: "حافظ على سلسلة ١٠٠ يوم متتالية",          iconAr: "🏅", xpReward: 1500, threshold: 100, category: "streak" },
  { slug: "questions_25",    nameAr: "خمسة وعشرون",        descriptionAr: "أجبت ٢٥ سؤالًا",                          iconAr: "📝", xpReward: 50,  threshold: 25,  category: "volume" },
  { slug: "questions_50",    nameAr: "خمسون سؤالًا",       descriptionAr: "أجبت ٥٠ سؤالًا",                          iconAr: "📚", xpReward: 100, threshold: 50,  category: "volume" },
  { slug: "questions_100",   nameAr: "مئة سؤال",           descriptionAr: "أجبت ١٠٠ سؤال",                           iconAr: "📖", xpReward: 200, threshold: 100, category: "volume" },
  { slug: "questions_200",   nameAr: "مئتان سؤال",         descriptionAr: "أجبت ٢٠٠ سؤال",                           iconAr: "🎓", xpReward: 300, threshold: 200, category: "volume" },
  { slug: "questions_500",   nameAr: "خمسمئة سؤال",        descriptionAr: "أجبت ٥٠٠ سؤال — أنت ملتزم حقًا!",          iconAr: "🧠", xpReward: 600, threshold: 500, category: "volume" },
  { slug: "questions_1000",  nameAr: "الألف الأولى",       descriptionAr: "أجبت ١٠٠٠ سؤال — إنجاز استثنائي!",        iconAr: "🚀", xpReward: 1200, threshold: 1000, category: "volume" },
  { slug: "master_category", nameAr: "إتقان فئة",          descriptionAr: "بلغت إتقان ٨٠٪ في فئة واحدة",            iconAr: "🏆", xpReward: 250, threshold: 80,  category: "mastery" },
  { slug: "exam_pass",       nameAr: "نجاح في الاختبار",   descriptionAr: "اجتزت اختبارًا بنسبة ٧٠٪ أو أعلى",      iconAr: "✅", xpReward: 80,  threshold: 70,  category: "mastery" },
  { slug: "exam_perfect",    nameAr: "العلامة الكاملة",    descriptionAr: "حصلت على ١٠٠٪ في اختبار كامل",           iconAr: "💯", xpReward: 200, threshold: 100, category: "mastery" },
  { slug: "all_rounder",     nameAr: "موسوعي",             descriptionAr: "بلغت إتقان ٦٠٪ في جميع الفئات",          iconAr: "🌈", xpReward: 500, threshold: 60,  category: "mastery" },
  { slug: "speed_3s",        nameAr: "سريع البديهة",       descriptionAr: "أجبت على سؤال في أقل من ٣ ثوانٍ",        iconAr: "⚡", xpReward: 30,  threshold: 3,   category: "speed" },
  { slug: "speed_10",        nameAr: "السرعة الخاطفة",     descriptionAr: "أجبت ١٠ أسئلة بمعدل أقل من ١٥ ثانية",    iconAr: "💨", xpReward: 150, threshold: 10,  category: "speed" },
  { slug: "lightning",       nameAr: "برق",                descriptionAr: "أجبت على سؤال في أقل من ثانيتين",         iconAr: "🌩️", xpReward: 50,  threshold: 2,   category: "speed" },
  { slug: "review_30",       nameAr: "مراجعة منتظمة",      descriptionAr: "أتممت ٣٠ مراجعة بالتكرار المتباعد",      iconAr: "🔄", xpReward: 100, threshold: 30,  category: "revision" },
  { slug: "review_100",      nameAr: "مئة مراجعة",         descriptionAr: "أتممت ١٠٠ مراجعة بالتكرار المتباعد",     iconAr: "♻️", xpReward: 300, threshold: 100, category: "revision" },
  { slug: "review_500",      nameAr: "خمسمئة مراجعة",      descriptionAr: "أتممت ٥٠٠ مراجعة — الالتزام هو المفتاح",  iconAr: "🏅", xpReward: 800, threshold: 500, category: "revision" },
];

async function seedAchievements() {
  console.log("\n── Seeding achievements ──");
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { slug: a.slug },
      update: a,
      create: a,
    });
  }
  console.log(`✓ ${DEFAULT_ACHIEVEMENTS.length} achievements ready`);
}

async function ensureUserProfile() {
  console.log("\n── Ensuring default user profile ──");
  await db.userProfile.upsert({
    where: { userBucket: "default" },
    update: {},
    create: { userBucket: "default" },
  });
  console.log("✓ Default profile ready");
}

async function ingestSource(entry: { slug: string; path: string }): Promise<IngestionResult> {
  const fullPath = path.resolve(PROJECT_ROOT, entry.path);
  const result: IngestionResult = {
    sourceSlug: entry.slug,
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    categories: [],
  };

  console.log(`\n── Ingesting: ${entry.slug} (${entry.path}) ──`);

  if (!fs.existsSync(fullPath)) {
    result.errors.push(`File not found: ${fullPath}`);
    console.error(`✗ File not found: ${fullPath}`);
    return result;
  }

  const rawText = fs.readFileSync(fullPath, "utf-8");
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch (e) {
    result.errors.push(`Invalid JSON: ${(e as Error).message}`);
    console.error(`✗ Invalid JSON: ${(e as Error).message}`);
    return result;
  }

  const validation = validateSource(rawJson);
  if (!validation.ok || !validation.data) {
    result.errors.push(...validation.errors);
    console.error(`✗ Validation failed:`, validation.errors);
    return result;
  }

  const source = validation.data;
  result.total = source.questions.length;
  console.log(`  Parsed ${source.questions.length} questions from "${source.document_title}"`);

  // Upsert Source record
  const sourceRecord = await db.source.upsert({
    where: { slug: entry.slug },
    update: {
      title: source.document_title,
      date: source.date ?? null,
    },
    create: {
      slug: entry.slug,
      title: source.document_title,
      date: source.date ?? null,
    },
  });

  // Track category names for this source
  const categoryNames = new Set<string>();

  for (const rawQ of source.questions) {
    try {
      const normalized: NormalizedQuestion = normalizeQuestion(entry.slug, rawQ);
      categoryNames.add(normalized.categoryNameAr);

      // Upsert Category
      const cat = await db.category.upsert({
        where: { slug: normalized.categorySlug },
        update: { nameAr: normalized.categoryNameAr },
        create: {
          slug: normalized.categorySlug,
          nameAr: normalized.categoryNameAr,
        },
      });

      // Upsert Question
      await db.question.upsert({
        where: {
          sourceId_sourceLocalId: {
            sourceId: sourceRecord.id,
            sourceLocalId: normalized.sourceLocalId,
          },
        },
        update: {
          categoryId: cat.id,
          type: normalized.rawType,
          stem: normalized.stem,
          options: JSON.stringify(normalized.options),
          correctKey: normalized.correctKey,
          explanation: normalized.explanation,
          studyTip: normalized.studyTip,
          difficulty: normalized.difficulty,
          tags: JSON.stringify(normalized.tags),
          citation: normalized.citation ?? null,
          metadata: JSON.stringify(normalized.metadata),
        },
        create: {
          sourceId: sourceRecord.id,
          categoryId: cat.id,
          sourceLocalId: normalized.sourceLocalId,
          type: normalized.rawType,
          stem: normalized.stem,
          options: JSON.stringify(normalized.options),
          correctKey: normalized.correctKey,
          explanation: normalized.explanation,
          studyTip: normalized.studyTip,
          difficulty: normalized.difficulty,
          tags: JSON.stringify(normalized.tags),
          citation: normalized.citation ?? null,
          metadata: JSON.stringify(normalized.metadata),
        },
      });
      result.inserted++;
    } catch (e) {
      result.errors.push(`Q#${rawQ.id}: ${(e as Error).message}`);
    }
  }

  // Update Source.questionCount
  await db.source.update({
    where: { id: sourceRecord.id },
    data: { questionCount: result.inserted },
  });

  result.categories = Array.from(categoryNames);
  console.log(`  ✓ Inserted: ${result.inserted} / ${result.total}`);
  console.log(`  ✓ Categories: ${result.categories.join(", ")}`);
  if (result.errors.length > 0) {
    console.log(`  ⚠ Errors: ${result.errors.length}`);
    result.errors.slice(5).forEach((e) => console.log(`    - ${e}`));
  }

  return result;
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Qudurat LMS — Content Ingestion Pipeline  ║");
  console.log("╚════════════════════════════════════════════╝");

  await seedAchievements();
  await ensureUserProfile();

  const allResults: IngestionResult[] = [];
  for (const entry of SOURCE_MANIFEST) {
    const r = await ingestSource(entry);
    allResults.push(r);
  }

  // Final summary
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║               SUMMARY                       ║");
  console.log("╚════════════════════════════════════════════╝");
  const totals = allResults.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      inserted: acc.inserted + r.inserted,
      errors: acc.errors + r.errors.length,
    }),
    { total: 0, inserted: 0, errors: 0 }
  );
  console.log(`  Sources:  ${allResults.length}`);
  console.log(`  Total questions parsed:    ${totals.total}`);
  console.log(`  Total questions inserted:  ${totals.inserted}`);
  console.log(`  Errors:                    ${totals.errors}`);

  // Count categories in DB
  const catCount = await db.category.count();
  console.log(`  Categories in DB:          ${catCount}`);

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
