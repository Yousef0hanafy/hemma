# Future Features & Improvements

> Everything that could be added, improved, or built next — organized by category and priority.

---

## How to Read This Document

Each item has:
- **Effort:** 🟢 Easy (< 1 day) | 🟡 Medium (1-3 days) | 🔴 Hard (3-7 days) | ⚫ Major (1-4 weeks)
- **Impact:** 🌟 High | 👍 Medium | 👌 Low
- **Status:** ⬜ Not started | 🔄 In progress | ✅ Done

---

## 🚨 Tier 0 — Launch Blockers (Must Do Before Going Live)

These will cause real problems if you launch without them.

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 1 | **Install pending deps** | 🟢 | 🌟 | `pnpm add bcryptjs @types/bcryptjs @sentry/nextjs` — auth + error tracking won't work without them |
| 2 | **Prisma db push** | 🟢 | 🌟 | Sync the schema (password field on User model) to the database |
| 3 | **Seed content** | 🟢 | 🌟 | Run `bun run scripts/seed-content.ts` to populate questions. Without content, the app is empty |
| 4 | **Set up production env vars** | 🟢 | 🌟 | Configure all env vars in Vercel/Neon — Google OAuth redirect URIs must match production domain |
| 5 | **Configure Neon backup** | 🟢 | 👍 | Neon has point-in-time recovery — enable it. One bad migration and data is gone |

---

## 📊 Tier 1 — Product Analytics (Measure Before You Improve)

Without data, you're guessing.

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 6 | **Plausible Analytics** | 🟢 | 🌟 | Privacy-first, lightweight analytics. 5-min setup. Know: page views, referrers, bounce rate |
| 7 | **PostHog** | 🟡 | 🌟 | Self-hosted or cloud. Product analytics + feature flags + session recording. Deeper insights: which features users actually use, drop-off points, funnels |
| 8 | **Custom events** | 🟡 | 👍 | Track specific actions: "started exam", "completed study session", "unlocked achievement". Understand feature adoption |
| 9 | **Dashboard for metrics** | 🟡 | 🌟 | Show admins: DAU/MAU, avg session time, questions answered per day, retention rate |

**Recommendation:** Start with Plausible (5-min setup). Add PostHog later for deeper insights.

---

## 🛡️ Tier 2 — Security & Reliability

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 10 | **Rate limiting on auth** | 🟢 | 🌟 | Add `@upstash/ratelimit` or Vercel WAF rules. Prevent brute-force attacks on login/signup |
| 11 | **Rate limiting on server actions** | 🟡 | 🌟 | Protect expensive AI operations from abuse. Limit: AI chat, batch processing, import |
| 12 | **CSRF protection audit** | 🟢 | 👍 | Next.js has built-in CSRF for Server Actions, but verify all routes are protected |
| 13 | **Input sanitization** | 🟢 | 👍 | Sanitize all user inputs (especially in question editor). Prevent XSS in question stems/options |
| 14 | **Session expiry handling** | 🟢 | 👍 | Show a friendly "انتهت الجلسة" message instead of a cryptic error when JWT expires |
| 15 | **GDPR/PDPL compliance tools** | 🟡 | 🌟 | Data export (download my data) + account deletion flow + consent management. Required by Saudi PDPL law |

---

## 🎨 Tier 3 — User Experience & Polish

### Student Experience

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 16 | **Sound effects** | 🟡 | 🌟 | Correct answer chime, wrong answer sound, combo streaks, level-up fanfare, achievement unlock. Use Web Audio API (no files needed). Biggest "feel" improvement per effort |
| 17 | **Confetti celebrations** | 🟢 | 🌟 | Canvas-confetti on: level up, achievement unlock, streak milestone, exam perfect score. Gamification feels unfinished without it |
| 18 | **Loading skeletons** | 🟡 | 👍 | Replace the FullScreenLoader with skeleton placeholders that match the content layout. Much better perceived performance |
| 19 | **Pull-to-refresh on mobile** | 🟢 | 👌 | Native-feeling refresh gesture for study/exam data |
| 20 | **Haptic feedback** | 🟢 | 👌 | Subtle vibration on correct/wrong (mobile only). Works with `navigator.vibrate()` |
| 21 | **Study timer / Pomodoro** | 🟡 | 👍 | Built-in 25-min focus timer. Track study sessions. Show "You studied 2 hours today!" |
| 22 | **Personal notes on questions** | 🟡 | 👍 | Let students add their own notes to questions. Show in revision mode |
| 23 | **Bookmark with folders** | 🟡 | 👌 | Organize bookmarked questions into folders/categories |
| 24 | **Daily streak reminder widget** | 🟢 | 👍 | On the phone home screen, show a widget with current streak and daily goal progress |
| 25 | **Shareable progress cards** | 🟡 | 🌟 | Generate OG images: "أتممت 500 سؤال — المستوى 12 🔥" that students share on social media. Free marketing |
| 26 | **Certificate generation** | 🟡 | 👍 | "شهادة إتمام" PDF after completing a certain milestone. Shareable, printable |

