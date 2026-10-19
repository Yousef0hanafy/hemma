# تقرير الـ Discovery — منصة همّة

> تاريخ: 2026-10-18 · الحالة: مرجع لخطة الإصلاح. كل بند معاه مسار الملف.
> ✔ = اتأكدت منه يدويًا من الكود. الباقي من فحص الـ agents ومحتاج تأكيد وقت التنفيذ.

## ✅ حالة التنفيذ (آخر تحديث: 2026-10-19)

كل الدفعات من 0 لـ 7 اتنفذت على فرع `ccr-0e4bb614-0hnhe3`:
lint بـ 0 errors، typecheck نظيف، ~140 test (منهم 8 على Postgres حقيقي بيشتغلوا بـ `TEST_DATABASE_URL`).

| البند | الحالة |
|---|---|
| C1–C5, C12 (صلاحيات، auto-admin، IDOR) | ✅ دفعة 1 |
| C8 (تصحيح وXP على السيرفر) | ✅ دفعة 2 |
| C6, C7, C9 (Caddyfile، sentry tunnel، service worker) + headers + login timing | ✅ دفعة 3 |
| migrations + runtime DDL + indexes + rate limit + C10, C11 | ✅ دفعة 4 |
| رفع الملفات، timeouts الـ AI، OpenRouter، استيراد عالق، cache خطة المذاكرة | ✅ دفعة 5 |
| achievements، shields، تسجيل الامتحان، leaderboard، الأسئلة المنشورة فقط، pool، التايمر | ✅ دفعة 6 |
| deps، bun.lock، dead code، revocation الوهمي، milestones، الدوكس | ✅ دفعة 7 |

**لسه مفتوح (مش متنفذ):**
- تطبيق الـ migrations على Neon (خطوة لمرة واحدة — `docs/05-SETUP.md`).
- CSP كامل بـ nonces؛ رفع ملفات أكبر من 4MB (Vercel Blob)؛ email verification للتسجيل بالإيميل.
- حذف سؤال لسه بيمسح محاولات الطلاب عليه (بديل: أرشفة) — قرار منتج.
- تقسيم الملفات الضخمة (>800 سطر) و ~400 lint warning (`any`، unused).
- جدول `RevokedToken` و`Achievement` في الـ schema مش مستخدمين (حذفهم محتاج migration).

> الجداول تحت هي تقرير الـ discovery الأصلي كما هو، للمرجع.

