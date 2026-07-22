/**
 * Health Flag Vocabulary
 *
 * A controlled vocabulary for the searchable layer of a student's medical
 * profile. The narrative fields (`allergies`, `conditions`, `medications`,
 * `notes`) stay free text and are encrypted at rest; these codes are what
 * queries actually run against.
 *
 * Why coded rather than free-text search: substring matching on prose is unsafe
 * for this use case. "peanut" / "peanuts" / "nut allergy" are the same clinical
 * fact and a `LIKE` query silently *misses* a pupil — the failure mode is a
 * child on a school trip whose allergy was recorded but not found. A closed
 * vocabulary makes the query correct rather than merely possible.
 *
 * Codes are `<category>:<slug>` and MUST be stable: they are the input to a
 * blind index, so renaming a code orphans every row indexed under the old one.
 * Add new codes freely; never repurpose an existing one.
 */

/** Allergies — the category most often queried before trips and catering. */
export enum HealthAllergyFlag {
  PEANUT = 'allergy:peanut',
  TREE_NUT = 'allergy:tree_nut',
  DAIRY = 'allergy:dairy',
  EGG = 'allergy:egg',
  SHELLFISH = 'allergy:shellfish',
  FISH = 'allergy:fish',
  GLUTEN = 'allergy:gluten',
  SOY = 'allergy:soy',
  SESAME = 'allergy:sesame',
  INSECT_STING = 'allergy:insect_sting',
  LATEX = 'allergy:latex',
  MEDICATION = 'allergy:medication',
  OTHER = 'allergy:other',
}

/** Ongoing conditions relevant to day-to-day care and emergency response. */
export enum HealthConditionFlag {
  ASTHMA = 'condition:asthma',
  ANAPHYLAXIS = 'condition:anaphylaxis',
  EPILEPSY = 'condition:epilepsy',
  DIABETES_TYPE_1 = 'condition:diabetes_type_1',
  DIABETES_TYPE_2 = 'condition:diabetes_type_2',
  SICKLE_CELL = 'condition:sickle_cell',
  CARDIAC = 'condition:cardiac',
  MIGRAINE = 'condition:migraine',
  VISUAL_IMPAIRMENT = 'condition:visual_impairment',
  HEARING_IMPAIRMENT = 'condition:hearing_impairment',
  MOBILITY = 'condition:mobility',
  OTHER = 'condition:other',
}

/**
 * Learning and behavioural support needs. Kept separate from `condition:` so a
 * "medical conditions" query does not sweep up support needs, which are usually
 * handled by different staff under different consent expectations.
 */
export enum HealthSupportFlag {
  ADHD = 'support:adhd',
  AUTISM = 'support:autism',
  DYSLEXIA = 'support:dyslexia',
  SPEECH_LANGUAGE = 'support:speech_language',
  OTHER = 'support:other',
}

/** Every valid flag code. */
export const HEALTH_FLAG_CODES: readonly string[] = [
  ...Object.values(HealthAllergyFlag),
  ...Object.values(HealthConditionFlag),
  ...Object.values(HealthSupportFlag),
];

export type HealthFlagCode = string;

/** Domain separator for the blind index — see `EncryptionService.blindIndex`. */
export const HEALTH_FLAG_INDEX_DOMAIN = 'health-flag';

/**
 * Normalize a code for storage/lookup. Applied on both the write and the query
 * side so that casing or stray whitespace can never split a match.
 */
export function normalizeHealthFlag(code: string): string {
  return code.trim().toLowerCase();
}

/** Whether a code belongs to the controlled vocabulary. */
export function isHealthFlagCode(code: string): boolean {
  return HEALTH_FLAG_CODES.includes(normalizeHealthFlag(code));
}
