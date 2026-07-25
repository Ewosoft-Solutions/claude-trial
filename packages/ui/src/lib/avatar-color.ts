/* ============================================================
   avatar-color — deterministic neon avatar tints

   People avatars (like Teams/Slack) get a bright, consistent colour
   derived from a stable seed (email/name), drawn from the Aurora neon
   palette. Deterministic so the same person always renders the same
   colour across sessions and surfaces. White foreground is assumed.
   ============================================================ */

/** Bright neon palette aligned to the Aurora chart/status hues. */
export const NEON_AVATAR_PALETTE = [
  '#5b8cff', // blue
  '#8c5cff', // blurple
  '#ff6fae', // pink
  '#2ee6a6', // mint
  '#ffce5c', // amber
  '#ff8f5c', // coral
  '#4fd1ff', // cyan
  '#b06bff', // violet
  '#ff5c8a', // rose
  '#43e97b', // green
  '#f857a6', // magenta
  '#22d3ee', // sky
] as const;

/** Stable 32-bit hash of a seed string. */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Pick a neon colour for a person from a stable seed (email > name >
 * initials). Always returns a vivid hue regardless of any backend tint.
 */
export function neonAvatarColor(seed: string | undefined | null): string {
  const key = (seed ?? '').trim() || 'anon';
  return NEON_AVATAR_PALETTE[hashSeed(key) % NEON_AVATAR_PALETTE.length]!;
}
