/**
 * Form Engine — pure, framework-agnostic validation (no Nest imports; lifts into
 * `packages/forms` in P2, shared by client + server). Two entry points:
 *   • validateDefinition(def) — structural checks when a draft is saved/published.
 *   • validateAnswers(def, answers) — type/required/rule checks on a submission,
 *     returning cleaned answers. `file` items are validated in SHAPE only (a ref
 *     or an upload marker); the server materialises uploads through F4 afterwards.
 */
import {
  CHOICE_ITEM_TYPES,
  DISPLAY_ITEM_TYPES,
  SUBMIT_TARGET,
  allItems,
  questionItems,
  type AddressAnswer,
  type FileAnswerRef,
  type FileUploadMarker,
  type FormDefinition,
  type FormItem,
  type FormSection,
  type PhoneAnswer,
} from './schema';

/** Thrown for any invalid definition or answer (mapped to 400 by the service). */
export class FormValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(message: string): never {
  throw new FormValidationError(message);
}

// ---------------------------------------------------------------- definition

/** Validate a form's STRUCTURE (keys, options, scales, grids, branching). */
export function validateDefinition(def: FormDefinition): void {
  if (!def || typeof def.title !== 'string' || !def.title.trim()) {
    fail('The form needs a title.');
  }
  if (!Array.isArray(def.sections) || def.sections.length === 0) {
    fail('The form needs at least one section.');
  }

  const sectionIds = new Set<string>();
  for (const s of def.sections) {
    if (!s.id) fail('Every section needs an id.');
    if (sectionIds.has(s.id)) fail(`Duplicate section id "${s.id}".`);
    sectionIds.add(s.id);
  }
  const isTarget = (t: string) => t === SUBMIT_TARGET || sectionIds.has(t);

  const keys = new Set<string>();
  for (const s of def.sections) {
    if (s.next && !isTarget(s.next)) {
      fail(`Section "${s.title ?? s.id}" points at a missing section.`);
    }
    for (const item of s.items) {
      if (DISPLAY_ITEM_TYPES.includes(item.type)) continue;
      const key = item.key?.trim();
      if (!key) fail(`Item "${item.label}" needs a key.`);
      if (keys.has(key)) fail(`Duplicate item key "${key}".`);
      keys.add(key);

      if (CHOICE_ITEM_TYPES.includes(item.type)) {
        const options = (item.options ?? [])
          .map((o) => o.trim())
          .filter(Boolean);
        if (options.length === 0) {
          fail(`"${item.label}" needs at least one option.`);
        }
      }
      if (item.type === 'linear_scale') {
        const min = item.scale?.min;
        const max = item.scale?.max;
        if (min == null || max == null || min >= max) {
          fail(`"${item.label}" needs a valid scale (min < max).`);
        }
      }
      if (item.type === 'grid_radio' || item.type === 'grid_checkbox') {
        if (!item.grid?.rows?.length || !item.grid?.columns?.length) {
          fail(`"${item.label}" needs grid rows and columns.`);
        }
      }
      for (const b of item.branching ?? []) {
        if (!isTarget(b.goTo)) {
          fail(`"${item.label}" branches to a missing section.`);
        }
      }
    }
  }
}

// ------------------------------------------------------------------- answers

function isEmpty(type: FormItem['type'], raw: unknown): boolean {
  if (raw == null || raw === '') return true;
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'object') {
    const v = raw as Record<string, unknown>;
    switch (type) {
      case 'phone':
        return !String(v.number ?? '').trim();
      case 'address':
        return !String(v.formatted ?? v.line1 ?? '').trim();
      case 'file':
        return !v.documentId && !v.contentBase64;
      case 'cascade':
        return !String(v.yearLevelId ?? '').trim();
      default:
        return Object.keys(v).length === 0;
    }
  }
  return false;
}

