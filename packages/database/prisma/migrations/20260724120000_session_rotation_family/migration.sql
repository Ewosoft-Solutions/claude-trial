-- Refresh-token rotation lineage on sessions: additive-only, no data loss.
-- The `sessions` table carries no tenant RLS policy (it is scoped at read time
-- via the `user_tenants` include — see authentication.service.refreshToken), so
-- these columns require no new RLS work.

-- AlterTable: rotation-family columns
ALTER TABLE "user-management"."sessions" ADD COLUMN     "family_id" TEXT,
ADD COLUMN     "rotated_at" TIMESTAMP(3),
ADD COLUMN     "replaced_by_id" TEXT;

-- Backfill: every pre-existing session becomes its own single-row family, so a
-- refresh token issued before this migration is treated as a valid, un-rotated
-- family of one rather than a familyless row the rotation logic can't chain.
UPDATE "user-management"."sessions" SET "family_id" = "id" WHERE "family_id" IS NULL;

-- CreateIndex: family lookup for rotation + reuse revocation
CREATE INDEX "sessions_family_id_idx" ON "user-management"."sessions"("family_id");
