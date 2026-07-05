# منصة همّة التعليمية — Hema Educational Platform

> منصة تعليمية متميّزة لتحضير اختبار القدرات اللفظية، مبنية بأحدث تقنيات الويب.

A premium Arabic RTL Learning Management System (LMS) for Qudurat (القدرات اللفظية) exam preparation, built with Next.js 16, TypeScript, TailwindCSS 4, Prisma, and Neon Postgres.

---

## ✨ الميزات الرئيسية (Key Features)

### أوضاع التعلّم (Learning Modes)
- **وضع المذاكرة (Study Mode)** — تفسير فوري بعد كل سؤال مع نصائح دراسية وتقييم الثقة
- **وضع الاختبار (Exam Mode)** — محاكاة وقتية للاختبار الحقيقي مع تقرير مفصّل
- **وضع المراجعة (Revision Mode)** — حديقة الأخطاء، المفضلة، وبطاقات المراجعة
- **البحث والتصفّح (Search)** — بحث نصي مع تصفية بالفئة والمصدر والصعوبة

### الفئات المدعومة (Supported Categories)
- التناظر اللفظي (Verbal Analogy)
- إكمال الجمل (Sentence Completion)
- الخطأ السياقي (Contextual Error)
- المفردة الشاذة (Odd Word Out)
- استيعاب المقروء (Reading Comprehension)

### نظام التحفيز (Gamification)
- نقاط الخبرة (XP) مع مستويات
- سلاسل الأيام المتتالية (Streaks) مع دروع حماية
- ٨ إنجازات قابلة للفتح
- مهام يومية (Daily Quests)
- حلقات إتقان متحركة لكل فئة
- توصيات شخصية لنقاط الضعف

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Neon Postgres |
| ORM | Prisma 6 |
| State | Zustand + TanStack Query patterns |
| Animations | Framer Motion |
| Fonts | Cairo + Noto Naskh Arabic + Amiri |

---

## 🚀 التشغيل المحلي (Local Development)

### المتطلبات (Prerequisites)
- Node.js 18+ أو Bun
- قاعدة بيانات Neon Postgres (أو أي Postgres)

### الخطوات (Setup)

1. **استنساخ المستودع:**
   ```bash
   git clone https://github.com/Yousef0hanafy/hemma.git
   cd hemma
   ```

2. **تثبيت الاعتماديات:**
   ```bash
   bun install
   # أو: npm install
   ```

3. **إعداد متغيرات البيئة:**
   ```bash
   cp .env.example .env
   # عدّل .env وضع رابط اتصال Neon الخاص بك
   ```

4. **إنشاء قاعدة البيانات وزرع البيانات:**
   ```bash
   bun run db:push        # إنشاء الجداول
   bun run db:generate    # توليد عميل Prisma
   bun run scripts/seed-content.ts  # زرع ٦٠ سؤالاً
   ```

5. **تشغيل خادم التطوير:**
   ```bash
   bun run dev
   ```

افتح `http://localhost:3000` في المتصفح.

---

## 📦 إضافة ملفات أسئلة جديدة (Adding New Question Files)

النظام مصمّم ليكون قابلاً للتوسّع — لإضافة ملف JSON جديد:

1. ضع الملف في مجلد `upload/` (مثل `upload/question_set_3.json`)
2. أضف إدخالاً إلى `src/lib/content/manifest.ts`:
   ```typescript
   { slug: "question_set_3", path: "upload/question_set_3.json" }
   ```
3. شغّل:
   ```bash
   bun run scripts/seed-content.ts
   ```

لا حاجة لتعديل أي كود آخر — الواجهة ستكتشف المصدر الجديد تلقائياً.

### تنسيق ملف JSON المتوقّع:
```json
{
  "document_title": "عنوان الملف",
  "date": "2026/6/15",
  "questions": [
    {
      "id": 1,
      "type": "تناظر لفظي",
      "question": "نص السؤال",
      "options": { "أ": "خيار 1", "ب": "خيار 2", "ج": "خيار 3", "د": "خيار 4" },
      "answer": "ب",
      "citation": "[cite: 1, 2]"
    }
  ]
}
```