function applyStringRules(item: FormItem, value: string): void {
  const v = item.validation;
  if (!v) return;
  if (v.minLength != null && value.length < v.minLength) {
    fail(`"${item.label}" must be at least ${v.minLength} characters.`);
  }
  if (v.maxLength != null && value.length > v.maxLength) {
    fail(`"${item.label}" must be at most ${v.maxLength} characters.`);
  }
  if (v.kind === 'email' && !EMAIL_RE.test(value)) {
    fail(v.patternError ?? `"${item.label}" must be a valid email.`);
  }
  if (v.kind === 'url' && !URL_RE.test(value)) {
    fail(v.patternError ?? `"${item.label}" must be a valid link (https://…).`);
  }
  if (v.pattern) {
    let re: RegExp;
    try {
      re = new RegExp(v.pattern);
    } catch {
      return; // a bad pattern in the definition never blocks a submission
    }
    if (!re.test(value)) {
      fail(v.patternError ?? `"${item.label}" is not in the expected format.`);
    }
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function optNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function coerce(item: FormItem, raw: unknown): unknown {
  switch (item.type) {
    case 'short_text':
    case 'paragraph': {
      if (typeof raw !== 'string') fail(`"${item.label}" must be text.`);
      applyStringRules(item, raw);
      return raw;
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) fail(`"${item.label}" must be a number.`);
      const v = item.validation;
      if (v?.kind === 'integer' && !Number.isInteger(n)) {
        fail(`"${item.label}" must be a whole number.`);
      }
      if (v?.min != null && n < v.min) {
        fail(`"${item.label}" must be at least ${v.min}.`);
      }
      if (v?.max != null && n > v.max) {
        fail(`"${item.label}" must be at most ${v.max}.`);
      }
      return n;
    }
    case 'date': {
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
        fail(`"${item.label}" must be a date.`);
      }
      return raw;
    }
    case 'time': {
      if (typeof raw !== 'string' || !TIME_RE.test(raw)) {
        fail(`"${item.label}" must be a time (HH:MM).`);
      }
      return raw;
    }
    case 'phone': {
      const v = raw as Record<string, unknown>;
      const number = String(v.number ?? '').trim();
      if (!number) fail(`"${item.label}" needs a phone number.`);
      const dialCode =
        String(v.dialCode ?? '').trim() ||
        item.phone?.defaultDialCode ||
        '+234';
      return { dialCode, number } satisfies PhoneAnswer;
    }
    case 'address': {
      if (typeof raw === 'string') return { formatted: raw.trim() };
      const v = raw as Record<string, unknown>;
      const formatted = String(v.formatted ?? v.line1 ?? '').trim();
      if (!formatted) fail(`"${item.label}" needs an address.`);
      return {
        formatted,
        line1: str(v.line1),
        city: str(v.city),
        state: str(v.state),
        country: str(v.country),
        postalCode: str(v.postalCode),
        lat: optNum(v.lat),
        lng: optNum(v.lng),
      } satisfies AddressAnswer;
    }
    case 'radio':
    case 'dropdown': {
      if (typeof raw !== 'string') fail(`"${item.label}" must be a choice.`);
      const options = item.options ?? [];
      if (!options.includes(raw) && !item.allowOther) {
        fail(`"${item.label}" must be one of its options.`);
      }
      return raw;
    }
    case 'checkboxes': {
      if (!Array.isArray(raw))
        fail(`"${item.label}" must be a list of choices.`);
      const options = item.options ?? [];
      for (const v of raw) {
        if (
          typeof v !== 'string' ||
          (!options.includes(v) && !item.allowOther)
        ) {
          fail(`"${item.label}" has an invalid choice.`);
        }
      }
      return raw;
    }
    case 'linear_scale': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      const min = item.scale?.min ?? 1;
      const max = item.scale?.max ?? 5;
      if (!Number.isInteger(n) || n < min || n > max) {
        fail(`"${item.label}" must be between ${min} and ${max}.`);
      }
      return n;
    }
    case 'file': {
      const v = raw as Record<string, unknown>;
      if (typeof v.documentId === 'string' && v.documentId) {
        return {
          documentId: v.documentId,
          filename: typeof v.filename === 'string' ? v.filename : 'file',
          mime: typeof v.mime === 'string' ? v.mime : undefined,
          size: typeof v.size === 'number' ? v.size : undefined,
        } satisfies FileAnswerRef;
      }
      if (typeof v.contentBase64 === 'string' && v.contentBase64) {
        return {
          filename: typeof v.filename === 'string' ? v.filename : 'upload',
          mime: typeof v.mime === 'string' ? v.mime : undefined,
          contentBase64: v.contentBase64,
        } satisfies FileUploadMarker;
      }
      return fail(`"${item.label}" must be an uploaded file.`);
    }
    case 'grid_radio': {
      const rows = item.grid?.rows ?? [];
      const cols = item.grid?.columns ?? [];
      const out: Record<string, string> = {};
      for (const [rk, cv] of Object.entries(raw as Record<string, unknown>)) {
        if (
          !rows.includes(rk) ||
          typeof cv !== 'string' ||
          !cols.includes(cv)
        ) {
          fail(`"${item.label}" has an invalid selection.`);
        }
        out[rk] = cv as string;
      }
      return out;
    }
    case 'grid_checkbox': {
      const rows = item.grid?.rows ?? [];
      const cols = item.grid?.columns ?? [];
      const out: Record<string, string[]> = {};
      for (const [rk, cv] of Object.entries(raw as Record<string, unknown>)) {
        if (!rows.includes(rk) || !Array.isArray(cv)) {
          fail(`"${item.label}" has an invalid selection.`);
        }
        for (const c of cv as unknown[]) {
          if (typeof c !== 'string' || !cols.includes(c)) {
            fail(`"${item.label}" has an invalid selection.`);
          }
        }
        out[rk] = cv as string[];
      }
      return out;
    }
    case 'cascade': {
      // An academic-structure selection. Ids are validated against the tenant's
      // structure server-side (createApplication); here we only shape-check.
      const v = raw as Record<string, unknown>;
      const yearLevelId = str(v.yearLevelId);
      if (!yearLevelId) fail(`"${item.label}" needs a class.`);
      return {
        yearLevelId,
        stageId: str(v.stageId),
        streamId: str(v.streamId),
        campusId: str(v.campusId),
      };
    }
    default:
      return fail(`Unsupported item type on "${item.label}".`);
  }
}

