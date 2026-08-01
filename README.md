# منصة همّة التعليمية — Hema Educational Platform

A premium, highly scalable, Arabic Right-to-Left (RTL) Learning Management System (LMS) designed specifically for Qudurat (القدرات اللفظية) exam preparation. 

Built with a modern web stack emphasizing performance, seamless UI/UX, AI integrations, and rigorous security standards.

---

## 1. Project Overview

### What the Project Is
Hema Educational Platform is an interactive testing and learning environment. It shifts the paradigm of Qudurat preparation from passive reading to active, gamified, and AI-assisted learning.

### Purpose and Business Goals
- **Purpose**: To democratize high-quality Qudurat exam preparation for Arabic-speaking students.
- **Business Goals**: Increase student retention through gamification, reduce manual tutoring overhead via AI assistance, and provide a scalable platform that can be extended to other standardized tests (e.g., Tahsili).

### Target Users
- **Students**: High school students preparing for their Qudurat exams.
- **Content Editors & Reviewers**: Subject matter experts who ingest, review, and organize question banks.
- **Administrators**: Platform managers who oversee user roles, platform analytics, and overall system health.

### Main Features
- **Adaptive Learning Modes**: Study Mode (instant feedback), Exam Mode (timed simulation), and Revision Mode (spaced repetition).
- **Gamification Engine**: Experience points (XP), levels, daily streaks, shields, and unlockable achievements.
- **AI Study Buddy**: Context-aware Gemini-powered AI tutor that explains complex linguistic relationships without revealing direct answers.
- **Studio Dashboard**: A secure, RBAC-protected administrative interface for managing content, AI processing pipelines, and user roles.

---

## 2. Architecture Overview

### Application Architecture
Hema uses a monolithic architecture built on **Next.js (App Router)**. It leverages **React Server Components (RSC)** for data fetching and SEO, while utilizing Client Components for highly interactive gamification elements and AI chat interfaces.

### Folder Structure
```text
src/
├── app/              # Next.js App Router (Public routes, API, and protected /studio)
├── components/       # React components (grouped by feature/domain)
├── lib/              # Core business logic, database client, auth, and utilities
└── server/           # Server Actions (Mutations) and AI integration services
prisma/               # Database schema and migration histories
scripts/              # CLI tools for data seeding and maintenance
```

### Key Modules
- **State Management**: Uses `Zustand` for global client state (e.g., active exams, themes) and `TanStack Query` for caching and synchronizing server state.
- **Authentication**: Managed by `NextAuth.js` utilizing both Google OAuth and Email/Password credentials. JWTs are used for session management with a custom database-backed revocation strategy.
- **Authorization**: Role-Based Access Control (RBAC) enforced at both the UI layer (React) and the data layer (Server Actions/API).
- **Database (Prisma)**: Relational data modeling using Prisma ORM connected to Neon (Serverless Postgres), heavily optimized with cascading deletes and index clustering.
- **AI Pipeline**: Integrated with Google's Gemini SDK. The pipeline includes the Study Buddy (student-facing) and AI Evaluators (admin-facing content quality control).

---

## 3. Technology Stack

| Technology | Purpose & Justification |
|------------|-------------------------|
| **Next.js 16 (App Router)** | Provides Server Components, API routes, and Server Actions in a unified React framework. |
| **TypeScript** | Ensures end-to-end type safety, eliminating a massive class of runtime errors. |
| **Tailwind CSS 4** | Rapid, utility-first styling with native support for RTL logical properties. |
| **Prisma ORM** | Type-safe database queries and intuitive schema management. |
| **Neon Postgres** | Serverless Postgres database allowing for rapid scaling and connection pooling. |
| **NextAuth.js** | Secure, flexible authentication supporting multiple providers. |
| **Zustand** | Lightweight, boilerplate-free global client state management. |
| **Framer Motion** | Powers the premium micro-interactions and gamification animations. |
| **Google Gemini API** | Drives the AI tutoring and content evaluation pipelines. |

---

## 4. Environment Variables

Create a `.env` file in the root directory. **Never commit secrets to version control.**

```env
# Database configuration
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-strong-random-secret"

# OAuth Providers (Optional but recommended)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI Integration
GEMINI_API_KEY="your-google-gemini-api-key"

# Sentry (Optional for production monitoring)
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
SENTRY_AUTH_TOKEN="your-sentry-auth-token"
```

---

## 5. Installation Guide

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd hemma
   ```
2. **Install dependencies:**
   *(The project uses `npm` or `bun`)*
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your specific credentials
   ```

---

## 6. Local Development Guide

1. **Initialize the Database:**
   Push the Prisma schema to your local or Neon Postgres database:
   ```bash
   npm run db:push
   npm run db:generate
   ```
2. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.
3. **Running Tests:**
   ```bash
   npm run test
   ```
4. **Running Production Build Locally:**
   ```bash
   npm run build
   npm run start
   ```

---

## 7. Deployment Guide

