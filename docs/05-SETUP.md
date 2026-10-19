# Setup Guide

> How to set up, configure, and deploy منصة همّة التعليمية

---

## Prerequisites

- **Node.js** 20.9+ and **pnpm** (version pinned in `package.json`)
- **pnpm** (recommended) or npm
- **PostgreSQL** database (Neon recommended for production)
- **Google Cloud Console** account (for OAuth credentials)
- **OpenRouter** account (API key for AI features, optional)
- **Sentry** account (for error tracking, optional)

---

## Local Development

### 1. Clone & Install

```bash
git clone https://github.com/Yousef0hanafy/hemma.git
cd hemma
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Database (get free from https://console.neon.tech)
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

# Google OAuth (create at https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# AI via OpenRouter (get a key at https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-...
AI_MODEL=openrouter/free

# Owner account: promoted to admin on Google sign-in
ADMIN_EMAIL=you@gmail.com

# Sentry (optional — get from https://sentry.io)
SENTRY_DSN=
```

### 3. Create the Database Schema

```bash
pnpm db:deploy     # applies prisma/migrations
```

### 4. Seed Content (Optional)

Add your question JSON files to the `upload/` directory, then:

```bash
# Register files in src/lib/content/manifest.ts first
npx tsx scripts/seed-content.ts
```

### 5. Start Dev Server

```bash
pnpm dev
```

Visit `http://localhost:3000`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server on port 3000 |
| `pnpm build` | Production build (standalone output) |
| `pnpm start` | Run production server |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint |
| `pnpm test` | Run Vitest tests |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm db:deploy` | Apply pending migrations (local DB or production) |
| `pnpm db:status` | Show which migrations are applied |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Create a new migration after editing the schema (dev DB only) |
| `pnpm admin:grant <email> [role]` | Give a user a studio role |

---

## Database Setup

### Neon (Production)

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project
3. Copy the connection string
4. Set as `DATABASE_URL` in `.env`

### Local PostgreSQL (Development)

```bash
createdb hemma
# Set DATABASE_URL=postgresql://localhost:5432/hemma
pnpm db:deploy
```

### Schema Updates

The schema is managed with **migrations** (`prisma/migrations`). Don't use
`prisma db push` against production: it changes the database without a
record, which is how production drifted from the schema before.

```bash
# 1. Edit prisma/schema.prisma, then create a migration against your dev DB:
pnpm db:migrate --name describe_change
# 2. Commit the new folder in prisma/migrations
# 3. Apply it to production:
DATABASE_URL="<neon url>" pnpm db:deploy
```

### One-time: moving an existing `db push` database to migrations

Production was created with `db push`, so Prisma doesn't know the baseline
is already there. Do this **once**, ideally on a Neon branch first
(Neon console → Branches → Create branch — it's an instant copy):

```bash
export DATABASE_URL="<neon url>"

# 1. Mark the baseline (the schema as it was) as already applied
npx prisma migrate resolve --applied 0_init

# 2. Apply the rest. The first one is idempotent: it repairs drift left by
#    the old runtime ALTER TABLE code, then adds indexes + rate-limit table
pnpm db:deploy

# 3. Verify the database now matches the schema exactly
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --exit-code
# exit code 0 / "No difference detected" = done
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

**Build settings:**
- Framework: Next.js
- Build command: `pnpm build`
- Output directory: `.next`

### Docker / Standalone

The app is configured for `output: "standalone"` in `next.config.ts`:

```bash
pnpm build
# Output in .next/standalone/
node .next/standalone/server.js
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | ✅ (for Google auth) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ (for Google auth) | Google OAuth client secret |
| `NEXTAUTH_SECRET` | ✅ | Random string for session encryption |
| `NEXTAUTH_URL` | ✅ | App URL (must be correct for production) |
| `OPENROUTER_API_KEY` | ❌ | OpenRouter key (AI features unavailable without it) |
| `AI_MODEL` | ❌ | OpenRouter model id, "provider/model" (default: `openrouter/free`) |
| `ADMIN_EMAIL` | ❌ | Owner email, promoted to admin on Google sign-in |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | Sentry DSN for the browser (also the only DSN `/sentry-tunnel` forwards to) |
| `DB_CHECK_SECRET` | ❌ | Shared secret for `GET /api/db-check` |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | Sentry DSN for client-side error tracking |
| `SENTRY_DSN` | ❌ | Sentry DSN for server-side error tracking |
| `SENTRY_ORG` | ❌ | Sentry org slug (source maps) |
| `SENTRY_PROJECT` | ❌ | Sentry project slug (source maps) |
| `SENTRY_AUTH_TOKEN` | ❌ | Sentry auth token (CI source maps) |

---

## Adding Content

### JSON Format

```json
{
  "document_title": "اسم المصدر",
  "date": "2026/6/15",
  "questions": [
    {
      "id": 1,
      "type": "تناظر لفظي",
      "question": "نص السؤال",
      "options": {
        "أ": "خيار 1",
        "ب": "خيار 2",
        "ج": "خيار 3",
        "د": "خيار 4"
      },
      "answer": "ب",
      "explanation": "شرح الإجابة الصحيحة (اختياري)",
      "study_tip": "نصيحة دراسية (اختياري)",
      "citation": "[cite: 1, 2]"
    }
  ]
}
```

### Steps

1. Place JSON file in `upload/` directory
2. Register in `src/lib/content/manifest.ts`:
   ```typescript
   { slug: "my_source", path: "upload/my_source.json" }
   ```
3. Run seeder:
   ```bash
   npx tsx scripts/seed-content.ts
   ```
4. Or use the Studio Import Center at `/studio/import`

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
npx vitest run src/lib/engine/gamification.test.ts
```

### Test Coverage

| File | Covers |
|---|---|
| `src/lib/engine/gamification.test.ts` | XP, levels, mastery, Riyadh day/week keys, streaks & shields, milestones, quests, adaptive order |
| `src/server/actions/progress.test.ts` | Server-side grading, XP once per question per day, exam finalize (final answers, bonus cap, idempotency) |
| `src/lib/studio-auth.test.ts` | Role guards (student / reviewer / editor / admin) |
| `src/server/ai/evaluator.test.ts` | OpenRouter key and model selection |
| `src/server/ingestion/ingestion.test.ts`, `src/server/ai/scoring.test.ts`, `src/lib/auth.test.ts`, `src/server/actions/actions.test.ts` | Ingestion schemas, heuristic scoring, permission matrix, DTOs |
| `*.db.test.ts` (opt-in) | Against real Postgres: rate limiter, achievements, leaderboard, question pool |

The `*.db.test.ts` files are skipped unless `TEST_DATABASE_URL` is set
(point it, and `DATABASE_URL`, at a disposable database with migrations applied).
