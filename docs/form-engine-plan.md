# Form Engine — reusable, sectioned, branching forms

**Status:** approved scope (owner, 2026-08-12) — _full generic Form subsystem_ +
sections/pages + branching + grids. The form system is extracted into its own
engine; **Admissions becomes a consumer**, and any future domain (HR onboarding,
health intake, PTA/club surveys, feedback) reuses the whole thing.

Grounded in **Google Forms** — we adopt its respondent model (sections as pages,
its question-type vocabulary, per-answer branching) while keeping the one thing
Google Forms lacks and we already have: **versioned, immutable forms** whose
responses **snapshot** the version they answered.

---

## 1 · How Google Forms works (the model we ground in)

- A form is a **title + description + an ordered list of items**.
- Items are **questions**, **section breaks**, or **layout blocks** (title/
  description, image, video).
- **Sections = pages.** Each section has its own title + description; the
  respondent sees **one section per screen** with **Back / Next** and a
  **progress bar**. The last section submits.
- **Question types:** short answer, paragraph, multiple choice (radio),
  checkboxes, dropdown, file upload, linear scale, rating, date, time, and
  **grids** (multiple-choice / checkbox).
- **Per question:** required, description/help, an **"Other"** option, shuffle
  options, and **response validation** (number range, text length/regex/email…).
- **Branching:** on a choice question, _"go to section based on answer"_ routes
  each answer to a section (or to Submit).
- **Settings:** progress bar, shuffle question order, one response, edit after
  submit, confirmation message.

## 2 · What we have today (what this replaces)

`AdmissionFormVersion` (a **flat** `fields` JSON array, 8 field types:
`text · paragraph · number · date · select · multiselect · boolean · file`) +
`AdmissionFormResponse` (answers keyed by field key, tied to an `applicationId`).
Versioned + immutable + snapshot-on-response — **a strength we keep.** But: a
flat field list (no sections/pages), a thin/overloaded type set (`select` is
really a dropdown; no radio, scale, time, grids, or display blocks), and it is
**welded to admissions**.

## 3 · Target architecture (three layers)

| Layer                     | Home                            | Responsibility                                                                                                                                                                                     |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema + validation**   | `packages/forms` (new, pure TS) | The canonical `FormDefinition` types + a **pure `validateAnswers(def, answers)`** shared by client and server (one source of truth). File uploads are _materialised_ server-side (see §4).         |
| **Backend `FormsModule`** | `apps/api/src/forms`            | Generic `Form` / `FormVersion` / `FormResponse` tables (polymorphic owner + `purpose`), `FormsService` (draft / publish / archive / submit / validate), RLS, versioning + immutability, audit.     |
| **Reusable UI**           | `packages/ui`                   | `<FormBuilder>` (sections + items, per-type config, branching editor, drag-reorder) and `<FormRenderer>` (paginated by section, Back/Next, progress bar, branching navigation, client validation). |

**Admissions after extraction:** an application form is just a `Form` owned by
the tenant with `purpose = "admissions.application"`; an application's answers
are a `FormResponse` whose subject is the application. The `file` item keeps
flowing through F4/R2 exactly as it does now. Nothing form-specific stays in the
admissions module.

## 4 · The canonical schema

```ts
type FormItemType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'date'
  | 'time'
  | 'phone'
  | 'address' // composite value types
  | 'radio'
  | 'dropdown'
  | 'checkboxes'
  | 'linear_scale'
  | 'file'
  | 'grid_radio'
  | 'grid_checkbox' // grids
  | 'heading'
  | 'description'; // display-only (no answer)

// Response validation for text/number items. `kind` are friendly presets the
// builder surfaces as a dropdown; `pattern` is the escape hatch for anything
// specific (e.g. a 10-digit rule = `^\d{10}$` + patternError "Enter 10 digits").
interface FormValidation {
  minLength?: number;
  maxLength?: number; // also drives a live character countdown in the UI
  min?: number;
  max?: number; // numeric value range
  kind?: 'email' | 'url' | 'number' | 'integer';
  pattern?: string;
  patternError?: string;
}

interface FormItem {
  id: string; // stable id — branching targets + reorder
  key: string; // answer key (questions only; '' for display)
  type: FormItemType;
  label: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // radio / dropdown / checkboxes
  allowOther?: boolean; // adds an "Other: ___" choice
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  grid?: { rows: string[]; columns: string[] };
  file?: { accept?: string[]; maxSizeMb?: number; maxFiles?: number };
  phone?: { defaultDialCode?: string };
  validation?: FormValidation;
  // Per-answer branching (choice items): overrides the section's default next.
  branching?: { answer: string; goTo: string /* sectionId | 'submit' */ }[];
}

interface FormSection {
  id: string;
  title?: string;
  description?: string;
  items: FormItem[];
  next?: string; // default next: sectionId | 'submit' (else next in order)
}

interface FormSettings {
  progressBar?: boolean;
  shuffleQuestions?: boolean;
  confirmationMessage?: string;
}

interface FormDefinition {
  title: string;
  description?: string;
  sections: FormSection[];
  settings?: FormSettings;
}
```

