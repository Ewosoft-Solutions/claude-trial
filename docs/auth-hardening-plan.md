# Auth Hardening — Session Lifecycle Plan

> **Status:** Workstreams A and B delivered on 2026-07-16. Secure resume and
> assessment draft protection are delivered with them. Workstream C biometrics
> and passkey Phases 0–4 were completed on 2026-07-17 in
> `biometrics-plan.md`. Workstream D (breached-password screening) is **backlog,
> not started** — captured 2026-08-08; see the section below.

## Why this exists

The one-hour access token used to disappear while an actively used session was
still valid for seven days. The web app did not consume its refresh token, so
the user was sent to `/login` mid-work. The same session layer also needed an
explicit inactivity policy, safe long-work behaviour, and a trustworthy way to
return a re-authenticated user to their work.

## Confirmed policy

- Access tokens last **1 hour** and refresh sessions have a fixed **7-day
  absolute lifetime**. Refresh **rotates** the refresh token on every use (with
  reuse detection — see below) but never **extends** the absolute lifetime: the
  successor token inherits the original session's expiry.
- The default inactivity threshold is **15 minutes**.
- The configured tenant range defaults to **5–60 minutes** and is server
  enforced inside a non-configurable hard safety range of **5–120 minutes**.
- At the inactivity threshold, standard screens receive a **2-minute** warning;
  approved long-work screens receive **5 minutes**.
- Tenant users with `settings.security` and platform users with
  `platform.security` can update the tenant value. `settings.view` can read it.
- All tabs share activity, refresh completion, and logout state.
- Idle logout preserves an approved route for up to **30 minutes**, but never
  bypasses the destination page's own permission checks.

## Workstream A — Silent session refresh ✅

Delivered:

- `authedFetch` retries one failed same-origin API request after a successful
  refresh. The shared Next.js proxy layer also retries protected JSON, stream,
  parent-portal, profile-switch, and multipart learning requests once.
- Refreshes are single-flight within a tab and coordinated across tabs with Web
  Locks plus a short-lived, non-sensitive local-storage completion marker.
- The session provider refreshes five minutes before access expiry while the
  app is visible and online, and checks again on focus, page-show, and PWA wake.
- If an installed PWA wakes after the access cookie has expired but the refresh
  cookie remains valid, middleware sends it through `/session/resume` instead
  of presenting a false logout.
- Refresh and logout reasons are audit logged. Logout revocation is idempotent,
  so an already removed session is still a successful logout.
- The seven-day refresh token and its database session remain the absolute cap;
  no activity or access refresh extends them.

### Refresh-token rotation + reuse detection (delivered)

- Each refresh rotates the refresh token: a successor `Session` row is created in
  the same rotation **family** (`familyId`), the parent is marked `rotatedAt`, and
  the successor inherits the parent's `expiresAt` (the absolute cap never slides).
- Replaying a just-rotated token within a short grace window returns the
  already-issued successor (idempotent — absorbs the web layer's retries / tab
  races). Replaying it after the window is treated as reuse: the whole family is
  revoked and a `TOKEN_REUSE_DETECTED` audit row is written. Reuse revokes only
  that login's lineage, not the user's other sessions.
- Every server-side web refresh consumer persists the rotated `swe_refresh`
  cookie (via `cookies.set`, never a second appended `Set-Cookie`), so no path
  keeps presenting a retired token.
- The rotation read/writes stay inside `withTenantScope`, so the `user_tenants`
  include resolves under FORCE RLS on the deployed `app_runtime` topology.

## Workstream B — Inactivity logout ✅

Delivered:

- One global lifecycle provider observes pointer, keyboard, touch, wheel,
  scroll, route, focus, visibility, and page-show activity. High-frequency
  persistence is throttled and timestamp based, so a suspended PWA cannot pause
  the clock.
- The first tap after an already elapsed idle period cannot erase the timeout;
  the warning is evaluated first.
- Assessment, assignment, reading, and media modes can register as focus work.
  Assessments register today while an attempt is active. A semantic activity
  reporter is available for visible media progress when those screens land.
- The warning is a controlled, accessible modal with a timestamp-derived
  countdown. “I'm still here” must successfully refresh the session before the
  timer resets; offline and expired-session states are explicit.
- Logout is broadcast across tabs. Idle logout writes a closeable, persistent
  notification that survives the login navigation until the user dismisses it.
- Tenant and platform settings surfaces expose the effective timeout and the
  two warning windows. Server validation, not the input control, enforces the
  configured limits.
- Policy updates, access refresh, manual logout, and idle logout are recorded in
  the existing audit log.

### Configuration

The following API environment keys are declared beside the authentication
configuration and have matching examples:

```text
AUTH_IDLE_TIMEOUT_MIN_MINUTES=5
AUTH_IDLE_TIMEOUT_MAX_MINUTES=60
AUTH_IDLE_TIMEOUT_DEFAULT_MINUTES=15
AUTH_IDLE_STANDARD_GRACE_SECONDS=120
AUTH_IDLE_FOCUS_GRACE_SECONDS=300
```

`AUTH_RESUME_SECRET` must be set to a strong deployment secret in production.
Production deliberately refuses to sign resume state when it is absent.

## Secure resume ✅

- Idle, absolute-expiry, and refresh-failure logout can write a 30-minute HMAC
  signed resume cookie containing only a sanitized local path, tenant/profile
  context, and an allow-listed modal key.
- Sensitive query names such as tokens, codes, passwords, credentials, and
  redirect values are removed before signing.
- The resume endpoint re-fetches `/auth/me`, verifies tenant/profile context,
  and applies a route permission resolver. An invalid, expired, tampered, or
  unauthorized state falls back to `/overview`.
