/**
 * Chat session titles.
 *
 * History reads better as a concise label than as the raw first question. The
 * assistant piggybacks a short title onto its first reply — a trailing
 * `#title:` line the system prompt asks for — so we get a real summary at no
 * extra API call (a handful of output tokens, once per conversation).
 *
 * `extractSessionTitle` pulls that line out of the model text and returns the
 * body with it removed (so it never shows in the answer). `deriveSessionTitle`
 * is the heuristic fallback: it seeds the session's initial title and stands in
 * whenever the model omits the line.
 */

/** Pull an inline/trailing `#title:` line out of model text, if present. */
export function extractSessionTitle(text: string): {
  title: string | null;
  body: string;
} {
  const match = text.match(/(?:^|\n)[ \t]*#title:[ \t]*([^\n]+)/i);
  if (!match || match.index === undefined) return { title: null, body: text };
  const title = cleanTitle(match[1] ?? '');
  const body = (
    text.slice(0, match.index) + text.slice(match.index + match[0].length)
  ).trim();
  return { title: title || null, body };
}

/** Heuristic title from the user's message (initial + fallback). */
export function deriveSessionTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';
  const firstSentence = cleaned.split(/(?<=[.?!])\s/)[0] ?? cleaned;
  const base = firstSentence.length >= 12 ? firstSentence : cleaned;
  return cleanTitle(base) || 'New conversation';
}

/** Collapse whitespace, cap at ~60 chars on a word boundary, tidy ends. */
function cleanTitle(value: string): string {
  let title = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'#\s]+/, '');
  if (title.length > 60) {
    title = `${title.slice(0, 60).replace(/\s+\S*$/, '').trimEnd()}…`;
  }
  title = title.replace(/[?!.,;:]+$/, '').trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}
