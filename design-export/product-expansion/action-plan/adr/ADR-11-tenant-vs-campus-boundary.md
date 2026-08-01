# ADR-11 — Tenant vs campus/arm boundary · **OWNER DECISION BRIEF**

- **Status:** Accepted — 2026-08-01 (Option A).
- **Deciders:** **product owner** (+ security) — [Q6](../../plan/06-roadmap-and-discussion-guide.md#b--product-shape--terminology). **Owner decision (2026-08-01):** Option A. Target schools run **multiple campuses under one operating school**, and the owner needs **consolidated whole-school reporting _and_ per-campus reporting**: school-owner roles see the whole school, campus managers see localised (campus-scoped) reports, and some cross-campus roles see multi-campus reports. That is exactly Option A's scope model; a school-group super-tenant (Option C) is reserved for a future franchise / group-of-independent-schools customer.
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

## Owner input captured (2026-08-01)

1. **First customers:** multi-campus — schools that operate **several campuses under one school**, not independent schools.
2. **Franchise / group-of-independent-schools in committed scope now?** No — reserve the school-group super-tenant (Option C) as a later additive layer.
3. **Shared at group level:** **consolidated whole-school reporting** plus per-campus reporting; **school-owner** roles span all campuses, **campus managers** are campus-scoped, some **cross-campus roles** span selected campuses.
4. **Data-residency / contractual isolation forcing Option B?** None indicated.

## Consequences by choice

- **A** → campus = org entity + scope constraint; `Person`/finance/results tenant-scoped; cross-campus reporting explicit. (Unblocks ADR-01, WB1-6 scope, multi-campus reporting.)
- **B** → per-campus tenants; add a reconciliation/reporting layer to recombine; heavier.
- **C** → add a group aggregate + cross-tenant group reporting on top of A (reuse the existing platform-scope seam).

**Blocks:** the final "Accepted" state of **ADR-01** (tenant-scoped Person) and the campus-scope model in WB1-6. Until decided, engineering proceeds on **Option A** (the recommended default) and keeps the group layer as a clean extension point.
