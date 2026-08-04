-- ============================================================
-- Per-account UI preference: default table page size
-- ============================================================
-- Additive nullable column on user-management.users. NULL = not set → the app
-- default (10) applies. A cookie mirrors this locally for a fast first paint,
-- but this column is the cross-device source of truth (set via
-- PATCH /auth/preferences). The `users` table already has RLS; a nullable
-- column addition needs no policy change.
-- ============================================================

ALTER TABLE "user-management"."users"
  ADD COLUMN IF NOT EXISTS "default_page_size" INTEGER;
