-- ============================================================
-- Education-level spine + class arms (alignment step 1)
-- ============================================================
-- Purely additive columns on three existing academic-structure tables. No new
-- tables, so RLS is unchanged (the existing per-table tenant_isolation policies
-- already cover these rows).
--
--   stages.education_level   — the FIXED band: nursery | primary | secondary |
--                              tertiary | special
--   year_levels.level_code   — the FIXED national rung (PRY_3, JSS_1, L_200…).
--                              `name` stays the school's own word for it
--                              ("Basic 3" / "Year 3"), so a school renames
--                              freely while cross-school comparison, transfer
--                              and reporting key on the code.
--   streams.description      — what this ARM means in the school's words
--   streams.aliases          — other names the arm answers to (search/import)
--
-- Both new reference columns are NULLABLE so existing rows survive; a separate
-- backfill maps them by name and reports whatever it cannot match rather than
-- guessing. Idempotent throughout.
-- ============================================================

ALTER TABLE "academic-structure"."stages"
  ADD COLUMN IF NOT EXISTS "education_level" TEXT;

ALTER TABLE "academic-structure"."year_levels"
  ADD COLUMN IF NOT EXISTS "level_code" TEXT;

ALTER TABLE "academic-structure"."streams"
  ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "academic-structure"."streams"
  ADD COLUMN IF NOT EXISTS "aliases" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "stages_tenant_id_education_level_idx"
  ON "academic-structure"."stages" ("tenant_id", "education_level");

CREATE INDEX IF NOT EXISTS "year_levels_tenant_id_level_code_idx"
  ON "academic-structure"."year_levels" ("tenant_id", "level_code");
