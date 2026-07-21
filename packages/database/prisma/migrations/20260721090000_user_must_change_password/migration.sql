-- Forces rotation of assigned passwords.
--
-- The seeded platform Architect is created with a password the operator did
-- not choose (previously a value hardcoded in the repo). Nothing made that
-- password expire: the User model had no flag for it, and while
-- `password_changed_at` exists, PasswordService.isPasswordExpired was never
-- called from the login flow. Login now refuses to issue a token while this
-- column is true.
--
-- Defaults to false so every existing account is unaffected.
ALTER TABLE "user-management"."users"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
