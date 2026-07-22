import { prisma } from '../../src/singleton.js';
import * as crypto from 'node:crypto';

/**
 * Backfill: encrypt existing plaintext health-record narrative fields.
 *
 * 0.5.7c turned on at-rest encryption for the free-text medical fields on
 * `HealthRecord`. New writes are enveloped (`enc:v1:…`) by the API; rows written
 * before the cutover are still plaintext. The read path tolerates both, so the
 * app keeps working — but a plaintext row in a leaked backup is exactly what the
 * encryption exists to prevent. This rewrites those rows.
 *
 * Idempotent: rows already carrying the `enc:v1:` envelope are skipped, so it is
 * safe to run more than once (e.g. after a partial run).
 *
 * The envelope format and AES-256-GCM parameters are duplicated here rather than
 * imported, because this is a database-package script with no access to the Nest
 * EncryptionService. They MUST stay in lock-step with
 * apps/api/src/common/encryption/encryption.service.ts — same algorithm, same
 * iv/tag layout, same `enc:v1:` prefix — or the API will fail to decrypt what
 * this writes. There is a matching guard test in the API encryption spec.
 *
 * Usage (never against production without a current backup):
 *   ENCRYPTION_KEY="$KEY" DATABASE_URL="$URL" \
 *     pnpm --filter @workspace/database tsx prisma/scripts/backfill-health-encryption.ts
 */

const ENVELOPE_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

const NARRATIVE_FIELDS = [
  'bloodType',
  'allergies',
  'conditions',
  'medications',
  'notes',
] as const;

/**
 * Derive the 32-byte key EXACTLY as EncryptionService does, so ciphertext this
 * script writes is decryptable by the API:
 *   - a valid 32-byte base64 key is used as-is (the production shape);
 *   - any other string is SHA-256'd to 32 bytes (the dev/test fallback).
 * If these two derivations ever diverge, the API cannot read backfilled rows.
 */
function resolveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is required — the backfill cannot encrypt without the ' +
        'same key the API uses. Aborting rather than writing unreadable data.',
    );
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === KEY_LENGTH) return decoded;
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptEnveloped(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Layout mirrors EncryptionService.encrypt: iv + tag + ciphertext, base64.
  const packed = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return ENVELOPE_PREFIX + packed;
}

async function main() {
  const key = resolveKey();
  const records = await prisma.healthRecord.findMany({
    select: {
      id: true,
      bloodType: true,
      allergies: true,
      conditions: true,
      medications: true,
      notes: true,
    },
  });

  let scanned = 0;
  let updated = 0;

  for (const record of records) {
    scanned++;
    const patch: Record<string, string> = {};

    for (const field of NARRATIVE_FIELDS) {
      const value = (record as Record<string, string | null>)[field];
      if (value && !value.startsWith(ENVELOPE_PREFIX)) {
        patch[field] = encryptEnveloped(value, key);
      }
    }

    if (Object.keys(patch).length > 0) {
      await prisma.healthRecord.update({ where: { id: record.id }, data: patch });
      updated++;
    }
  }

  console.log(
    `Health encryption backfill complete: ${updated} of ${scanned} record(s) encrypted ` +
      `(${scanned - updated} already enveloped or empty).`,
  );
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
