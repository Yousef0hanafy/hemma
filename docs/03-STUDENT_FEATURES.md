# Student Features

> All student-facing features of منصة همّة التعليمية

---

## 1. Authentication

| Feature | Details |
|---------|---------|
| **Google OAuth** | Sign in with Google account (one-click) |
| **Email/Password** | Sign up with email + password (6+ chars) |
| **Auto-login** | After signup, logged in automatically |
| **Session Restore** | Remembers interrupted exam/study sessions after re-auth |
| **Pending Exam Recovery** | Shows a banner to resume unfinished exams |

**File:** `src/components/qudurat/AuthGate.tsx` | `src/lib/auth.ts` | `src/server/actions/auth.ts`

---

## 2. Dashboard

The landing page after login showing a quick overview.

- **Smart greeting** based on time of day + streak status
- **Quick stats cards**: XP, level, streak, accuracy
- **Quick actions**: Study, Exam, Revision, Search
- **Daily quest** with progress bar
- **Weekly challenge** tracker
- **Recent activity** mini-feed
- **Category mastery** progress overview
- **Study plan summary** (if AI plan is available)

**File:** `src/components/qudurat/DashboardView.tsx`

---

## 3. Study Mode (وضع المذاكرة)

Core learning mode with instant feedback.

| Feature | Details |
|---------|---------|
| **Category filter** | Study specific category or all |
| **Question count** | Choose how many questions (5-50) |
| **Add explanation** | Toggle to show explanation after each answer |
| **Immediate feedback** | Correct/Wrong with color coding + animation |
| **Explanation** | Detailed explanation shown after answering |
| **Study tips** | Additional learning tips per question |
| **Confidence rating** | Rate your confidence (1-5) for SRS tracking |
| **XP reward** | Shows XP earned per correct answer |
| **Progress bar** | Visual progress through session |
| **Keyboard shortcuts** | 1-4 for options, Enter to confirm |

**File:** `src/components/qudurat/StudySetupView.tsx` | `src/components/qudurat/StudyPlayerView.tsx`

---

## 4. Exam Mode (وضع الاختبار)

Timed exam simulation.

| Feature | Details |
|---------|---------|
| **Timed** | Configurable duration (5-60 min) |
| **Question count** | Auto-calculated or manual |
| **Real-time timer** | Countdown with visual warning at 5 min |
| **Question palette** | Grid showing all questions, answered/unanswered |
| **Review before submit** | Flag questions for review, change answers |
| **Auto-submit** | On timer expiry |
| **Detailed report** | Score, time per question, accuracy breakdown |
| **Per-question review** | See all questions with correct/wrong indicators |

**File:** `src/components/qudurat/ExamSetupView.tsx` | `src/components/qudurat/ExamRunnerView.tsx` | `src/components/qudurat/ExamReportView.tsx`

---

## 5. Revision Mode (وضع المراجعة)

Spaced repetition + mistake review.

| Tab | Description |
|-----|-------------|
| **بطاقات المراجعة (Flashcards)** | SM-2 spaced repetition algorithm. Questions due for review. Rate your recall (again/hard/good/easy) |
| **حديقة الأخطاء (Mistake Garden)** | All questions you answered incorrectly. Filter by category. Re-attempt them |
| **المفضلة (Favorites)** | Bookmarked questions with optional notes |

The SM-2 algorithm tracks:
- Easiness factor (EF)
- Interval in days
- Repetition count
- Next review date

**File:** `src/components/qudurat/RevisionView.tsx`

---

## 6. Statistics (الإحصائيات)

| Section | Content |
|---------|---------|
| **Accuracy Overview** | Overall accuracy percentage with trend |
| **Category Breakdown** | Per-category mastery, accuracy, attempts |
| **Activity Heatmap** | GitHub-style contribution grid (84 days) |
| **Speed Stats** | Average time per question, speed trend |
| **Level Progress** | XP progress bar to next level |
| **Recently Studied** | Categories studied recently with quick actions |

**File:** `src/components/qudurat/StatsView.tsx`

---

## 7. Achievements (الإنجازات)

22 unlockable achievements across 4 categories:

| Category | Examples |
|----------|----------|
| **Volume** | أول إجابة صحيحة, 25/50/100/200/500/1000 سؤال |
| **Streak** | 3/7/14/30/60/100 يوم متتالي |
| **Mastery** | إتقان فئة, نجاح اختبار, علامة كاملة, موسوعي |
| **Speed** | سريع البديهة (<3s), سرعة خاطفة, برق (<2s) |
| **Revision** | 30/100/500 مراجعة SRS |

Each achievement rewards XP and shows a celebration animation when unlocked.

**File:** `src/components/qudurat/AchievementsView.tsx`

