-- Structured person names (the person-name rule — see @workspace/forms).
--
-- A person's name is captured + stored as PARTS (optional title + first /
-- middle / surname), never a single string. This migration:
--   * adds `title` to person.persons and "user-management".users, plus
--     `middle_name` to users (Person already had middle_name);
--   * adds the structured parts to the two admissions tables that stored a
--     single string, keeping the existing `applicant_name` / `full_name` as the
--     COMPOSED display column (kept in step by the API from now on);
--   * BACKFILLS the parts from those strings best-effort — strip a leading
--     title, first token -> first name, last -> surname, the rest -> middle.
--     Legacy rows may be imperfect; every NEW entry is captured structured.
--
-- All columns are additive, nullable and IF NOT EXISTS, and the backfill only
-- touches rows whose parts are still unset, so this migration is idempotent.

-- ---- additive columns -------------------------------------------------------
ALTER TABLE "person"."persons" ADD COLUMN IF NOT EXISTS "title" text;

ALTER TABLE "user-management"."users" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "user-management"."users" ADD COLUMN IF NOT EXISTS "middle_name" text;

ALTER TABLE "admissions"."admission_applications"
  ADD COLUMN IF NOT EXISTS "applicant_title" text,
  ADD COLUMN IF NOT EXISTS "applicant_first_name" text,
  ADD COLUMN IF NOT EXISTS "applicant_middle_name" text,
  ADD COLUMN IF NOT EXISTS "applicant_surname" text;

ALTER TABLE "admissions"."admission_guardians"
  ADD COLUMN IF NOT EXISTS "title" text,
  ADD COLUMN IF NOT EXISTS "first_name" text,
  ADD COLUMN IF NOT EXISTS "middle_name" text,
  ADD COLUMN IF NOT EXISTS "surname" text;

-- ---- best-effort split of the existing single-string names ------------------
-- Session-scoped helper (auto-dropped at end of the migration connection).
CREATE FUNCTION pg_temp._swe_split_name(v text)
RETURNS TABLE(title text, first_name text, middle_name text, surname text)
LANGUAGE plpgsql AS $fn$
DECLARE
  toks text[];
  n int;
BEGIN
  toks := array_remove(regexp_split_to_array(btrim(coalesce(v, '')), '\s+'), '');
  n := coalesce(array_length(toks, 1), 0);
  title := NULL; first_name := NULL; middle_name := NULL; surname := NULL;
  IF n = 0 THEN RETURN NEXT; RETURN; END IF;
  IF n > 1 AND lower(regexp_replace(toks[1], '\.$', '')) IN (
    'mr','mrs','miss','ms','master','dr','prof','professor','engr','barr','rev',
    'reverend','pastor','chief','alhaji','alhaja','mallam','otunba','sir','madam'
  ) THEN
    title := regexp_replace(toks[1], '\.$', '');
    toks := toks[2:];
    n := n - 1;
  END IF;
  IF n = 1 THEN first_name := toks[1]; RETURN NEXT; RETURN; END IF;
  first_name := toks[1];
  surname := toks[n];
  IF n > 2 THEN middle_name := array_to_string(toks[2:n-1], ' '); END IF;
  RETURN NEXT;
END
$fn$;

UPDATE "admissions"."admission_applications" a
SET applicant_title = s.title,
    applicant_first_name = s.first_name,
    applicant_middle_name = s.middle_name,
    applicant_surname = s.surname
FROM "admissions"."admission_applications" a2
CROSS JOIN LATERAL pg_temp._swe_split_name(a2.applicant_name) s
WHERE a.id = a2.id
  AND a.applicant_first_name IS NULL
  AND btrim(coalesce(a.applicant_name, '')) <> '';

UPDATE "admissions"."admission_guardians" g
SET title = s.title,
    first_name = s.first_name,
    middle_name = s.middle_name,
    surname = s.surname
FROM "admissions"."admission_guardians" g2
CROSS JOIN LATERAL pg_temp._swe_split_name(g2.full_name) s
WHERE g.id = g2.id
  AND g.first_name IS NULL
  AND btrim(coalesce(g.full_name, '')) <> '';
