/**
 * Standard Bearer token extraction for the `Authorization` header.
 *
 * Tolerant of common copy/paste mistakes — most notably pasting a token
 * that already includes a `Bearer ` prefix into a client that adds its
 * own (e.g. Swagger UI's `http`/`bearer` Authorize dialog), which would
 * otherwise produce `Authorization: Bearer Bearer <token>` and silently
 * extract the literal word "Bearer" as the token.
 *
 * - Scheme match is case-insensitive ("bearer", "Bearer", "BEARER").
 * - Any number of repeated/duplicated "Bearer " prefixes on the token
 *   portion are stripped.
 * - Surrounding whitespace is trimmed.
 *
 * Returns `undefined` if no usable token can be extracted.
 */
export function extractBearerToken(authorizationHeader: string | undefined | null): string | undefined {
  if (!authorizationHeader) return undefined;

  const trimmed = authorizationHeader.trim();
  const match = /^bearer\s+(.+)$/i.exec(trimmed);
  if (!match) return undefined;

  // Strip any further repeated "Bearer " prefixes left on the token itself
  // (handles "Bearer Bearer <token>", "Bearer bearer  <token>", etc.).
  let token = match[1].trim();
  let stripped = /^bearer\s+(.+)$/i.exec(token);
  while (stripped) {
    token = stripped[1].trim();
    stripped = /^bearer\s+(.+)$/i.exec(token);
  }

  return token.length > 0 ? token : undefined;
}