- The destination page and API still enforce the final authorization decision;
  resume state is navigation intent, never an authorization credential.
- Global search is the first allow-listed modal that can be reopened. Other
  modals stay closed until they explicitly register a safe resume key.

### Idle decision precedes resume (2026-08-09 fix)

Secure resume and the inactivity logout are separate subsystems that used to
run uncoordinated on wake, so a user returning past the idle deadline was
re-authenticated by the resume trampoline, shown their page, and only then
ejected by the lifecycle provider (resume → overview → logout). The idle
`lastActivity` timestamp is client-only (localStorage), invisible to the
server/middleware resume path, which is why resume ran regardless.

The idle deadline now **gates** the resume, decided before any protected UI:

- The provider persists a **policy snapshot** (`swe:session-policy:v1`) alongside
  the activity timestamp, so pre-auth surfaces can evaluate idle without a live
  session.
- The **resume trampoline** (`/session/resume`) evaluates the idle deadline
  BEFORE calling `/api/auth/resume`. If already past logout, it does not
  re-authenticate: it clears cookies via `/api/auth/logout` with a new
  `skipResumeState` flag (preserving the middleware-set resume cookie for the
  original destination, so re-login still returns the user to their work), leaves
  the inactivity notice, and goes straight to `/login`.
- The **lifecycle provider** adds a pre-paint (`useLayoutEffect`) gate: if the
  shell mounts already idle/absolute-expired (e.g. a suspended PWA reopened while
  the access cookie was still valid, so no resume ran), it blocks the app from
  rendering and signs out — never a page-flash-then-eject.

Outcome: exactly one result on return — resumed (idle within window) or a clean
"signed out due to inactivity" login screen — never resumed-then-ejected.

## Long-work data protection ✅

Assessment attempts now save draft answers after a one-second debounce and
flush with a keepalive request when the page is hidden or unloaded. Draft save
validates the active attempt and question IDs, enforces the assessment timer,
and never grades or submits the attempt. Returning to an active attempt restores
the saved answers.

Future assignment editors, readers, and media players should use the existing
focus-mode and semantic-activity hooks. They should add their own draft/checkpoint
endpoint before being designated long-work screens; extending the warning is
not a substitute for preserving work.

## Security boundaries

The browser inactivity timer is a user-experience and unattended-device
control. It is not the only server security boundary. The fixed refresh-session
expiry, access-token verification, database session validation, route guards,
and permission checks remain authoritative.

## Verification record (2026-07-16)

- Web TypeScript check: passed.
- Web unit tests: **85/85** passed, including lifecycle timestamps, signed
  resume, route authorization, and refresh single-flight/retry.
- UI tests: **104/104** passed.
- API unit tests: **316/316** passed across **46** suites.
- API production build and web production build: passed.
- API lint: passed with pre-existing warnings only and no errors.
- UI/database strict lint still reports four pre-existing warnings in
  `table.tsx`, `school-switcher.tsx`, and `verify-app-runtime.ts`; none is in a
  file changed by this work.
- Prisma client generation: passed.
- Migration `20260716103000_session_idle_timeout_default`: applied locally.
- Permission seed: **299** permissions and **1,690** pool assignments verified.
- Physical iPhone installed-PWA acceptance: passed and confirmed by the product
  owner on **2026-07-17**.

## Workstream C — Biometrics / passkeys ✅

Phases 0–4 are complete in `biometrics-plan.md`: platform passkeys,
passwordless login, policy-aware step-up with fallbacks, the server-owned
sensitive-operation catalog, tenant enrollment policy, and platform/tenant
governance surfaces.

## Workstream D — Breached-password screening 📋

**Status:** Backlog. Not started. Captured 2026-08-08 from the password-policy
review.

**Goal.** Reject passwords known to appear in public breach corpuses, per NIST
800-63B "compromised password" screening — so a password that satisfies every
composition rule but is already public (e.g. `Password1!`) cannot be set.

**Where it fits.** This is a **submit-time async validator, not a strength-meter
requirement.** `PasswordService.validatePasswordPolicy` is pure/synchronous and
runs on both client and server; a breach check needs a network lookup and must
run **server-side only**, on the same paths that already call
`validatePasswordAgainstAllSchools` (registration, reset, forced rotation,
self-service change). On a hit it returns a new error — e.g. "This password has
appeared in a known data breach; choose another." — surfaced exactly like the
other server-enforced policy rules.

**Approach — k-anonymity (privacy-preserving).** Use the HIBP Pwned Passwords
range model: SHA-1 the candidate, send only the **first 5 hex chars** of the
hash to `range/{prefix}`, then match the returned 35-char suffixes locally. The
full password and full hash never leave the server; send `Add-Padding: true` to
blunt traffic analysis. Zero-egress alternative: host the hash corpus and serve
range lookups locally (higher storage/ops cost). Pick at build time.

**Failure mode.** Fail **open** on lookup error/timeout — a breach-list outage
must never block a password reset — and write an audit row noting the check was
skipped. Cache prefix responses briefly to bound egress and latency.

**Policy control.** Add a `SchoolSecurityPolicy.passwordCheckBreached` toggle,
resolved strictest-wins across a user's schools like the other password fields
(logical-OR). Suggested defaults: on for `enhanced`/`maximum` tiers, off for
`basic`. It does **not** join the client `PasswordRequirements` contract (can't
be evaluated live), so the strength meter is unchanged — note this so nobody
tries to render it as a checklist row.

**Acceptance.** A known-breached password that passes every composition rule is
rejected at set/reset/rotation with a clear message; the full password and hash
are never transmitted; a simulated lookup outage fails open with an audit trail;
the toggle resolves strictest-across-schools.
