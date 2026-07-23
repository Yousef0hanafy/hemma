# Setup Guide

> How to set up, configure, and deploy منصة همّة التعليمية

---

## Prerequisites

- **Node.js** 18+ or **Bun** 1.x
- **pnpm** (recommended) or npm
- **PostgreSQL** database (Neon recommended for production)
- **Google Cloud Console** account (for OAuth credentials)
- **Google AI Studio** account (for Gemini API key, optional)
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

# Gemini AI (get from https://aistudio.google.com/apikey)
GOOGLE_API_KEY=your-gemini-key
AI_MODEL=gemini-2.0-flash

# Sentry (optional — get from https://sentry.io)
SENTRY_DSN=
```

### 3. Sync Database

```bash
npx prisma db push
npx prisma generate
```

### 4. Seed Content (Optional)

Add your question JSON files to the `upload/` directory, then:

```bash
# Register files in src/lib/content/manifest.ts first
bun run scripts/seed-content.ts
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
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Create a new migration |

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
npx prisma db push
```

### Schema Updates

After modifying `prisma/schema.prisma`:

```bash
# For development (auto-sync):
npx prisma db push

# For production (migration file):
npx prisma migrate dev --name describe_change
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
| `GOOGLE_API_KEY` | ❌ | Gemini API key (AI features unavailable without it) |
| `AI_MODEL` | ❌ | Gemini model name (default: gemini-2.0-flash) |
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
   bun run scripts/seed-content.ts
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

Currently: **71 tests** across the gamification engine:
- `xpForCorrect` — 5 tests
- `xpForExamSession` — 3 tests
- `levelForXp` / `xpForLevel` / `levelProgress` — 12 tests
- `computeMastery` / `masteryLabel` — 11 tests
- `todayKey` / `dayKeyOffset` — 6 tests
- `updateStreak` — 8 tests
- `getCrossedXpMilestones` — 7 tests
- `getCrossedStreakMilestone` — 7 tests
- `weeklyChallengeForDate` — 5 tests
- `weekStartKey` / `weekEndKey` — 9 tests
- `questForDate` — 4 tests
- `shuffle` — 7 tests
- `pickAdaptiveOrder` — 6 tests
