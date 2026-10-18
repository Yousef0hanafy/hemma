// =====================================================================
// Achievement catalogue — the single source of truth.
// Unlock rules live in src/server/achievements.ts (evaluated after
// attempts, exams and reviews); unlocked slugs are stored on UserProfile.
// =====================================================================

import type { AchievementDTO } from "@/lib/content/dto";

export const ACHIEVEMENTS: AchievementDTO[] = [
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

export const ACHIEVEMENTS_BY_SLUG = new Map(ACHIEVEMENTS.map((a) => [a.slug, a]));
