# ADR-11 — Tenant vs campus/arm boundary · **OWNER DECISION BRIEF**

- **Status:** Proposed — **owner decision pending** (2026-07-31).
- **Deciders:** **product owner** (+ security) — [Q6](../../plan/06-roadmap-and-discussion-guide.md#b--product-shape--terminology).
- **Why it matters now:** this **confirms ADR-01** — whether `Person` is tenant-scoped (and campus is an org _within_ the tenant) or something else. It also sets the scope model for every workbench (a bursar scoped to "Campus A").

## Context

The legacy system runs as **one school with campuses/arms**: the corpus tenant is _a sample school tenant — Campus A_, and provisioning lets a user hold **multi-campus access** across "Campus A" and "Campus B – Nursery" (C012). Our platform already has a working **platform (cross-tenant) scope** with RLS + audited seams (prior initiative). The open question is where the **tenant boundary** sits for a school **group**.

## Options

| Option                                                                                          | What it means                                                                                                                | Pros                                                                                                                                                  | Cons                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A · One tenant per operating school; campuses/arms = orgs _within_ it (recommended default)** | A school with several campuses is **one** tenant; campuses are organizations inside it; users hold scoped campus memberships | Matches the legacy system (C012); shared staff/family across campuses; cross-campus reporting is natural; `Person` cleanly **tenant-scoped** (ADR-01) | A campus is not hard-isolated from siblings (mitigated by scope + RLS row policies)                       |
| **B · One tenant per campus**                                                                   | Each campus is its own tenant                                                                                                | Hardest isolation                                                                                                                                     | Breaks cross-campus reporting, shared staff, family-across-campuses; heavier onboarding; duplicate people |
| **C · School-group "super-tenant" over school tenants**                                         | A group/franchise layer above school tenants                                                                                 | Needed for large franchises; group-level branding/reporting                                                                                           | More complex; only if a group customer is in committed scope                                              |

## Recommendation

**Option A** — one tenant = one operating school; **campuses/arms are organizations within the tenant**, with scoped memberships (campus/department) and RLS row policies for isolation where needed. Treat a **truly independent** school as a separate tenant. Make **school-group super-tenancy (C)** an explicit _later_ decision if a franchise/group customer appears. This confirms **ADR-01's tenant-scoped `Person`** and the campus-scope in WB1-6.

## What we need from the owner

1. Are the **first customers** single-school or **multi-campus groups**?
2. Is a **franchise / group-of-schools** customer in **committed** scope for the architecture to serve now?
3. What (if anything) is shared at **group level** — branding, consolidated reporting, shared staff pool, central admissions?
4. Any **data-residency / contractual isolation** requirement between campuses that would force Option B?

## Consequences by choice

- **A** → campus = org entity + scope constraint; `Person`/finance/results tenant-scoped; cross-campus reporting explicit. (Unblocks ADR-01, WB1-6 scope, multi-campus reporting.)
- **B** → per-campus tenants; add a reconciliation/reporting layer to recombine; heavier.
- **C** → add a group aggregate + cross-tenant group reporting on top of A (reuse the existing platform-scope seam).

**Blocks:** the final "Accepted" state of **ADR-01** (tenant-scoped Person) and the campus-scope model in WB1-6. Until decided, engineering proceeds on **Option A** (the recommended default) and keeps the group layer as a clean extension point.
