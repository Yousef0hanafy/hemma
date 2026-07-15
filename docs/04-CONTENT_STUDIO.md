# Content Studio (لوحة التحكم)

> Admin panel for managing content, users, and AI processing. Accessible at `/studio/*`

---

## Overview

The Content Studio is a full-featured admin panel for managing the entire educational content lifecycle — from import through AI processing, review, publishing, and analytics.

**Access:** Only users with `role: "admin"` or `role: "editor"` can access the Studio.

---

## Pages

### 1. Dashboard (`/studio`)

Real-time overview of the platform:

- **Quick Stats**: Total questions, students, sources, attempts
- **Recent Imports**: Latest content imports with status
- **Review Queue Summary**: Questions pending review
- **Activity Trend**: 14-day question addition chart
- **Status Distribution**: Published vs draft vs review counts
- **Quality Overview**: AI quality score distribution

**File:** `src/components/studio/StudioDashboardClient.tsx`

---

### 2. Content Library (`/studio/library`)

Full question management with table view.

| Feature | Details |
|---------|---------|
| **Table View** | Sortable, searchable question list |
| **Filters** | By status, category, source, difficulty |
| **Bulk Actions** | Change status, category, difficulty for selected questions |
| **Quick Edit** | Inline field editing (stem, explanation, difficulty) |
| **Status Badges** | Published, Draft, Review, Archived, Approved |
| **AI Badges** | Shows quality score, processing status |
| **Export** | Download questions as JSON |

**File:** `src/components/studio/StudioLibraryClient.tsx`

---

### 3. Question Editor (`/studio/questions/[id]`)

Full question detail view with inline editing.

| Feature | Details |
|---------|---------|
| **Inline Editing** | Click any field to edit (stem, options, explanation, study tip) |
| **AI Insights Panel** | Quality score, estimated difficulty, AI suggestions |
| **Version History** | Field-level change tracking with timestamps |
| **Status Management** | Draft → Review → Approved → Published → Archived |
| **Preview Mode** | See the question as a student would |
| **Keyboard Shortcuts** | j/k = prev/next, e = edit, s = save, Esc = cancel |
| **AI Explanation** | Auto-generate explanation with Gemini |
| **AI Difficulty** | Estimate difficulty with Gemini |
| **Navigation** | Quick prev/next between questions |

**File:** `src/components/studio/StudioQuestionEditor.tsx`

---

### 4. Import Center (`/studio/import`)

Upload content from multiple sources.

| Import Method | Details |
|---------------|---------|
| **JSON File** | Drag & drop or browse. Validates and shows preview |
| **Paste Text** | Paste question text directly |
| **PDF** (planned) | Upload PDF for AI extraction |
| **DOCX** (planned) | Upload Word documents |

**Import pipeline:**
1. Upload / Paste → Validate JSON
2. Preview with question count, categories detected
3. Confirm → Insert into database
4. Auto-process (if enabled): AI quality check + difficulty + explanation
5. Success page with processing status

**File:** `src/components/studio/StudioImportClient.tsx`

---

### 5. Review Queue (`/studio/review`)

Keyboard-first review workflow for content approval.

| Feature | Details |
|---------|---------|
| **Queue View** | Questions pending review with priority |
| **Full Question View** | See stem, options, explanation, AI quality score |
| **Approve** | Mark as approved |
| **Reject** | Reject with notes for revision |
| **AI Flagging** | AI-flagged potential issues highlighted |
| **Keyboard Shortcuts** | Full keyboard navigation |
| **Review History** | Previous reviews with notes |

**File:** `src/components/studio/StudioReviewClient.tsx`

---

### 6. Analytics (`/studio/analytics`)

Data-driven insights for content managers.

| Section | Content |
|---------|---------|
| **Overview** | Total questions, students, attempts, sources |
| **Student Performance** | Average accuracy, attempts per student, activity over time |
| **Content Quality** | AI quality score distribution, low-quality question list |
| **Category Breakdown** | Questions per category, accuracy per category |
| **Difficulty Distribution** | Easy/Medium/Hard question mix |
| **Trending Insights** | Which categories need more questions, which have quality issues |
| **Needs Attention** | Questions with low quality scores, low attempt counts |

**File:** `src/components/studio/StudioAnalyticsClient.tsx` | `src/server/actions/studio-analytics.ts`

---

