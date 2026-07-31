# ADR-12 — OneRoster / LTI / Ed-Fi / interop adoption scope

- **Status:** Accepted — 2026-08-01 _(canonical-model + phased-adapter posture; which standards enter committed scope stays market-driven)_
- **Deciders:** engineering + product. **Owner sign-off:** which integrations are in **committed** scope (market-driven).
- **Unblocks:** WB9 (ecosystem, Phase 4); shapes the export side of F2/F9.

## Context

Requirements call for SIS/LMS/API/webhooks/SSO. The legacy system's visible integration story is thin and unsafe: **Sage via username/password capture** (C094, a reject) and a bespoke **BClass** video hub (C075). We must add interoperability **without letting a transport schema become our domain model**, and **without building standards a market hasn't asked for** ([08 interop](../../plan/05-academic-nigeria-international.md#8--interoperability--portability)).

**What breaks if we guess wrong:** adopting a standard _as_ the core model contaminates every aggregate; building Ed-Fi/OneRoster before a customer needs it burns effort; capturing third-party credentials (the legacy system's mistake) is a security liability.

## Options

1. **Canonical internal model + phased mapping adapters (recommended).** The SchoolWithEase model stays richer than any interchange format; each standard is an adapter with explicit mappings + external source IDs. Trade-off: an adapter per standard, added when demand is real.
2. **Adopt a standard as the core model** (e.g. model everything as OneRoster). Rejected — the transport schema is lossy for our domain (curriculum versions, result snapshots, family accounts).
3. **No interop; bespoke per integration.** Rejected — no portability, repeated one-off work, lock-in.

## Decision

Adopt **Option 1**, phased by demand:

- **Now / Phase 1–2:** **CSV/XLSX import-export contracts** with schema templates + validation reports (the practical Nigerian channel; part of F2/F9) + **stable external source IDs** (ADR-09).
- **When a customer/integration needs it:** **OneRoster 1.2** adapter (users/orgs/classes/enrollments/courses/sessions/gradebook) over People/Academics/Results, preserving source IDs; **LTI 1.3 / Advantage** for secure tool launch + grade return (treat keys/deployment/consent as security config); **signed, versioned, replay-protected webhooks** with subscription scopes + delivery logs (reuse the F5 delivery-attempt patterns); **OIDC/SAML SSO** for enterprise tenants.
- **Market-gated:** **Ed-Fi** only for a target market that demands it (e.g. US districts) with version mappings/profiles; **Caliper** deferred (telemetry) with strict minimization; **accounting integration adapter** (ties to ADR-10) instead of credential capture — **never** username/password like Sage (C094).
- The canonical model is always the source of truth; standards are **edges**.

## Consequences

- **Enables** portability + LMS/SIS/enterprise integration without core contamination; effort tracks real demand.
- **Constrains:** each integration carries a mapping + source-ID + integration-scoped permissions + a sync/replay surface.
- **Migration impact:** none core; export adapters reuse F2/F9 + ADR-09 source IDs.
- Depends on **F2/F9** (export), **F5** (webhook delivery), **ADR-09** (source IDs); mostly **Phase 4**.

## Validation

- An export round-trips via **OneRoster** preserving external source IDs.
- An **LTI 1.3** tool launches with correct role/context claims and returns a grade to the gradebook.
- A **webhook** is signed, replay-protected, subscription-scoped, and delivery-logged.
- No integration captures a third-party username/password.
