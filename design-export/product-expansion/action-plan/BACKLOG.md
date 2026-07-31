# Backlog — Phases 2–5 (outline; detailed just-in-time)

Near-term (Phase 0/1 + Workbench 1) is fully specified in the sibling docs. This is the **shape** of what follows, mapped to [parity-matrix](../plan/07-capability-parity-matrix.md) rows so no analysis is lost. Detail each workbench into `work-item.md` cards only when its dependencies are `done`.

## Phase 2 — replacement runway

### WB2 · Academic structure + student lifecycle (2B) — deps: F1, F6, ADR-02/03

Curriculum/profile version + year/term + subject/course catalog (#37,#38); class/arm/**stream** modeling that doesn't parse the label (#36); teacher assignment + **elective election** (#30); registration + **rollover** + transfer/withdrawal/graduation (#31,#32); identifier allocation + controlled credential issue; **promotion workbench** with preview + exceptions (#58). _Exit: every student sits in an explainable structure and keeps history across years._

### WB3 · Admissions (2C) — deps: F1, F4, F5, WB1

Form/version builder + portal + responses (#15); list/board + saved views + assignments (#14); **document checklist/verification** (#16); assessment/interview scheduling + structured review (#17,#18,#19); capacity/quota + decision + **offer/waitlist + acceptance** (#22); **finance-linked** charge/receipt (#20); one-command **reviewable conversion** → person/student/guardian/enrollment (#23). _Exit: run an intake without spreadsheets or retyping into student records._

### WB4 · Results parity / ResultCycle (2D) — deps: F6, ADR-04, ADR-08

Result-cycle workbench + configurable **CA components** (#53,#55); direct entry **+ Excel import in one flow** (#54); validation + missing/absent/exempt + completeness; **remark rule sets** (replace 724 prose rows) (#57) + affective/psychomotor; moderation + approval + **publication policy** (#59); **immutable report-card/broadsheet/transcript artifacts** (#63,#66); notification via Engagement; **amendment/supersession** (#61); **promotion input** (#58); ranking-as-policy default-off (#65); **SigningAuthority** replaces raw signature images (#110); `FinancialHold` replaces silent per-student blocking (#60). _Exit: reproduce and explain the published result a family received._

### WB5 · Family Account + Finance (2E) — deps: ADR-05, F2

Fee-item catalog + schedule versions + charge applicability (#77); **invoice lines** + family/student accounts + **opening balances** (#79); payment + **partial allocation** + overpayment/unapplied credit + refunds (#80,#81,#82); discount/scholarship/waiver/debt-adjustment **approval** (#78); receipt numbering + reprint + verification; daily collection/outstanding/aging/reconciliation; **payment gateway + idempotent webhooks** (#85); legacy balance/transaction import; **GL build-vs-integrate** (ADR-10, #87); contra-entry reversals replace negative amounts (#95). _Exit: opening balances + post-cutover activity reconcile; every allocation traceable._

### WB6 · Engagement + operational reporting (2F) — deps: F5, F9

Audience builder over authorized saved views; template/version + channel policy; **delivery attempts + cost + retries + provider response** (#97,#98); notification preference/consent (#100); result/payment/absence **SecureLinks** with expiry (#99); scheduled **export jobs** (#104); core admin/academic/finance/audit reports with definition/version (#103). _Exit: know who should receive a message, who did, what it cost, what failed._

### WB7 · Migration cockpit (2G) — deps: F2, F4, ADR-09

Source-object mapping + **stable legacy IDs**; staged imports + validation + repair; identity **dedup/merge** with evidence; attachment ingest + checksum (#28); **reconciliation dashboard** by entity + financial/result aggregate; dry-run/delta/cutover/**rollback** runbook; **legacy read-only archive** + retention (#113,#114). Cleans dirty catalogs on the way in (duplicate subjects #37, corrupted grades #56). _Exit: the replacement claim is backed by repeatable reconciliation._

**Phase 2 exit gate:** a design-partner completes a full term-cycle simulation; P0 parity jobs pass acceptance; historical results + balances reconcile; published docs + receipts independently verifiable; high-risk access + finance/result corrections pass audit; support diagnoses failed jobs without DB access.

## Phase 3 — daily-work superiority (WB8) — deps: WB1–4

Teacher **"Today"** queue (#102); **class workspace** joining roster/timetable/attendance/materials/assignments/results/communication (absorbs BClass #52); lesson author/review/publish (#43,#44,#45); homework **submissions + rubrics + feedback** (#47); CBT bank + delivery + **accommodations** + grading (#48,#49,#51); **atomic CBT→gradebook** (#50); attendance **intervention** + guardian ack + escalation (#68,#69,#70,#72); curriculum coverage + outcome evidence (#39); parent/student mobile; calendar/events (#93); report scheduling + governed dashboards (#103); **PWA offline + background sync** (#71). _Exit: common teacher jobs need fewer context switches than the legacy system; mobile flows pass low-bandwidth tests; no page duplicates a directory/workbench just to add search/import/archive._

## Phase 4 — operational depth & ecosystem (WB9) — deps: F-platforms

Library circulation ledger (#91); transport routes/fleet/trips (#92); health **encounters/medication/immunization/incidents** (#74); **safeguarding/behaviour** cases (#75); HR leave/appraisal + **payroll engine** + NG statutory (#88,#89); inventory/assets + depreciation (#90); hostel/boarding where validated; **OneRoster** import/export + **LTI 1.3** (ADR-12); payment/accounting/identity/messaging integrations; API/webhook DX.

## Phase 5 — responsible intelligence & scale (WB10) — deps: data provenance done

Exception/risk views with explainable inputs; AI-assisted lesson/question/remark drafting **with human approval** (#40,#106); curriculum-mapping assistance + provenance; operational recommendations with thresholds; benchmarking only with lawful, protected data; AI registry/evaluations/model governance/cost controls; multi-region/data-location where justified.

## Deferred / reject (tracked so they're not silently dropped)

- **Defer:** wallet-QR (#12), sport house (#33), parent feedback/surveys (#101), GL depth if integrate chosen (#87).
- **Reject (never build as-is):** generated-password SMS (#13), Sage credential capture (#94), negative-amount reversals (#95), unguarded signature images (#110), nested sub-app IA (#24), BClass silo (#52), "Pay Now" nag (#116). Each is redesigned into the safe pattern noted in [02](../plan/02-incumbent-capability-and-ux-assessment.md#capabilities-to-retain-reframe-or-reject).
