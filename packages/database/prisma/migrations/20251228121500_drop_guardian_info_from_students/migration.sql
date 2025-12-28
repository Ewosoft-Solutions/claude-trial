-- Drop guardian_info column now that guardian links are relational
ALTER TABLE "student-management"."students" DROP COLUMN IF EXISTS "guardian_info";

