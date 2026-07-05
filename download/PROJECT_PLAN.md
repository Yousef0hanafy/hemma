# منصة قُدرات LMS — الخطة الشاملة
# Qudurat LMS — Comprehensive Project Plan

> **Document type:** Architecture & Product Blueprint (pre-implementation deliverable)
> **Status:** Approved baseline for MVP build
> **Date:** 2026-07-06

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│  Single-page Next.js 16 App (route: /)                           │
│  RTL Arabic-first · TailwindCSS 4 · shadcn/ui · Framer Motion    │
│  Zustand view-state navigation (no client-side router needed)    │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Server Actions + TanStack Query
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       BUSINESS LOGIC LAYER                       │
│  • Question selection algorithms (adaptive, exam, revision)      │
│  • Spaced repetition scheduler (SM-2 inspired)                   │
│  • XP / Streak / Mastery calculators                             │
│  • Auto-explanation generator (per-category templates)           │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         DATA ACCESS LAYER                        │
│  Prisma Client (single source of truth)                          │
│  src/lib/db.ts · src/server/actions/*.ts                         │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER                            │
│  SQLite (dev) — schema is Prisma-portable to Neon Postgres       │
│  Migration path documented in §10                                │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CONTENT INGESTION PIPELINE                   │
│  JSON files (upload/) → Validator → Normalizer → Seeder → DB     │
│  Plugin-style: drop a new JSON → run `bun run seed:content`      │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Routing model** | Single `/` route + Zustand view-state | Sandbox constraint + creates an "app-like" immersive experience |
| **State management** | Zustand (UI) + TanStack Query (server) | Matches installed stack; minimal boilerplate |
| **Mutation layer** | Next.js Server Actions | Type-safe, no API boilerplate, progressive enhancement |
| **DB abstraction** | Prisma ORM with portable schema | Swap datasource provider from `sqlite` to `postgres` to migrate to Neon |
| **RTL strategy** | `<html dir="rtl" lang="ar">` + logical CSS props (ps-/pe-/ms-/me-) | Native browser RTL; no JS layout mirroring |
| **Arabic typography** | "Noto Naskh Arabic" (body) + "Cairo" (UI) + "Amiri" (display) | Readable naskh for questions, modern sans for UI, classic serif for headings |

### 1.3 Layer Separation Guarantees

- **Content** → `src/lib/content/` (ingestion, validation, types)
- **Business logic** → `src/lib/engine/` (algorithms, no React/DB imports)
- **Data access** → `src/server/actions/` and `src/lib/db.ts`
- **Presentation** → `src/components/` and `src/app/`

A new JSON file requires **zero** changes to business logic or presentation — only a new entry in the seeder manifest.

---

## 2. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

// A single source file = one import batch (question_set_1.json, etc.)
model Source {
  id           String     @id @default(cuid())
  slug         String     @unique   // e.g. "question_set_1"
  title        String               // document_title from JSON
  date         String?              // raw date string from JSON
  importedAt   DateTime   @default(now())
  questionCount Int      @default(0)
  questions    Question[]
  metadata     String     @default("{}") // JSON string for portability
}

// Master list of categories — auto-discovered from JSON
model Category {
  id            String      @id @default(cuid())
  slug          String      @unique  // "verbal_analogy"
  nameAr        String      @unique  // "تناظر لفظي"
  descriptionAr String?
  icon          String?              // lucide icon name
  colorTheme    String?              // tailwind hue, e.g. "emerald"
  displayOrder  Int         @default(99)
  questions     Question[]
  // stats derived at runtime
}

// Unified question model — schema is identical across all sources
model Question {
  id            String     @id @default(cuid())
  sourceId      String
  source        Source     @relation(fields: [sourceId], references: [id])
  categoryId    String
  category      Category   @relation(fields: [categoryId], references: [id])
  sourceLocalId Int                 // original "id" inside its JSON
  type          String               // raw type string from JSON
  stem          String               // question text
  options       String               // JSON: {"أ": "...", "ب": "...", ...}
  correctKey    String               // "أ" | "ب" | "ج" | "د"
  explanation   String?              // auto-generated; editable later
  studyTip      String?              // auto-generated; editable later
  difficulty    String     @default("medium") // easy | medium | hard
  tags          String     @default("[]")     // JSON array
  citation      String?              // optional citation from JSON
  passageId     String?              // optional link to Passage for reading comp
  metadata      String     @default("{}")     // extensible JSON
  createdAt     DateTime   @default(now())
  attempts      Attempt[]
  favorites     Favorite[]

  @@unique([sourceId, sourceLocalId])
  @@index([categoryId])
  @@index([sourceId])
}

// Reading passage — anchored to multiple questions (for استيعاب المقروء)
model Passage {
  id          String     @id @default(cuid())
  sourceId    String
  titleAr     String?
  bodyAr      String     // the passage text
  metadata    String     @default("{}")
  questions   Question[]
}

// Every answer attempt — powers analytics + spaced repetition
model Attempt {
  id           String   @id @default(cuid())
  // Anonymous user bucket (sandbox has no auth requirement for MVP)
  userBucket   String   @default("default")
  questionId   String
  question     Question @relation(fields: [questionId], references: [id])
  selectedKey  String?
  isCorrect    Boolean
  mode         String   // "study" | "exam" | "revision" | "flashcard"
  sessionId    String?  // groups attempts in one exam/revision session
  timeMs       Int      @default(0)
  createdAt    DateTime @default(now())

  @@index([userBucket, questionId])
  @@index([sessionId])
  @@index([createdAt])
}

model Favorite {
  id          String   @id @default(cuid())
  userBucket  String   @default("default")
  questionId  String
  question    Question @relation(fields: [questionId], references: [id])
  note        String?
  createdAt   DateTime @default(now())

  @@unique([userBucket, questionId])
}

// Daily activity tracker — powers streaks + heatmap
model DailyActivity {
  id           String   @id @default(cuid())
  userBucket   String   @default("default")
  date         String   // "2026-07-06" (YYYY-MM-DD)
  attempts     Int      @default(0)
  correct      Int      @default(0)
  xpEarned     Int      @default(0)
  // Per-category mastery snapshot for trend tracking
  categoryStats String  @default("{}") // JSON

  @@unique([userBucket, date])
  @@index([userBucket])
}

// User state (XP, level, streak, settings) — keyed by bucket
model UserProfile {
  id            String   @id @default(cuid())
  userBucket    String   @unique @default("default")
  totalXp       Int      @default(0)
  level         Int      @default(1)
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastActiveDate String? // "YYYY-MM-DD"
  streakShields Int      @default(1)  // grace days per week
  settings      String   @default("{}") // JSON: theme, sound, etc.
  unlockedAchievements String @default("[]") // JSON array of slugs
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Achievement {
  id           String   @id @default(cuid())
  slug         String   @unique   // "first_correct", "streak_7", etc.
  nameAr       String
  descriptionAr String
  iconAr       String              // emoji or lucide name
  xpReward     Int      @default(0)
  threshold    Int                 // numeric threshold
  category     String              // "streak" | "xp" | "mastery" | "speed" | "volume"
}
```

### 2.1 Why this schema is "future-proof"

- **`metadata` JSON column on every model** → new fields without migrations
- **`tags` array on Question** → cross-category taxonomies (e.g., "philosophy", "medical")
- **`Passage` model is independent** → reading comprehension questions can share passages
- **`UserProfile.settings` JSON** → per-user theme, sound, font-size without schema changes
- **`Achievement` is data-driven** → adding badges is a DB insert, not code change
- **`userBucket` field** → ready for multi-user / auth without refactor

---

## 3. Content Ingestion Pipeline

```
JSON file (upload/question_set_N.json)
   │
   ▼
[1. Loader]  — read file, parse JSON, attach source slug
   │
   ▼
[2. Validator] — Zod schema validates structure:
   • Required: id (int), type (string), question (string),
     options (object with أ/ب/ج/د keys), answer (one of keys)
   • Optional: citation (string)
   • Throws with row-level error context
   │
   ▼
[3. Normalizer] — clean text:
   • Strip PDF-extraction noise ("١٠٠٪" suffixes)
   • Normalize Arabic punctuation
   • Trim whitespace
   • Convert option keys to canonical Arabic letters
   │
   ▼
[4. Categorizer] — map raw "type" to category slug:
   • "تناظر لفظي"     → verbal_analogy
   • "إكمال جمل"      → sentence_completion
   • "خطأ سياقي"      → contextual_error
   • "المفردة الشاذة" → odd_word_out
   • "استيعاب المقروء" → reading_comprehension
   • Unknown types    → auto-create new category (slugify)
   │
   ▼
[5. Explanation Generator] — per-category template-based:
   • Verbal Analogy: detect relationship type (cause/effect, part/whole, etc.)
   • Sentence Completion: identify grammatical cues
   • Contextual Error: explain why the chosen word breaks meaning
   • Odd Word Out: identify the common theme of the other three
   • Reading Comprehension: surface signal phrase from question
   Each template produces an Arabic explanation + study tip
   │
   ▼
[6. Difficulty Estimator] — heuristic:
   • Sentence length, vocabulary rarity, option similarity
   • Default: "medium"; adjust to easy/hard
   │
   ▼
[7. Seeder] — upsert into Prisma:
   • Idempotent (re-runnable)
   • Updates Source.questionCount
   • Atomic transaction per source file
```

### 3.1 Adding a New JSON File (Operator Guide)

1. Place file at `upload/question_set_N.json` (or any name).
2. Add an entry to `src/lib/content/manifest.ts`:
   ```ts
   { slug: "question_set_3", path: "upload/question_set_3.json" }
   ```
3. Run `bun run db:push && bun run seed:content`.
4. Done. No code changes to UI or business logic.

---

## 4. Question Data Model (TypeScript)

```ts
// src/lib/content/types.ts

export interface RawQuestionJSON {
  id: number;
  type: string;           // Arabic type string from source
  question: string;
  options: Record<ArabicLetter, string>;
  answer: ArabicLetter;
  citation?: string;
}

export interface NormalizedQuestion {
  // Identity
  sourceId: string;
  sourceLocalId: number;
  // Categorization
  categorySlug: string;
  categoryNameAr: string;
  rawType: string;
  // Content
  stem: string;                          // cleaned question text
  options: QuestionOption[];             // ordered array
  correctKey: ArabicLetter;
  // Enrichment (auto-generated)
  explanation: string;
  studyTip: string;
  difficulty: Difficulty;
  tags: string[];
  // Source metadata
  citation?: string;
  passage?: Passage;
  metadata: Record<string, unknown>;
}

export interface QuestionOption {
  key: ArabicLetter;    // "أ" | "ب" | "ج" | "د"
  text: string;
}

export type ArabicLetter = "أ" | "ب" | "ج" | "د";
export type Difficulty = "easy" | "medium" | "hard";
export type StudyMode = "study" | "exam" | "revision" | "flashcard";
```

---

## 5. Component Hierarchy

```
src/app/page.tsx                     ← single route, hydration root
└── <AppShell/>                      ← layout, RTL, theme provider
    ├── <AppHeader/>                 ← logo, streak chip, XP chip, level chip
    ├── <AppNav/>                    ← bottom nav (mobile) / side rail (desktop)
    ├── <AppMain/>                   ← view renderer (Zustand-driven)
    │   ├── DashboardView
    │   │   ├── <StreakHero/>        ← flame + days + shield count
    │   │   ├── <DailyQuestCard/>    ← today's goal with progress
    │   │   ├── <MasteryRings/>      ← 5 animated rings, one per category
    │   │   ├── <QuickActions/>      ← "مذاكرة سريعة", "اختبار قصير", "مراجعة الأخطاء"
    │   │   ├── <SourceSplitCard/>   ← unified vs per-source toggle
    │   │   └── <ActivityHeatmap/>   ← GitHub-style 12-week grid
    │   ├── StudyView
    │   │   ├── <CategorySelector/>  ← pick category or "all"
    │   │   ├── <SourceFilter/>      ← filter by source file(s)
    │   │   ├── <QuestionPlayer/>
    │   │   │   ├── <QuestionStem/>
    │   │   │   ├── <OptionsList/>   ← radio cards with Arabic letters
    │   │   │   ├── <FeedbackPanel/> ← correct/wrong + explanation + tip
    │   │   │   └── <PlayerFooter/>  ← prev / next / mark favorite
    │   │   └── <SessionProgress/>   ← "5 / 12"
    │   ├── ExamView
    │   │   ├── <ExamSetup/>         ← count, duration, category, source
    │   │   ├── <ExamPlayer/>        ← timer, hidden answers, navigation grid
    │   │   └── <ExamReport/>        ← score ring, per-category breakdown, review
    │   ├── RevisionView
    │   │   ├── <MistakeGarden/>     ← cards styled as "seeds to grow"
    │   │   ├── <FavoritesList/>
    │   │   └── <FlashcardPlayer/>   ← flip animation
    │   ├── StatsView
    │   │   ├── <MasteryTrendChart/> ← recharts line per category
    │   │   ├── <WeaknessRadar/>     ← radar of 5 categories
    │   │   ├── <SpeedHistogram/>
    │   │   └── <AchievementsGrid/>
    │   └── SearchView
    │       ├── <SearchBar/>
    │       ├── <FilterChips/>       ← category, source, difficulty, favorites
    │       └── <QuestionResultList/>
    ├── <AppFooter/>                 ← credits, source attribution
    └── <Toaster/>                   ← sonner toasts for XP/achievements
```

---

## 6. Routing Structure (Single-Route Constraint)

The sandbox only exposes `/`. We implement **view-state navigation** via Zustand:

```ts
// src/lib/store/view-store.ts
type ViewKey =
  | { kind: "dashboard" }
  | { kind: "study"; categorySlug?: string; sourceSlugs?: string[] }
  | { kind: "exam"; setup?: ExamSetup }
  | { kind: "exam_running"; sessionId: string }
  | { kind: "exam_report"; sessionId: string }
  | { kind: "revision"; tab: "mistakes" | "favorites" | "flashcards" }
  | { kind: "stats" }
  | { kind: "search"; query?: string };

interface ViewStore {
  view: ViewKey;
  history: ViewKey[];
  setView: (v: ViewKey) => void;
  back: () => void;
}
```

- **Back button** works via in-memory history stack
- **Browser back** is hijacked via `popstate` to call `back()`
- **Deep-linkable** view state is encoded in URL hash (e.g. `#study/verbal_analogy`) — bonus

This gives users the feeling of a multi-page app while staying within the single-route constraint.

---

## 7. Educational UX Decisions

### 7.1 Pedagogical Principles Applied

| Principle | Implementation |
|---|---|
| **Active recall** | Every interaction forces a choice before revealing explanation |
| **Spaced repetition** | Wrong answers re-appear at SM-2 intervals in revision |
| **Immediate feedback** | Study mode shows explanation in-place, no modal friction |
| **Interleaving** | "Mixed practice" mode alternates categories within a session |
| **Metacognition** | After answering, user self-rates confidence (★) — feeds algorithm |
| **Growth mindset language** | Wrong answers labeled "بذرة تنمو" (a seed growing), not "خطأ" |
| **Cognitive load** | One question per screen; options use Arabic letters as anchors |
| **Dual coding** | Categories have color + icon + Arabic name (3 cues) |

### 7.2 Premium Touches

- **Streak fire animation** — CSS flame flicker when active
- **Mastery ring** — animated SVG arc filling on mount
- **Achievement unlock toast** — confetti-style particle burst
- **Question transitions** — Framer Motion spring slide
- **Haptic-style feedback** — subtle scale + shadow on tap
- **Reading mode** — passage displayed in a side panel with verse-style typography for استيعاب المقروء
- **Confidence indicator** — 3-star rating below each answer reveals metacognition
- **Daily quest** — randomized goal each day ("حل 10 أسئلة في 3 فئات") for variety

### 7.3 Accessibility (RTL-specific)

- All interactive elements ≥ 44px touch target
- Keyboard navigation: `1-4` keys map to options `أ/ب/ج/د`, `Enter` to submit
- High-contrast option for low-vision users
- `aria-label` on all icon-only buttons (Arabic labels)
- Reduced-motion mode respected via `prefers-reduced-motion`

---

## 8. Feature Prioritization

### MVP (must ship in v1)

| Feature | Status |
|---|---|
| Ingestion pipeline (both JSON files) | ✅ |
| 5 categories with auto-discovery | ✅ |
| Study Mode (immediate feedback + explanation) | ✅ |
| Exam Mode (timed, hidden answers, score report) | ✅ |
| Revision Mode (mistakes + favorites) | ✅ |
| Flashcards (flip animation) | ✅ |
| Search + filter (text, category, source) | ✅ |
| Dashboard with streak, XP, mastery rings | ✅ |
| Daily quest | ✅ |
| Auto-generated explanations per category | ✅ |
| Source toggle (unified vs per-source) | ✅ |
| 5 achievement badges | ✅ |
| RTL Arabic premium typography | ✅ |
| Light/dark mode | ✅ |
| Responsive mobile + desktop | ✅ |

### Post-MVP (v2 — design ready, not built)

- Real auth (NextAuth) replacing `userBucket`
- AI-generated hints via `z-ai-web-dev-sdk`
- Adaptive difficulty algorithm (item response theory)
- Reading passages for استيعاب المقروء
- Onboarding diagnostic quiz
- Streak shields marketplace
- Custom question lists / teacher mode
- Neon Postgres migration (already portable)

---

## 9. Risks & Assumptions

| Risk | Mitigation |
|---|---|
| **No reading passages in source JSON** | Build the Passage model; for MVP, استيعاب المقروء questions display as standalone (the question references context implicitly). v2 will allow passage attachment. |
| **PDF extraction noise** ("١٠٠٪" suffixes) | Normalizer strips these patterns before insert |
| **Single-route constraint limits deep linking** | URL hash encodes view state for shareable links |
| **No auth in sandbox** | `userBucket = "default"`; schema is multi-user ready |
| **Neon requested but sandbox uses SQLite** | Prisma schema is portable — change `provider` + `DATABASE_URL` |
| **Auto-generated explanations may be generic** | Template-based, but easily edited in DB later; v2 adds AI generation |
| **Arabic typography rendering** | Load Noto Naskh Arabic + Cairo + Amiri via next/font/google |
| **Cognitive overload from too many features** | Progressive disclosure — Dashboard surfaces 3 actions; rest behind nav |

---

## 10. Long-Term Scalability

### 10.1 Adding JSON File #N

```
1. Drop file in /upload
2. Add slug to src/lib/content/manifest.ts
3. Run: bun run db:push && bun run seed:content
4. Done — UI auto-discovers new source, no code changes
```

### 10.2 Migrating to Neon Postgres

```prisma
// schema.prisma — change ONE line:
datasource db {
  provider = "postgres"   // was "sqlite"
  url      = env("DATABASE_URL")  // Neon connection string
}
```

Then `bun run db:push`. All Prisma queries work unchanged.

### 10.3 Adding New Question Types

- New `type` strings auto-create new categories
- Question player renders generically (MCQ UI handles all 4-option questions)
- For non-MCQ types in future (true/false, fill-blank), add a `renderer` field to Question and a switch in `<QuestionPlayer/>`

### 10.4 Multi-Tenant / Auth Ready

- `userBucket` field on all user-scoped tables makes adding auth a drop-in
- Replace `"default"` with NextAuth session user ID
- No schema migration needed

### 10.5 Performance

- Prisma indexes on `categoryId`, `sourceId`, `userBucket+date`, `userBucket+questionId`
- TanStack Query caches server state per view
- Static question content cached at component level (no refetch on view change)
- Analytics queries use date-bucketed aggregates (no full table scans)

---

## 11. Success Metrics (how we'll know it's "premium")

- [ ] First-time user understands the dashboard in < 5 seconds
- [ ] A 10-question Study session completes in < 4 minutes with full engagement
- [ ] Streak + XP create a "one more question" loop
- [ ] Explanations feel genuinely educational (not "the answer is X")
- [ ] Mobile layout is single-thumb friendly
- [ ] Adding a 3rd JSON file takes < 60 seconds of operator time
- [ ] Lint passes clean, dev server runs without errors

---

**Plan status: COMPLETE. Proceeding to implementation.**
