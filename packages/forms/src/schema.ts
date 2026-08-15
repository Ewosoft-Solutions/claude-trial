/**
 * Form Engine — the canonical schema (see docs/form-engine-plan.md §4).
 *
 * Framework-agnostic on purpose (no Nest imports) so it lifts cleanly into the
 * shared `packages/forms` in P2. A form is a sequence of SECTIONS (pages), each
 * an ordered list of ITEMS (questions or display blocks). Answers are keyed by
 * item key; sections are a layout/navigation concern only.
 */

export const FORM_ITEM_TYPES = [
  'short_text',
  'paragraph',
  'number',
  'date',
  'time',
  'phone',
  'address',
  'radio',
  'dropdown',
  'checkboxes',
  'linear_scale',
  'file',
  'grid_radio',
  'grid_checkbox',
  // WB3 consolidation: the "applying for" academic-structure picker (stage →
  // year level → optional stream → optional campus). Sourced from the tenant's
  // structure at render time; a `system` item bound to `applying_for`.
  'cascade',
  'heading',
  'description',
] as const;
export type FormItemType = (typeof FORM_ITEM_TYPES)[number];

/** Items that carry no answer (layout only). */
export const DISPLAY_ITEM_TYPES: readonly FormItemType[] = [
  'heading',
  'description',
];
/** Single/multi choice items backed by an option set. */
export const CHOICE_ITEM_TYPES: readonly FormItemType[] = [
  'radio',
  'dropdown',
  'checkboxes',
];
export const GRID_ITEM_TYPES: readonly FormItemType[] = [
  'grid_radio',
  'grid_checkbox',
];

/** The special "go to submit" branching target. */
export const SUBMIT_TARGET = 'submit';

export interface FormValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  kind?: 'email' | 'url' | 'number' | 'integer';
  pattern?: string;
  patternError?: string;
}

export interface FormBranch {
  answer: string;
  goTo: string; // a section id, or SUBMIT_TARGET
}

export interface FormItem {
  id: string;
  key: string; // '' for display-only items
  type: FormItemType;
  label: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  allowOther?: boolean;
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  grid?: { rows: string[]; columns: string[] };
  file?: { accept?: string[]; maxSizeMb?: number; maxFiles?: number };
  phone?: { defaultDialCode?: string };
  validation?: FormValidation;
  branching?: FormBranch[];

  // ---- WB3 consolidation: SYSTEM (bound) items ----
  // A `system` item is seeded by the platform and mapped to a structured column
  // that drives conversion (see BINDINGS). A school may relabel / reorder / toggle
  // required / hide it, but NOT delete it or change its type/key. `binding` is the
  // stable target key; `hidden` drops it from the rendered intake form.
  system?: boolean;
  binding?: string;
  hidden?: boolean;
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  items: FormItem[];
  next?: string; // a section id, or SUBMIT_TARGET; default = next in order

  // ---- WB3 consolidation ----
  system?: boolean;
  binding?: string;
  hidden?: boolean;
  // A repeatable section renders its items once per entry (e.g. Guardians). The
  // answer for a repeatable section is an ARRAY of per-entry answer maps keyed by
  // the section's item keys. `entryNoun` labels the add button ("Add guardian").
  repeatable?: { min?: number; max?: number; entryNoun?: string };
}

export interface FormSettings {
  progressBar?: boolean;
  shuffleQuestions?: boolean;
  confirmationMessage?: string;
}

export interface FormDefinition {
  title: string;
  description?: string;
  sections: FormSection[];
  settings?: FormSettings;
}

export type FormAnswers = Record<string, unknown>;

/** A `file` item's persisted answer — a reference to the stored F4 document. */
export interface FileAnswerRef {
  documentId: string;
  filename: string;
  mime?: string;
  size?: number;
}

/** A new upload sent by the client for a `file` item (materialised server-side). */
export interface FileUploadMarker {
  filename: string;
  mime?: string;
  contentBase64: string;
}

/** A phone answer — a dial code + the local number. */
export interface PhoneAnswer {
  dialCode: string;
  number: string;
}

/** A structured address answer (ready for autocomplete-populated fields). */
export interface AddressAnswer {
  formatted: string;
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

// ---- WB3 consolidation: the standard admission-intake bindings ----
// Stable keys a `system` item/section binds to, mapped by
// `answersToCreateApplicationInput` onto the structured intake payload that
// drives conversion. Adding a binding here + a case in the mapper keeps the two
// in lock-step.
export const BINDINGS = {
  title: 'applicant.title',
  firstName: 'applicant.firstName',
  middleName: 'applicant.middleName',
  surname: 'applicant.surname',
  dateOfBirth: 'applicant.dateOfBirth',
  gender: 'applicant.gender',
  stateOfOrigin: 'applicant.stateOfOrigin',
  religion: 'applicant.religion',
  healthNotes: 'applicant.healthNotes',
  /** The `cascade` item — an academic-structure selection. */
  applyingFor: 'applying_for',
  /** The repeatable Guardians section. */
  guardians: 'guardians',
  // Per-guardian item bindings (inside the repeatable Guardians section).
  guardianTitle: 'guardian.title',
  guardianFirstName: 'guardian.firstName',
  guardianMiddleName: 'guardian.middleName',
  guardianSurname: 'guardian.surname',
  guardianRelationship: 'guardian.relationship',
  guardianEmail: 'guardian.email',
  guardianAddress: 'guardian.address',
  guardianPhone: 'guardian.phone',
  guardianWhatsapp: 'guardian.whatsapp',
} as const;

/** A `cascade` item's answer — an academic-structure selection. */
export interface CascadeAnswer {
  stageId?: string;
  yearLevelId?: string;
  streamId?: string;
  campusId?: string;
}

/** Flatten every item across all sections (in order). */
export function allItems(def: FormDefinition): FormItem[] {
  return def.sections.flatMap((s) => s.items);
}

/** Sections that are actually rendered (drops `hidden` ones). */
export function visibleSections(def: FormDefinition): FormSection[] {
  return def.sections.filter((s) => !s.hidden);
}

/**
 * The definition with only the SYSTEM (bound) sections — the standard intake
 * fields the New Application / apply forms render + map to `createApplication`.
 */
export function systemSectionsOnly(def: FormDefinition): FormDefinition {
  return { ...def, sections: def.sections.filter((s) => s.system) };
}

/**
 * The definition WITHOUT the system sections — the respondent-facing custom
 * questions that make up a form RESPONSE (the bound system data is captured via
 * bindings at intake, not as a response answer).
 */
export function withoutSystemSections(def: FormDefinition): FormDefinition {
  return { ...def, sections: def.sections.filter((s) => !s.system) };
}

/** A section's rendered items (drops `hidden` ones). */
export function visibleItems(section: FormSection): FormItem[] {
  return section.items.filter((i) => !i.hidden);
}

/** The answer-bearing items (skips headings/descriptions). */
export function questionItems(def: FormDefinition): FormItem[] {
  return allItems(def).filter((i) => !DISPLAY_ITEM_TYPES.includes(i.type));
}
