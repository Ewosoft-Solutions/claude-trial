# ADR-14 — Platform-level surfaces over tenants (cross-tenant identity · consented data sharing · targeted notifications) · **OWNER DECISION BRIEF**

- **Status:** Proposed — 2026-08-01
- **Deciders:** **product owner** (+ security / DPO) — **owner sign-off REQUIRED** (this shares data — sometimes minors' data — across organizations and sends to user devices). Engineering: claude.
- **Context:** three product asks (a stable cross-tenant user id; platform-organized **inter-school** activities such as tournaments; platform→user **targeted notifications**, e.g. to all school owners or all IT-support) all need surfaces that deliberately **span tenants** — which the platform is otherwise built to keep apart. Getting this wrong risks a privacy breach (especially for minors) or an accidental "global person graph".

## Context

The platform is multi-tenant with **RLS isolation** as a mandatory backstop, and — per **ADR-01** + **ADR-11 (Option A)** — `Person` is **tenant-scoped**: the same human at two schools is two `Person` rows, never silently cross-linked. What already exists that these surfaces can build on:

- **`User`** (`user-management.users`) — account-level, **no `tenant_id`**, globally unique by email: the platform's cross-tenant identity **for login-holders**. It fans out to per-school `UserTenant` profiles.
- An audited **`app.is_platform`** scope + a **platform module** (the sanctioned cross-tenant seam).
- **F3** durable jobs/outbox (reliable, idempotent fan-out) — built.
- A tenant-scoped **`Announcement`** + a **web-push client** (`apps/web/lib/push.ts`, `public/sw.js`) — but **no** server-side subscription store or VAPID fan-out, and **no** cross-tenant broadcast.
- **F5** (delivery abstraction + `DeliveryAttempt` + `ContactPreference`/DND + `SecureLink`) and **F9** (`ConsentOrAuthorization` + `DisclosureLog` + retention) are **designed, not built**.

This ADR sets the contract for three related sub-decisions. The unifying principle is **SSO/OIDC-style data minimization + explicit consent**: nothing crosses a tenant boundary except a purpose-scoped, consented projection, under the audited platform scope, always audited.

---

## 14A — Cross-tenant user identity

| Option                                     | What it means                                                                                                                                                                 | Trade-off                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 · Use `User.id`**                     | The existing account identity is the platform id                                                                                                                              | ✅ exists, unique, cross-tenant · ❌ only covers people **with a login** — a login-less `Person` (young student, non-login guardian) has none |
| **A2 · Platform participant registry**     | Mint a platform participant id on demand, with a **private** platform-held mapping to the origin `Person`(s); expose only a **pairwise/pseudonymous** id to any other context | ✅ covers login-less people; no silent cross-school correlation · ❌ new platform table + governance                                          |
| **A3 · Opt-in cross-tenant `Person` link** | Explicitly assert "these two `Person`s are the same human"                                                                                                                    | ✅ real identity resolution · ❌ highest privacy risk; only with explicit consent                                                             |

**Recommendation:** **A1 for account-holders now; A2 (pseudonymous participant id) when the first cross-tenant feature ships; A3 only opt-in + consented, later.** `Person` stays tenant-scoped — **no change to ADR-01/ADR-11**.

## 14B — Consented cross-tenant data sharing (inter-school activities, e.g. tournaments)

Model it exactly like SSO/OIDC consent:

- Origin school = **identity provider** (holds the real record); the platform activity = **relying party**; **registration = a scoped, consented claims release** (data minimization + purpose limitation).
- The activity stores a **minimized snapshot of the released claims** + a **`DisclosureLog`** entry (who shared what, for which purpose, until when) + **retention/expiry** — never a live cross-tenant read of the school's record.
- **Consent for minors is guardian-driven and school-mediated** (school opts in → guardian consents → minimal claims released). Bulk release of children's data goes through **maker-checker + step-up**.
- **Share the minimum:** display name/handle, age/grade band, team/affiliation, gender category only if the sport needs it, photo only if needed for on-site identity. **Withhold:** contact, address, **health/safeguarding narrative**, grades, fees. Medical eligibility is an **attestation** ("cleared: yes/no by <role> on <date>"), never the health narrative (golden rule 7).
- Invites via **`SecureLink`** (F5); any documents via signed expiring URLs (**F4**, built).

**Decision:** adopt the **consented-claims exchange**; depends on **F5 + F9**.

## 14C — Targeted platform notifications

- A **tenant** admin announces within their own school (existing `Announcement`). Only a **platform actor** may target across tenants — under `app.is_platform` + a **platform permission** + **step-up** + audit. A tenant admin can never cross the tenant boundary.
- **Audience selector:** `all` / specific tenants / **by permission-or-capability** (e.g. `school.manage`, `it.support.*`) — **not** by role _name_ (role names vary per tenant; the permission is the stable contract — golden rule 5). Cross-tenant audiences resolve over `UserTenantRole` under the platform scope.
- **Delivery via F5 on F3 jobs:** each send fans out and writes a **`DeliveryAttempt`** per device/channel, so a **retried broadcast never double-notifies** a confirmed delivery (idempotency). Multi-channel: **in-app notification centre** (reliable) + **web push** (best-effort) + email/SMS, chosen by the recipient's **`ContactPreference`/consent/DND**.
- Needs a **device/subscription registry** (web-push endpoints now, FCM/APNs later) + a **VAPID fan-out backend** — the missing pieces today.
- **Notification class:** service/security = mandatory; operational = opt-outable; marketing = consent + unsubscribe (and respect **H3** — no commercial nags).

---

## Consequences

- New **platform-level constructs** — a pseudonymous participant identity (14A/A2), a consented-claims + disclosure record (14B), a broadcast + device-subscription registry (14C) — all **additive**, reusing the existing platform-scope seam. **No change to tenant RLS or to ADR-01/ADR-11.**
- **Depends on:** **F5** (delivery + preferences/DND + `SecureLink`), **F9** (consent/disclosure/retention), and a **web-push backend** (VAPID keys + subscription store). F3 + the platform scope already exist.
- **Unblocks** a new **WB11 — platform-level surfaces (cross-tenant)** (inter-school participation + targeted broadcast).
- **Owner + DPO must sign off:** minors' data across organizations (NDPA consent/retention), and platform→device messaging (consent classes / unsubscribe).

## Validation

- No raw contact/health/PII ever leaves the origin tenant; a participant carries only the **minimized, consented** claim set; pseudonymous ids are **pairwise** (no cross-context correlation without explicit consent); every disclosure has a `DisclosureLog` row + an expiry, and consent is revocable.
- Broadcast: a cross-tenant send is possible **only** under the platform scope + a platform permission + step-up, and is audited (who → whom → what); a **retried** send does not double-notify (idempotent `DeliveryAttempt`); recipient preferences/DND are honoured; audience-by-permission resolves to the correct set; a **tenant** admin cannot target beyond their tenant.
