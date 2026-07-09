# Academics Reuse Assessment — learn-lift-backend & gau-api

> Assessment of `/Users/befenudu/Documents/works/learn-lift/learn-lift-backend` and
> `/Users/befenudu/Documents/works/GAU/gau-dashboard/gau-api` as accelerators for the
> SchoolWithEase academics build-out. Our `requirements/` remain the final authority;
> these repos are pattern donors, not code donors.

## 1. What the reference repos are

Both are NestJS + Mongoose (MongoDB) monoliths, single-tenant, with a
module-per-domain layout (`schemas/`, `dtos/`, `mappers/`, `interfaces/`).

- **learn-lift-backend** — K-12 e-learning: education structure (faculty/department/
  special class), subjects, chapters, lessons, file catalog, question bank,
  assessments, assignments, answer sheets, subscriptions (Paystack), S3 uploads.
- **gau-api** — university LMS variant of the same codebase: courses → chapters,
  file catalog, question bank, assessments, answer sheets, course progress,
  ratings/reviews, certificates, chatbot.

Their stack (Mongoose documents, ObjectId ref arrays, no tenancy, no RLS, coarse
`userType` authorization) does **not** transfer. What transfers is the **domain
model shapes and workflows**, which both repos proved in production.

## 2. Reusable principles & workflows

### 2.1 Content hierarchy (both repos)
`Subject/Course → Chapter → Lesson → Files (videos[], pdfs[])`.
Lessons aggregate typed file references; chapters aggregate lessons, assignments
and assessments. **Mapping here:** our `Course → Class → Lesson → LessonMaterial`
already mirrors this (Class plays the role of a term-bound subject offering;
lesson `order` plays the chapter sequencing role). No new hierarchy level needed.