**Answers** stay `Record<itemKey, value>` — sections are a _layout/navigation_
concern, so the response shape is unchanged. Value by type: `string`
(text/paragraph/date/time/radio/dropdown), `number` (number/linear_scale),
`string[]` (checkboxes), `{ dialCode, number }` (phone), a structured
`{ formatted, line1?, city?, state?, country?, postalCode?, lat?, lng? }`
(address — ready for autocomplete-populated data, works as plain text meanwhile),
`{ documentId, filename, mime?, size? }` (file), `Record<rowKey, string |
string[]>` (grids). `address` **autocomplete** needs an external places provider
(Google Places / Mapbox → API key + per-lookup cost) and is wired in **P3**; the
type ships in P1 as structured text.

**Validation.** `validateAnswers(def, answers)` is **pure** (structural + type +
required + `validation` rules + option membership + branching reachability) and
runs on **both** client and server. `file` is special: the pure validator checks
the _shape_ (a new-upload marker `{ filename, mime, contentBase64 }` or an
existing `{ documentId }` ref), and the **server** additionally _materialises_
new uploads through F4 and confirms an existing ref belongs to the response's
subject — exactly the pattern already shipped for the admissions `file` field.

## 5 · Data model (Prisma, generic)

```
Form         { id, tenantId, ownerType, ownerId, purpose, key?, title, createdBy… }
FormVersion  { id, tenantId, formId, version, status(draft|published|archived),
               definition Json, publishedAt, publishedBy, … }   // published = immutable
FormResponse { id, tenantId, formVersionId, subjectType, subjectId,
               answers Json, definitionSnapshot Json, version, submittedBy, … }
```

- **Polymorphic owner** (`ownerType`/`ownerId`) + `purpose` so a domain names its
  forms (mirrors the Documents F4 owner pattern). Admissions: `ownerType='Tenant'`,
  `purpose='admissions.application'`.
- **Subject** on the response is the thing that answered (an admissions
  application → `subjectType='AdmissionApplication'`).
- RLS on all three (tenant isolation) + `app_runtime` grants; `@@unique`
  (`formVersionId`,`subjectType`,`subjectId`) = one response per subject per
  version. No privileged client.

## 6 · Migration from the admissions form tables

Pre-launch — no production data — so a clean cutover:

1. Create the generic tables (+ RLS).
2. Migrate the handful of dev `AdmissionFormVersion` rows → `Form` +
   `FormVersion` (a flat `fields[]` becomes a **single default section**), and
   `AdmissionFormResponse` → `FormResponse` (subject = the application).
3. Rewire admissions (service + the three UI surfaces) onto the engine.
4. Drop `AdmissionFormVersion` / `AdmissionFormResponse`.

## 7 · Phased delivery (each its own verified PR)

- **P1 — Backend generic Forms subsystem.** Tables + migration + RLS +
  `FormsModule`/`FormsService` in `apps/api`, with the schema + validation living
  in `apps/api/src/forms` for now (branching-capable). Real-pg e2e. _Self-
  contained; no cross-package work yet._
- **P2 — Extract schema → `packages/forms`.** Move the schema + pure validator to
  the shared package; the api consumes it. Solves the cross-runtime resolution
  (see §8). Vitest on the pure validator.
- **P3 — Reusable UI.** `<FormBuilder>` + `<FormRenderer>` in `packages/ui`
  (sections/pages, progress, branching navigation, grids, per-type config).
- **P4 — Rewire admissions.** Point the builder, internal response panel, and
  public apply page at the engine; migrate dev data; drop the admissions form
  tables. `admissions-forms` e2e green throughout.
- **P5 — Advanced polish.** Shuffle, rating, richer validation UI, response
  summary/analytics, embeddable public forms.

## 8 · Cross-runtime package note (the P2 risk to resolve deliberately)

**No package here is currently consumed by _both_ runtimes.** The api
(`module: commonjs`, `moduleResolution: Node10`) consumes `@workspace/database`;
the web (Bundler/ESM) consumes `@workspace/ui`. `packages/forms` must resolve
under **both**. Options, decided in P2:

1. **Build to `dist`** (JS + `.d.ts`) and consume the compiled output — simplest
   resolution, adds a turbo build step.
2. **Source-consume** with a package `exports` map + the api's jest
   `moduleNameMapper` (the pattern already used for `@workspace/database`).
3. A thin **`paths`** mapping in each consumer's tsconfig.

This is exactly why the schema starts _inside the api_ in P1 and is extracted in
a focused P2 — the risky plumbing gets its own attention, not a rushed corner of
a feature PR.

## 9 · Non-goals (for now)

Real-time collaborative editing, response quotas/limits, payment questions,
respondent theming, and Google-account-style respondent identity. Reassess after
P4.
