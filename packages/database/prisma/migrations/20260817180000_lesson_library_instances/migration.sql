-- ============================================================
-- Lesson library + per-section instances (alignment step 2)
-- ============================================================
-- The owner's decision was BOTH: author a lesson once in a library, and let
-- each class instantiate it. So:
--
--   lessons               becomes the LIBRARY TEMPLATE — anchored to an F6
--                         curriculum subject instead of a legacy Class. Its
--                         materials, chunks and embeddings are untouched, which
--                         is the point of repurposing rather than replacing:
--                         nothing needs re-extracting or re-embedding.
--   lesson_chapters       groups library lessons under a curriculum subject.
--   lesson_instances      what a PARTICULAR class is taught — one library
--                         lesson against one subject_offering, carrying the
--                         per-class reality (schedule, taught/skipped, local
--                         notes, title override).
--
-- `lessons.class_id` becomes NULLABLE and is deprecated rather than dropped, so
-- existing rows survive and the backfill can move them at its own pace. The
-- column goes when nothing reads it.
--
-- Additive + idempotent. The two new tables get the standard own+platform RLS
-- and the app_runtime grant.
-- ============================================================

-- ---- lessons: library anchor + tile art, legacy pointer relaxed -----------
ALTER TABLE "learning"."lessons"
  ADD COLUMN IF NOT EXISTS "curriculum_subject_id" TEXT;

ALTER TABLE "learning"."lessons"
  ADD COLUMN IF NOT EXISTS "chapter_id" TEXT;

ALTER TABLE "learning"."lessons"
  ADD COLUMN IF NOT EXISTS "thumbnail_key" TEXT;

ALTER TABLE "learning"."lessons"
  ALTER COLUMN "class_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "lessons_tenant_id_curriculum_subject_id_idx"
  ON "learning"."lessons" ("tenant_id", "curriculum_subject_id");

CREATE INDEX IF NOT EXISTS "lessons_tenant_id_chapter_id_idx"
  ON "learning"."lessons" ("tenant_id", "chapter_id");

-- ---- learning.lesson_chapters --------------------------------------------
CREATE TABLE IF NOT EXISTS "learning"."lesson_chapters" (
    "id"                    TEXT NOT NULL,
    "tenant_id"             TEXT NOT NULL,
    "curriculum_subject_id" TEXT NOT NULL,
    "title"                 TEXT NOT NULL,
    "description"           TEXT,
    "thumbnail_key"         TEXT,
    "order"                 INTEGER NOT NULL DEFAULT 0,
    "status"                TEXT NOT NULL DEFAULT 'active',
    "created_by"            TEXT,
    "updated_by"            TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lesson_chapters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "lesson_chapters_tenant_id_idx" ON "learning"."lesson_chapters"("tenant_id");
CREATE INDEX IF NOT EXISTS "lesson_chapters_tenant_id_curriculum_subject_id_idx" ON "learning"."lesson_chapters"("tenant_id", "curriculum_subject_id");
CREATE INDEX IF NOT EXISTS "lesson_chapters_tenant_id_status_idx" ON "learning"."lesson_chapters"("tenant_id", "status");

-- ---- learning.lesson_instances -------------------------------------------
CREATE TABLE IF NOT EXISTS "learning"."lesson_instances" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "lesson_id"           TEXT NOT NULL,
    "subject_offering_id" TEXT NOT NULL,
    "title_override"      TEXT,
    "notes"               TEXT,
    "scheduled_for"       TIMESTAMP(3),
    "taught_at"           TIMESTAMP(3),
    "status"              TEXT NOT NULL DEFAULT 'planned',
    "order"               INTEGER NOT NULL DEFAULT 0,
    "created_by"          TEXT,
    "updated_by"          TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lesson_instances_pkey" PRIMARY KEY ("id")
);
-- Instantiating the same library lesson twice for one class is a mistake, not a
-- second copy.
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_instances_lesson_id_subject_offering_id_key"
  ON "learning"."lesson_instances"("lesson_id", "subject_offering_id");
CREATE INDEX IF NOT EXISTS "lesson_instances_tenant_id_idx" ON "learning"."lesson_instances"("tenant_id");
CREATE INDEX IF NOT EXISTS "lesson_instances_tenant_id_subject_offering_id_idx" ON "learning"."lesson_instances"("tenant_id", "subject_offering_id");
CREATE INDEX IF NOT EXISTS "lesson_instances_tenant_id_status_idx" ON "learning"."lesson_instances"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "lesson_instances_lesson_id_idx" ON "learning"."lesson_instances"("lesson_id");

-- ---- foreign keys --------------------------------------------------------
DO $fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_chapters_tenant_id_fkey') THEN
    ALTER TABLE "learning"."lesson_chapters" ADD CONSTRAINT "lesson_chapters_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_chapter_id_fkey') THEN
    ALTER TABLE "learning"."lessons" ADD CONSTRAINT "lessons_chapter_id_fkey"
      FOREIGN KEY ("chapter_id") REFERENCES "learning"."lesson_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_instances_tenant_id_fkey') THEN
    ALTER TABLE "learning"."lesson_instances" ADD CONSTRAINT "lesson_instances_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_instances_lesson_id_fkey') THEN
    ALTER TABLE "learning"."lesson_instances" ADD CONSTRAINT "lesson_instances_lesson_id_fkey"
      FOREIGN KEY ("lesson_id") REFERENCES "learning"."lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- subject_offering_id is a DB-level FK with no Prisma relation (WB2
  -- convention), so this module stays decoupled from academic-structure.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_instances_subject_offering_id_fkey') THEN
    ALTER TABLE "learning"."lesson_instances" ADD CONSTRAINT "lesson_instances_subject_offering_id_fkey"
      FOREIGN KEY ("subject_offering_id") REFERENCES "academic-structure"."subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['learning','lesson_chapters'],
    ARRAY['learning','lesson_instances']
  ];
  i int;
  sch text;
  tbl text;
BEGIN
  FOR i IN 1 .. array_length(tables, 1) LOOP
    sch := tables[i][1];
    tbl := tables[i][2];
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I.%I', sch, tbl);
    EXECUTE format($p$
      CREATE POLICY "tenant_isolation" ON %I.%I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, sch, tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', sch, tbl);
  END LOOP;
END
$rls$;
