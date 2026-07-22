import { prisma } from '../../src/singleton.js';
import * as crypto from 'node:crypto';

/**
 * Key rotation for encrypted health data.
 *
 * Rotating `ENCRYPTION_KEY` invalidates every value it protects, so the data
 * must be re-keyed in one pass: decrypt with the OLD key, re-encrypt with the
 * NEW key. Three representations move together on `HealthRecord`:
 *
 *   1. Narrative fields (bloodType/allergies/conditions/medications/notes) —
 *      enveloped AES (`enc:v1:…`).
 *   2. `healthFlagsEnc` — plain AES (no envelope), a JSON array of flag codes.
 *   3. `healthFlagIndex` — a keyed HMAC per code. This is the subtle one: the
 *      blind index is derived from the key, so a rotation that skips it leaves
 *      every flag SEARCH broken (queries HMAC under the new key; stored digests
 *      are under the old). Re-indexing is not optional.
 *
 * Idempotency is by design NOT assumed — this is a one-shot, run under a
 * maintenance window with a fresh backup. It re-keys every row unconditionally,
 * so running it twice with the same NEW key is fine but running it with the
 * wrong OLD key corrupts data. Guard rails below refuse an obviously wrong OLD
 * key by test-decrypting a sample first.
 *
 * The crypto is duplicated from EncryptionService / HealthFlagsService (a
 * database-package script cannot import Nest); it MUST stay in lock-step —
 * envelope prefix, AES layout, HMAC domain. A guard test in the API encryption
 * spec pins the wire format.
 *
 * Usage (MAINTENANCE WINDOW, with a current backup):
 *   OLD_ENCRYPTION_KEY="$OLD" NEW_ENCRYPTION_KEY="$NEW" DATABASE_URL="$URL" \
 *     pnpm --filter @workspace/database tsx prisma/scripts/rotate-health-encryption.ts
 */

const ENVELOPE_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const FLAG_INDEX_DOMAIN = 'health-flag';

const NARRATIVE_FIELDS = [
  'bloodType',
  'allergies',
  'conditions',
  'medications',
  'notes',
] as const;

/** Derive a 32-byte key exactly as EncryptionService does (see backfill script). */
function deriveKey(raw: string | undefined, label: string): Buffer {
  if (!raw) throw new Error(`${label} is required.`);
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === KEY_LENGTH) return decoded;
  return crypto.createHash('sha256').update(raw).digest();
}

function aesEncrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function aesDecrypt(packed: string, key: Buffer): string {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** Re-key an enveloped narrative value. Plaintext/absent values pass through. */
function reEnvelope(value: string | null, oldKey: Buffer, newKey: Buffer): string | null {
  if (value === null) return null;
  if (!value.startsWith(ENVELOPE_PREFIX)) {
    // Legacy plaintext (pre-encryption). Encrypt it fresh under the new key
    // rather than leaving it exposed.
    return ENVELOPE_PREFIX + aesEncrypt(value, newKey);
  }
  const plain = aesDecrypt(value.slice(ENVELOPE_PREFIX.length), oldKey);
  return ENVELOPE_PREFIX + aesEncrypt(plain, newKey);
}

function blindIndex(code: string, key: Buffer): string {
  return crypto
    .createHmac('sha256', key)
    .update(`${FLAG_INDEX_DOMAIN}:${code}`)
    .digest('hex');
}

async function main() {
  const oldKey = deriveKey(process.env.OLD_ENCRYPTION_KEY, 'OLD_ENCRYPTION_KEY');
  const newKey = deriveKey(process.env.NEW_ENCRYPTION_KEY, 'NEW_ENCRYPTION_KEY');

  if (oldKey.equals(newKey)) {
    throw new Error('OLD and NEW keys are identical — nothing to rotate.');
  }

  const records = await prisma.healthRecord.findMany({
    select: {
      id: true,
      bloodType: true,
      allergies: true,
      conditions: true,
      medications: true,
      notes: true,
      healthFlagsEnc: true,
    },
  });

  // Fail fast on a wrong OLD key: find the first enveloped value and test-decrypt
  // it, so we abort before touching a single row rather than corrupting the table.
  for (const r of records) {
    for (const f of NARRATIVE_FIELDS) {
      const v = r[f];
      if (v?.startsWith(ENVELOPE_PREFIX)) {
        try {
          aesDecrypt(v.slice(ENVELOPE_PREFIX.length), oldKey);
        } catch {
          throw new Error(
            'OLD_ENCRYPTION_KEY failed to decrypt existing data — refusing to ' +
              'proceed (a wrong old key would corrupt every row).',
          );
        }
        break;
      }
    }
  }

  let updated = 0;
  for (const r of records) {
    const patch: Record<string, unknown> = {};

    for (const f of NARRATIVE_FIELDS) {
      const v = r[f];
      if (v !== null) patch[f] = reEnvelope(v, oldKey, newKey);
    }

    if (r.healthFlagsEnc) {
      // Recover the codes under the old key, then rebuild both flag columns.
      const codes = JSON.parse(aesDecrypt(r.healthFlagsEnc, oldKey)) as string[];
      patch.healthFlagsEnc = aesEncrypt(JSON.stringify(codes), newKey);
      patch.healthFlagIndex = codes.map((c) => blindIndex(c, newKey));
    }

    if (Object.keys(patch).length > 0) {
      await prisma.healthRecord.update({ where: { id: r.id }, data: patch });
      updated++;
    }
  }

  console.log(
    `Health key rotation complete: re-keyed ${updated} of ${records.length} record(s). ` +
      'Update ENCRYPTION_KEY to the NEW key and restart the API.',
  );
}

main()
  .catch((err) => {
    console.error('Rotation failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
