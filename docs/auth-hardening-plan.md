# Auth Hardening — Next-Session Plan

> **Status:** Planned / not started. **How to start this session:** do **not**
> jump straight to code. Begin by resolving the Open Questions below with the
> user (use the AskUserQuestion flow), then propose a phased plan. Several
> decisions here are product/security policy calls that must be the user's.

## Why this exists

During the 2026-07-14 session the signed-in session silently expired while we
were still actively working, bouncing us to `/login`. Investigation showed the
plumbing for a smoother session already exists but **is not wired up**, and the
user asked to add (a) an idle auto-logout and (b) biometric sign-in. This doc
captures the current state, recommendations, and the questions to settle first.

## Current state (grounded in code)

- **Two cookies exist:** `swe_access` (access token) and `swe_refresh` (refresh
  token) — see `apps/web/lib/auth-cookies.ts`. The access cookie's `Max-Age` is
  set to the token's `expiresIn` at login, so when it elapses the browser drops
  the cookie.
- **A refresh route exists but nothing calls it.** `POST /api/auth/refresh`
  (`apps/web/app/api/auth/refresh/route.ts`) exchanges the refresh cookie for a
  new access token — but a repo-wide search finds **no caller**. It is dead code.
- **The middleware only checks cookie _existence_.** `apps/web/middleware.ts`
  does `req.cookies.has(COOKIE_ACCESS_TOKEN)` → redirect to `/login` if absent.
  It never validates or refreshes the token.
- **`getSession()`** (`apps/web/lib/session.ts`) calls `GET /auth/me`; on a 401
  (expired token) it returns null and the `(app)` layout redirects to login.

**Net:** the access token expires on its TTL, the cookie disappears, and because
nothing ever calls `/api/auth/refresh`, the long-lived refresh token goes unused
→ hard logout mid-session. This is the root of the bug we hit.

---

## Workstream A — Silent session refresh (foundational; do first)

The idle-logout feature only makes sense once sessions *don't* die on their own.

**Recommendation:**
- Add a **client fetch wrapper** that, on a `401` from an `/api/*` call, calls
  `POST /api/auth/refresh` **once**, then retries the original request; on
  refresh failure, hard-logout (clear cookies, redirect to `/login` preserving
  the return path via the existing `swe_post_login_redirect` cookie).
- Add **proactive refresh**: a timer that refreshes shortly before the access
  token's `expiresIn` while the tab is active (skip while hidden; refresh on
  refocus). Pairs naturally with the SWR `revalidateOnFocus` already in place.
- Coordinate across tabs (BroadcastChannel or a storage event) so N tabs don't
  stampede the refresh endpoint.
- Decide sliding vs absolute: refresh should extend the session up to an
  **absolute maximum lifetime**, after which re-auth is required regardless.

**Touch points:** `lib/api-client`/a new `lib/authed-fetch`, `SwrProvider`
`onError`, `pwa-register`-style timer, `api/auth/refresh` (already exists).

---

## Workstream B — Idle auto-logout (tenant-customizable, env-capped)

Log the user out after a period of **inactivity**, with the timeout configurable
per tenant but never exceeding a server-side hard cap.

**Recommendation:**
- **Idle timer** reset on real activity (pointer/key/visibility/route change and
  successful API calls); debounce writes. On expiry → warn, then logout.
- **Warn-before-logout** countdown modal ("You'll be signed out in 60s — Stay
  signed in") that refreshes the session on "stay".
- **Two independent limits:** idle timeout *and* absolute session lifetime
  (Workstream A). Idle logout is client-driven UX; the absolute cap is enforced
  server-side and can't be extended by activity.
- **Config precedence:** tenant setting is clamped to
  `[MIN, AUTH_IDLE_TIMEOUT_MAX]` where the max comes from an `.env` value
  (group it beside the other auth/session env keys — do not append to the
  bottom of `.env`). Enforce the clamp on the **server**, not just the client,
  so a tampered client can't extend it.
- **Multi-tab:** broadcast logout so all tabs drop together.
- Store the tenant setting with the other tenant settings/feature config (check
  how `tenant/features` and AI settings persist) and expose it in Settings for
  an authorized role.

**Security note:** client-side idle logout is UX, not a security boundary — the
server-enforced absolute lifetime (A) is what actually bounds a stolen token.

---

## Workstream C — Biometric login (Face ID / fingerprint)

The web-standard mechanism is **WebAuthn / passkeys** using **platform
authenticators** (Face ID, Touch ID, Windows Hello, Android biometrics). The
biometric never leaves the device — it unlocks a device-bound credential; the
server only stores/verifies a public key. Works in the installed PWA.

**Recommendation:**
- Use WebAuthn platform authenticators (`residentKey`/`userVerification`).
- **Two possible use cases — confirm which (see questions):**
  1. **Passwordless login** — a registered passkey signs the user in directly.
  2. **Step-up / unlock only** — password login first, then biometrics to
     unlock a persisted session or to re-auth after idle. Lower risk, simpler.
- **Enrollment:** opt-in from Account settings after a normal password login;
  device-bound, so support enrolling multiple devices and a management/removal UI.
- **Fallback:** always keep password (and MFA) available when biometrics are
  unavailable, fail, or the device isn't enrolled.
- **Backend (NestJS):** a WebAuthn credentials table (userId, credentialId,
  publicKey, counter, deviceLabel, createdAt) + register/authenticate
  challenge+verify endpoints; a vetted server lib (e.g. SimpleWebAuthn).
- **Tenant policy:** whether a school can require / allow / forbid biometrics.
- **Recovery:** account-recovery path if the only enrolled device is lost.

---

## Open Questions to resolve first (ask before building)

**Session & refresh (A)**
1. What are the current access-token and refresh-token TTLs (from the API config)?
2. Sliding sessions (activity extends up to a cap) or fixed absolute lifetime?
3. On refresh failure mid-action, is a hard logout + return-to-path acceptable?

**Idle auto-logout (B)**
4. What counts as "activity" — pointer/keyboard only, or also route/API calls?
5. Default idle timeout, and the allowed tenant range `[MIN, MAX]`?
6. Exact name/location of the `.env` hard-cap key (group beside which keys)?
7. Warn-before-logout countdown — yes/no, and how long?
8. Different timeouts per role/clearance (e.g. Finance stricter than Student)?
9. Which role can edit the tenant timeout, and where does it live in Settings?
10. Log out all tabs together?

**Biometrics (C)**
11. Passwordless login, or step-up/unlock only (or both, phased)?
12. Platform authenticators only, or also roaming security keys?
13. Can a school require/forbid biometrics (tenant policy)?
14. Multiple devices per user + a manage/remove UI?
15. Recovery flow if the only enrolled device is lost?

**Cross-cutting**
16. Audit-log auth events (login/logout/refresh/idle-timeout/biometric)? The app
    already has an audit-log destination — reuse it?
17. Any compliance constraints (data residency, session-length mandates)?

## Suggested phasing

1. **A — silent refresh** (fixes the bug we hit; unblocks everything).
2. **B — idle auto-logout** (depends on A for the "stay signed in" refresh).
3. **C — biometrics**, likely step-up/unlock first (C.2), passwordless later.

## Related

- Session seam: `apps/web/lib/session.ts`; middleware: `apps/web/middleware.ts`.
- Refresh route (unused today): `apps/web/app/api/auth/refresh/route.ts`.
- MFA already exists (`api/auth/verify-mfa`) — align biometrics with it.
