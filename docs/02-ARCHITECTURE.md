# System Architecture

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (PWA)                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐    │
│  │ App Shell│ │ AuthGate │ │ Service Worker    │    │
│  │ (Router) │ │ (Login)  │ │ (Offline Cache)   │    │
│  └────┬─────┘ └────┬─────┘ └───────────────────┘    │
│       │            │                                  │
│  ┌────▼────────────▼──────────────────────────┐      │
│  │          View Components                    │      │
│  │  Dashboard │ Study │ Exam │ Stats │ ...     │      │
│  └───────────────────┬────────────────────────┘      │
│                      │                                │
└──────────────────────┼────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Next.js Server  │
              │  (App Router)    │
              │                  │
              │  ┌────────────┐  │
              │  │  Server    │  │
              │  │  Actions   │  │
              │  └─────┬──────┘  │
              │        │         │
              │  ┌─────▼──────┐  │
              │  │  AI Layer  │  │
              │  │  (Gemini)  │  │
              │  └─────┬──────┘  │
              │        │         │
              │  ┌─────▼──────┐  │
              │  │  Prisma    │  │
              │  │  ORM       │  │
              │  └─────┬──────┘  │
              └────────┼─────────┘
                       │
              ┌────────▼────────┐
              │  Neon Postgres   │
              │  (Serverless)    │
              └─────────────────┘
```

---

## Folder Structure

```
hemma/
├── prisma/
│   └── schema.prisma           # Complete database schema
│
├── public/
│   ├── sw.js                   # Service Worker (offline + push)
│   ├── manifest.webmanifest    # PWA manifest
│   ├── icon-{192,512}.png      # App icons
│   └── logo-*.png              # Branding assets
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (RTL, fonts, providers)
│   │   ├── page.tsx            # Single-page app entry → AppShell
│   │   ├── globals.css         # Theme variables + animations
│   │   ├── global-error.tsx    # Last-resort error boundary
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │   │   └── studio/chat/stream/route.ts  # AI chat streaming
│   │   ├── terms/page.tsx      # Terms of Service
│   │   └── privacy/page.tsx    # Privacy Policy
│   │
│   ├── components/
│   │   ├── qudurat/            # Student app components
│   │   │   ├── AppShell.tsx    # Main layout + view router
│   │   │   ├── AppHeader.tsx   # Top navigation bar
│   │   │   ├── AppNav.tsx      # Sidebar + bottom nav
│   │   │   ├── AuthGate.tsx    # Auth guard + login UI
│   │   │   ├── ErrorBoundary.tsx # React error boundary
│   │   │   ├── OnboardingTour.tsx # First-time user guide
│   │   │   └── ...views        # All view components
│   │   ├── studio/             # Content Studio components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── providers/          # Session, Theme, ServiceWorker
│   │   └── notifications/      # Push notification manager
│   │
│   ├── lib/
│   │   ├── auth.ts             # NextAuth config
│   │   ├── auth-utils.ts       # getUserBucket() helper
│   │   ├── db.ts               # Prisma client (singleton)
│   │   ├── utils.ts            # cn() helper
│   │   ├── sentry-server-action.ts # Sentry action wrapper
│   │   ├── content/            # Content pipeline
│   │   │   ├── dto.ts          # Data transfer objects
│   │   │   ├── manifest.ts     # Source file registry
│   │   │   ├── normalize.ts    # JSON validator + normalizer
│   │   │   ├── types.ts        # TypeScript types
│   │   │   └── ui-helpers.ts   # Arabic formatting
│   │   ├── engine/
│   │   │   └── gamification.ts # XP, levels, streaks, mastery
│   │   ├── hooks/
│   │   │   └── use-data.ts     # Server data fetching hook
│   │   └── store/
│   │       └── view-store.ts   # Zustand view state
│   │
│   ├── server/
│   │   ├── actions/            # All server actions
│   │   │   ├── progress.ts     # Student progress (core)
│   │   │   ├── questions.ts    # Question fetching
│   │   │   ├── auth.ts         # Email/password signup
│   │   │   ├── learning-goals.ts
│   │   │   ├── leaderboard.ts
│   │   │   ├── ai-study-plan.ts
│   │   │   ├── study-plan.ts   # Heuristic study plan
│   │   │   ├── student-profile.ts
│   │   │   └── studio-*.ts     # 15+ Studio server actions
│   │   └── ai/
│   │       ├── evaluator.ts    # Gemini client + scoring
│   │       ├── prompts.ts      # AI prompt templates
│   │       ├── scoring.ts      # Heuristic fallback scoring
│   │       ├── service.ts      # AI processing pipeline
│   │       ├── study-plan-prompt.ts
│   │       └── study-plan-service.ts
│   │
│   └── instrumentation.ts      # Sentry init hook
│
├── scripts/
│   ├── seed-content.ts        # Content ingestion pipeline
│   ├── trace-pipeline.ts      # Data integrity checker
│   ├── scan-invisible.ts      # Unicode sanitization scanner
│   └── check-q30.ts           # Specific question debug
│
├── sentry.client.config.ts    # Sentry browser config
├── sentry.server.config.ts    # Sentry server config
├── sentry.edge.config.ts      # Sentry edge config
├── vitest.config.ts           # Vitest test runner config
└── next.config.ts             # Next.js + Sentry config
```

---

## Data Flow

### Student Study Session

```
1. Student selects "Study" mode
2. Server Action: fetchQuestions(filter) → Prisma → PostgreSQL
3. Questions rendered in StudyPlayerView
4. Student answers → recordAttempt() server action
5. Server:
   a. Saves attempt to DB
   b. Updates streak (updateStreak logic)
   c. Awards XP (xpForCorrect logic)
   d. Checks milestones (getCrossedXpMilestones)
   e. Updates review schedule (SM-2 algorithm)
   f. Updates daily activity
