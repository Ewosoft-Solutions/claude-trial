# ADR-08 — Document / media platform + signature-asset security

- **Status:** Proposed — 2026-07-31
- **Deciders:** engineering + security. **Owner sign-off:** not required (a security architecture choice); confirm retention periods with the institution/DPO.
- **Unblocks:** F4 (document service), WB4 (authorized report signing), WB3 (admission documents), WB7 (attachment migration + checksums).

## Context

Documents and signatures are pervasive in the corpus and are also its **sharpest security reject**:

- **Signatures as browsable images.** the legacy system stores 6 officer signatures (Principal/Headmaster/Proprietor/Proprietress/Administration/Director) **and 104 staff signatures** as plain image thumbnails in tables next to contact info (C126–C128), viewable by anyone with config access, with **no usage restriction**. Any of these can be lifted and pasted onto a forged report card.
- **Attachments everywhere.** 776 missing passport photos + scanned admission docs (C039), homework/lesson attachments (C064/C067), and report-card artifacts (C104) — all needing storage, retention, and access control.

Our current state (verified): **no document model at all.** Requirements demand encryption-at-rest, audit for sensitive actions, and compliance-ready handling (`requirements/monitoring-auditing.md`, PRD §10; NDPA in [05](../../plan/05-academic-nigeria-international.md)).

**What breaks if we guess wrong:** if we copy the legacy system and store files in a public/browsable location, we inherit a forgery + PII-leak vector; if we bolt storage onto each domain ad-hoc, retention/consent/scan policy varies per module. Result publication (WB4) **cannot ship** on unguarded signatures.

## Options

1. **Logical `Document` vs stored `DocumentVersion` on encrypted object storage, signed short-lived downloads, + `SigningAuthority`/`SignatureUse` (recommended).** One governed platform; signatures usable only via an authorized, audited application. Trade-off: build the pipeline once (scan/thumbnail/retention).
2. **Files on disk / a public bucket keyed by filename (the legacy system's approach).** Rejected — this _is_ the reject: forgeable, unscannable, filename-guessable, no retention/consent.
3. **Defer documents; store nothing structured yet.** Rejected — admissions, results, and migration all need documents in Phase 2; deferring forces per-domain hacks.

## Decision

Adopt **Option 1**:

- **`Document`** (logical record: `tenantId, type, ownerRef, visibilityPolicy, retentionPolicyId, consent/provenance, createdBy`) **vs `DocumentVersion`** (each stored blob: `objectKey, checksum, mime, size, scanStatus, thumbnailKey?, createdAt`). Storage is **encrypted object storage**; keys include `tenantId`.
- **Access = signed, short-lived URLs**, minted only after a server-side permission + scope check; downloads of sensitive documents are **audited**. Nothing is served from a browsable/static path.
- **Pipeline:** MIME sniff + size check + **malware scan** on upload (quarantine until clean); thumbnail/preview generation as an F3 job; **resumable** upload for low-bandwidth (C033/C039 realities).
- **Retention + legal hold** via a `RetentionPolicyVersion`; disposition runs as a job (F9).
- **Signatures are governed assets, not images in a table:**
  - **`SigningAuthority`** — a person's authority to sign in a role (e.g. "Principal"), with validity dates.
  - **`SignatureUse`** — a signature applied **to a specific artifact**, authorized per use (maker–checker + step-up for high-value artifacts like published results), recorded and audited. The signature image itself is a restricted `Document` never listed in a browsable table.
- Migration ingests attachments with **checksums** and stable source keys (WB7); duplicate/orphan attachments are flagged, not silently trusted.

## Consequences

- **Enables** F4, and unblocks WB4 (a report card can be signed only via an authorized `SignatureUse` referencing an immutable publication) and WB3 (admission document checklist/verification).
- **Constrains** all file handling to the platform — no domain writes files elsewhere; every download is permission-checked + signed + expiring.
- **Closes the reject:** no raw signature/PII images in any list; signature use is authorized per artifact, not copied freely (fixes C126–C128).
- **Migration impact:** additive tables + an object-storage bucket per environment; back-fill photos/docs with checksums. RLS on metadata tables; `db:rls:check`.
- Depends on **ADR-06** (scan/thumbnail/retention run as jobs) and pairs with the existing **health enveloped-encryption** design (same posture: encrypt at rest, never browse raw).

## Validation

- Upload a document → a signed URL works, expires, and an **unauthorized** role is denied; the access is audited.
- A malicious file is quarantined by the scan step before it's downloadable.
- A signature can be applied to an artifact **only** through an authorized `SignatureUse`; the raw signature image is not fetchable by a config-viewer role and appears in no list.
- Checksum mismatch on a migrated attachment is flagged in reconciliation (WB7).
