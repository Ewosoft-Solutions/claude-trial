# Auth Hardening — Session Lifecycle Plan

> **Status:** Workstreams A and B delivered on 2026-07-16. Secure resume and
> assessment draft protection are delivered with them. Workstream C continues
> in `biometrics-plan.md`.

## Why this exists

The one-hour access token used to disappear while an actively used session was
still valid for seven days. The web app did not consume its refresh token, so
the user was sent to `/login` mid-work. The same session layer also needed an
explicit inactivity policy, safe long-work behaviour, and a trustworthy way to
return a re-authenticated user to their work.

## Confirmed policy

- Access tokens last **1 hour** and refresh sessions have a fixed **7-day
  absolute lifetime**. Refresh does not rotate or extend the stored session.
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
- API unit tests: **300/300** passed across **45** suites.
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

## Workstream C — Biometrics / passkeys

Continue from `biometrics-plan.md`. Silent refresh is no longer a blocker for
expanding the server-owned step-up catalog and its governance surfaces.
