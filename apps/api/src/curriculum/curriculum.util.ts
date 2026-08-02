/**
 * Canonicalize a subject/name for alias de-duplication: lowercase, unify "&"↔
 * "and", strip punctuation, collapse whitespace. So "Cultural & Creative Arts"
 * and "Cultural And Creative Arts" (C080 dirty-catalog duplicates) both map to
 * the same normalized key.
 */
export function normalizeName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
