-- Biometrics Phase 2b: allow a usernameless/discoverable passkey login
-- challenge to exist before the user is known (resolved from the assertion at
-- verify time). Additive, non-destructive: only relaxes a NOT NULL constraint.
ALTER TABLE "user-management"."mfa_challenges" ALTER COLUMN "user_id" DROP NOT NULL;
