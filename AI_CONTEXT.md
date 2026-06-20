# AI_CONTEXT.md

## Project Name

SchoolWithEase

---

# Product Vision

SchoolWithEase is a multi-tenant educational operating system designed to serve:

* Nursery Schools
* Primary Schools
* Secondary Schools
* Universities
* Colleges
* Training Institutes
* Educational Organizations

The platform aims to centralize academic operations, finance, communication, HR, reporting, analytics, and AI-powered educational assistance into a single unified system.

The primary goal is to reduce administrative workload while improving communication, accountability, and educational outcomes.

---

# Current Strategy

The platform is currently being built as:

* Responsive Web Application
* Progressive Web App (PWA)

Native Android and iOS applications are NOT part of the current phase.

Future native applications may be evaluated after significant user adoption.

---

# Architecture

Monorepo Architecture

Technology Stack:

* Next.js
* TypeScript
* Turborepo
* PostgreSQL
* Prisma ORM
* TailwindCSS
* shadcn/ui
* PWA Support

Repository Structure:

apps/

* web — Next.js frontend (design system + product surfaces; currently mock data,
  not yet wired to the backend)
* api — **the real NestJS backend** (HTTP app): auth/login + MFA + select-school
  + refresh, RBAC (role/permission management), maker-checker, audit, tenant,
  breach response. DB-backed via `packages/database` (Prisma). `main.ts` bootstraps + listens.

packages/

* api — NestJS **service library** consumed by `apps/api` (tenant-context,
  JWT-secret, school-selection, suspension). NOT the HTTP app — don't confuse it
  with `apps/api` (a past hand-off did, and wrongly concluded "no auth backend").
* database — Prisma schema + client (`@workspace/database`); models for tenant,
  roles/permissions, users, academic structure, assessment, audit, etc.
* ui
* eslint-config
* jest-config
* tailwind-config
* typescript-config
* vitest-config

requirements/

* Product and architecture documentation

design-export/

* High-fidelity UI designs
* Design reference files
* Screenshots and exported assets

---

# Source Of Truth Priority

When conflicts occur:

1. Requirements Documents
2. Approved Designs
3. Existing Codebase
4. AI Suggestions

AI should NEVER override documented requirements without explicit instruction.

---

# Multi-Tenant Architecture

SchoolWithEase is a true multi-tenant platform.

Requirements:

* Multiple schools on one platform
* Tenant isolation
* Shared infrastructure
* School-specific configurations
* School-specific branding
* School-specific feature enablement

All new features must consider tenant boundaries.

---

# Access Control Model

Role-based access control (RBAC) is mandatory.

Roles and permissions are defined in:

requirements/access-control.md

requirements/permissions.md

AI must review those documents before implementing authorization changes.

---

# Major User Personas

Platform Level

* Architect
* Platform Administrator

School Level

* School Owner
* Proprietor
* Principal
* Vice Principal
* Head Teacher
* Academic Coordinator

Operational

* Finance Officer
* HR Officer
* Registrar
* Admissions Officer
* Librarian

Academic

* Teacher
* Class Teacher
* Subject Teacher

Student

* Student

Parent

* Parent / Guardian

Guest

* Prospective Parent
* Applicant
* Visitor

---

# AI Systems

There are TWO completely separate AI systems.

1. Academic AI Tutor

Purpose:

* Teaching
* Explanations
* Homework support
* Revision assistance

Restrictions:

* No access to school database
* No access to student analytics
* No access to personal records

2. School Intelligence Assistant

Purpose:

* Administrative assistance
* Analytics
* Reporting
* Workflow assistance

Restrictions:

* Permission-aware
* Must respect RBAC
* Must respect tenant boundaries

These systems must NEVER be merged.

---

# Frontend Development Rules

Use approved designs as source of truth.

Requirements:

* Mobile-first responsive design
* PWA compatibility
* Accessibility support
* Reusable component architecture

Avoid:

* One-off UI implementations
* Duplicate components
* Hardcoded permissions
* Hardcoded tenant logic

Reusable components should be created inside:

packages/ui

before being consumed by apps/web.

---

# Backend Rules

Preserve existing Prisma schema whenever possible.

Do not introduce breaking database changes without documenting:

* Purpose
* Impact
* Migration strategy

All API changes should remain backward compatible whenever possible.

---

# Coding Standards

Requirements:

* Strict TypeScript
* ESLint compliance
* Consistent naming
* Reusable services
* Feature-based organization

Every implementation must:

* Compile successfully
* Pass linting
* Pass type checking

before being considered complete.

---

# Current Priority

Phase 1

* Frontend redesign and reconstruction
* Design system creation
* Shared UI components
* Layout architecture
* Authentication flows

Phase 2

* Dashboard infrastructure
* Role-aware navigation
* Tenant-aware navigation

Phase 3

* Academic modules
* Finance modules
* Communication modules

Phase 4

* AI integrations

---

# Documents To Read First

Before implementing features, review:

1. requirements/PRD.md
2. requirements/features-functionality.md
3. requirements/access-control.md
4. requirements/permissions.md
5. requirements/multi-tenant-architecture.md
6. requirements/ai-integration.md
7. requirements/polymorphic-design.md

These documents are mandatory references.