---

## 📁 هيكل المشروع (Project Structure)

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # RTL layout + fonts + metadata
│   ├── page.tsx             # Single-route entry
│   └── globals.css          # Theme + animations
├── components/
│   ├── qudurat/             # All app-specific components
│   │   ├── AppShell.tsx     # Layout shell + footer
│   │   ├── AppHeader.tsx    # Navbar with logo
│   │   ├── AppNav.tsx       # Side rail + mobile bottom nav
│   │   ├── SplashScreen.tsx # Premium loading screen
│   │   ├── DashboardView.tsx
│   │   ├── StudyPlayerView.tsx
│   │   ├── ExamSetupView.tsx
│   │   ├── ExamRunnerView.tsx
│   │   ├── ExamReportView.tsx
│   │   ├── RevisionView.tsx
│   │   ├── StatsView.tsx
│   │   ├── AchievementsView.tsx
│   │   ├── SearchView.tsx
│   │   ├── MasteryRing.tsx  # Animated SVG ring
│   │   └── LoadingStates.tsx
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── content/             # Content pipeline + types
│   │   ├── types.ts
│   │   ├── normalize.ts     # JSON validator + normalizer
│   │   ├── manifest.ts      # Source file registry
│   │   ├── dto.ts           # Data transfer objects
│   │   └── ui-helpers.ts    # Arabic numerals, formatting
│   ├── engine/              # Business logic (pure functions)
│   │   └── gamification.ts  # XP, levels, streaks, mastery
│   ├── hooks/               # React data hooks
│   │   └── use-data.ts
│   ├── store/               # Zustand stores
│   │   └── view-store.ts
│   ├── db.ts                # Prisma client
│   └── utils.ts
├── server/
│   └── actions/             # Next.js Server Actions
│       ├── questions.ts
│       └── progress.ts
prisma/
└── schema.prisma            # Database schema (Postgres)
scripts/
├── seed-content.ts          # Ingestion pipeline
├── generate-icons.py        # Logo variant generator
└── trace-pipeline.ts        # Data integrity tracer
public/                      # Logo, favicon, PWA icons, manifest
```

---

## 🗄️ قاعدة البيانات (Database)

يستخدم المشروع **Neon Postgres** (serverless Postgres). المخطط يشمل:

- `Source` — ملفات المصدر (question_set_1.json، إلخ)
- `Category` — الفئات (تناظر لفظي، إكمال جمل، ...)
- `Question` — الأسئلة مع الخيارات والتفسير
- `Passage` — القطع القرائية (للاستخدام المستقبلي)
- `Attempt` — محاولات الإجابة (للتتبّع والإحصاءات)
- `Favorite` — الأسئلة المفضّلة
- `DailyActivity` — النشاط اليومي (للسلاسل والخرائط الحرارية)
- `UserProfile` — الملف الشخصي (XP، المستوى، السلسلة)
- `Achievement` — الإنجازات القابلة للفتح

للاتصال بـ Neon، ضع رابط الاتصال في `.env`:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

---

## 🎨 التصميم (Design)

- **اتجاه RTL** أصيل مع `dir="rtl"` وخصائص CSS المنطقية
- **خطوط عربية متميّزة:** Cairo (واجهة) + Noto Naskh Arabic (أسئلة) + Amiri (عناوين)
- **لوحة ألوان دافئة:** كريم + زمرّد + كهرماني
- **وضع فاتح/داكن** كامل
- **تجاوب كامل** مع الموبايل والديسكتوب
- **حركات سلسة** مع Framer Motion

---

## 👨‍💻 المُطوّر (Developer)

**Developed By [Youssef Hanafy](https://portfolio-yousef-hanafy.vercel.app/)**

---

## 📄 الترخيص (License)

هذا المشروع مملوك لمنصة همّة التعليمية.
