# منصة همّة التعليمية — Hemma

An Arabic, right-to-left learning platform for **Qudurat verbal** (القدرات اللفظية)
exam preparation: study and timed-exam modes, spaced-repetition revision,
gamification, an AI study buddy, and a Content Studio for importing and
reviewing the question bank.

- **Students** practise in study / exam / revision modes, earn XP, streaks and
  achievements, and compete on leaderboards.
- **Content staff** import sources (PDF, DOCX, TXT, JSON), let AI extract and
  check questions, review them, and publish.

Detailed docs live in [`docs/`](docs): overview, architecture, student
features, studio, setup, AI, roadmap.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Framer Motion, Recharts |
| Data | PostgreSQL on Neon, Prisma 6 with migrations (`prisma/migrations`) |
| Auth | NextAuth v4 — Google OAuth + email/password (bcrypt), JWT sessions |
| AI | OpenRouter (OpenAI-compatible API) — free-model router by default |
| Client state | Zustand (navigation), a small user-scoped data cache (`lib/hooks/use-data.ts`), TanStack Query in the Studio |
| Monitoring | Sentry (optional) |
| Hosting | Vercel |

## Project layout

```text
src/
├── app/            # Routes: "/" (student SPA), /studio/*, /api/*
├── components/     # qudurat/ (student UI), studio/ (admin UI), ui/ (shadcn)
├── lib/            # auth, db, rate limiter, engine/ (gamification, SRS, achievements), content/
└── server/         # actions/ (Server Actions), ai/ (OpenRouter + prompts), ingestion/
prisma/             # schema.prisma + migrations
scripts/            # seed-content.ts, grant-admin.mjs, post-build.js
docs/               # project documentation
```

---

## Getting started

Requirements: **Node.js ≥ 20.9** and **pnpm** (version pinned in `package.json`).

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, …
pnpm db:deploy              # apply migrations
pnpm dev                    # http://localhost:3000
```

| Command | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop / production build / serve |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | What CI runs on every PR |
| `pnpm db:migrate --name x` | Create a migration after editing the schema |
| `pnpm db:deploy` · `pnpm db:status` | Apply / inspect migrations |
| `pnpm admin:grant <email> [role]` | Give a user a studio role |

Environment variables are documented in [`.env.example`](.env.example). The
important ones: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`GOOGLE_CLIENT_ID`/`SECRET`, `OPENROUTER_API_KEY`, `ADMIN_EMAIL`.

### First admin

Set `ADMIN_EMAIL` to the owner's Google address — that account becomes admin
when it signs in **with Google** (Google verifies the email; email/password
signups can't claim it). Other staff: `pnpm admin:grant name@example.com editor`.

---

## Roles

| Role | Access |
|---|---|
| `student` | The learning app only |
| `reviewer` | Studio: view content, review queue (approve / reject) |
| `editor` | + edit questions, import, sources, categories, AI jobs |
| `admin` | + users and settings |

Guards live in `src/lib/studio-auth.ts` (`requireStudioAccess`,
`requireEditorAccess`, `requireAdminAccess`) and the permission matrix in
`src/lib/auth.ts` (`requirePermission`). Every Server Action checks its own
access — the Studio layout redirect is only a convenience.

## Security notes

- **Grading is server-side**: answers are graded against the stored key and
  XP is computed on the server; running exams don't receive answer keys.
- **Sessions** are JWTs; each request re-reads the user's role from the
  database, so demotions and deletions apply immediately.
- **Rate limits** (login, signup, AI chat) are stored in Postgres so they hold
  across serverless instances (`src/lib/rate-limiter.ts`).
- Security headers are set in `next.config.ts`; the service worker never
  caches Server Actions, `/api/*` or `/studio`.

## AI

All AI features go through **OpenRouter** (`src/server/ai/evaluator.ts`):
the student study buddy, the studio assistant, quality checks, difficulty and
explanation generation, document ingestion, and the personal study plan.
Each call tries at most 4 models with timeouts. Without `OPENROUTER_API_KEY`
the app still works; AI features fall back to heuristics or are hidden.
See [`docs/06-AI.md`](docs/06-AI.md).

## Deployment (Vercel)

1. Set the environment variables in the Vercel project.
2. Apply migrations to Neon: `DATABASE_URL=<neon url> pnpm db:deploy`.
   For the existing production database there's a **one-time** baseline
   step — see [`docs/05-SETUP.md`](docs/05-SETUP.md#one-time-moving-an-existing-db-push-database-to-migrations).
3. Keep **Fluid compute** enabled (default) so long imports can run up to 300 s.

Uploads go through a Server Action, so files are limited to **4 MB**
(Vercel's request-body limit).

## Testing

Vitest, tests next to the code (`*.test.ts`). Files named `*.db.test.ts` run
against a real Postgres and are skipped unless `TEST_DATABASE_URL` is set:

```bash
TEST_DATABASE_URL=postgres://… DATABASE_URL=$TEST_DATABASE_URL pnpm test
```

## Known limitations

- Free OpenRouter models can be slow or rate-limited; AI features degrade
  gracefully but may be unavailable at times.
- Very long documents are imported in one AI pass (first 35k characters);
  split larger sources.
- Offline mode serves the cached app shell only, not data.
