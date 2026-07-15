# Roadmap & Status

> What's built, what's coming, and what's being considered.

---

## ✅ Complete — Student Experience

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth Authentication | ✅ | NextAuth + Prisma |
| Email/Password Authentication | ✅ | Credentials provider + bcrypt |
| Dashboard | ✅ | Overview, stats, quick actions |
| Study Mode | ✅ | Instant feedback, explanations |
| Exam Mode | ✅ | Timed, palette, auto-submit |
| Revision Mode | ✅ | Flashcards (SM-2), mistakes, favorites |
| Statistics | ✅ | Charts, heatmap, category breakdown |
| Achievements | ✅ | 22 achievements across 5 categories |
| Search | ✅ | Full-text with filters |
| Smart Study Plan | ✅ | Heuristic + AI-powered |
| Gamification | ✅ | XP, levels, streaks, shields |
| Daily Quests | ✅ | 5 daily quest types |
| Weekly Challenges | ✅ | 5 weekly challenge types |
| Session Summaries | ✅ | Post-study/exam overlay |
| Profile Page | ✅ | Stats, mastery, goals, settings |
| Leaderboards | ✅ | XP, weekly, streak rankings |
| Browser Notifications | ✅ | Reminders + streak alerts |
| Learning Goals | ✅ | Daily targets with progress |
| Dark Mode | ✅ | Light/Dark/System toggle |
| Onboarding Tour | ✅ | 10-step first-time guide |
| Exam Deep-Review | ✅ | Per-question exam review |
| Exam History | ✅ | Past exam sessions with details |

---

## ✅ Complete — Content Studio

| Feature | Status | Notes |
|---------|--------|-------|
| Studio Dashboard | ✅ | Stats, trends, queue summary |
| Content Library | ✅ | Table, filters, bulk actions |
| Question Editor | ✅ | Inline editing, AI insights, versions |
| Import Center | ✅ | JSON upload, paste text, preview |
| Review Queue | ✅ | Keyboard-first, approve/reject |
| Analytics Dashboard | ✅ | Charts, distributions, insights |
| Categories Management | ✅ | CRUD, drag reorder, icons |
| Sources Management | ✅ | CRUD, processing status, export |
| Users Management | ✅ | Table, roles, activity stats |
| Settings Page | ✅ | Auto-processing toggles, defaults |
| AI Chat Assistant | ✅ | Gemini streaming chat |
| Processing Audit | ✅ | Full audit trail with filters |
| Sidebar Badges | ✅ | Real-time counts on nav items |

---

## 🟡 Complete — Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| TypeScript Strict Mode | ✅ | No `any` types in production code |
| RTL Support | ✅ | Full Arabic layout |
| PWA | ✅ | Service worker, manifest, offline |
| Dark Mode | ✅ | next-themes with class strategy |
| Error Boundary | ✅ | Component-level + global |
| Sentry Error Tracking | ✅ | Config ready (needs `pnpm add @sentry/nextjs`) |
| Error Boundary | ✅ | Catches + reports to Sentry |
| Unit Tests | ✅ | 71 tests for gamification engine |
| Legal Pages | ✅ | Terms + Privacy in Arabic |
| SEO Metadata | ✅ | OpenGraph, Twitter cards, manifest |

---

## 🟡 In Progress — What Was Just Built (Needs Activation)

| Item | Action Needed |
|------|---------------|
| Email/Password Auth | Run `pnpm add bcryptjs @types/bcryptjs` + `npx prisma db push` |
| Sentry Error Tracking | Run `pnpm add @sentry/nextjs` + add `SENTRY_DSN` to `.env` |

---

## 🔴 Not Started — Launch Readiness

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | **Deploy to production** | ~1hr | 🔥 Essential |
| P1 | **Populate content** (seed questions) | ~30min | 🔥 Essential |
| P2 | **Product analytics** (Plausible/PostHog) | ~2hrs | Understand user behavior |
| P2 | **SEO** (sitemap.xml + JSON-LD) | ~1hr | Organic traffic |
| P2 | **Rate limiting** on auth endpoints | ~1hr | Security |
| P3 | **Accessibility audit** | ~3hrs | Screen reader support |
| P3 | **Studio mobile responsiveness** | ~3hrs | Manage content from phone |

---

## 💡 Future Ideas — Not Yet Started

| Idea | Category | Why |
|------|----------|-----|
| **AI Study Buddy for Students** | Feature | Student-facing AI chat for concept questions |
| **Sound Effects** | UX | Correct/wrong sounds, level-up jingles |
| **Wrong Answer Analytics** | Feature | Heatmaps of common mistakes |
| **Pomodoro Timer** | UX | 25-min focus timer integrated with study |
| **Study Groups** | Social | Compete with friends, share progress |
| **Shareable Progress Cards** | Marketing | OG images for social media sharing |
| **Email Notifications** | Infrastructure | Daily summaries, streak alerts via email |
| **PDF Export** | Feature | Download reports, certificates |
| **Multi-language Support** | Architecture | English/Urdu alongside Arabic |
| **Monetization / Subscriptions** | Business | Premium content tiers |
| **Groq API Integration** | AI | Second AI provider for speed/cost optimization |
| **Bulk Question Editing** | Studio | Edit fields across hundreds of questions |
| **Content Scheduling** | Studio | Schedule when content goes live |
| **Question Templates** | Studio | Save reusable question formats |
| **Docker Compose** | DevOps | Easy local development environment |

---

## Implementation Order (Recommended)

### Phase 1: Ship (1-2 days)
1. ✅ Pre-deployment fixes (done)
2. ⬜ Install remaining deps (bcryptjs, @sentry/nextjs)
3. ⬜ Prisma db push
4. ⬜ Seed content
5. ⬜ Deploy to Vercel

### Phase 2: Measure (1 week)
6. ⬜ Add product analytics (PostHog)
7. ⬜ Collect real user feedback
8. ⬜ Fix critical bugs from real usage

### Phase 3: Grow (2-4 weeks)
9. ⬜ AI Study Buddy for students
10. ⬜ SEO optimization
11. ⬜ Sound effects
12. ⬜ Shareable progress cards

### Phase 4: Scale (1-2 months)
13. ⬜ Multi-provider AI (Groq)
14. ⬜ Study groups
15. ⬜ Mobile app / PWA improvements
16. ⬜ Monetization