---

## 8. Search (البحث)

Full-text search across all questions with filters:

- **Text search** across question stems
- **Filter by category** (dropdown)
- **Filter by source** (dropdown)
- **Filter by difficulty** (easy/medium/hard)
- **Filter by favorites** only
- **Filter by mistakes** only
- **Results count** with pagination

**File:** `src/components/qudurat/SearchView.tsx`

---

## 9. Smart Study Plan (الخطة الذكية)

AI-powered personalized recommendations.

**Heuristic plan** (always available):
- Analyzes recent 30/7 attempts for trend detection
- Computes category priority scores (mastery × recency × coverage)
- Recommends difficulty level based on performance
- Recommends study vs exam mode

**AI plan** (when Gemini is available):
- Generates personalized insight in Arabic
- Creates 7-day study schedule
- Analyzes learning style and motivation
- Provides difficulty recommendations
- Generates weekly schedule with focus areas

**File:** `src/components/qudurat/StudyPlanView.tsx` | `src/server/actions/ai-study-plan.ts` | `src/server/ai/study-plan-service.ts`

---

## 10. Leaderboard (المتصدّرون)

XP-based social ranking:

| Tab | Metric |
|-----|--------|
| **نقاط الخبرة (XP)** | All-time XP ranking |
| **أسبوعي (Weekly)** | XP earned this week |
| **السلسلة (Streak)** | Current streak ranking |

- Podium for top 3 (🥇🥈🥉)
- Current user highlighted with "You" badge
- Shows rank, avatar, name, level, score
- Olympic-style tie handling

**File:** `src/components/qudurat/LeaderboardView.tsx` | `src/server/actions/leaderboard.ts`

---

## 11. Profile (الملف الشخصي)

| Section | Content |
|---------|---------|
| **Hero** | Avatar, name, level, XP, rank badge |
| **Stats Summary** | Total attempts, accuracy, streak, study time |
| **Mastery Grid** | Per-category mastery rings |
| **Achievements** | Recently unlocked achievements |
| **Activity** | Daily activity mini-chart |
| **Learning Goals** | Daily targets (attempts, correct, XP) with progress |
| **Notification Settings** | Browser push notification toggles |
| **Dark Mode** | Light/Dark/System theme toggle |

**File:** `src/components/qudurat/ProfileView.tsx`

---

## 12. Gamification System

| Mechanic | Details |
|----------|---------|
| **XP** | 10 per correct (study), 15 per correct (exam), difficulty multipliers |
| **Levels** | Quadratic curve: level N requires 50×(N-1)² XP |
| **Streaks** | Consecutive daily activity. Shield protects 1 day gap per 7-day milestone |
| **Streak Shields** | Earn 1 shield every 7 days. Consumed automatically on missed day |
| **Daily Quests** | 5 quest types, deterministic per date |
| **Weekly Challenges** | 5 challenge types, deterministic per week |
| **Milestones** | 8 XP milestones + 6 streak milestones with celebrations |

**Test file:** `src/lib/engine/gamification.test.ts` (71 tests)

---

## 13. Onboarding Tour

First-time user guided tour (10 steps):

1. Welcome
2. Dashboard overview
3. Study mode
4. Exam mode
5. Revision mode
6. Statistics
7. Achievements
8. Learning goals
9. Profile settings
10. Complete

Auto-navigates to each feature. Only shows once (localStorage). Dismissible.

**File:** `src/components/qudurat/OnboardingTour.tsx`

---

## 14. Exam History (سجل الاختبارات)

- List of past exam sessions with date, score, duration
- Detail view with per-question breakdown
- Deep-review mode for each past exam
- Re-attempt saved questions

**File:** `src/components/qudurat/ExamHistoryView.tsx` | `src/components/qudurat/ExamHistoryDetailView.tsx`

---

## 15. Session Summaries

Post-study/exam overlay showing:

- Circular score graphic
- XP earned this session
- Accuracy percentage
- Strengths (categories with highest accuracy)
- Weaknesses (categories needing improvement)
- Level progress bar
- Recommendations for next session

**File:** `src/components/qudurat/SessionSummary.tsx` (integrated into StudyPlayerView and ExamReportView)

---

## 16. Notifications

| Type | Trigger | Platform |
|------|---------|----------|
| **Review Reminder** | Daily at configured time | Browser push + in-app |
| **Streak At Risk** | If no activity by evening | Browser push |
| **Achievement Unlock** | On milestone reached | In-app toast |
| **Level Up** | On level increase | In-app toast + animation |
| **XP Milestone** | On crossing XP threshold | In-app toast |

**File:** `src/components/notifications/NotificationManager.tsx` | `public/sw.js`