### 2.2 File catalog with approval gate (both repos)
A single `File` record per upload: `fileCategory` (image/video/document/generic/
question_image), storage `key` + `url`, owner, optional subject/lesson refs,
`duration`, and — the key bit — **`isApproved: false` by default**. Content
uploaded by teachers is invisible to students until an admin flips the flag.
**Adaptation:** our `LessonMaterial` gets a `category` column and a proper
review-state machine (`draft → pending_review → approved | rejected` with
reviewer identity, timestamp and note) instead of a bare boolean — our
requirements demand approval *workflows* (features-functionality.md: "validation
and approval workflows"), auditability, and RLS-safe tenant scoping.

### 2.3 Question bank (learn-lift `question`, reused by gau)
Question: owner teacher, subject scope, `category` (assessment|assignment),
`style` (MCQ default), `instruction`, `text`, optional `image`, `options[]`
(label + text/image), `answer` (correct label), optional `solution` (worked
answer shown after marking). Questions are linked to an assessment/assignment via
id arrays. **Adaptation:** first-class `Question` table scoped to tenant +
Course (the bank outlives any one class), joined to `Assessment` through an
explicit `AssessmentQuestion` join with `order` and `points` — Postgres join
tables replace Mongo ref-arrays and let different questions carry different
weights (our Assessments already have `maxPoints`).

### 2.4 Auto-marked answer sheets (learn-lift `answer-sheet`)
Submission workflow proven in learn-lift:
1. Student submits `{question, answer}[]` for an assessment/assignment.
2. Server re-fetches the questions and marks server-side (never trusts client
   scores): `score = Σ correct`, `percentage = ceil(score/total×100)`.
3. Assignment category = single attempt (409 on retry); assessments allow
   re-attempts by overwriting.
**Adaptation:** `AssessmentSubmission` table keyed to `Enrollment` (like our
`Grade`), with `answers` JSONB, per-question points from `AssessmentQuestion`,
`maxAttempts` honored per Assessment, deadline (`dueDate`) and `durationMinutes`
enforced server-side. Objective styles (MCQ/true-false) auto-mark and upsert a
`Grade` row through the existing `computeGradeValues` (percentage → letter →
GPA via the tenant's GradingSystem). Essay/short-answer land as `submitted` for
teacher grading — merging both repos' flow with our richer gradebook.

### 2.5 Teacher–subject allocation (learn-lift `user.subjects[]`)
Teachers carry allocated subject ids; only allocated teachers author content for
a subject. **Adaptation:** we already model this better with `ClassTeacher`
(role, assignedBy, unassignedAt, isActive) — but it has **no API endpoints and
is not enforced anywhere**. Reuse the principle: allocation endpoints on Class +
service-level ownership checks (a teacher may only author/edit content and
assessments for classes where they hold an active `ClassTeacher` row; admins
bypass via a broader permission).

### 2.6 Course progress (gau `course-progress`)
Per-student watched-video set → percentage. Worth adopting **later** for the AI
tutor's context (what the student has/hasn't covered); not part of today's
scope — noted as a follow-up, keyed on (enrollment, lesson/material).

### 2.7 Other patterns noted, not adopted now
- Ratings/reviews aggregation with breakdown (gau) — not a requirement.
- Certificates, subscriptions/Paystack, smart contracts — out of scope.
- OTP/user flows — ours are stronger (JWT-per-tenant, clearance levels).
- S3 helper module — our `StorageProvider` port already abstracts this;
  S3 becomes an alternate implementation later, no design change needed.

## 3. Gap analysis (current system vs. the ask)

| Concern | Today | Gap → action |
|---|---|---|
| Class management | `Class` CRUD, schedule, roster endpoints | none — done |
| Subject allocation to teachers | `ClassTeacher` model only | add endpoints + enforce ownership in content/assessment services |
| Lesson notes | `Lesson` (title/desc only, built as AI-tutor substrate) | add rich-text `content` body |
| Videos | uploads restricted to PDF/DOCX/PPTX/TXT | add `category`; accept video/image/audio, skip extraction pipeline; add download/stream endpoint |
| Material approval before student visibility | `status` draft/published only | review-state machine + `lessons.approve` permission on Lesson & LessonMaterial |
| Who can see/edit/delete | flat permissions; students (clearance 1) cannot see lessons at all | `lessons.view.own` for students (published + approved + enrolled only); teacher mutations gated by `ClassTeacher`; admin override permission |
| Assessments | gradebook (`Assessment`/`Grade`) only — no questions, no taking | question bank + `AssessmentQuestion` + `AssessmentSubmission`, auto-marking into `Grade` |
| Assignments | covered by `Assessment.type='assignment'` | same submission flow; single-attempt default via `maxAttempts` |

## 4. Adaptation plan (built today)

1. **Schema** — `learning.prisma`: Lesson `content`, review fields; LessonMaterial
   `category`, review fields. `assessment-grading.prisma`: `Question`,
   `AssessmentQuestion`, `AssessmentSubmission`; Assessment `durationMinutes`,
   `maxAttempts`. One migration incl. RLS policies (tenant_isolation, RESTRICTIVE)
   for new tables, per the learning-domain migration pattern.
2. **Learning module** — material categories + streaming download; review
   workflow endpoints (`submit-review`, `approve`, `reject` for lessons and
   materials); role-aware visibility (students: published+approved+enrolled;
   teachers: own classes; `lessons.manage.all` bypass for admins).
3. **Academic-structure** — `GET/POST/DELETE /classes/:id/teachers`.
4. **Assessment module** — Question CRUD (course-scoped bank), attach/detach/
   reorder on assessments, `GET /assessments/:id/take` (sans answers),
   `POST /assessments/:id/submissions` with server-side marking → `Grade`.
5. **Seed** — new permissions wired into pools/roles; verify-seed updated.
6. **Tests + docs** — unit specs for marking, review transitions, scoping;
   build/lint/test green; handoff docs updated.

Deliberate deferrals: course progress tracking (2.6), S3 storage implementation,
timed-attempt auto-submit background job (deadline+duration are enforced at
submit time today).
