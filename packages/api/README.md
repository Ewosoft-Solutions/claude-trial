# @workspace/api — Shared API Library

**This is a shared library package, not the HTTP server.**

## Package boundary

| Package | What it is |
|---|---|
| `packages/api` (`@workspace/api`) | Shared TypeScript library — tenant context utilities, JWT secret management, link entities, and shared types consumed by other packages and services. Builds to `dist/` via `tsc`. |
| `apps/api` | The NestJS HTTP application — auth, RBAC, MFA, maker-checker, academic core, attendance, finance. Imports from `@workspace/api` for shared tenant/JWT logic. |

## What lives here

- **`src/tenant/`** — `TenantValidationService`, `TenantDbService` helpers, JWT secret service (`JWTSecretService`), suspension logic.
- **`src/links/`** — `Link` entity + DTOs (short-link feature, shared across services).
- **`src/types/`** — Shared TypeScript types.
- **`src/entry.ts`** — barrel export.

## Consumers

- `apps/api` imports `@workspace/api` for `JWTSecretService`, `TenantValidationService`, `TenantDbService` primitives.
- Any future service (e.g. a reporting sidecar) can import shared types without depending on the NestJS app.

## Build

```bash
pnpm --filter @workspace/api build
```

Output goes to `dist/`. Do **not** commit compiled files from `src/` — they are gitignored.