### Studio / Admin Experience

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 27 | **Mobile responsive Studio** | 🔴 | 🌟 | The admin panel doesn't work well on phones. Content creators need to approve/review from mobile |
| 28 | **Bulk question editing** | 🔴 | 🌟 | Edit a field (explanation, difficulty, category) across hundreds of questions at once |
| 29 | **Question templates** | 🟡 | 👍 | Save question formats as reusable templates. "Create 10 new تناظر لفظي questions with this format" |
| 30 | **Content scheduling** | 🟡 | 👍 | Schedule when content goes live. "Publish on next Sunday at 8 AM" |
| 31 | **Version diff view** | 🟡 | 🌟 | Side-by-side diff when reviewing question edits. See exactly what changed |
| 32 | **Import analytics** | 🟢 | 👍 | Show per-import stats: questions added, categories affected, AI processing results |
| 33 | **CSV/Excel export** | 🟢 | 👍 | Export question library as CSV/Excel for offline editing |
| 34 | **Drag-drop image upload** | 🟡 | 👍 | For questions that include images (diagrams, charts). Store in Vercel Blob or Cloudinary |
| 35 | **API keys for external tools** | 🟡 | 👍 | Generate API keys so external tools can push/pull content programmatically |

---

## 🤖 Tier 4 — AI & Intelligence

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 36 | **AI Study Buddy for Students** | 🔴 | 🌟 | Student-facing AI chat: "اسأل AI عن这个概念". Students ask questions about concepts they don't understand. Uses Gemini. This is the #1 feature that would set this platform apart |
| 37 | **AI question generation** | 🔴 | 🌟 | "Generate 10 تناظر لفظي questions about this topic." Admin enters a topic, AI generates questions with options and explanations. Massive content creation accelerator |
| 38 | **AI flashcard generation** | 🟡 | 🌟 | Auto-generate SRS flashcards from wrong answers. "You got this wrong — here's a flashcard to help you remember" |
| 39 | **AI content gap analysis** | 🟡 | 👍 | "You have 500 تناظر لفظي questions but only 50 استيعاب المقروء — create more" |
| 40 | **AI student progress report** | 🟡 | 👍 | Generate a natural-language summary: "في الأسبوع الماضي، تحسّنت في التناظر اللفظي بنسبة 15% ولكن تراجعت في إكمال الجمل..." |
| 41 | **Multi-provider AI routing** | 🟡 | 🌟 | Route tasks: Groq for fast/cheap (difficulty estimation), Gemini for complex reasoning (study plans). Provides redundancy |
| 42 | **AI-powered search** | 🟢 | 👍 | Semantic search over questions, not just text matching. "اعطيني أسئلة صعبة عن الطقس" |
| 43 | **AI difficulty calibration** | 🟡 | 👍 | Adjust difficulty labels based on actual student performance data, not just AI estimation |
| 44 | **Voice questions (text-to-speech)** | 🟡 | 👍 | Read questions aloud for listening comprehension practice. Useful for استيعاب المقروء |

---

## 🌍 Tier 5 — Social & Community

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 45 | **Study groups** | 🔴 | 🌟 | Create/join groups. Share progress. Compete on XP. "Invite your friends to study together" |
| 46 | **Friend leaderboards** | 🟡 | 🌟 | See how you rank among your friends specifically (not just global) |
| 47 | **Challenge friends** | 🟡 | 👍 | "I challenge you to answer 50 questions today" — friendly competition |
| 48 | **Achievement sharing** | 🟢 | 👍 | Share achievement unlocks on WhatsApp/Twitter directly from the app |
| 49 | **Comments & discussion** | 🔴 | 👍 | Students can ask questions about specific questions. Community-driven learning |
| 50 | **Teacher/classroom mode** | ⚫ | 🌟 | Teachers create classes, assign questions, track student progress. Major feature for institutional adoption |

