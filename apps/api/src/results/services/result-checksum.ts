/**
 * WB4 · deterministic snapshot checksums (ADR-04 / anchor-ready ADR-13).
 *
 * A published result must be reproducible byte-for-byte, so the checksum is taken
 * over a CANONICAL serialization (object keys sorted recursively) — the same
 * logical snapshot always hashes to the same value regardless of key order.
 */
import { createHash } from 'node:crypto';

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Checksum of a canonicalized snapshot object. */
export function checksumOf(snapshot: unknown): string {
  return sha256Hex(canonicalize(snapshot));
}
