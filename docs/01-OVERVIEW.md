# منصة همّة التعليمية — Hema LMS

> **منصة تعليمية متكاملة لتحضير اختبار القدرات اللفظية بنظام ذكاء اصطناعي**
>
> A premium Arabic RTL LMS for Qudurat (القد رات اللفظية) exam preparation with AI-powered learning.

---

## What Is This?

Hema LMS is a full-featured educational platform designed specifically for Saudi students preparing for the **Qudurat (القدرات اللفظية)** exam — the standardized verbal aptitude test required for university admission in Saudi Arabia.

Unlike traditional LMS platforms, Hema combines:

- **Interactive study modes** with instant feedback
- **Spaced repetition** for long-term retention
- **AI-powered recommendations** via Google Gemini
- **Gamification** (XP, levels, streaks, achievements)
- **A full Content Studio** for managing questions, categories, and sources
- **Exam simulations** that mirror the real test experience

---

## Target Users

| Role | Description |
|------|-------------|
| **Student** | Saudi high school students preparing for Qudurat |
| **Content Manager** | Teachers/editors who create and review question content |
| **Admin** | Platform operators managing users, settings, and analytics |

---

## Core Philosophy

1. **Speed is a feature** — Every interaction is optimized for minimal clicks
2. **AI as a team member** — Gemini handles quality checks, difficulty estimation, explanation generation, and personalized study plans
3. **Data-driven improvement** — Every student attempt feeds back into the system
4. **RTL-first** — Built from the ground up for Arabic, not translated from English
5. **Offline-resilient** — PWA with service worker caching for unreliable connections

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Database** | Neon Postgres (serverless) |
| **ORM** | Prisma 6 |
| **Auth** | NextAuth v4 (Google OAuth + Email/Password) |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **AI** | Google Gemini 2.0 Flash |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod |
| **Tables** | TanStack Table |
| **Testing** | Vitest |
| **Error Tracking** | Sentry (config ready) |
| **Deployment** | Vercel / Standalone Docker |

---

## Key Numbers

- **~71** unit tests across the gamification engine
- **17** student view modes (dashboard, study, exam, revision, stats, etc.)
- **13+** Content Studio pages
- **2** auth providers (Google OAuth + Email/Password)
- **22** achievements
- **8** XP milestones
- **6** streak milestones
- **5** question categories