### 7. Categories (`/studio/categories`)

Manage question categories.

| Feature | Details |
|---------|---------|
| **List View** | All categories with question counts |
| **Drag Reorder** | Drag to reorder display order |
| **Rename** | Edit Arabic name |
| **Icon Picker** | Choose emoji icon |
| **Color Theme** | Set category color |
| **Create** | Add new categories |
| **Delete** | Remove empty categories |

**File:** `src/components/studio/StudioCategoriesClient.tsx`

---

### 8. Sources (`/studio/sources`)

Manage imported content sources.

| Feature | Details |
|---------|---------|
| **Source List** | All imported files with question counts |
| **Import History** | When each source was imported |
| **Processing Status** | AI processing progress (quality, difficulty, explanations) |
| **Batch AI Actions** | Run AI on selected/all sources |
| **Export** | Download source as JSON |
| **Delete** | Remove source and all its questions |

**File:** `src/components/studio/StudioSourcesClient.tsx`

---

### 9. Users (`/studio/users`)

User management.

| Feature | Details |
|---------|---------|
| **User Table** | All users with name, email, role, auth provider |
| **Role Management** | Change user roles (student, editor, admin) |
| **Activity Stats** | Total attempts, correct count, last active date |
| **Delete User** | Remove user and all their data |
| **Overview Stats** | Total users, active users, new users this month |

**File:** `src/components/studio/StudioUsersClient.tsx`

---

### 10. AI Chat (`/studio/chat`)

AI Q&A Assistant for content managers.

| Feature | Details |
|---------|---------|
| **Chat Interface** | Conversational AI about content quality |
| **Gemini Streaming** | Token-by-token streaming responses |
| **Session Management** | Multiple chat sessions, persisted to DB |
| **Title Editing** | Rename chat sessions |
| **Delete Sessions** | Clean up old conversations |
| **Arabic-first** | Full RTL support in chat UI |

**File:** `src/components/studio/StudioChatClient.tsx`

---

### 11. Processing Audit (`/studio/audit`)

Track all AI processing operations.

| Feature | Details |
|---------|---------|
| **Audit Trail** | Every AI operation with status, duration, result |
| **Filters** | By operation type, status, source, date range |
| **Quick Stats** | Total operations, success rate, avg duration |
| **Error Details** | Expand to see error messages for failed operations |
| **Source Filter** | View operations for a specific source |

**File:** `src/components/studio/StudioAuditClient.tsx`

---

### 12. Settings (`/studio/settings`)

System configuration.

| Setting | Options |
|---------|---------|
| **Default Question Status** | Draft / Review / Published |
| **Auto Quality Check on Import** | On/Off |
| **Auto Difficulty Estimation** | On/Off |
| **Auto Explanation Generation** | On/Off |
| **AI Model** | Gemini model selection |
| **Reset All Settings** | Restore defaults |

**File:** `src/components/studio/StudioSettingsClient.tsx`

---

## AI Processing Pipeline

```
                ┌──────────────┐
                │  New Import   │
                └──────┬───────┘
                       │
            ┌──────────▼──────────┐
            │  Auto-processing?    │
            │  (check settings)    │
            └──────┬──────┬───────┘
                   │ NO   │ YES
                   │      └──────────────┐
                   │                     │
            ┌──────▼──────┐    ┌─────────▼──────────┐
            │ Manual only  │    │  Queue AI pipeline   │
            └──────┬──────┘    │                      │
                   │           │  ┌────────────────┐  │
                   │           │  │ Quality Check  │  │
                   │           │  ├────────────────┤  │
                   │           │  │ Difficulty Est │  │
          ┌────────▼────────┐  │  ├────────────────┤  │
          │ Source Details   │  │ │ Explanation    │  │
          │ "Run AI" button │  │  │ Generation     │  │
          └─────────────────┘  │  └────────────────┘  │
                               └──────────────────────┘
```

## Sidebar Navigation

The Studio sidebar shows real-time badges:
- **Review Queue**: Count of questions in "review" status
- **Library**: Total question count
- **Users**: Total non-admin user count
- **Sources**: Total source count
- **Processing**: Failed AI operations in last 24 hours

All counts fetched in a single server action (`getSidebarBadgeCounts`).

**File:** `src/server/actions/studio-sidebar.ts` | `src/components/studio/StudioSidebar.tsx`
