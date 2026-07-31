# Architecture Decision Records (the legacy system parity)

An ADR is required for any choice that changes a **core table or cross-cutting contract**. A dependent work item stays `blocked` until its ADR is **Accepted**. One decision → one file `ADR-NN-<slug>.md`.

## Template

```markdown
# ADR-NN — <title>

- Status: Proposed | Accepted | Superseded(by ADR-MM) — <date>
- Deciders: <names/agents> — Owner sign-off: <needed? who?>
- Context: <the forces; incumbent evidence Cxxx; requirement refs; what breaks if we guess wrong>
- Options: <2–4 options with trade-offs>
- Decision: <the choice + why>
- Consequences: <what it enables/constrains; migration impact; which items unblock>
- Validation: <how we'll know it was right; tests/invariants>
```

## Index

| ADR                                                     | Decision                                                        | Status                    | Owner sign-off?              | Unblocks         |
| ------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- | ---------------------------- | ---------------- |
| [01](ADR-01-person-identity-profile.md)                 | Person / auth-identity / profile / tenant-membership separation | **Accepted — 2026-08-01** | no                           | F1, WB1-5        |
| [02](ADR-02-class-offering-registration-model.md)       | Class / section / offering / registration model                 | **Accepted — 2026-08-01** | no (Q5 display-only)         | WB2              |
| [03](ADR-03-curriculum-version-overlay.md)              | Curriculum version + tenant overlay + cohort adoption           | **Proposed (drafted)**    | **owner — academic (Q11)**   | F6, WB4          |
| [04](ADR-04-result-publication-snapshot.md)             | Result publication snapshot + amendment (immutability)          | **Proposed (drafted)**    | **owner (Q13–16)**           | WB4              |
| [05](ADR-05-finance-ledger-family-credit-allocation.md) | Finance ledger + family credit/wallet + allocation              | **Proposed (drafted)**    | **owner — finance (Q20–23)** | WB5              |
| [06](ADR-06-job-outbox-infrastructure.md)               | Durable job/outbox infrastructure                               | **Accepted — 2026-08-01** | no                           | F2–F5            |
| [07](ADR-07-communication-delivery-abstraction.md)      | Communication delivery-provider abstraction                     | **Accepted — 2026-08-01** | no (Q24–26 channel contract) | F5               |
| [08](ADR-08-document-signature-security.md)             | Document/signature asset security (SigningAuthority)            | **Accepted — 2026-08-01** | no (DPO retention)           | F4, WB4          |
| [09](ADR-09-migration-sourceid-reconciliation.md)       | Migration source-ID + reconciliation contract                   | **Accepted — 2026-08-01** | no (Q29–32 per-school)       | F2, WB7          |
| [10](ADR-10-general-ledger-build-vs-integrate.md)       | General-ledger **build vs integrate**                           | **Owner brief (drafted)** | **owner (Q19)**              | WB5              |
| [11](ADR-11-tenant-vs-campus-boundary.md)               | Tenant vs campus/arm boundary                                   | **Owner brief (drafted)** | **owner (Q6)**               | F1, multi-campus |
| [12](ADR-12-interoperability-scope.md)                  | OneRoster / LTI / Ed-Fi adoption scope                          | **Accepted — 2026-08-01** | no (market-gated)            | WB9              |

Context + recommended defaults for each are in [plan/04](../../plan/04-target-product-and-architecture.md) and the [decision questions](../../plan/06-roadmap-and-discussion-guide.md#decision-workshop--questions-to-settle). Draft the ADR from those; flip to `Accepted` after review (owner-gated ones need the product owner).
