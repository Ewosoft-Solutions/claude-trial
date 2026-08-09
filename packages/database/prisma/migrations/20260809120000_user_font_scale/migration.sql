-- ============================================================
-- Per-account UI preference: text-size (font-scale)
-- ============================================================
-- Additive nullable column on user-management.users. NULL = not set → the app
-- default (1.0) applies. The value is a font-scale multiplier (0.9–1.1) the web
-- applies to every font token so text scales as a group without zooming the
-- layout. A cookie mirrors this locally for a fast first paint, but this column
-- is the cross-device source of truth (set via PATCH /auth/preferences). The
-- `users` table already has RLS; a nullable column addition needs no policy
-- change.
-- ============================================================

ALTER TABLE "user-management"."users"
  ADD COLUMN IF NOT EXISTS "font_scale" DOUBLE PRECISION;
