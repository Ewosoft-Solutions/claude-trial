-- The existing session_timeout column was previously descriptive only. It is
-- now the effective per-tenant inactivity timeout, with a 15-minute default.
ALTER TABLE "security-policy"."school_security_policies"
  ALTER COLUMN "session_timeout" SET DEFAULT 15;

-- No tenant could have relied on the old value because it was not enforced.
-- Normalize Basic-tier rows that still carry the old implicit default while
-- preserving explicit Enhanced/Maximum values and any custom values.
UPDATE "security-policy"."school_security_policies"
SET "session_timeout" = 15
WHERE "policy_tier" = 'basic' AND "session_timeout" = 30;
