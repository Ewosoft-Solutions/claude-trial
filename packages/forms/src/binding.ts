/**
 * WB3 consolidation — map a form submission's SYSTEM (bound) answers onto the
 * structured admission-intake payload that drives conversion.
 *
 * The standard intake fields live in the form definition as `system` items bound
 * (via {@link BINDINGS}) to structured columns. This mapper reads those bound
 * answers and produces a {@link CreateApplicationInput} — the SAME shape the
 * `createApplication` service already accepts — so the acceptance/conversion path
 * is untouched. Non-system (custom) answers are NOT mapped here; they are kept as
 * the generic form response.
 *
 * Framework-agnostic (shared by web + api). Keep in lock-step with the API's
 * `CreateApplicationDto`.
 */
import {
  BINDINGS,
  visibleItems,
  type CascadeAnswer,
  type FormDefinition,
  type FormItem,
  type FormSection,
  type PhoneAnswer,
} from './schema';

export interface GuardianInput {
  title?: string;
  firstName: string;
  middleName?: string;
  surname: string;
  relationship: string;
  email?: string;
  address?: string;
  phoneCountryCode?: string;
  phoneNumber: string;
  whatsappSameAsPhone?: boolean;
  whatsappCountryCode?: string;
  whatsappNumber?: string;
  isPrimary?: boolean;
}

export interface CreateApplicationInput {
  applicantTitle?: string;
  applicantFirstName: string;
  applicantMiddleName?: string;
  applicantSurname: string;
  yearLevelId: string;
  stageId?: string;
  streamId?: string;
  campusId?: string;
  dateOfBirth?: string;
  gender?: string;
  stateOfOrigin?: string;
  religion?: string;
  healthNotes?: string;
  guardians: GuardianInput[];
  submittedDate?: string;
  notes?: string;
}

function trimmed(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asPhone(v: unknown): PhoneAnswer | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  const number = trimmed(p['number']);
  if (!number) return undefined;
  return { dialCode: trimmed(p['dialCode']) ?? '+234', number };
}

/** Every item in the definition that carries a `binding`, keyed by binding. */
function boundItems(def: FormDefinition): Map<string, { item: FormItem }> {
  const out = new Map<string, { item: FormItem }>();
  for (const s of def.sections) {
    if (s.repeatable) continue; // repeatable entries are read separately
    for (const item of s.items) {
      if (item.binding) out.set(item.binding, { item });
    }
  }
  return out;
}

/** The (single) repeatable Guardians section, if the form has one. */
function guardiansSection(def: FormDefinition): FormSection | undefined {
  return def.sections.find(
    (s) => s.repeatable && s.binding === BINDINGS.guardians,
  );
}

/** Map one guardian entry (answers keyed by the section's item bindings). */
function mapGuardian(
  section: FormSection,
  entry: Record<string, unknown>,
  index: number,
): GuardianInput {
  // Within a repeatable entry, values are keyed by item KEY; resolve each item's
  // binding → its key so config drives the mapping.
  const keyOf = (binding: string) =>
    section.items.find((i) => i.binding === binding)?.key;
  const val = (binding: string) => {
    const k = keyOf(binding);
    return k ? entry[k] : undefined;
  };
  const phone = asPhone(val(BINDINGS.guardianPhone));
  const whatsapp = asPhone(val(BINDINGS.guardianWhatsapp));
  return {
    title: trimmed(val(BINDINGS.guardianTitle)),
    firstName: trimmed(val(BINDINGS.guardianFirstName)) ?? '',
    middleName: trimmed(val(BINDINGS.guardianMiddleName)),
    surname: trimmed(val(BINDINGS.guardianSurname)) ?? '',
    relationship: trimmed(val(BINDINGS.guardianRelationship)) ?? 'guardian',
    email: trimmed(val(BINDINGS.guardianEmail)),
    address: trimmed(val(BINDINGS.guardianAddress)),
    phoneCountryCode: phone?.dialCode,
    phoneNumber: phone?.number ?? '',
    whatsappSameAsPhone: whatsapp ? false : true,
    whatsappCountryCode: whatsapp?.dialCode,
    whatsappNumber: whatsapp?.number,
    // Exactly one primary — the first entry, regardless of any client flag.
    isPrimary: index === 0,
  };
}

/**
 * Build the structured intake payload from a form submission. Bound answers →
 * the structured columns; the cascade → the class ids; the repeatable Guardians
 * section → the guardian array.
 */
export function answersToCreateApplicationInput(
  def: FormDefinition,
  answers: Record<string, unknown>,
): CreateApplicationInput {
  const bound = boundItems(def);
  const get = (binding: string) => {
    const hit = bound.get(binding);
    return hit ? answers[hit.item.key] : undefined;
  };

  const cascade = (get(BINDINGS.applyingFor) ?? {}) as CascadeAnswer;

  const gSection = guardiansSection(def);
  const gEntries = gSection
    ? (Array.isArray(answers[gSection.binding!])
        ? (answers[gSection.binding!] as Record<string, unknown>[])
        : []
      ).map((entry, i) => mapGuardian(gSection, entry, i))
    : [];

  return {
    applicantTitle: trimmed(get(BINDINGS.title)),
    applicantFirstName: trimmed(get(BINDINGS.firstName)) ?? '',
    applicantMiddleName: trimmed(get(BINDINGS.middleName)),
    applicantSurname: trimmed(get(BINDINGS.surname)) ?? '',
    yearLevelId: trimmed(cascade.yearLevelId) ?? '',
    stageId: trimmed(cascade.stageId),
    streamId: trimmed(cascade.streamId),
    campusId: trimmed(cascade.campusId),
    dateOfBirth: trimmed(get(BINDINGS.dateOfBirth)),
    gender: trimmed(get(BINDINGS.gender)),
    stateOfOrigin: trimmed(get(BINDINGS.stateOfOrigin)),
    religion: trimmed(get(BINDINGS.religion)),
    healthNotes: trimmed(get(BINDINGS.healthNotes)),
    guardians: gEntries,
  };
}

/** True when the form has the bound applicant + cascade + guardians system fields. */
export function hasSystemIntake(def: FormDefinition): boolean {
  const bindings = new Set<string>();
  for (const s of def.sections) {
    for (const i of visibleItems(s)) if (i.binding) bindings.add(i.binding);
    if (s.binding) bindings.add(s.binding);
  }
  return (
    bindings.has(BINDINGS.firstName) &&
    bindings.has(BINDINGS.surname) &&
    bindings.has(BINDINGS.applyingFor)
  );
}
