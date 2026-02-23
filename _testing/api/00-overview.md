# API Testing Guide - Overview

This guide walks you through testing the School With Ease API from scratch. It assumes you have the codebase cloned and want to interact with the API manually (e.g., via Postman, curl, or the Swagger UI).

## Prerequisites

| Requirement       | Version    | Notes                                     |
| ----------------- | ---------- | ----------------------------------------- |
| Node.js           | >= 20.19   | Required by the monorepo                  |
| pnpm              | 10.4.1     | Package manager (corepack recommended)    |
| PostgreSQL        | 14+        | Local instance or remote connection       |
| An HTTP client    | Any        | Postman, Insomnia, curl, or Swagger UI    |

## Monorepo Structure (Testing-Relevant)

```
.
├── apps/
│   └── api/                    # NestJS API server (port 3000)
├── packages/
│   └── database/               # Prisma ORM, schema, migrations, seed scripts
└── _testing/
    └── api/                    # This documentation
```

## How to Read This Guide

Follow the sections **in order** the first time. Each builds on the previous:

| Order | Section                                                          | What You'll Do                                         |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | [Environment Setup](./01-environment-setup/README.md)            | Configure `.env` files, install deps, set up database  |
| 2     | [Seeding the Platform](./02-seeding/README.md)                   | Run seed scripts to populate roles and permissions     |
| 3     | [Authentication](./03-authentication/README.md)                  | Log in, select a school, get JWT tokens                |
| 4     | [Tenant Management](./04-tenant-management/README.md)            | Register schools, create users, manage tenants         |
| 5     | [Academic Management](./05-academic-management/README.md)        | Work with students, classes, courses, grades           |
| 6     | [API Reference](./06-api-reference/README.md)                    | Quick-reference table of every endpoint                |

## Key Concepts

### Multi-Tenant Architecture

Every data operation is scoped to a **tenant** (school). After logging in, you select which school to operate in, and the JWT token you receive is bound to that tenant.

### Clearance Levels

Roles have numeric clearance levels (0-10) that determine what operations are allowed:

| Level | Role          | Typical Use                       |
| ----- | ------------- | --------------------------------- |
| 10    | Architect     | Platform infrastructure           |
| 9     | SuperAdmin    | Platform-wide administration      |
| 8     | Owner         | School registration, full control |
| 7     | Management    | Staff and user management         |
| 6     | ITSupport     | Technical operations              |
| 5     | Finance       | Billing and fees                  |
| 4     | Operations    | Logistics and facilities          |
| 3     | Teacher       | Academics and grading             |
| 2     | Parent        | Monitoring children               |
| 1     | Student       | Own academic data                 |
| 0     | Guest         | Read-only public access           |

Endpoints enforce minimum clearance levels. For example, `POST /tenant/register` requires clearance 8+ (Owner or higher).

### Platform Bootstrap

The seed script creates a **Platform Architect** account — the originator who bootstraps the entire system:

| Field    | Value                           |
| -------- | ------------------------------- |
| Email    | `architect@schoolwithease.com`  |
| Password | `Architect@2025!`               |
| Role     | Architect (clearance level 10)  |
| Tenant   | Platform Administration         |

This is the first user you log in with. From there, you can register schools and create users.

### Authentication Flow (Summary)

```
POST /auth/login          →  Returns list of schools the user belongs to
POST /auth/select-school  →  Returns JWT access + refresh tokens scoped to one school
Authorization: Bearer <token>  →  Used on all subsequent requests
```

### Swagger UI

Once the API is running, interactive documentation is available at:

```
http://localhost:3000/api/docs
```

You can authorize in Swagger UI with your JWT token and test endpoints directly from the browser.
