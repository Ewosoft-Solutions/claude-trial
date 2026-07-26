/* ============================================================
   names — display-name helpers (initials + title-casing)
   ============================================================ */

/** Two-letter initials from a display name (first + last word). */
export function deriveInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Title-case a display name — capitalise the first letter of each word,
 * preserving hyphens/apostrophes (e.g. "multi persona" → "Multi Persona",
 * "o'neil-smith" → "O'Neil-Smith").
 */
export function toTitleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep: string, ch: string) =>
      sep + ch.toUpperCase(),
    );
}
