# Biometrics & Passkeys — Design & Implementation Plan

> **Status:** Delivered — Phases 0–4 were implemented on 2026-07-17. Companion
> to `auth-hardening-plan.md` (Workstream C).
> Product decisions were confirmed with the product owner; production RP/origin
> values remain deployment configuration.
> Physical iPhone installed-PWA acceptance was completed successfully on
> 2026-07-17.

## Goal

Let a user opt in to authenticating with their device's own mechanism — Face ID,
Touch ID, Windows Hello, Android biometrics, device PIN, or a passkey — so they
stop re-typing a password. Biometrics is used for **both**:

1. **Passwordless login** (the target end state — one-tap), and
2. **Step-up re-verification** for sensitive actions.

## Confirmed decisions

| #   | Decision                   | Choice                                                                                                                                                                                                                |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login scope                | **True one-tap passwordless** (discoverable/resident credentials). Built in phases, but the end state is no email/password at the login screen.                                                                       |
| 2   | Biometrics vs MFA          | A user-verified platform passkey **counts as MFA** (it is device-possession + biometric/PIN, and phishing-resistant). No extra OTP stacked on top. Password+TOTP path is unchanged for non-passkey users.             |
| 3   | Which actions need step-up | The **catalog of protected actions is platform-owned** (see §4). Tenants **cannot edit** it; they get a **read-only summary** and can **submit a change request** that platform reviews, with feedback surfaced back. |
| 4   | Enrollment policy          | **Require / Allow / Forbid per school**, set by the tenant admin (distinct plane from #3).                                                                                                                            |

Two governance planes fall out of #3 and #4 — keep them separate:

- **Plane A — Step-up catalog (platform-owned).** _Which_ operations demand a
  fresh step-up, and at what assurance. Editable only by platform users
  (clearance 9 / platform-oversight). Tenants view a summary + request changes.
- **Plane B — Enrollment policy (tenant-owned).** Whether _this school's users_
  may/must/can't enrol biometrics for login. Editable by the tenant admin role.

---

## 1. Baseline before implementation (historical)

The implementation started from an existing hardware-security-key WebAuthn
path, without platform passkeys or a client-side biometric experience:

- `apps/api/src/auth/services/mfa-webauthn.service.ts` uses `@simplewebauthn/server`
  with `authenticatorAttachment: 'cross-platform'`, `requireResidentKey: false`,
  `userVerification: 'preferred'`, default name `'Hardware Key'`.
- Credentials persist in `MfaMethod` (`webauthnId`, `webauthnPublicKey`,
  `webauthnCounter`) — `packages/database/prisma/models/user-management.prisma:144`.
- Full MFA lifecycle + recovery codes: `apps/api/src/auth/mfa.controller.ts`.
- Login already has an MFA branch that can return `webauthnOptions`:
  `authentication.service.ts:325`.
- JWT TTLs: access **1h**, refresh **7d**, pre-auth **5min** (`jwt.service.ts`).
- Audit logging exists and is used at login (`authentication.service.ts:293`).
- `WEBAUTHN_RP_NAME/RP_ID/ORIGIN` env keys exist (`env.config.ts:45`).

At that baseline, `login-form.tsx` only handled a 6-digit OTP; there was
no `@simplewebauthn/browser`, no `navigator.credentials` call, and **no
Settings → Security page** (settings has profile/roles/audit/features/etc. but
no security surface).

Step-up was scaffolding only, and unsound. `guards/mfa-required.guard.ts` +
`maker-checker.service.ts` exist, but the guard is applied to **no endpoint**
and `MfaRequired()` is a no-op stub. See §5 for the defect.

---

## 2. Security fixes to land first (Phase 0)

These are prerequisites — do not build biometrics on top of them unfixed.

1. **Rewrite the step-up guard.** `MfaRequiredGuard` returns `true` whenever a
   request carries both `x-mfa-challenge-id` and `x-mfa-verified: true` headers,
   skipping the DB check (`mfa-required.guard.ts:87-117` — inverted condition).
   Replace with a `StepUpGuard` whose **only** source of truth is a server-side
   `MfaChallenge` row that is `verified`, **unconsumed**, bound to the calling
   `userId` **and** the specific `operation`, and within a freshness window.
   Consume it on use (single-use). Never trust a client header.
2. **Fix credential-ID encoding.** `verifyAuthentication` round-trips
   base64url through `base64` (`mfa-webauthn.service.ts:330`), which can fail to
   match the stored `webauthnId`. Use SimpleWebAuthn's base64url helpers
   consistently for store + lookup.
3. **Require user verification** (`userVerification: 'required'`) on the
   biometric path — `'preferred'` lets a device skip the actual biometric/PIN.
4. **Multi-tenant RP scoping.** Credentials are bound to an RP ID and
   origin-checked, but you serve tenants on `{slug}.domain`. Register under the
   **apex RP ID** (e.g. `schoolwithease.com`) so one passkey works across all
   subdomains, and pass `expectedOrigin` as the **allow-list array** of
   subdomain origins to SimpleWebAuthn. Configure the production apex and
   single- or multi-apex topology at deployment. Add `WEBAUTHN_RP_ID` /
   `WEBAUTHN_ALLOWED_ORIGINS` (grouped beside the existing `WEBAUTHN_*` keys, not
   appended to the bottom of env).
5. **(Low priority)** Align `webauthnPublicKey` storage with the existing
   AES-256-GCM encrypted-column convention (`.env.example:28`). Public keys
   aren't secret, so this is hygiene, not a vulnerability.

---

## 3. Data model changes

Reuse `MfaMethod` / `MfaChallenge`; add:

- `MfaMethod.authenticatorAttachment` — `'platform' | 'cross-platform'` (so the
  UI can label "This iPhone" vs "YubiKey", and so passwordless only offers
  platform credentials).
- `MfaMethod.deviceLabel` (already have `name`), `aaguid?`, `backedUp?`,
  `transports?` (JSON) — for richer device management + iCloud/Google-synced
  passkey awareness.
- `MfaChallenge.consumedAt` — enforce single-use for step-up.
- **Plane B (tenant):** `SchoolSecurityPolicy.biometricEnrollmentPolicy`
  (`require | allow | forbid`), school-wide and tenant-admin managed.
- **Plane A (platform):** a `SensitiveOperationPolicy` table owned by platform,
  seeded from the code catalog in §4 (operation, category, assurance level,
  requiresMakerChecker, freshnessMinutes, enabled). Editable only by platform.
- **Tenant change requests:** reuse the maker-checker / platform-oversight
  request pattern for "tenant requested a catalog change" → platform decision →
  feedback visible to tenant.

---

## 4. Sensitive-action catalog (platform-owned)

Seeded from `maker-checker.service.ts` and expanded across modules. Grouped by
category; each entry gets an assurance level: **step-up** (fresh biometric/MFA
within N min) and/or **maker-checker** (second approver). Platform can toggle
per operation; tenants see this as a read-only summary.

**A. Governance & access control** _(step-up + existing maker-checker)_

- `roles.create` / `roles.update` / `roles.delete` / `roles.custom.level7.create`
- `permissions.modify` (permission-pool changes)
- `users.role.assign` / staff `users.create`
- `security-policy.update` (`security-policy.controller.ts`)

**B. Financial** _(step-up + maker-checker)_

- `financial.transactions` (payments, refunds, adjustments)
- fee-structure changes, any payout/withdrawal

**C. Account & security** _(step-up; self-service, no maker-checker)_

- change own password · add/remove MFA method · **add/remove a biometric device**
- change email · generate recovery codes
- (admin acting on others) force-logout, reset another user's password

**D. Bulk / destructive data** _(step-up + maker-checker)_

- `students.delete` / `users.delete`
- bulk grade change / grade override (`assessment-grading`)
- bulk import/delete · `data.export` (student PII)
- `backup.restore` · `system.configuration`

**E. Platform-level** _(step-up; platform users only)_

- `ai.settings.update` · breach-response actions · tenant provisioning/suspension

> **Note the reflexive rule in C:** removing a biometric device or disabling MFA
> must _itself_ require step-up — otherwise a hijacked live session could strip
> the account's protections.

---

## 5. Endpoints

**Enrollment (platform passkey; requires a fresh password login):**

- `POST /auth/biometrics/register/options` → platform-attachment,
  `residentKey: 'required'`, `userVerification: 'required'`.
- `POST /auth/biometrics/register/verify` → store credential, label the device.

**Passwordless login (discoverable credentials — no email submitted):**

- `POST /auth/passwordless/options` → challenge with empty `allowCredentials`.
- `POST /auth/passwordless/verify` → resolve user from the credential, issue the
  existing **pre-auth token** → reuse `POST /auth/select-school`. Because the
  passkey satisfies MFA (decision #2), skip the OTP branch entirely.

**Step-up:**

- `POST /auth/step-up/options` `{ operation }` → per-user challenge.
- `POST /auth/step-up/verify` → mark challenge verified; the `StepUpGuard` on the
  target endpoint validates + consumes it server-side.

**Device management:** `GET /auth/biometrics/devices`,
`DELETE /auth/biometrics/devices/:id` (step-up protected — see §4C).

**Governance:**

- Plane B (tenant admin): `GET/PATCH /security-policies/biometrics`.
- Plane A (platform): `GET/PATCH /platform/security-policies/step-up-policies`
  plus request review under
  `/platform/security-policies/step-up-change-requests`; tenant-facing
  `GET /security-policies/step-up-policies` and
  `GET/POST /security-policies/step-up-change-requests`.

---

## 6. UX & presentation

**Enrollment** — new **Settings → Security** page (build it):

- "Sign in faster with Face ID / fingerprint" opt-in, gated behind a fresh
  password re-auth.
- Enrolled-device list: label, type icon, created, last-used, per-device remove.
- Recovery-codes management lives here too (already exists server-side).
- Respect Plane B policy: if the school **forbids**, hide enrolment; if it
  **requires**, prompt on next login until enrolled.

**Login:**

- Show a "Sign in with Face ID / fingerprint" action for a returning user when
  WebAuthn exists. Do not hard-gate the explicit user-triggered ceremony on
  `isUserVerifyingPlatformAuthenticatorAvailable()` because iOS standalone PWA
  can report a false negative.
- Passwordless: on load, offer conditional-UI ("passkey autofill"); tapping it
  triggers the platform biometric with zero typing. Password remains a fallback
  link for un-enrolled devices.

**Step-up** — a lightweight "Confirm it's you" modal triggered inline when a
sensitive action is invoked; biometric first, password/OTP fallback. Never a
full page bounce.

**PWA** — platform passkeys work inside the installed PWA; this is the strongest
mobile story. Physical iPhone installed-PWA acceptance passed on 2026-07-17.

---

## 7. Recovery & fallbacks (non-negotiable)

- Password + existing MFA + **recovery codes** stay available at all times.
- **Lost-only-device:** because the target is passwordless, a user may lack
  password muscle-memory — make "Sign in another way" prominent and route to
  password/recovery-code re-auth, then force re-enrolment. A user cannot remove
  the last passkey while any active membership requires enrollment.
- Enrolment always needs a prior strong auth (password login), so a stolen live
  session alone can't silently add an attacker's device (and §4C step-up guards
  device changes).

---

## 8. Phasing

Dependency: **Workstream A (silent session refresh)** from `auth-hardening-plan.md`
was delivered on 2026-07-16. Passwordless and step-up sessions now refresh
proactively, retry protected requests once, and recover safely after PWA wake.

0. **Phase 0 — Security & foundation:** §2 fixes, §3 migration, multi-tenant RP
   config. No user-visible change.
1. **Phase 1 — Enrolment + device mgmt:** platform-passkey registration,
   Settings → Security page, device list/remove. Biometrics usable for step-up
   from here.
2. **Phase 2 — Passwordless login:** discoverable credentials, conditional UI,
   fallbacks.
3. **Phase 3 — Step-up on sensitive actions (delivered):** the complete
   versioned 32-operation catalog is persisted, policy-aware, and wired to the
   existing sensitive endpoints. Passkey, TOTP, recovery-code, and password
   proofs are supported; challenges are operation-bound, fresh, and single-use.
4. **Phase 4 — Governance surfaces (delivered):** Plane B tenant enrollment
   policy UI and enforcement; Plane A platform editor; tenant read-only catalog,
   change-request and feedback loop; platform review with self-review prevention
   and transactional approval.

Cross-cutting throughout: audit every biometric event (enrol, login, step-up,
device-remove, policy-change) via the existing audit log.

---

## 9. Verification record (2026-07-17)

- Physical iPhone installed-PWA enrollment and returning-user login: passed.
- API unit/integration tests: **316/316** across **46** suites.
- Web unit tests: **85/85**; UI tests: **104/104**.
- API and web production builds: passed; web lint passed; API lint reported no
  errors and only existing warnings.
- Prisma client generation, governance migrations, RLS coverage, seed, and seed
  verification: passed; all **32** sensitive-operation policies verified.
- Database-gated e2e remains a deployment-environment check because the local
  restricted-role `APP_RUNTIME_DATABASE_URL` has a malformed password value.

---

## 10. Resolved decisions and deployment configuration

- Production RP ID and exact allowed-origin values remain deployment
  configuration; SimpleWebAuthn exact-match origin validation does not use
  wildcard tenant origins.
- Roaming security keys remain available beside platform passkeys.
- A user cannot remove their last passkey while any active school membership
  requires biometric enrollment. Password, TOTP, and recovery remain available
  for recovery and re-enrollment.
- The default step-up freshness window is 5 minutes and platform policy may set
  1–30 minutes per operation.
- Enrollment policy is school-wide in this release.

---

## Appendix B — Testing on a physical device (Cloudflare tunnel)

WebAuthn needs a **secure context** (HTTPS, or `localhost`/loopback) and an RP
ID that is a **domain** (never an IP). So a LAN IP like `http://192.168.x.x:3001`
can't be used from a phone. Use a Cloudflare named tunnel to a real host:

- **Tunnel:** `swe-dev` (UUID `fc33581e-…`) → `~/.cloudflared/config.yml` routes
  `swe-dev.schoolwithease.com` → `http://localhost:3001` (the **Next.js web
  app**, NOT the API on :3030 — the API is reached server-side via the web
  app's `/api/*` proxy). Run: `pnpm dev:tunnel` (`cloudflared tunnel run swe-dev`).
- **API (`apps/api/.env`, gitignored):** `WEBAUTHN_RP_ID=swe-dev.schoolwithease.com`,
  `WEBAUTHN_ORIGIN=https://swe-dev.schoolwithease.com`. A single RP ID can't
  cover both `localhost` and the tunnel host (no shared suffix) — the file keeps
  a commented localhost block to toggle back. **Restart the API after switching**
  (dotenv loads `.env` at boot).
- **Web (`apps/web/next.config.ts`):** `swe-dev.schoolwithease.com` added to
  `allowedDevOrigins` so Next's dev server serves `/_next` assets + Server
  Actions to the non-localhost origin. **Restart the web dev server** after the
  change.
- **Steps:** restart API + web → `pnpm dev:tunnel` → open
  `https://swe-dev.schoolwithease.com` on laptop and phone → Settings → Security
  → Set up biometric sign-in. Passkeys enrolled here are bound to the tunnel host
  (not localhost). The tunnel is a separate process each session; running
  `cloudflared service install` can make it always-on.

## Appendix A — Phase 0 task breakdown (concrete)

> **Progress (2026-07-15, branch `claude`):** Phase 0 committed (`42194e8`):
> P0-1..P0-5. P0-6 ✅ (public key AES-256-GCM encrypted at rest via
> EncryptionService) and **Phase 1 backend + frontend** ✅ — see below. Full API
> suite green (260 tests). Deployment configuration still required: prod
> apex `WEBAUTHN_RP_ID` and the exact subdomain origin list (SimpleWebAuthn's
> allow-list is exact-match, **no wildcards** — enumerate each tenant subdomain).
>
> **Phase 2 delivered (2026-07-16):** passwordless passkey login. API:
> `POST /auth/passkey/login/options` (per-user, UV=required, `login` challenge) +
> `/verify` (issues the same pre-auth token + schools as password login; a UV
> passkey counts as MFA, no OTP). Web: `startAuthentication` get() ceremony,
> `/api/auth/passkey/options|verify` routes, a readable **returning-user hint
> cookie** (`swe_last_user`: firstName+email, no token), and a login form that
> greets **"Welcome back, {First name}"** with a Face ID / fingerprint button +
> "Not you?" escape. Full API suite 281 green; browser-verified on localhost
> (button, greeting, options endpoint). Full ceremony needs the tunnel + a real
> device. **Phase 2b delivered:** true usernameless/conditional-UI one-tap uses
> an empty `allowCredentials` list and a nullable-user login challenge; the user
> is resolved from the selected discoverable credential during verification.
>
> **Phase 2 PWA routing correction (2026-07-16):** explicit passkey actions no
> longer use `isUserVerifyingPlatformAuthenticatorAvailable()` as a hard UI
> gate because iOS standalone web apps can return a false negative. The
> user-triggered WebAuthn ceremony is authoritative. Per-user biometric login
> now selects only `platform` credentials, preserves each credential's stored
> `getTransports()` values instead of inventing USB/NFC/BLE routes, and sends a
> `client-device` hint so Chrome/macOS prefers iCloud Keychain + Touch ID over a
> physical security key. The web middleware now redirects non-local HTTP
> requests to HTTPS because WebAuthn is unavailable in insecure contexts. Any
> iPhone Home Screen copy originally installed from `http://` must be removed
> and added again from `https://swe-dev.schoolwithease.com` so its saved origin
> is secure. Removing an enrolled passkey now also calls WebAuthn's
> `signalUnknownCredential()` in supporting browsers. This is an opportunistic
> consistency signal: the current provider may hide or delete its local copy,
> while unsupported password managers and copies on other providers still need
> manual cleanup.
>
> **Phase 3a delivered (2026-07-16):** the API now exposes authenticated
> `POST /auth/step-up/options|verify` ceremonies for a server-owned operation
> catalog. Confirmation prefers an enrolled `platform` passkey with required
> user verification and falls back to the signed-in user's current password.
> Both proofs produce short-lived, operation-bound challenges. Biometric
> enrolment verification and device removal now use `StepUpGuard`; each proof
> is consumed atomically once and cannot be replayed for another action. The
> Account → Security UI performs confirmation inline in a mobile-friendly
> drawer before continuing the requested action. Step-up success/failure and
> biometric enrol/remove are written to the audit log on a best-effort basis.
> Focused guard/service tests cover wrong-user, wrong-operation, expired and
> replayed challenges.
>
> **Phases 3 and 4 delivered (2026-07-17):** TOTP and single-use recovery-code
> fallback, the complete versioned `SensitiveOperationPolicy` catalog, database
> policy and tenant-request models, policy-aware endpoint guards, tenant
> enrollment enforcement, platform policy editing, and tenant request/review
> surfaces are complete. The `require` rule is enforced across active school
> memberships so switching tenant context cannot bypass last-passkey protection.
>
> **Phase 1 delivered:**
>
> - API: `BiometricsController` + `BiometricsService` (`/auth/biometrics/*`):
>   register options/verify (platform attachment), device list, device delete.
>   `verifyRegistration` now persists attachment/backedUp/transports/aaguid.
> - Web: `lib/webauthn.ts` (native base64url ceremony, no lib dep), four proxy
>   routes under `app/api/auth/biometrics/*`, and **Settings → Security** page +
>   nav entry. Verified in-browser: page renders, device list loads (200),
>   enrolment options returns 200, client reaches the WebAuthn ceremony.
> - Fixed a real 401 found via browser test: registration must resolve
>   email/display-name from the DB, not the JWT (token carries no email).
> - **Follow-up:** the same JWT-email bug affects `mfa.controller.ts` MFA setup
>   endpoints (flagged as a separate task).

**Goal of Phase 0:** land the security fixes + data/config foundation with **no
user-visible change** and **no behavioural regression**. Governance tables
(`SensitiveOperationPolicy`, tenant policy, change-requests) are **deferred to
Phases 3–4** — Phase 0 only touches columns on existing, already-RLS-protected
tables so no new RLS policy work is needed here.

**Environment:** SimpleWebAuthn `@simplewebauthn/server@^13`, Prisma 7,
migrations via `pnpm --filter @workspace/database db:migrate` (`prisma migrate
dev`). Keep CI green (PR #1 baseline) and migrations forward-only/nullable.

### P0-1 — Migration: platform-authenticator fields on `MfaMethod`

- **File:** `packages/database/prisma/models/user-management.prisma` (`MfaMethod`).
- **Add (all nullable, back-compat):** `authenticatorAttachment String?`
  (`'platform' | 'cross-platform'`), `aaguid String?`, `backedUp Boolean?`,
  `transports String[]` (or `Json?`). `name` already exists as the device label.
- **Ships with P0-2 as one migration** `*_webauthn_platform_and_stepup`.
- **Accept:** `db:generate` + `db:migrate` clean; existing `webauthn` rows
  unaffected (all new cols null); typecheck green.

### P0-2 — Migration: single-use step-up on `MfaChallenge`

- **File:** same model file (`MfaChallenge`).
- **Add:** `consumedAt DateTime?`; index `@@index([userId, operation, verified])`
  for the guard lookup. `operation` / `verified` / `expiresAt` already exist.
- **Accept:** migration applies; index present.

### P0-3 — Rewrite step-up as server-authoritative (`StepUpGuard`)

- **Replace** `apps/api/src/auth/guards/mfa-required.guard.ts` (inverted-logic
  bypass) with `guards/step-up.guard.ts` + a `@RequireStepUp('<operation>')`
  decorator (real metadata, not the current no-op stub).
- **Logic:** read the step-up challenge id from the **request body** (not a
  trusted header); load the `MfaChallenge`; accept **only** if `userId` matches
  the authenticated user **and** `operation` matches the decorator **and**
  `verified === true` **and** `consumedAt == null` **and** `now < expiresAt`;
  then **atomically consume** it (`updateMany where consumedAt: null` →
  set `consumedAt`) so it's single-use. Reject otherwise.
- **Files:** new guard + decorator; a `StepUpService.verifyAndConsume(...)`
  (or extend `mfa.service.ts`); wire into `auth.module.ts` (replace the three
  `MfaRequiredGuard` references). Delete the old guard once unreferenced.
- **Accept (unit tests):** forged `x-mfa-verified` header → rejected;
  valid challenge accepted **once**, second use rejected (single-use); expired
  → rejected; wrong operation → rejected; other user's challenge → rejected.
- **Dep:** P0-2. _(Guard is applied to no endpoint yet — wiring onto real
  endpoints is Phase 3, so this is a safe internal replacement.)_

### P0-4 — Fix credential-ID encoding in the WebAuthn service

- **File:** `apps/api/src/auth/services/mfa-webauthn.service.ts:330` (and the
  `:209` store site).
- **Change:** stop the `base64 → base64url` round-trip; use SimpleWebAuthn v13
  `isoBase64URL` helpers consistently for storing `webauthnId` and matching on
  authentication, so IDs containing `-`/`_` resolve correctly.
- **Accept:** register→authenticate round-trip test matches the stored
  credential; regression test with a base64url id containing `-` and `_`.

### P0-5 — Multi-tenant RP / origin config

- **`env.config.ts`:** add `WEBAUTHN_ALLOWED_ORIGINS` (comma-separated) to the
  interface (`:45`) + Joi schema (`:117`), defaulting to `[WEBAUTHN_ORIGIN]`.
  Keep `WEBAUTHN_RP_ID` as the **apex** registrable domain. Group beside the
  existing `WEBAUTHN_*` keys — do not append to the bottom (see
  `[[feedback-group-related-config]]`).
- **Env templates:** mirror the key in `.env.example`, `env.template`,
  `env.staging.template`, `env.production.template` beside the `WEBAUTHN_*` block.
- **`mfa-webauthn.service.ts`:** change `config.origin: string` →
  `origins: string[]`; pass `expectedOrigin: origins` to
  `verifyRegistrationResponse` / `verifyAuthenticationResponse` (SimpleWebAuthn
  accepts an array). Add a **platform-options helper** (attachment `'platform'`,
  `residentKey: 'required'`, `userVerification: 'required'`) — defined now as
  foundation, consumed in Phase 1.
- **Accept:** single-origin config still verifies (back-compat); a credential
  registered on one allowed origin verifies against the array; env validation
  passes with and without the new key. Configure the prod apex value at deploy.

### P0-6 — (Stretch / optional) Encrypt `webauthnPublicKey` at rest

- Align with the existing `ENCRYPTION_KEY` AES-256-GCM column convention
  (`.env.example:28`). **Low priority** — public keys aren't secret; may be
  folded into Phase 1 or skipped. Not a blocker.

### P0-7 — Verification gate

- Run auth Jest suite + the new guard/service tests; lint + typecheck;
  `db:generate`. Confirm no endpoint relied on the old `MfaRequiredGuard`
  (already verified: referenced only in `auth.module.ts`, applied nowhere).

**Order:** P0-1 + P0-2 (one migration) → P0-3 (needs P0-2). P0-4 and P0-5 are
independent and can run in parallel. P0-6 optional. P0-7 gates the phase.
**Rough effort:** P0-1/P0-2 S · P0-3 M · P0-4 S · P0-5 M · P0-6 S · P0-7 S.

```

```