/**
 * The keys of the items on the sections actually REACHED given these answers,
 * following per-answer branching (a choice item's branch overrides the section's
 * `next`, which defaults to the next section in order). Required is enforced only
 * for reached items, so a section a respondent branches past isn't demanded.
 */
export function reachedItemKeys(
  def: FormDefinition,
  answers: Record<string, unknown>,
): Set<string> {
  const byId = new Map(def.sections.map((s) => [s.id, s]));
  const order = def.sections.map((s) => s.id);
  const reached = new Set<string>();
  const visited = new Set<string>();

  let currentId: string | undefined = def.sections[0]?.id;
  while (currentId && currentId !== SUBMIT_TARGET && !visited.has(currentId)) {
    visited.add(currentId);
    const section = byId.get(currentId);
    if (!section) break;
    // Repeatable sections are validated per-entry (not as flat top-level keys),
    // and a hidden section/item is never demanded.
    if (!section.repeatable && !section.hidden) {
      for (const item of section.items) {
        if (!DISPLAY_ITEM_TYPES.includes(item.type) && !item.hidden) {
          reached.add(item.key);
        }
      }
    }

    let next: string | undefined;
    for (const item of section.items) {
      if (item.branching?.length && CHOICE_ITEM_TYPES.includes(item.type)) {
        const match = item.branching.find(
          (b) => b.answer === answers[item.key],
        );
        if (match) {
          next = match.goTo;
          break;
        }
      }
    }
    if (!next) next = section.next;
    if (!next) next = order[order.indexOf(currentId) + 1];
    currentId = next;
  }
  return reached;
}

/**
 * Validate a submission against the definition, returning cleaned answers.
 * `file` values come back as a ref or an upload marker — the SERVER materialises
 * markers through F4 after this pure pass.
 */
export function validateAnswers(
  def: FormDefinition,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  // Repeatable sections carry their answers as an array under the section's
  // `binding` key; every other question is a flat top-level key.
  const repeatables = def.sections.filter((s) => s.repeatable && !s.hidden);
  const repeatableKeys = new Set(
    repeatables.map((s) => s.binding).filter((k): k is string => !!k),
  );
  const flatItems = questionItems(def).filter((i) => {
    const section = def.sections.find((s) => s.items.includes(i));
    return section && !section.repeatable && !section.hidden && !i.hidden;
  });
  const byKey = new Map(flatItems.map((i) => [i.key, i]));

  for (const key of Object.keys(answers)) {
    if (!byKey.has(key) && !repeatableKeys.has(key)) {
      fail(`"${key}" is not a field on this form.`);
    }
  }

  const reached = reachedItemKeys(def, answers);
  const cleaned: Record<string, unknown> = {};
  for (const item of flatItems) {
    const raw = answers[item.key];
    if (isEmpty(item.type, raw)) {
      if (item.required && reached.has(item.key)) {
        fail(`"${item.label}" is required.`);
      }
      continue;
    }
    cleaned[item.key] = coerce(item, raw);
  }

  for (const section of repeatables) {
    cleaned[section.binding!] = validateRepeatable(
      section,
      answers[section.binding!],
    );
  }
  return cleaned;
}

/** Validate a repeatable section's answer — an array of per-entry answer maps. */
function validateRepeatable(section: FormSection, raw: unknown): unknown[] {
  const entries = Array.isArray(raw) ? raw : [];
  const min = section.repeatable?.min ?? 0;
  const max = section.repeatable?.max;
  const noun = section.repeatable?.entryNoun ?? 'entry';
  if (entries.length < min) {
    fail(`Add at least ${min} ${noun}${min === 1 ? '' : 's'}.`);
  }
  if (max != null && entries.length > max) {
    fail(`Add at most ${max} ${noun}${max === 1 ? '' : 's'}.`);
  }
  const items = section.items.filter(
    (i) => !DISPLAY_ITEM_TYPES.includes(i.type) && !i.hidden,
  );
  return entries.map((entry) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const item of items) {
      const val = e[item.key];
      if (isEmpty(item.type, val)) {
        if (item.required) fail(`"${item.label}" is required.`);
        continue;
      }
      out[item.key] = coerce(item, val);
    }
    return out;
  });
}

/** The keys of every `file` item in the form (server uses these to materialise). */
export function fileItemKeys(def: FormDefinition): string[] {
  return allItems(def)
    .filter((i) => i.type === 'file')
    .map((i) => i.key);
}

export function isFileUploadMarker(v: unknown): v is FileUploadMarker {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as FileUploadMarker).contentBase64 === 'string'
  );
}

export function isFileRef(v: unknown): v is FileAnswerRef {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as FileAnswerRef).documentId === 'string'
  );
}
