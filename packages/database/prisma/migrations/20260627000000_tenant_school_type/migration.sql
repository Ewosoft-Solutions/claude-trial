-- Add school_type column to tenants
-- Stores the institution category used for polymorphic nav/feature toggles (Step 6).
-- NULL = legacy row; treated as 'secondary' by the app until explicitly set.

ALTER TABLE "tenant"."tenants"
  ADD COLUMN "school_type" TEXT;
