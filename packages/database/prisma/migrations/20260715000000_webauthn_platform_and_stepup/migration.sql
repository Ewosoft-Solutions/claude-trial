-- Biometrics/passkeys Phase 0 (P0-1, P0-2): additive-only, no data loss.
-- Columns are added to existing RLS-protected tables and inherit their
-- policies, so no new RLS work is required here.

-- P0-1: platform-authenticator (passkey/biometric) metadata on mfa_methods
-- AlterTable
ALTER TABLE "user-management"."mfa_methods" ADD COLUMN     "webauthn_attachment" TEXT,
ADD COLUMN     "webauthn_aaguid" TEXT,
ADD COLUMN     "webauthn_backed_up" BOOLEAN,
ADD COLUMN     "webauthn_transports" TEXT[];

-- P0-2: single-use step-up marker on mfa_challenges
-- AlterTable
ALTER TABLE "user-management"."mfa_challenges" ADD COLUMN     "consumed_at" TIMESTAMP(3);

-- P0-2: step-up lookup index (user + operation + verified)
-- CreateIndex
CREATE INDEX "mfa_challenges_user_id_operation_verified_idx" ON "user-management"."mfa_challenges"("user_id", "operation", "verified");
