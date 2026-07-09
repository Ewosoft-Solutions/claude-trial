Current Phase: Phase 3 - AI Integration (PRD §11 Phase 3)

> Rewritten 2026-07-06. The previous version of this file (Phase 2 - Dashboard
> Infrastructure, with academic/finance/communication modules as a future
> "Phase 3") was stale: all of that shipped between 2026-06 and 2026-07-01 via
> `docs/backend-remediation-plan.md` (Steps 1-8, closed). Phase numbering now
> follows the PRD: Phase 1 = core platform (done), Phase 2 = operations
> modules (done; PWA offline/push explicitly deferred), Phase 3 = AI.

Where we actually are:
- Real auth end-to-end (login -> MFA -> school selection -> session -> profile
  switching) against apps/api; RBAC with 297 seeded permissions, clearance
  levels 0-10, maker-checker, audit; RLS-enforced multi-tenancy across 19
  Prisma schemas; academic core + finance +
  communication + all six operational domains (admissions, transport, library,
  health, HR/payroll, events) each with model + RLS + NestJS module + frontend
  surface.
- AI foundation (plan Step 1) done 2026-07-06: apps/api/src/ai module (owns
  AIMediatorService, moved out of auth/), AnthropicService wrapping
  @anthropic-ai/sdk (AI_MODEL/AI_MAX_TOKENS/AI_ENABLED config, /ai/health),
  "ai" Prisma schema with ChatSession/ChatMessage + RLS, and ai.analytics.query
  / ai.chat.use / ai.configure seeded into the permission catalog.
- Analytics AI (plan Steps 2+3) done 2026-07-07: backend (LlmProvider port,
  six mediated tools, manual tool loop, POST /ai/analytics/chat SSE + session
  read endpoints, live-verified via the gated paid e2e) and frontend (shared
  chat kit in packages/ui, /assistant page with streaming + session resume,
  Assistant nav item at clearance floor 1, live-verified in a browser as
  owner + parent). First user-facing AI feature is shipped.
- Lesson content substrate (plan Step 4) done 2026-07-07: learning schema
  (Lesson/LessonMaterial/MaterialChunk + pgvector), StorageProvider +
  EmbeddingsProvider ports, extraction→chunk→embed pipeline, /learning
  module, isolation e2e, teacher upload surface.
- Academics build-out done 2026-07-08 (docs/academics-reuse-assessment.md,
  patterns adapted from the user's learn-lift/gau repos): lesson notes +
  video/media materials with streaming download, review/approval workflow
  gating student visibility, teacher-class allocation endpoints with
  record-level enforcement, course-scoped question bank + online assessment
  taking with server-side auto-marking into the gradebook, plus frontend
  surfaces for materials, review, teachers, question bank, assessments, and
  student assessment taking. Permissions 297.
- Runtime mock/dev-seed cleanup done 2026-07-09: web route handlers and app
  pages no longer fall back to local mock/demo rows; they call backend data and
  render empty states when data is absent. Dev-only seeds live under
  `packages/database/prisma/scripts/dev/`, require `ENABLE_DEV_SEEDS=true`, and
  refuse production environments. Operational dev seeds are tied to real
  personas/students/staff with traceable `DEV-SEED` / `DEV-*` values.
- Academic AI tutor (plan Step 5) done 2026-07-09: lesson-scoped RAG with
  citations, academic-integrity prompt, assessment-window blocking, persisted
  student sessions, teacher usage v1, `/classes/tutor`, and
  `/classes/tutor-usage`. Live browser acceptance remains pending.
- AI hardening/governance (plan Step 6) done 2026-07-09: DB-backed
  `ai_settings`, monthly usage aggregates, tenant concurrency leases,
  `/ai/admin/usage`, `/settings/ai-usage`, prompt-injection smoke tests,
  tool-permission matrix, and AI-schema RLS coverage.

Current Objective:
Run the remaining Step 5 live browser acceptance with the spend-capped
Anthropic key, then refresh PR #1 with the AI Steps 1-6 summary and
verification notes.

Do not work on parked items (PWA offline/push, subdomain resolution,
schoolType polymorphism, Step 8 sub-surfaces - see the plan's "Parked"
section) unless unblocking AI work requires it. Continue reusing packages/ui;
build new shared UI in packages/ui before consuming it in apps/web.
