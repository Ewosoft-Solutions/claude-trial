/**
 * WB3 structured-intake — the admissions requirements framework.
 *
 * A school configures WHAT it collects and WHEN. Each requirement is a
 * document / typed field / measurement / fee, tagged to the COLLECTION STAGE at
 * which it is due, so collection is STAGGERED the way real admissions work:
 * some things at application, the rest after an offer is accepted (medicals,
 * uniform measurements, acceptance fee, more IDs). Some schools want everything
 * up-front; others defer — hence per-tenant, editable config with a sensible
 * default set seeded on demand.
 */

export const REQUIREMENT_TYPES = [
  'document', // an F4 file upload (passport photo, birth certificate…)
  'field', // a typed value captured against the application
  'measurement', // a set of measurements (e.g. uniform sizing)
  'fee', // a fee to be settled (application fee, acceptance fee…)
] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

/**
 * The point in the pipeline a requirement is collected at. `application` is
 * captured on submission; the rest are collected after the offer is made /
 * accepted / the pupil enrols — the staggered reality.
 */
export const COLLECT_STAGES = [
  'application',
  'offer',
  'acceptance',
  'enrolment',
] as const;
export type CollectStage = (typeof COLLECT_STAGES)[number];

export const REQUIREMENT_STATUSES = ['pending', 'provided', 'waived'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export interface RequirementSeed {
  key: string;
  label: string;
  type: RequirementType;
  collectStage: CollectStage;
  required: boolean;
  order: number;
  config?: Record<string, unknown>;
}

/**
 * The default Nigerian K-12 admissions checklist. Application-stage items are
 * the starter set a parent brings when applying; acceptance-stage items are the
 * post-offer collection (medical, immunization, uniform sizing, acceptance fee,
 * supporting IDs). A school edits, disables, reorders or re-stages any of these.
 */
export const DEFAULT_ADMISSION_REQUIREMENTS: RequirementSeed[] = [
  // ---- At application ----
  {
    key: 'passport_photo',
    label: 'Passport photograph',
    type: 'document',
    collectStage: 'application',
    required: true,
    order: 10,
    config: { accept: ['image/jpeg', 'image/png'] },
  },
  {
    key: 'birth_certificate',
    label: 'Birth certificate / age declaration',
    type: 'document',
    collectStage: 'application',
    required: true,
    order: 20,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
  {
    key: 'previous_report',
    label: 'Previous school report (transfers)',
    type: 'document',
    collectStage: 'application',
    required: false,
    order: 30,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
  {
    key: 'application_fee',
    label: 'Application / form fee',
    type: 'fee',
    collectStage: 'application',
    required: true,
    order: 40,
    // amount in minor units (kobo); ₦5,000. A prefill for billing — editable per
    // application, and a school can change or clear it on the template.
    config: { currency: 'NGN', amount: 500000 },
  },
  // ---- On acceptance (post-offer) ----
  {
    key: 'acceptance_fee',
    label: 'Acceptance fee',
    type: 'fee',
    collectStage: 'acceptance',
    required: true,
    order: 50,
    // amount in minor units (kobo); ₦50,000. Prefill for billing (editable).
    config: { currency: 'NGN', amount: 5000000 },
  },
  {
    key: 'medical_form',
    label: 'Completed medical / health form',
    type: 'document',
    collectStage: 'acceptance',
    required: true,
    order: 60,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
  {
    key: 'immunization_card',
    label: 'Immunization records',
    type: 'document',
    collectStage: 'acceptance',
    required: true,
    order: 70,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
  {
    key: 'uniform_measurement',
    label: 'Uniform measurements',
    type: 'measurement',
    collectStage: 'acceptance',
    required: true,
    order: 80,
    config: {
      fields: [
        { key: 'height_cm', label: 'Height (cm)' },
        { key: 'chest_cm', label: 'Chest (cm)' },
        { key: 'waist_cm', label: 'Waist (cm)' },
        { key: 'shoe_size', label: 'Shoe size' },
      ],
    },
  },
  {
    key: 'guardian_id',
    label: 'Parent / guardian ID',
    type: 'document',
    collectStage: 'acceptance',
    required: false,
    order: 90,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
  {
    key: 'origin_certificate',
    label: 'LGA / State of origin certificate',
    type: 'document',
    collectStage: 'acceptance',
    required: false,
    order: 100,
    config: { accept: ['image/jpeg', 'image/png', 'application/pdf'] },
  },
];

/** Relationship of a guardian to the applicant (structured, multi-guardian). */
export const GUARDIAN_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'sibling',
  'other',
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const APPLICANT_GENDERS = ['male', 'female', 'other'] as const;
export type ApplicantGender = (typeof APPLICANT_GENDERS)[number];
