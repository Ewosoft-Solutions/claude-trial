/**
 * The fixed education-level spine (Nigerian structure as the basis).
 *
 * Two ideas live here, and keeping them apart is the whole point:
 *
 *   levelCode  — a FIXED, machine-readable rung on the national ladder
 *                (`PRY_3`, `JSS_1`, `L_200`). Never shown to a user, never
 *                edited by a school. Anything that has to compare, transfer,
 *                benchmark or report across schools keys on this.
 *   name       — what THIS school calls that rung. Surulere's `PRY_3` is
 *                "Basic 3"; Lekki's is "Year 3". Tenant-owned, freely edited,
 *                and the only thing a user ever sees.
 *
 * Before this existed, two schools' "Primary 3" were unrelated free-text rows,
 * so nothing could line them up — a transfer could not map a level and no
 * cross-school report was possible. The codes fix that without taking naming
 * away from schools.
 *
 * Shared from `@workspace/database` because the seed, the API and the onboarding
 * flow must all agree on one ladder.
 */

// ---------------------------------------------------------------- bands

export const EDUCATION_LEVELS = [
  'nursery',
  'primary',
  'secondary',
  'tertiary',
  'special',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export function isEducationLevel(value: unknown): value is EducationLevel {
  return (
    typeof value === 'string' &&
    (EDUCATION_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * `special` is the escape hatch: vocational, skills, remedial, or an
 * organisation running training that is not a school ladder at all. It has one
 * rung (`SPECIAL`) on purpose — its structure comes from the school's own
 * stages, not from a national ladder.
 */
export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  nursery: 'Nursery / pre-primary',
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
  special: 'Special / vocational',
};

// ---------------------------------------------------------------- rungs

export const LEVEL_CODES = [
  'NURSERY_1',
  'NURSERY_2',
  'NURSERY_3',
  'PRY_1',
  'PRY_2',
  'PRY_3',
  'PRY_4',
  'PRY_5',
  'PRY_6',
  'JSS_1',
  'JSS_2',
  'JSS_3',
  'SSS_1',
  'SSS_2',
  'SSS_3',
  'L_100',
  'L_200',
  'L_300',
  'L_400',
  'L_500',
  'L_600',
  'SPECIAL',
] as const;

export type LevelCode = (typeof LEVEL_CODES)[number];

export function isLevelCode(value: unknown): value is LevelCode {
  return (
    typeof value === 'string' &&
    (LEVEL_CODES as readonly string[]).includes(value)
  );
}

export interface LevelSpineEntry {
  code: LevelCode;
  educationLevel: EducationLevel;
  /** Ladder position across the WHOLE spine, so sorting works across bands. */
  order: number;
  /** The national name — used as a school's starting label, then renamed. */
  canonicalName: string;
  /**
   * Spellings seen in the wild, used to map existing free-text levels onto a
   * code. Nigeria's UBE "Basic 1–9" spans primary and junior secondary, so
   * Basic 7 correctly resolves to JSS_1, not a primary rung.
   */
  aliases: string[];
}

function entry(
  code: LevelCode,
  educationLevel: EducationLevel,
  order: number,
  canonicalName: string,
  aliases: string[],
): LevelSpineEntry {
  return { code, educationLevel, order, canonicalName, aliases };
}

export const LEVEL_SPINE: readonly LevelSpineEntry[] = [
  entry('NURSERY_1', 'nursery', 10, 'Nursery 1', [
    'nur 1',
    'creche',
    'pre-nursery',
  ]),
  entry('NURSERY_2', 'nursery', 20, 'Nursery 2', ['nur 2']),
  entry('NURSERY_3', 'nursery', 30, 'Nursery 3', [
    'nur 3',
    'reception',
    'kindergarten',
  ]),
  entry('PRY_1', 'primary', 110, 'Primary 1', [
    'pry 1',
    'p1',
    'basic 1',
    'year 1',
    'class 1',
    'grade 1',
    'std 1',
  ]),
  entry('PRY_2', 'primary', 120, 'Primary 2', [
    'pry 2',
    'p2',
    'basic 2',
    'year 2',
    'class 2',
    'grade 2',
    'std 2',
  ]),
  entry('PRY_3', 'primary', 130, 'Primary 3', [
    'pry 3',
    'p3',
    'basic 3',
    'year 3',
    'class 3',
    'grade 3',
    'std 3',
  ]),
  entry('PRY_4', 'primary', 140, 'Primary 4', [
    'pry 4',
    'p4',
    'basic 4',
    'year 4',
    'class 4',
    'grade 4',
    'std 4',
  ]),
  entry('PRY_5', 'primary', 150, 'Primary 5', [
    'pry 5',
    'p5',
    'basic 5',
    'year 5',
    'class 5',
    'grade 5',
    'std 5',
  ]),
  entry('PRY_6', 'primary', 160, 'Primary 6', [
    'pry 6',
    'p6',
    'basic 6',
    'year 6',
    'class 6',
    'grade 6',
    'std 6',
  ]),
  entry('JSS_1', 'secondary', 210, 'JSS 1', [
    'js 1',
    'basic 7',
    'year 7',
    'grade 7',
    'form 1',
    'junior secondary 1',
  ]),
  entry('JSS_2', 'secondary', 220, 'JSS 2', [
    'js 2',
    'basic 8',
    'year 8',
    'grade 8',
    'form 2',
    'junior secondary 2',
  ]),
  entry('JSS_3', 'secondary', 230, 'JSS 3', [
    'js 3',
    'basic 9',
    'year 9',
    'grade 9',
    'form 3',
    'junior secondary 3',
  ]),
  entry('SSS_1', 'secondary', 240, 'SSS 1', [
    'ss 1',
    'year 10',
    'grade 10',
    'form 4',
    'senior secondary 1',
  ]),
  entry('SSS_2', 'secondary', 250, 'SSS 2', [
    'ss 2',
    'year 11',
    'grade 11',
    'form 5',
    'senior secondary 2',
  ]),
  entry('SSS_3', 'secondary', 260, 'SSS 3', [
    'ss 3',
    'year 12',
    'grade 12',
    'form 6',
    'senior secondary 3',
  ]),
  entry('L_100', 'tertiary', 310, '100 Level', [
    '100l',
    'year 1 tertiary',
    'first year',
  ]),
  entry('L_200', 'tertiary', 320, '200 Level', ['200l', 'second year']),
  entry('L_300', 'tertiary', 330, '300 Level', ['300l', 'third year']),
  entry('L_400', 'tertiary', 340, '400 Level', ['400l', 'fourth year']),
  entry('L_500', 'tertiary', 350, '500 Level', ['500l', 'fifth year']),
  entry('L_600', 'tertiary', 360, '600 Level', ['600l', 'sixth year']),
  entry('SPECIAL', 'special', 410, 'Special programme', [
    'spec',
    'vocational',
    'custom',
  ]),
];

const SPINE_BY_CODE = new Map<LevelCode, LevelSpineEntry>(
  LEVEL_SPINE.map((e) => [e.code, e]),
);

export function levelSpineEntry(code: LevelCode): LevelSpineEntry {
  const found = SPINE_BY_CODE.get(code);
  if (!found) throw new Error(`Unknown level code: ${code}`);
  return found;
}

export function educationLevelOf(code: LevelCode): EducationLevel {
  return levelSpineEntry(code).educationLevel;
}

export function levelCodesFor(band: EducationLevel): LevelCode[] {
  return LEVEL_SPINE.filter((e) => e.educationLevel === band).map(
    (e) => e.code,
  );
}

// ---------------------------------------------------------------- matching

/** Fold a label for tolerant comparison: "Basic  3" / "basic-3" → "basic3". */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .trim();
}

const MATCH_INDEX = new Map<string, LevelCode>();
for (const e of LEVEL_SPINE) {
  // Later entries must not silently overwrite earlier ones — an alias that
  // resolves to two rungs is a taxonomy bug, so keep the first and ignore
  // repeats rather than letting order decide.
  for (const key of [e.code, e.canonicalName, ...e.aliases]) {
    const folded = fold(key);
    if (!MATCH_INDEX.has(folded)) MATCH_INDEX.set(folded, e.code);
  }
}

/**
 * Best-effort map of a school's own level name onto a fixed code, for
 * backfilling existing free-text rows. Returns null rather than guessing — an
 * unmatched level is reported for a human to map, never assigned at random.
 */
export function matchLevelCode(
  text: string | null | undefined,
): LevelCode | null {
  if (!text) return null;
  return MATCH_INDEX.get(fold(text)) ?? null;
}

// ---------------------------------------------------------------- ladders

export interface LadderStage {
  educationLevel: EducationLevel;
  /** Default stage name; the school renames it freely afterwards. */
  name: string;
  code: string;
  levels: LevelCode[];
}

const STAGE_DEFAULTS: Record<EducationLevel, { name: string; code: string }> = {
  nursery: { name: 'Nursery', code: 'NUR' },
  primary: { name: 'Primary', code: 'PRY' },
  secondary: { name: 'Secondary', code: 'SEC' },
  tertiary: { name: 'Undergraduate', code: 'UG' },
  special: { name: 'Special programme', code: 'SPEC' },
};

export function ladderForBands(bands: EducationLevel[]): LadderStage[] {
  return bands.map((band) => ({
    educationLevel: band,
    name: STAGE_DEFAULTS[band].name,
    code: STAGE_DEFAULTS[band].code,
    levels: levelCodesFor(band),
  }));
}

/**
 * The bands a school type starts with. Deliberately EXACT — a school called
 * "primary" gets primary rungs only, and adds nursery itself if it runs one.
 * Inventing rows a school did not ask for is worse than one extra click.
 */
export function bandsForSchoolType(
  schoolType: string | null | undefined,
): EducationLevel[] {
  switch (schoolType) {
    case 'nursery':
      return ['nursery'];
    case 'primary':
      return ['primary'];
    case 'secondary':
      return ['secondary'];
    case 'university':
    case 'college':
      return ['tertiary'];
    case 'training_institute':
    case 'organization':
      return ['special'];
    default:
      // Unknown or unset school type: primary is the commonest Nigerian case,
      // and the school can add or remove bands from the structure page.
      return ['primary'];
  }
}

export function defaultLadderFor(
  schoolType: string | null | undefined,
): LadderStage[] {
  return ladderForBands(bandsForSchoolType(schoolType));
}
