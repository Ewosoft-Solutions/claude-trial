import { prisma } from '../../src/singleton.js';
import * as crypto from 'node:crypto';

/**
 * Mints a single-use setup token for the platform Architect.
 *
 * Why this exists as a separate command rather than part of `db:seed`:
 *
 * The seed creates the Architect with no password, so there is no standing
 * credential anywhere — not in the repo, not in the environment, not in a secret
 * store. The trade-off is that the account needs some one-time way to be
 * claimed, and that is this token.
 *
 * It is deliberately NOT minted during seeding. Seeding runs in CI and deploy
 * pipelines, and anything printed there lands in pipeline logs that are often
 * retained and widely readable. Minting on demand, from an operator's terminal,
 * at the moment the token is actually needed, keeps it out of that path
 * entirely.
 *
 * Properties of the token:
 *   - 32 bytes from a CSPRNG (crypto.randomBytes), hex encoded.
 *   - Only its SHA-256 hash is stored, so a database read yields nothing usable.
 *   - Expires in 30 minutes.
 *   - Single use: POST /auth/reset-password clears it on success.
 *
 * Exchange it with:
 *   POST /auth/reset-password  { "token": "<token>", "newPassword": "<chosen>" }
 */

const TOKEN_TTL_MINUTES = 30;

/**
 * Must match hashResetToken in apps/api/src/auth/services/password-reset.service.ts.
 *
 * Plain SHA-256, unsalted: the input is 32 CSPRNG bytes, so there is no
 * dictionary to attack, and the reset flow needs a direct lookup by hash.
 */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function main() {
  const email = process.env.SEED_ARCHITECT_EMAIL?.trim();

  if (!email) {
    throw new Error(
      '[bootstrap] SEED_ARCHITECT_EMAIL must be set so this knows which account to mint a token for.',
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new Error(
      `[bootstrap] No account found for ${email}. Run \`pnpm db:seed\` first.`,
    );
  }

  if (!user.isActive) {
    throw new Error(
      `[bootstrap] ${email} is not active. Refusing to mint a token for a disabled account.`,
    );
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashResetToken(token),
      passwordResetExpiresAt: expiresAt,
    },
  });

  // Minting replaces any previous token, so an accidental extra run invalidates
  // the earlier one rather than leaving two live.
  const alreadyClaimed = Boolean(user.passwordHash);

  console.log(`\n🔑 Single-use setup token for ${user.email}`);
  console.log(`\n   ${token}\n`);
  console.log(
    `   Expires:  ${expiresAt.toISOString()} (${TOKEN_TTL_MINUTES} minutes)`,
  );
  console.log(`   Exchange: POST /auth/reset-password`);
  console.log(
    `             { "token": "<above>", "newPassword": "<your choice>" }`,
  );
  console.log(
    `\n   Only the token's hash is stored, so this is the only copy — it cannot be`,
  );
  console.log(
    `   recovered from the database. Any previous token is now invalid.`,
  );

  if (alreadyClaimed) {
    console.warn(
      `\n   ⚠️  This account already has a password. Exchanging this token will`,
    );
    console.warn(
      `       replace it and revoke every active session for the account.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(
      '❌ Failed to mint token:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