The application is optimized for deployment on Vercel or any standard Node.js Docker environment.

### Production Checklist
1. **Environment Variables**: Ensure all production secrets are securely added to your deployment platform.
2. **Database Migrations**: Run `npx prisma migrate deploy` during the CI/CD build phase.
3. **First Admin Setup**:
   - Register a new account via the standard user interface.
   - Connect to your production database using Prisma Studio (`npx prisma studio`).
   - Manually edit your `User` record, changing the `role` from `student` to `admin`.
4. **Studio Access**: Navigate to `https://your-domain.com/studio` to verify administrative access.

---

## 8. Studio Documentation

The **Studio** (`/studio`) is the administrative heart of the platform.

### Modules
- **Content Library**: Manage questions, categories, and sources.
- **AI Processing**: Batch process raw text into structured Qudurat questions using AI evaluators.
- **User Management**: Promote users, view analytics, and manage access.

### User Roles & Permissions
- **Admin**: Full read/write/delete access to all resources. Can manage other users.
- **Editor**: Can create, update, and manage question content and AI pipelines. Cannot manage users.
- **Reviewer**: Can read content and approve/reject AI-generated questions. Cannot destructively modify core data.
- **Student**: Strict read-only access to exam content. Cannot access the Studio.

---

## 9. AI Documentation

The platform heavily utilizes the **Google Gemini API**.

### Study Buddy
An interactive chat interface available during Study Mode. 
- **Prompt Engineering**: The AI is strictly instructed *never* to give the direct answer. It uses the Socratic method to guide the student based on linguistic relationships (e.g., synonymy, antonymy).
- **Integration**: Uses `GoogleGenerativeAI` initialized on the server. Chat history is strictly validated to ensure strict `user` -> `model` alternation to prevent API `400 Bad Request` errors.

### Content Evaluator
Used in the Studio to grade user-submitted questions or AI-generated content for linguistic accuracy and curriculum alignment.

---

## 10. Database Documentation

Powered by Prisma and Postgres.

### Core Models
- **User**: Authentication credentials, roles, and profiles.
- **Question**: Core content model containing the prompt, options, correct answer, and explanation.
- **Category & Source**: Taxonomies for organizing questions.
- **Attempt**: Tracks user answers for analytics and spaced repetition algorithms.

### Indexing & Performance
- Foreign keys (`categoryId`, `sourceId`, `userId`) are explicitly indexed to prevent full-table scans during dashboard analytics queries.
- `ON DELETE CASCADE` is utilized heavily to maintain referential integrity without orphan records.

---

## 11. Security Documentation

Security is integrated at every layer:
- **Authentication**: JWT-based session tokens with a custom, database-backed token revocation list (`RevokedToken`) to allow immediate session termination.
- **Authorization (RBAC)**: Enforced via the `requirePermission` and `requireRole` utilities in `src/lib/auth.ts`.
- **Server Actions**: Every Next.js Server Action explicitly validates the user's session and permissions before executing database mutations.
- **Input Sanitization**: All rich text and markdown inputs are aggressively sanitized on the server before being persisted to the database to prevent Stored XSS.

---

## 12. Performance Notes

During the final production hardening phase, the following optimizations were implemented:
- **Query Deduplication**: Next.js `cache()` and React `useMemo`/`useCallback` applied to heavy data grids in the Studio.
- **Bundle Optimization**: Heavy dependencies are dynamically imported (e.g., `next/dynamic` for heavy chart libraries).
- **Database Efficiency**: N+1 query problems in the Study Player were resolved by leveraging Prisma's `include` appropriately.

---

## 13. Testing

The repository relies on `Vitest` for fast, reliable unit and integration testing.

- **Structure**: Tests are co-located with their respective modules (e.g., `actions.test.ts` next to `actions.ts`).
- **Execution**: Run `npm run test` or `npx vitest run`.
- **Coverage**: Core business logic, gamification engines (XP, levels), and server action permission boundaries are heavily tested. UI components rely on manual QA and static typing.

---

## 14. Known Limitations

- **AI Latency**: The Study Buddy relies on external Gemini API calls. High latency from Google's servers can occasionally cause the chat to feel unresponsive. 
- **Real-time Sync**: The platform currently uses polling/mutation invalidation for state updates. True real-time WebSockets are not implemented due to serverless constraints.
- **Content Ingestion**: The AI bulk-import pipeline can occasionally fail if the raw text format deviates drastically from standard Arabic linguistic patterns.

---

## 15. Future Improvements

**Prioritized Roadmap:**
1. **Redis Caching Layer**: Implement Upstash Redis for high-frequency reads (e.g., global leaderboards).
2. **WebSockets (Socket.io or Pusher)**: For real-time multiplayer exam challenges.
3. **Advanced AI Analytics**: Provide students with AI-generated weekly study plans based on their `Attempt` history.
4. **Expanded Content**: Native support for Tahsili and English language proficiency exams.