## الحالة العامة

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` | ✅ نظيف |
| `pnpm test` | ✅ 111 test ناجحين (90 منهم gamification) |
| `pnpm lint` | ❌ 50 error + 423 warning → **الـ CI أحمر** |

أخطاء الـ lint: `react-hooks/refs` (27)، `set-state-in-effect` (19)، `immutability` (2)، `preserve-manual-memoization` (1)، و`rules-of-hooks` (1) وده bug حقيقي (تحت).

---

## 🔴 Critical — أمان وفقد بيانات

| # | المشكلة | المكان |
|---|---|---|
| C1 ✔ | **أي يوزر يقدر يبقى admin**: لو مفيش admin في الـ DB أول واحد يفتح أي action في الاستوديو يتعمل admin. ولو `ADMIN_EMAIL` متحدد، أي حد يعمل signup بنفس الإيميل (مفيش email verification) يبقى admin. | `src/lib/studio-auth.ts:26-38`, `:77-90` |
| C2 ✔ | **أي طالب يقدر ينشر/يرفض أسئلة**: `requireReviewer()` بتشيك login بس. | `src/server/actions/studio-review.ts:11` |
| C3 | الطالب عنده `question:read` → يقدر يقرا `getQuestionDetail` (drafts + الإجابات + AI notes)، `getQuestionVersions`، `previewBulkApplyCount`. | `src/lib/auth.ts` ~60، `studio-questions.ts` |
| C4 ✔ | Endpoints من غير auth: `getImportProcessingStatus`، `buildSystemPrompt` (exported server action)، و`/api/studio/chat/stream` بيشيك session بس (أي طالب يستخدم الـ AI chat بتاع الاستوديو). | `studio-processing.ts:16`, `studio-chat.ts:23`, `api/studio/chat/stream/route.ts:147` |
| C5 ✔ | **IDOR**: `askStudyBuddy` بيكتب رسايل في `activeSessionId` حتى لو مش بتاع اليوزر. | `src/server/actions/ai-study-buddy.ts:152` |
| C6 ✔ | **Caddyfile** بيعمل proxy لأي port داخلي عن طريق `?XTransformPort=`. | `Caddyfile:1-12` |
| C7 | **Sentry tunnel** بياخد الـ DSN من الـ body ويبعت لأي host (open relay / SSRF). | `src/app/sentry-tunnel/route.ts:25-38` |
| C8 ✔ | **الإجابة الصح بيحددها الكلاينت**: `recordAttempt` بيثق في `input.isCorrect` → تزوير XP والـ leaderboard. و`correctKey` بيوصل للمتصفح أثناء الامتحان. | `src/server/actions/progress.ts:22-50`, `ExamRunnerView.tsx:152` |
| C9 ✔ | **Service worker بيكاش كل POST (server actions)** بدون scope لليوزر وما بيتمسحش عند logout → بيانات يوزر ممكن تظهر لغيره على نفس الجهاز، وmutations بترجع ردود قديمة offline. | `public/sw.js:210-252` |
| C10 | `bulkApplyField` بفلتر فاضي يعدّل **كل** الأسئلة، ومن غير `oldValue` في الـ versions (مفيش undo). | `studio-questions.ts:490,556` |
| C11 | حذف source/أسئلة بيمسح attempts/favorites/schedules بتاعة الطلاب ومن غير transaction. | `studio-library.ts:226`, `studio-sources.ts:206` |
| C12 | `updateUserRole`/`deleteUser` بيسمحوا للأدمن يشيل نفسه أو آخر أدمن → يفتح C1 تاني. | `studio-users.ts:217,240` |

## 🟠 Important — منطق مكسور / تجربة مستخدم

### Auth & infra
- مفيش rate limit على login/signup، وفي user enumeration (رسالة signup + timing). الإيميل مش بيتعمله lowercase → حسابات مكررة. — `src/lib/auth.ts:145-178`, `actions/auth.ts:55-66`
- الـ rate limiter in-memory وبالـ IP بس، ومش متطبق على أي server action. — `src/lib/rate-limiter.ts`
- Token revocation المذكور في الـ README مش متنده في أي حتة (dead code)، وTTL 15 دقيقة مقابل JWT 30 يوم.
- مفيش security headers / CSP. `/api/health` بيرجّع رسالة خطأ Prisma الخام.
- `db.ts` بيسجّل SIGTERM handlers بتعمل `process.exit`.

### Database
- **مفيش `prisma/migrations`** — الشغل بـ `db push`. والكود بيعمل `ALTER TABLE`/`CREATE TABLE` وقت الـ request لتعويض الـ drift. — `studio-ingest.ts:27-55`, `studio-settings.ts:47-58`
- Indexes ناقصة: `Account.userId`, `Session.userId`, `Passage.sourceId`, `Favorite.questionId`, `ReviewSchedule.questionId`.
- Roles/status نصوص حرة، والـ JSON متخزن كـ `String`.

### AI & Import
- ✔ رفع ملف > 1MB غالبًا بيفشل: مفيش `serverActions.bodySizeLimit` (الـ UI بيقول 15MB). — `next.config.ts`
- الـ AI كله OpenRouter رغم إن الكود/الدوكس بيقولوا Gemini. `GOOGLE_API_KEY` بيتبعت لـ OpenRouter (هيفشل). إعداد `ai_model` في الـ UI مالوش أثر. — `src/server/ai/evaluator.ts:104-113`
- مفيش timeout على أي AI call + fallback على عشرات الموديلات → call ممكن تاخد دقايق.
- الـ ingestion كلها جوه request واحد؛ لو اتقطع الـ source بيفضل `processing` للأبد. شغل background من غير `await` بيتقتل على serverless.
- `$transaction` بـ timeout الافتراضي 5 ثواني → imports كبيرة هتعمل rollback.
- قص صامت للنص عند 35k حرف، والـ output محدود بـ 8192 token → JSON مقطوع.
- Zod مش بيتأكد إن `correctKey` من ضمن الاختيارات.
- AI study plan بيتولد من جديد في كل فتح للصفحة (وكمان مع الـ hover prefetch) → بيستهلك الكوتا.

### Student app
- ✔ `ExamReportView.tsx:62`: `useMemo` بعد `return` → crash لما ترجع من المراجعة التفصيلية.
- "استكمال الجلسة" بايظ: `AuthGate.tsx:78` بيمسح الـ pending state قبل `setView`. والامتحان الجديد ممكن يورث `timeLeft` من القديم.
- XP بيتحسب read-modify-write (مش `increment`) → فقد XP مع الطلبات المتوازية. — `progress.ts:69-114`
- Timezone: `todayKey()` بتوقيت السيرفر (UTC) والطلاب في السعودية → اليوم/الـ streak بيتقلب الساعة 3 الفجر. وفيه خلط UTC/local وبداية أسبوع أحد مقابل اتنين.
- Achievements عمرها ما بتتفتح، `shieldEarned` دايمًا false، multipliers الصعوبة ومكافأة الامتحان مش متطبقين.
- في الامتحان أول اختيار بس اللي بيتسجل كـ attempt (تغيير الإجابة مش محسوب).
- Hover prefetch ما بيعملش حاجة (مفاتيح cache مختلفة). — `prefetch-view-data.ts:102`
- Leaderboard الأسبوعي بيرتب أعلى 50 بالـ XP الكلي بس.
- Setup views بتجيب أول 200 سؤال بس → باقي البنك مش بيظهر للطلاب.
- `fetchQuestions`/`fetchQuestionsByIds` بياخدوا limit/IDs من غير حد أقصى. Learning goal بـ target=0 → NaN.

### Studio
- Bulk updates من غير validation على status/difficulty ولا حد أقصى للـ ids. `page/pageSize` مش متشيكين.
- تاب "rejected" في الـ review = كل الـ drafts.
- `deleteCategory` مش بيفرض "فاضي بس".

## 🟡 Cleanup

- **Dependencies مش مستخدمة**: `z-ai-web-dev-sdk`, `next-intl`, `@mdxeditor/editor`, `@google/generative-ai`, `@reactuses/core`, `react-syntax-highlighter`, `uuid`, `@hookform/resolvers`, `date-fns`, `modern-web-guidance`, `bun-types`.
- Lockfiles اتنين (`bun.lock` قديم + `pnpm-lock.yaml`)، pnpm في الـ CI `latest`، اسم الباكدج `nextjs_tailwind_shadcn_ts`.
- Dead code: `env-validation.ts` (مش متنده)، `withSentryAction`, `StudioPlaceholder`, `api/route.ts`, `askStudyBuddy`, `cleanupStuckAuditLogs`, سكربتات debug في `scripts/`.
- تكرار: نسختين `requireStudioAccess`، 4 أساليب auth، SQL الـ category mastery في 4 أماكن، `parseJSONResponse` 3 مرات.
- ملفات ضخمة (>800 سطر): `StudioQuestionEditor` 1375، `StudioSourcesClient` 1283، `StudioAuditClient` 1113، `ProfileView` 1093، `AiStudyBuddyView` 1033، `StudioLibraryClient` 985، `DashboardView` 958، `StudioChatClient` 855.
- الدوكس قديمة: Node 18+ (المطلوب ≥20.9)، "71 test"، "migration histories"، "Gemini SDK"، متغيرات ناقصة في `.env.example` (`ADMIN_EMAIL`, `DB_CHECK_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`).
- `next-auth.d.ts` مش بيضيف `role` → `as any` في كل حتة.

---

## خطة العمل المقترحة (دفعات)

| دفعة | المحتوى | ليه بالترتيب ده |
|---|---|---|
| **0. CI أخضر** | إصلاح الـ 50 lint error (ومنها crash الـ ExamReport) | كل PR بعد كده يتقاس صح |
| **1. Authorization** | توحيد helper واحد للـ auth + أدوار صح؛ شيل الـ auto-admin (C1, C12)؛ قفل C2–C5؛ بذرة أدمن آمنة بسكربت | أخطر ثغرات |
| **2. سلامة الامتحانات** | السيرفر يحسب `isCorrect` والـ XP (C8)؛ عدم إرسال `correctKey` قبل الإجابة؛ `increment`؛ timezone الرياض | الـ leaderboard والتقدم بيعتمدوا عليه |
| **3. Infra/Hardening** | Caddyfile، sentry tunnel، SW (C9)، security headers، rate limit لـ login، health endpoint | |
| **4. DB** | baseline migration + شيل الـ runtime DDL + indexes + transactions في الحذف/الـ bulk (C10, C11) | محتاج وصول لـ Neon/تأكيد منك |
| **5. Import/AI** | bodySizeLimit، timeouts، تنظيف provider/env، transaction timeout، recovery للـ stuck sources، cache للـ study plan | |
| **6. Student UX bugs** | resume، achievements/shields، exam attempts، prefetch، leaderboard، pool الأسئلة | |
| **7. Cleanup** | deps، lockfile، dead code، تقسيم الملفات الكبيرة، تحديث الدوكس | |