6. Response returns: { correct, xpEarned, milestone, streak }
7. UI shows result with animations, XP toast, milestone celebration
```

### Content Import Flow

```
1. Admin uploads JSON file or pastes text
2. previewImport() → parses + validates + normalizes
3. Admin reviews preview → confirms
4. confirmImport() →
   a. Creates/updates Source record
   b. Creates/updates Category records
   c. Inserts Questions with relations
   d. If auto-processing enabled: kicks off AI pipeline
5. AI pipeline (async):
   a. Quality check via Gemini
   b. Difficulty estimation via Gemini
   c. Explanation generation via Gemini
6. Results stored in AIProcessingLog
```

---

## Auth Flow

```
                    ┌─────────────────────────┐
                    │      User visits /       │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │    AuthGate checks       │
                    │    session status        │
                    └──────┬─────────┬────────┘
                           │         │
                    ┌──────▼──┐ ┌────▼─────────┐
                    │ Loading │ │Unauthenticated│
                    │(spinner)│ │  (Login UI)   │
                    └─────────┘ └────┬─────────┘
                                     │
                          ┌──────────▼─────────┐
                          │  Google OAuth  OR   │
                          │  Email + Password   │
                          └──────────┬─────────┘
                                     │
                    ┌────────────────▼──────────┐
                    │   JWT Session Created      │
                    │   (NextAuth with Prisma)   │
                    └────────────────┬──────────┘
                                     │
                    ┌────────────────▼──────────┐
                    │   Authenticated App View   │
                    └───────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single-page app** via view-store | Avoids full page navigation; all view transitions are instant (SPA-like) |
| **Server Actions** over REST API | Direct DB access, no API layer needed, type-safe, Next.js-native |
| **Zustand** over Redux | Minimal boilerplate, sufficient for this scope |
| **Prisma** over Drizzle | Better Postgres support, mature migration system |
| **Neon** over Supabase | Serverless Postgres with branching, good free tier |
| **JWT sessions** (from v0.2) | Required for Credentials provider in NextAuth v4 |
| **Gemini only** | Single provider simplicity; Groq considered but deferred |
