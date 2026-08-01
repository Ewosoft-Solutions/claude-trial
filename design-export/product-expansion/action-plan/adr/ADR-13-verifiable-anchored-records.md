# ADR-13 — Verifiable anchored records (results + financial receipts) · **FUTURE / DEFERRED BRIEF**

- **Status:** Proposed — **future / deferred** (2026-08-01). Owner-requested; documented now, built later. Not scheduled for Release-1.
- **Deciders:** engineering + product owner (+ security/DPO). **Owner sign-off:** direction endorsed 2026-08-01; the _how_ + _when_ are the open questions.
- **Relationship:** extends **ADR-04** (result publication snapshot) and **ADR-05/ADR-10** (financial records). It **adds external verifiability on top of** the immutability those ADRs already give internally — it does not replace them.

## Context

The owner wants published **results** (and later financial **receipts / transactions**) recorded on a blockchain for **immutability, authenticity, and independent reference** — so a third party (an employer, another school, an auditor, a parent) can verify a document is genuine and unaltered **without having to trust us**. The owner also stated that results may still be **reviewed/edited** in some cases, but the **original record + history must be preserved**.

ADR-04 already makes a published result an **immutable snapshot** rendered as a **checksum-addressed artifact** (ADR-08), and corrections are **amendments** that never overwrite the original. That gives strong integrity **inside our system**. What a blockchain adds is **external, trustless verifiability** and **tamper-evidence that does not depend on our database**.

## The core constraint — never put PII on-chain

Public/immutable ledgers **cannot be erased**, which directly conflicts with data-protection obligations (NDPR / GDPR right-to-erasure) — a student's or family's personal data must never be written to a chain. Therefore:

> **On-chain = cryptographic hashes only. Off-chain = the actual record.**

We keep the record (result snapshot, receipt) off-chain in our DB + checksum-addressed artifact, and publish only its **hash** to the ledger. Anyone holding the document can re-hash it and check the hash against the on-chain anchor: match ⇒ authentic + unaltered + existed at anchor time. This is **hash-anchoring / notarization**, not on-chain data storage.

## Recommendation (how to build it, when we do)

1. **Anchor hashes, batched by Merkle root.** Collect the checksums of the records anchored in a period (e.g. daily), build a **Merkle tree**, and write **one root** to the chain per batch. Each record gets a small **inclusion proof** — cheap (one transaction anchors thousands of records) and privacy-preserving.
2. **Map anchoring onto the existing snapshot + amendment model.** Anchor **each publication** and **each amendment** separately. The chain becomes an append-only history of hashes that mirrors ADR-04 exactly — _original preserved, every edit tracked_ — satisfying the owner's "edits allowed, history preserved" requirement.
3. **Run it as an ADR-06 job**, off the request path, with ret/backoff; store the transaction id + inclusion proof against the artifact. A **verification endpoint/page** lets anyone check a document's hash against its anchor.
4. **Scope: results first, receipts second.** Transcripts/certificates have the highest external-verification value (employers, other institutions); financial receipts/transactions follow as an audit-trail integrity layer once the internal GL (ADR-10) is in place.
5. **Chain choice is deferred.** Options to evaluate at build time: a low-cost public L2, a permissioned/notary anchoring service, or a dedicated timestamping service. Consider **W3C Verifiable Credentials** for issuing tamper-evident student credentials as a companion/alternative standard. Pick based on cost, longevity, and how independently a verifier can check without our infrastructure.

## Consequences

- **Enables** trustless third-party verification of transcripts/certificates and (later) financial records; strengthens the "auditing platform" positioning (ADR-10).
- **Constrains:** adds an anchoring job + verification surface + a chain dependency; requires strict discipline that **no PII ever leaves for the chain**.
- **Migration/architecture impact:** additive — because ADR-04/ADR-08 already produce checksum-addressed artifacts, the system is **anchor-ready today**; anchoring can be layered on later with no rework of the result or finance models.
- **Depends on** ADR-04 (result snapshots), ADR-08 (checksum-addressed artifacts), ADR-06 (jobs); financial anchoring depends on ADR-05/ADR-10.

## Open questions for later

- Which chain / anchoring service (cost, longevity, independence of verification)?
- Verifiable Credentials for transcripts — adopt the W3C standard, or a bespoke hash-anchor + verify page?
- Is external verification a **sales** requirement for any specific design-partner (which would raise its priority)?
- DPO review: confirm the hash-only, PII-never-on-chain rule against the retention/erasure policy (ADR-08).

## Validation (when built)

- A presented transcript re-hashes to a value provable against its on-chain anchor; a tampered copy fails.
- Amending a result produces a **new** anchor while the original anchor still verifies the original artifact.
- No personal data is ever written on-chain (only hashes / Merkle roots) — asserted by test + review.
