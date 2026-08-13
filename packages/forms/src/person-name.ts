/**
 * The person-name rule (project convention).
 *
 * A person's name is ALWAYS captured and stored as structured parts — an
 * optional `title` (Mr / Mrs / Dr …), a `firstName`, an optional `middleName`,
 * and a `surname` — never as a single "full name" string. This holds for
 * students, guardians, staff, everyone, so any surface can read exactly the
 * part it needs without guessing whether the surname was typed first. Display
 * strings are always COMPOSED from the parts via {@link formatPersonName}.
 *
 * Shared by the web (forms + display) and the API (composing denormalised
 * display columns). Framework-agnostic — no Nest/React imports.
 */

export interface PersonNameParts {
  title?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
}

/** Common honorifics — suggestions for the title field. Free text is allowed. */
export const TITLE_SUGGESTIONS = [
  'Mr',
  'Mrs',
  'Miss',
  'Ms',
  'Master',
  'Dr',
  'Prof',
  'Engr',
  'Barr',
  'Rev',
  'Pastor',
  'Chief',
  'Alhaji',
  'Alhaja',
] as const;

/** Leading tokens recognised as a title when splitting a legacy full name. */
const KNOWN_TITLE_TOKENS = new Set(
  [
    'mr',
    'mrs',
    'miss',
    'ms',
    'master',
    'dr',
    'prof',
    'professor',
    'engr',
    'barr',
    'rev',
    'reverend',
    'pastor',
    'chief',
    'alhaji',
    'alhaja',
    'mallam',
    'otunba',
    'sir',
    'madam',
  ].map((t) => t.toLowerCase()),
);

/** Compose the full display name from parts, e.g. "Mr Ada Ngozi Okoro". */
export function formatPersonName(
  parts: PersonNameParts | null | undefined,
): string {
  if (!parts) return '';
  return [parts.title, parts.firstName, parts.middleName, parts.surname]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Compact "First Surname" form (no title / middle) for dense lists + avatars. */
export function formatShortName(
  parts: PersonNameParts | null | undefined,
): string {
  if (!parts) return '';
  return [parts.firstName, parts.surname]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Best-effort split of a legacy single-string name into parts: strip a leading
 * recognised title, then first token → first name, last token → surname, the
 * remainder → middle name. Inherently lossy for ambiguous names — used ONLY to
 * backfill pre-existing data; every NEW record is captured as structured parts.
 */
export function splitFullName(full: string | null | undefined): PersonNameParts {
  const tokens = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};

  let title: string | undefined;
  if (
    tokens.length > 1 &&
    KNOWN_TITLE_TOKENS.has(tokens[0]!.replace(/\.$/, '').toLowerCase())
  ) {
    title = tokens.shift()!.replace(/\.$/, '');
  }

  if (tokens.length === 1) return { title, firstName: tokens[0] };
  const firstName = tokens.shift()!;
  const surname = tokens.pop()!;
  const middleName = tokens.length ? tokens.join(' ') : undefined;
  return { title, firstName, middleName, surname };
}
