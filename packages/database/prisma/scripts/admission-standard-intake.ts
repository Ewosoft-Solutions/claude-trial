/**
 * The standard admission-intake SYSTEM sections — the single source of truth for
 * the bound "applicant / applying-for / guardians" fields that make an admissions
 * form definition-driven (see the WB3 authoring consolidation, PRs #117/#120/#121).
 *
 * Kept here (a dependency-free database-package module) so BOTH the dev seed
 * (`dev/operational.ts`) and the backfill (`backfill-admission-system-sections.ts`)
 * compose the exact same sections — a new tenant (seeded) and an existing tenant
 * (backfilled) end up with an identical standard intake.
 *
 * The `binding` strings MUST stay in lock-step with `@workspace/forms` `BINDINGS`
 * — the API's `answersToCreateApplicationInput` reads bound answers by those
 * keys. They are inlined rather than imported because `@workspace/forms` resolves
 * to its built `dist/`, and these scripts run under `tsx` before any build. A
 * mismatch would make the mapper silently miss a field, so change them together.
 */

/** A section carries `system: true`; a definition is "already backfilled" if any does. */
export interface FormSectionSeed {
  id: string;
  title?: string;
  description?: string;
  system?: boolean;
  binding?: string;
  repeatable?: { min?: number; max?: number; entryNoun?: string };
  items: Array<Record<string, unknown>>;
}

export interface FormDefinitionSeed {
  title: string;
  description?: string;
  settings?: Record<string, unknown>;
  sections: FormSectionSeed[];
}

export const STANDARD_INTAKE_SECTIONS: FormSectionSeed[] = [
  {
    id: 'sys-applicant',
    title: 'Applicant',
    system: true,
    items: [
      {
        id: 'sys-title',
        key: 'applicant_title',
        type: 'short_text',
        label: 'Title',
        placeholder: 'e.g. Master / Miss',
        system: true,
        binding: 'applicant.title',
      },
      {
        id: 'sys-first',
        key: 'applicant_first_name',
        type: 'short_text',
        label: 'First name',
        required: true,
        system: true,
        binding: 'applicant.firstName',
      },
      {
        id: 'sys-middle',
        key: 'applicant_middle_name',
        type: 'short_text',
        label: 'Middle name',
        system: true,
        binding: 'applicant.middleName',
      },
      {
        id: 'sys-surname',
        key: 'applicant_surname',
        type: 'short_text',
        label: 'Surname',
        required: true,
        system: true,
        binding: 'applicant.surname',
      },
      {
        id: 'sys-dob',
        key: 'applicant_dob',
        type: 'date',
        label: 'Date of birth',
        system: true,
        binding: 'applicant.dateOfBirth',
      },
      {
        id: 'sys-gender',
        key: 'applicant_gender',
        type: 'dropdown',
        label: 'Gender',
        options: ['male', 'female', 'other'],
        system: true,
        binding: 'applicant.gender',
      },
      {
        id: 'sys-state',
        key: 'applicant_state',
        type: 'short_text',
        label: 'State of origin',
        system: true,
        binding: 'applicant.stateOfOrigin',
      },
      {
        id: 'sys-religion',
        key: 'applicant_religion',
        type: 'short_text',
        label: 'Religion',
        system: true,
        binding: 'applicant.religion',
      },
      {
        id: 'sys-health',
        key: 'applicant_health',
        type: 'paragraph',
        label: 'Health notes',
        help: 'Any medical needs we should know about (optional).',
        validation: { maxLength: 1000 },
        system: true,
        binding: 'applicant.healthNotes',
      },
    ],
  },
  {
    id: 'sys-class',
    title: 'Applying for',
    description: 'The class your child is applying to join.',
    system: true,
    items: [
      {
        id: 'sys-cascade',
        key: 'applying_for',
        type: 'cascade',
        label: 'Class',
        required: true,
        system: true,
        binding: 'applying_for',
      },
    ],
  },
  {
    id: 'sys-guardians',
    title: 'Parents / guardians',
    system: true,
    binding: 'guardians',
    repeatable: { min: 1, max: 4, entryNoun: 'guardian' },
    items: [
      {
        id: 'sys-g-title',
        key: 'guardian_title',
        type: 'short_text',
        label: 'Title',
        placeholder: 'e.g. Mrs',
        system: true,
        binding: 'guardian.title',
      },
      {
        id: 'sys-g-first',
        key: 'guardian_first_name',
        type: 'short_text',
        label: 'First name',
        required: true,
        system: true,
        binding: 'guardian.firstName',
      },
      {
        id: 'sys-g-middle',
        key: 'guardian_middle_name',
        type: 'short_text',
        label: 'Middle name',
        system: true,
        binding: 'guardian.middleName',
      },
      {
        id: 'sys-g-surname',
        key: 'guardian_surname',
        type: 'short_text',
        label: 'Surname',
        required: true,
        system: true,
        binding: 'guardian.surname',
      },
      {
        id: 'sys-g-rel',
        key: 'guardian_relationship',
        type: 'dropdown',
        label: 'Relationship',
        required: true,
        options: [
          'father',
          'mother',
          'guardian',
          'grandparent',
          'sibling',
          'other',
        ],
        system: true,
        binding: 'guardian.relationship',
      },
      {
        id: 'sys-g-phone',
        key: 'guardian_phone',
        type: 'phone',
        label: 'Phone',
        required: true,
        phone: { defaultDialCode: '+234' },
        system: true,
        binding: 'guardian.phone',
      },
      {
        id: 'sys-g-whatsapp',
        key: 'guardian_whatsapp',
        type: 'phone',
        label: 'WhatsApp (if different)',
        phone: { defaultDialCode: '+234' },
        system: true,
        binding: 'guardian.whatsapp',
      },
      {
        id: 'sys-g-email',
        key: 'guardian_email',
        type: 'short_text',
        label: 'Email',
        validation: { kind: 'email' },
        system: true,
        binding: 'guardian.email',
      },
      {
        id: 'sys-g-address',
        key: 'guardian_address',
        type: 'paragraph',
        label: 'Home address',
        validation: { maxLength: 240 },
        system: true,
        binding: 'guardian.address',
      },
    ],
  },
];

/** True once a definition carries the bound system sections (seeded or backfilled). */
export function definitionHasSystemIntake(def: unknown): boolean {
  const sections = (def as FormDefinitionSeed | null)?.sections;
  return Array.isArray(sections) && sections.some((s) => s?.system === true);
}

/**
 * Prepend the standard system sections to a definition that lacks them, preserving
 * the school's existing (custom) sections. Idempotent — a definition that already
 * has system sections is returned unchanged.
 */
export function withStandardIntake(
  def: FormDefinitionSeed,
): FormDefinitionSeed {
  if (definitionHasSystemIntake(def)) return def;
  return { ...def, sections: [...STANDARD_INTAKE_SECTIONS, ...def.sections] };
}
