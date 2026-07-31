# ADR-07 — Communication delivery-provider abstraction

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering. **Owner sign-off:** channel _contract_ (which channels ship first) is a product decision — see [Q24–26](../../plan/06-roadmap-and-discussion-guide.md#g--communication--reporting); the _abstraction_ below is engineering's.
- **Unblocks:** F5 (delivery ledger), WB1-3 (secure invitations), and every notification path (admissions C024, results C104/C108, attendance C048, finance).

## Context

The legacy system makes delivery **highly visible**, and parity schools will expect parity immediately: a prepaid, **metered** SMS balance (C105), per-message cost that differs by number type (**DND = 2.5 units, Normal = 3**, C107), a **19,539-message** log with delivery classification, and result links delivered by SMS/email (C104/C108). Our current state (verified): an email abstraction exists, auth SMS/email carry **provider TODOs**, and we have `Message`/`MessageReadReceipt`/`Announcement` models — but **no provider delivery-attempt / cost / consent** domain. Requirements call for SMS/email/push with preferences and audit.

Two specific incumbent hazards to fix, not copy:

- Result links are **tokenized but effectively public** (`api.the legacy system.net/url/?url=…`, C108) — anyone with the URL sees a child's result.
- Guardian targeting is **Father/Mother/Both** (C049) — not real consent-bearing relationships.

**What breaks if we guess wrong:** if each domain calls a provider SDK directly, we get no delivery evidence, no cost accounting, no consent enforcement, no idempotent retry — and schools notice the missing SMS balance/log on day one.

## Options

1. **One internal `DeliveryPort` interface + provider adapters + a `DeliveryAttempt` ledger (recommended).** Domains publish a _message intent_; the delivery layer resolves audience → preference/consent → channel → provider, records an attempt, and (on F3 jobs) sends idempotently. Trade-off: an abstraction layer to build once.
2. **Direct provider SDK calls per domain.** Fastest for one path; rejected — no shared observability/cost/consent, duplicated retry logic, the exact fragmentation the legacy system has (3 channels × compose/sent, C103/C106/C109).
3. **Third-party notification SaaS (e.g. a unified messaging vendor).** Offloads adapters; deferred — vendor lock, per-message cost on top of provider cost, and we still need the local ledger + consent for NDPA. Revisit if adapter maintenance becomes a burden.

## Decision

Adopt **Option 1**:

- **`DeliveryPort`** interface with pluggable **adapters** per channel (SMS, email, push) and per provider (behind the adapter). No domain calls a provider directly.
- **`DeliveryAttempt`** — `channel, provider, providerMessageId, status (queued|sent|delivered|failed|dnd_blocked), failureClass, costUnits, currency, dndFlag, redactedDestination, attemptNo, timestamps`. This is the ledger that reproduces the legacy system's SMS-balance + delivery log with cost.
- **`MessageTemplate` + `TemplateVersion`** (locale/channel), **`ContactPreference`** (channel opt-in/consent, quiet hours), **`Campaign`/`CampaignRecipient`** for bulk.
- **`SecureLink`** — access-controlled, **expiring**, permission-checked tokens replace public result/payment URLs (fixes C108).
- Sends run on **F3 jobs** with an idempotency key so a provider timeout + retry does **not** double-send a confirmed delivery.
- **Audience is resolved from real relationships + consent** (ADR-01 `GuardianRelationship`), never a gender label.
- The channel **contract** (SMS/email/in-app first; WhatsApp/push later) is a product decision; the abstraction supports adding adapters without touching domains.

## Consequences

- **Enables** F5, secure invitations (WB1-3), and all notifications; gives operators "who received it, what it cost, what failed" (Phase-2F exit).
- **Constrains** every send to go through the port (no shortcuts) and to carry a template + audience + idempotency key.
- **Cost/consent become first-class:** budgets/limits + DND classification + lawful-basis checks live here (NDPA, [05](../../plan/05-academic-nigeria-international.md)).
- **Migration impact:** additive tables; optionally back-fill historical delivery logs (589 emails / 19,539 SMS) as read-only `DeliveryAttempt` rows during migration (WB7). RLS + `db:rls:check`.
- Depends on **ADR-06** (jobs/outbox) for atomic enqueue + idempotent send.

## Validation

- A send records `costUnits` + DND classification; the SMS-balance view reproduces from the ledger.
- Provider timeout → retry via idempotency key → **no** double-send of a confirmed delivery.
- A result `SecureLink` expires and **denies** an unauthorized fetch (permission-checked, not just token-guessing-resistant).
- A guardian who opted out of a non-essential campaign still receives a lawful/contractual critical notice per policy.
