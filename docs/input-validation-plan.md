# Input-validation hardening — plan of record

**Status:** proposed (2026-08-04); **re-confirmed 2026-08-20** — owner has asked
for this to get its own dedicated session. **Owner:** unassigned. **Board item:** `H4`.

**Why.** A caregiver search accepted `??` and happily ran an empty query; more
generally we take user input across ~45 web surfaces and validate almost none of
it on the client, while the server accepts many unbounded / unpatterned strings.
This plan makes validation **systematic, by field _type_**, applied on both the
client (for instant, friendly feedback) and the server (the authoritative gate).

---

## 1 · Principles

1. **The server is the authority.** Every mutation validates its DTO server-side;
   the client can never be trusted. Client validation exists only to help the
   user and cut round-trips.
2. **Validate by _type_, not by field.** One rule per field type (name, email,
   phone, amount, …), reused everywhere — never a bespoke regex per input.
3. **One canonical rule table (§4).** Client and server rules for a type must
   agree. The web `lib/input-validation.ts` module and the API DTO decorators are
   two implementations of the same table.
4. **Fail closed, bound everything.** Every string has a `@MaxLength`; every
   number a range; every enum an `@IsIn`/allow-list. No unbounded free text.
5. **Don't over-block typing.** Prefer inline errors + gating a submit/search
   over silently eating keystrokes. Hard character-blocking is reserved for
   strict identifiers (codes, numbers).
6. **Sanitise at the boundary, never render untrusted input as HTML.** Trim,
   normalise, and reject; keep the existing CSV formula-injection guard for
   exports. (React already escapes text nodes — the risk is on export / email /
   downstream consumers, not the DOM.)

## 2 · Current state (measured 2026-08-04)

- **Server:** all 55 `*.dto.ts` carry _some_ `class-validator` decorators (good
  baseline), but coverage is uneven: **439 `@IsString()` vs 206 `@MaxLength` and
  only 5 `@Matches`** → roughly ~230 string fields are unbounded and virtually
  nothing validates a _format_ (email/phone/name/code).
- **Client:** ~45 input surfaces across every domain (classes 9, students 5,
  settings/platform/_shared 4 each, people 3, finance/account 2, …) with
  essentially **no field-level validation** before this initiative. Auth already
  has the `PasswordStrengthMeter` + policy (keep, fold into the catalog).