---

## 📧 Tier 6 — Notifications & Communication

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 51 | **Email notifications** | 🟡 | 🌟 | "You haven't studied in 3 days" reminder, weekly summary, achievement unlocked. Use Resend or SendGrid |
| 52 | **Push notifications (improved)** | 🟡 | 🌟 | Current push notifications work. Improve: scheduled daily reminders, configurable frequency |
| 53 | **WhatsApp integration** | 🟡 | 🌟 | "Send daily question to WhatsApp" — huge in Saudi Arabia. Use Twilio WhatsApp API |
| 54 | **SMS reminders** | 🟡 | 👍 | For users who don't have smartphones. Daily question via SMS |
| 55 | **Email digest (weekly)** | 🟢 | 👍 | "هذا الأسبوع: أجبت 120 سؤال بدقة 75%. سلسلتك 12 يوم. أنت في المستوى 8" |

---

## 📈 Tier 7 — Growth & Marketing

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 56 | **SEO (sitemap.xml)** | 🟢 | 🌟 | Generate sitemap.xml for Google. Add JSON-LD structured data. Target: "اختبار القدرات", "تناظر لفظي", "قدرات لفظية" |
| 57 | **Blog / Study tips** | 🟡 | 👍 | SEO-optimized blog posts about Qudurat tips. Drive organic traffic |
| 58 | **Referral program** | 🟡 | 🌟 | "Share with a friend — both get 50 XP". Viral growth loop |
| 59 | **Free trial / freemium** | 🟡 | 👍 | X free questions per day, then subscribe. Requires payment integration |
| 60 | **Landing page** | 🟡 | 🌟 | A proper marketing landing page separate from the app. Features, testimonials, screenshots |
| 61 | **Social proof badges** | 🟢 | 👍 | "انضم إلى 5000+ طالب" — show real user count |
| 62 | **Student testimonials** | 🟢 | 👍 | Collect and display success stories. "حصلت على 95% في القدرات بعد استخدام همّة" |

---

## 💰 Tier 8 — Monetization & Business

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 63 | **Subscription plans** | ⚫ | 🌟 | Free tier (limited), Premium (unlimited questions, AI features). Use Stripe |
| 64 | **One-time purchase packages** | 🟡 | 👍 | "200 سؤال إضافي" — one-time purchases for specific content packs |
| 65 | **Institutional licensing** | 🔴 | 🌟 | Schools/universities buy bulk licenses for their students. Custom pricing |
| 66 | **Gift cards** | 🟡 | 👍 | "أهدِ همّة لصديق" — gift subscription codes |
| 67 | **Affiliate program** | 🟡 | 👍 | Pay commission to influencers/teachers who refer students |
| 68 | **Advertisement-free tier** | 🟢 | 👌 | Remove all ads (if ads are added) for premium users |

---

## 🛠️ Tier 9 — Technical Improvements

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 69 | **Accessibility audit** | 🔴 | 🌟 | ARIA labels, keyboard navigation, screen reader support, color contrast. Educational platforms must be accessible |
| 70 | **Performance optimization** | 🔴 | 🌟 | Bundle analysis, code splitting, lazy loading heavy components, image optimization. Next.js 16 has built-in tools |
| 71 | **E2E tests (Playwright)** | 🔴 | 🌟 | Test critical flows: signup → study → exam → revision. Catch regressions before they reach users |
| 72 | **API documentation** | 🟡 | 👍 | Document all server actions for future API consumers |
| 73 | **Storybook component library** | ⚫ | 👌 | Document all UI components in isolation. Useful for team development |
| 74 | **i18n / multi-language** | ⚫ | 🌟 | English + Urdu alongside Arabic. Major effort but opens the platform to non-Arabic speakers |
| 75 | **Dark mode improvements** | 🟢 | 👌 | Fix any remaining dark mode contrast issues. Ensure all custom components respect dark mode |
| 76 | **Loading state audit** | 🟡 | 👍 | Every view should have: loading skeleton, empty state, error state. Audit and fill gaps |
| 77 | **Error message audit** | 🟢 | 👍 | All error messages should be user-friendly and in Arabic. No raw error codes to users |
| 78 | **Caching strategy** | 🟡 | 👍 | Cache frequently accessed data (categories, question counts). Reduce database load |
| 79 | **Database indexing review** | 🟡 | 👍 | Review Prisma schema indexes. Add missing indexes for slow queries (look in Neon query insights) |
| 80 | **Data cleanup cron job** | 🟢 | 👍 | Periodic cleanup: expired sessions, stale AI processing logs, orphaned data |

