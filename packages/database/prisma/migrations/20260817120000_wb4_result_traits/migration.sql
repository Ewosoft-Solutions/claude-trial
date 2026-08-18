-- ============================================================
-- WB4-3 · Affective / psychomotor trait rubric (ADR-04)
-- ============================================================
-- Two new tenant-owned tables in the academic-structure schema plus one additive
-- column on the per-student publication snapshot:
--
--   result_traits              — a cycle's behavioural rubric rows (affective |
--                                psychomotor), rated on an ordinal 1..max_rating
--                                scale; never part of the academic total
--   result_trait_ratings       — one student's rating for one trait (unrated ≠
--                                the lowest rating — an unrated trait is absent)
--   published_student_results.traits — the behavioural snapshot captured at
--                                publish, so a report card reproduces byte-for-
--                                byte from the publication alone
--
-- External references are DB-level FKs (no Prisma relation, F6 convention),
-- validated in-service. RLS: ENABLE + FORCE + PERMISSIVE tenant_isolation
-- (own + platform) on both new tables. All additive + idempotent.
-- ============================================================

-- ---- academic-structure.result_traits -----------------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_traits" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "cycle_id"   TEXT NOT NULL,
    "domain"     TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "max_rating" INTEGER NOT NULL DEFAULT 5,
    "order"      INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_traits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_traits_cycle_id_key_key" ON "academic-structure"."result_traits"("cycle_id", "key");
CREATE INDEX IF NOT EXISTS "result_traits_tenant_id_idx" ON "academic-structure"."result_traits"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_traits_cycle_id_idx" ON "academic-structure"."result_traits"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_traits_cycle_id_domain_idx" ON "academic-structure"."result_traits"("cycle_id", "domain");

-- ---- academic-structure.result_trait_ratings ----------------------------
CREATE TABLE IF NOT EXISTS "academic-structure"."result_trait_ratings" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "cycle_id"   TEXT NOT NULL,
    "trait_id"   TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "rating"     INTEGER,
    "rated_by"   TEXT,
    "rated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "result_trait_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "result_trait_ratings_cycle_id_student_id_trait_id_key" ON "academic-structure"."result_trait_ratings"("cycle_id", "student_id", "trait_id");
CREATE INDEX IF NOT EXISTS "result_trait_ratings_tenant_id_idx" ON "academic-structure"."result_trait_ratings"("tenant_id");
CREATE INDEX IF NOT EXISTS "result_trait_ratings_cycle_id_idx" ON "academic-structure"."result_trait_ratings"("cycle_id");
CREATE INDEX IF NOT EXISTS "result_trait_ratings_cycle_id_student_id_idx" ON "academic-structure"."result_trait_ratings"("cycle_id", "student_id");
CREATE INDEX IF NOT EXISTS "result_trait_ratings_student_id_idx" ON "academic-structure"."result_trait_ratings"("student_id");

-- ---- published_student_results.traits (additive) ------------------------
ALTER TABLE "academic-structure"."published_student_results"
  ADD COLUMN IF NOT EXISTS "traits" JSONB;

-- ---- foreign keys -------------------------------------------------------
DO $fks$
BEGIN
  -- result_traits
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_traits_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_traits" ADD CONSTRAINT "result_traits_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_traits_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_traits" ADD CONSTRAINT "result_traits_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- result_trait_ratings
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_trait_ratings_tenant_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_trait_ratings" ADD CONSTRAINT "result_trait_ratings_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_trait_ratings_cycle_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_trait_ratings" ADD CONSTRAINT "result_trait_ratings_cycle_id_fkey"
      FOREIGN KEY ("cycle_id") REFERENCES "academic-structure"."result_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_trait_ratings_trait_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_trait_ratings" ADD CONSTRAINT "result_trait_ratings_trait_id_fkey"
      FOREIGN KEY ("trait_id") REFERENCES "academic-structure"."result_traits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'result_trait_ratings_student_id_fkey') THEN
    ALTER TABLE "academic-structure"."result_trait_ratings" ADD CONSTRAINT "result_trait_ratings_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- RLS + grants (own + platform tenant isolation) ---------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['academic-structure','result_traits'],
    ARRAY['academic-structure','result_trait_ratings']
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