- **Seed already landed** (PR #60, WB1-4): `apps/web/lib/input-validation.ts`
  (`isSearchable`, `checkName`, `checkEmail`, `checkPhone`, `checkPositiveInt`)
  with unit tests, wired into the caregiver search. This plan generalises it.

## 3 · Approach & shared tooling

### Client — `apps/web/lib/input-validation.ts` (exists) + a tiny form ergonomics layer

- Keep growing the module: one exported `checkX(value, opts) → { valid, error }`
  per type in §4. Pure, unit-tested, framework-free.
- Add a light ergonomics helper so wiring a field is 2 lines, not 20:
  - `useField(initial, check)` → `{ value, setValue, error, touched, onBlur, valid }`,
    and/or
  - a `<ValidatedField label check>` wrapper around `Input`/`Textarea` that shows
    the error under the control and sets `aria-invalid` + `aria-describedby`.
- Submit is disabled (or shows the first error) until all fields are `valid`.

### Server — reusable composed decorators in `packages/api`

- Add `apps/api`/`packages/api` validation decorators that compose
  `class-validator` so a DTO field is one decorator, and the rule lives once:
  - `@IsPersonName()` = `@IsString @MaxLength(120) @Matches(NAME_RE)`
  - `@IsPhoneNumber('NG'-ish)` = `@Matches(PHONE_RE) @MaxLength(20)`
  - `@IsEmailAddress()`, `@IsAmountMinor()`, `@IsCode()`, `@IsShortText(n)`,
    `@IsLongText(n)`, `@IsBoundedInt(min,max)`, `@IsIsoDate()`, `@IsEnumValue(list)`.
- The global `ValidationPipe` already runs with `whitelist + forbidNonWhitelisted`
  (`apps/api/src/main.ts`) — keep it; add `transform: true` where numeric/boolean
  query coercion is needed and not already present.
- Regexes are shared as constants so the client module and the decorators are
  provably the same pattern (a small `@workspace/*` shared file, or duplicated
  with a guard test that pins them equal — mirror the health-crypto lock-step
  approach).

## 4 · Canonical field-type rules

| Type | Client (`check*`) | Server decorator | Rule |
| --- | --- | --- | --- |
| Person name | `checkName` | `@IsPersonName()` | letters (any script) + space `' . -`; 1–120; required-ness per field |
| Short text (title, label, dept) | `checkShortText` | `@IsShortText(120)` | any printable; trim; ≤120 |
| Long text (notes, reason, description) | `checkLongText` | `@IsLongText(2000)` | trim; ≤2000; strip control chars |
| Email | `checkEmail` | `@IsEmailAddress()` | RFC-ish `x@y.z`; lowercase; ≤254 |
| Phone | `checkPhone` | `@IsPhone()` | `+? digits/space/()/-`; 7–20; ≥7 digits |
| Search query | `isSearchable` | n/a (service trims + tokenises) | ≥2 letters/digits of signal; else no-op |
| Whole number / rank | `checkPositiveInt` | `@IsBoundedInt(min,max)` | integer within range |
| Money (minor units) | `checkAmountMinor` | `@IsAmountMinor()` | integer ≥0 (kobo); reject decimals/negatives |
| Percentage / score | `checkPercent` | `@IsBoundedInt(0,100)` | 0–100 (or 0–maxScore) |
| Date | `checkIsoDate` | `@IsIsoDate()` | ISO `YYYY-MM-DD`; sane bounds (DOB not future, etc.) |
| Enum / select | `checkOneOf(list)` | `@IsEnumValue(list)` | value ∈ allow-list (never trust the option) |
| Identifier code (student/employee no.) | `checkCode` | `@IsCode()` | `[A-Za-z0-9-/]`; ≤32; upper-normalise |
| URL | `checkUrl` | `@IsUrlHttps()` | http(s) only; ≤2048 |
| Password | existing meter + policy | existing `PasswordService` | keep; document as a type here |

DOB-not-in-future, amount-non-negative, and end-date-after-start are **field-pair
invariants** — enforce server-side in the service, list them per form in §5.

## 5 · Inventory & rollout (phased, highest-risk first)

Each phase: wire client `check*` on every field + confirm/patch the server DTO
against §4 + add the pair-invariants + tests. DoD in §6.

- **Phase 0 — foundations (in progress).** Seed module + guardian search (done,
  PR #60). Build `useField`/`<ValidatedField>` + the server composed decorators.
- **Phase 1 — identity & security (highest risk).** `(auth)/*` (login, forgot,
  accept-invite, reset), `account/profile`, `account/security`, People
  **account-access-panel** (invite email/role) + **guardianship-panel** (name
  search ✓, relationship, priority), `_shared/invite-user`, `_shared/step-up`.
- **Phase 2 — core records.** People/Students directories + enrollment,
  `platform/tenants/onboarding`, staff/teacher forms (`classes/teachers`),
  admissions applicant/guardian fields.
- **Phase 3 — money & sensitive.** `finance/invoices`, `finance/payments`,
  `students/fees`, `hr/payroll` (amounts, non-negative, date ranges) and
  `health/records` (sensitive; keep narrative encrypted + non-indexed).
- **Phase 4 — academics & ops.** `classes/*` (assessments, question-bank,
  materials, subjects, timetable, review), `library/books`, `events/upcoming`,
  `attendance/*`, `settings/*`, `platform/settings/*`.
- **Cross-cutting (parallel):** a lint/CI check that flags a new `@IsString()`
  with no `@MaxLength`, so unbounded strings can't regress in.

## 6 · Definition of done (per field / form)

- [ ] Client field uses the shared `check*` for its type; error shown inline with
      `aria-invalid` + `aria-describedby`; submit gated on validity.
- [ ] Server DTO field uses the composed decorator (bounded + patterned per §4).
- [ ] Field-pair invariants enforced in the service (dates, amounts, uniqueness).
- [ ] Client + server rule appear in the §4 table (kept in step; guard test if a
      shared regex).
- [ ] Tests: a client unit test for the `check*`, and a server test asserting the
      DTO rejects bad input (invalid + boundary + unauthorized already covered).
- [ ] `pnpm ci:quick` green.

## 7 · Tracking

Add board row **`H4 · Input-validation hardening`** (Hygiene) referencing this
doc; each phase (§5) is a claimable sub-task. Phase 0 partially done in PR #60;
Phases 1–4 sized ~`M` each. Recommend sequencing right after WB1-3/4 merge, since
Phase 1 covers the very surfaces those PRs added.

---

## 8 · Update — 2026-08-20

The owner has asked for a **full, dedicated session** on this: "as the user
types, we get instant validation and dependent actions are blocked". That is
§1.5 plus the §3 ergonomics layer, and it is the part still unbuilt. Recording
what has changed since the plan was written so that session starts informed
rather than re-surveying.

### What this cost us in the meantime

The finance work in August produced a live example of exactly the gap §2
describes. The invoice line entry's quantity box was a plain text input:

- it accepted `First term1` (text typed into a numeric field) and held it,
- the only symptom was the **Add button silently going quiet** — no message,
  nothing pointing at the offending field,
- the failure was invisible until someone happened to look at the value.

That is the shape of every remaining unvalidated field: not a crash, but a form
that stops working and does not say why. It is also a reminder that "the submit
is disabled" is NOT feedback — §6's inline error requirement is the point.

### Ground already taken (do not redo)

- `apps/web/lib/invoice-lines.ts` — `parseQuantity` (strict whole-number parse;
  deliberately rejects `1.5`, `-2`, `1e3` and `3 bags`, all of which `parseInt`
  would have accepted) and `MIN_QUANTITY`, unit-tested in
  `invoice-lines.test.ts`.
- `apps/web/app/(app)/finance/invoices/quantity-field.tsx` — `QuantityField`:
  filters non-digits on input, snaps back to the last good value on an
  unparseable blur, offers −/+ and Arrow-Up/Down, and cannot emit an invalid
  count. **This is a candidate to generalise** into the §3 ergonomics layer as
  the reference implementation of a typed control, and to move into
  `packages/ui` once a second domain needs it.
- The catalogue-priced invoice line (see `FeeItem.pricingMode`) removed a whole
  class of free-typed money: a fixed item's amount is no longer an input at all.

### Surfaces added since the 2026-08-04 inventory

§5's phase list predates these; fold them in when sizing:

- `finance/invoices/new` — the compose route (student search, term, year,
  cycle, due date, notes, per-line amount + quantity).
- `finance/invoices/[id]` — draft header fields (term/year/cycle/due/notes),
  the line entry row, and the line edit modal.
- `finance/fee-items` — pricing mode + price, where an unpriced fixed item is
  now a blocking condition rather than a silent one.

### Sharpened asks for the dedicated session

1. **Instant, not on-submit.** Validate as the user types (or on blur for
   expensive checks), with the message beside the field.
2. **Block dependent actions explicitly.** A disabled action must be
   accompanied by the reason — the quantity bug is the argument.
3. **Type-appropriate keyboards and filters.** `inputMode` is only a hint; the
   filter is what keeps letters out of a number.
4. **Numbers:** positive-only and integer-only where that is the domain rule
   (quantities, ranks, counts); money in minor units with no decimals typed.
5. **Emails, phones, codes, names** per the §4 table — reuse, never re-derive.
6. Decide whether the ergonomics layer is `useField` or `<ValidatedField>` (§3)
   and build ONE of them before touching 45 surfaces.