---

## 🧪 Tier 10 — Experiments & Innovation

These are higher-risk, higher-reward ideas that could differentiate the platform.

| # | Item | Effort | Impact | Details |
|---|------|--------|--------|---------|
| 81 | **AI Proctor Mode** | 🔴 | 🌟 | Camera-based exam proctoring. Ensure academic integrity during remote exams |
| 82 | **AR Vocabulary Cards** | ⚫ | 👍 | Augmented reality flash cards — point phone at an object, see the Arabic word |
| 83 | **Voice-based answers** | 🔴 | 👍 | Students answer verbally, AI evaluates. Speaking practice for oral exams |
| 84 | **AI-generated practice exams** | 🔴 | 🌟 | "Generate a full 60-minute practice exam" — AI creates a complete test from your question bank |
| 85 | **Personalized difficulty curve** | 🟡 | 👍 | Adaptive difficulty that adjusts in real-time based on student performance |
| 86 | **Gamified learning paths** | 🔴 | 🌟 | "Skill trees" — unlock harder categories by mastering easier ones. Like a video game skill tree |
| 87 | **Animated explainer videos** | ⚫ | 👍 | AI-generated short video explanations for common question types |
| 88 | **Competitive tournaments** | 🔴 | 🌟 | "Weekly tournament — top 10 students win XP bonuses". Live leaderboard during the tournament |
| 89 | **NFT achievements** | ⚫ | 👌 | Blockchain-based achievement badges. Novelty, but could attract tech-savvy students |
| 90 | **AI career counseling** | 🔴 | 🌟 | Based on performance data, recommend university majors and career paths that match student strengths |

---

## 📋 Priority Matrix

```
                    HIGH IMPACT                     LOWER IMPACT
                    ═══════════                     ═══════════
    🟢 EASY    │  6. Plausible Analytics         │  19. Pull-to-refresh
               │  10. Rate limiting              │  20. Haptic feedback
               │  16. Sound effects              │  24. Streak widget
               │  17. Confetti                   │  48. Share achievements
               │  56. Sitemap/SEO                │  76. Loading audit
               │                                 │
    🟡 MEDIUM  │  21. Pomodoro timer             │  29. Question templates
               │  36. AI Study Buddy             │  33. CSV export
               │  37. AI question generation     │  44. Voice questions
               │  38. AI flashcards              │  55. Weekly email digest
               │  46. Friend leaderboards        │  57. SEO blog
               │  58. Referral program           │
               │                                 │
    🔴 HARD    │  27. Mobile Studio              │  15. PDPL compliance tools
               │  28. Bulk question editing      │  49. Comments/discussion
               │  31. Version diff               │  69. Accessibility audit
               │  45. Study groups               │  70. Performance optimization
               │  50. Teacher/classroom mode     │  71. E2E tests
               │  60. Landing page               │
               │                                 │
    ⚫ MAJOR   │  63. Subscription/payments      │  73. Storybook
               │  65. Institutional licensing    │  74. i18n / multi-language
               │  81. AI Proctor                 │  82. AR Vocabulary
               │  84. AI practice exams          │  89. NFT achievements
               │  86. Gamified skill trees       │
               │  88. Competitive tournaments    │
               │  90. AI career counseling       │
```

---

## Recommended Next 5

If you want the highest ROI for your time:

| Order | Item | Why |
|-------|------|-----|
| **1** | **Install deps + db push + seed content** | Nothing else matters without a working app with content |
| **2** | **Confetti celebrations** | 1 hour, massive feel improvement. Gamification feels incomplete without it |
| **3** | **Sound effects** | 2-3 hours. Biggest "quality jump" per effort |
| **4** | **Plausible Analytics** | 30 minutes. Stop making product decisions in the dark |
| **5** | **AI Study Buddy** | 3-5 days. The single feature that would make this platform unique vs competitors |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-15 | Initial document created (90 items across 10 tiers) |
