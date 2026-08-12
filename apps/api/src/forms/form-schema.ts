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
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  items: FormItem[];
  next?: string; // a section id, or SUBMIT_TARGET; default = next in order
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

/** Flatten every item across all sections (in order). */
export function allItems(def: FormDefinition): FormItem[] {
  return def.sections.flatMap((s) => s.items);
}

/** The answer-bearing items (skips headings/descriptions). */
export function questionItems(def: FormDefinition): FormItem[] {
  return allItems(def).filter((i) => !DISPLAY_ITEM_TYPES.includes(i.type));
}
