-- ============================================================
-- Person / identity / profile / membership (F1) — ADR-01
-- ============================================================
-- Adds the "person" schema: a tenant-scoped human anchor that separates
--   human  ≠  account (User/UserTenant)  ≠  employment/enrollment,
-- so a staff-member-who-is-also-a-guardian is ONE identity with many profiles,
-- and dedup becomes tractable (stable source key + merge with history).
--
-- Additive only: existing rows are never destructively changed. `students`
-- gains a nullable `person_id`; a back-fill anchors every existing student and
-- guardian to a Person. RLS is enabled on the new tables AFTER the back-fill so
-- the migration owner (RLS-subject under FORCE RLS on Render) can seed them; the
-- one write to the already-RLS `students` table runs inside a DO block that sets
-- the audited platform GUC (per the two-statement-silently-updates-0-rows
-- gotcha, migration 20260724090000).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "person";

-- ---- person.persons -------------------------------------------------

CREATE TABLE "person"."persons" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "first_name"       TEXT NOT NULL,
  "last_name"        TEXT NOT NULL,
  "middle_name"      TEXT,
  "preferred_name"   TEXT,
  "date_of_birth"    DATE,
  "gender"           TEXT,
  "nationality"      TEXT,
  "state_of_origin"  TEXT,
  "lga_of_origin"    TEXT,
  "religion"         TEXT,
  "attributes"       JSONB DEFAULT '{}',
  "user_tenant_id"   TEXT,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "merged_into_id"   TEXT,
  "source_system"    TEXT,
  "source_id"        TEXT,
  "created_by"       TEXT,
  "updated_by"       TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "persons_user_tenant_id_key" ON "person"."persons"("user_tenant_id");
-- Idempotent migration upsert key (ADR-09): a re-run with the same source ref
-- updates rather than duplicating. NULLs are distinct, so non-migrated Persons
-- never collide.
CREATE UNIQUE INDEX "persons_tenant_source_key" ON "person"."persons"("tenant_id", "source_system", "source_id");
CREATE INDEX "persons_tenant_id_idx" ON "person"."persons"("tenant_id");
CREATE INDEX "persons_tenant_status_idx" ON "person"."persons"("tenant_id", "status");
CREATE INDEX "persons_tenant_name_idx" ON "person"."persons"("tenant_id", "last_name", "first_name");
CREATE INDEX "persons_merged_into_id_idx" ON "person"."persons"("merged_into_id");

-- ---- person.contact_points ------------------------------------------

CREATE TABLE "person"."contact_points" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT NOT NULL,
  "person_id"            TEXT NOT NULL,
  "kind"                 TEXT NOT NULL,
  "value"                TEXT NOT NULL,
  "value_normalized"     TEXT NOT NULL,
  "label"                TEXT,
  "is_primary"           BOOLEAN NOT NULL DEFAULT false,
  "verified_at"          TIMESTAMP(3),
  "verification_token"   TEXT,
  "verification_sent_at" TIMESTAMP(3),
  "verification_expires" TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_points_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_points_tenant_id_idx" ON "person"."contact_points"("tenant_id");
CREATE INDEX "contact_points_person_id_idx" ON "person"."contact_points"("person_id");
CREATE INDEX "contact_points_lookup_idx" ON "person"."contact_points"("tenant_id", "kind", "value_normalized");

-- ---- person.addresses -----------------------------------------------

CREATE TABLE "person"."addresses" (
  "id"              TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "person_id"       TEXT NOT NULL,
  "kind"            TEXT NOT NULL DEFAULT 'home',
  "line1"           TEXT NOT NULL,
  "line2"           TEXT,
  "city"            TEXT,
  "subdivision"     TEXT,
  "subdivision_lga" TEXT,
  "postal_code"     TEXT,
  "country"         TEXT NOT NULL DEFAULT 'NG',
  "is_primary"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "addresses_tenant_id_idx" ON "person"."addresses"("tenant_id");
CREATE INDEX "addresses_person_id_idx" ON "person"."addresses"("person_id");

-- ---- person.staff_profiles ------------------------------------------

CREATE TABLE "person"."staff_profiles" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "person_id"         TEXT NOT NULL,
  "employee_number"   TEXT,
  "employment_status" TEXT NOT NULL DEFAULT 'active',
  "employment_type"   TEXT,
  "job_title"         TEXT,
  "department"        TEXT,
  "hire_date"         TIMESTAMP(3),
  "end_date"          TIMESTAMP(3),
  "created_by"        TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_profiles_tenant_employee_number_key" ON "person"."staff_profiles"("tenant_id", "employee_number");
CREATE INDEX "staff_profiles_tenant_id_idx" ON "person"."staff_profiles"("tenant_id");
CREATE INDEX "staff_profiles_person_id_idx" ON "person"."staff_profiles"("person_id");
CREATE INDEX "staff_profiles_tenant_status_idx" ON "person"."staff_profiles"("tenant_id", "employment_status");

-- ---- person.guardian_relationships ----------------------------------

CREATE TABLE "person"."guardian_relationships" (
  "id"                 TEXT NOT NULL,
  "tenant_id"          TEXT NOT NULL,
  "guardian_person_id" TEXT NOT NULL,
  "ward_person_id"     TEXT NOT NULL,
  "relationship"       TEXT NOT NULL DEFAULT 'parent',
  "is_primary"         BOOLEAN NOT NULL DEFAULT false,
  "legal_guardian"     BOOLEAN NOT NULL DEFAULT false,
  "contact_priority"   INTEGER,
  "consent_given"      BOOLEAN NOT NULL DEFAULT false,
  "effective_from"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to"       TIMESTAMP(3),
  "ended_reason"       TEXT,
  "created_by"         TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guardian_relationships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guardian_relationships_pair_key" ON "person"."guardian_relationships"("guardian_person_id", "ward_person_id");
CREATE INDEX "guardian_relationships_tenant_id_idx" ON "person"."guardian_relationships"("tenant_id");
CREATE INDEX "guardian_relationships_guardian_idx" ON "person"."guardian_relationships"("guardian_person_id");
CREATE INDEX "guardian_relationships_ward_idx" ON "person"."guardian_relationships"("ward_person_id");

-- ---- person.relationship_history ------------------------------------

CREATE TABLE "person"."relationship_history" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "person_id"    TEXT NOT NULL,
  "change_type"  TEXT NOT NULL,
  "summary"      TEXT NOT NULL,
  "detail"       JSONB,
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by"  TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "relationship_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "relationship_history_tenant_id_idx" ON "person"."relationship_history"("tenant_id");
CREATE INDEX "relationship_history_person_effective_idx" ON "person"."relationship_history"("person_id", "effective_at");
CREATE INDEX "relationship_history_change_type_idx" ON "person"."relationship_history"("change_type");

-- ---- students.person_id (additive link) -----------------------------

ALTER TABLE "student-management"."students" ADD COLUMN "person_id" TEXT;
CREATE UNIQUE INDEX "students_person_id_key" ON "student-management"."students"("person_id");

-- ---- Foreign keys ---------------------------------------------------

ALTER TABLE "person"."persons"
  ADD CONSTRAINT "persons_user_tenant_id_fkey"
  FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person"."persons"
  ADD CONSTRAINT "persons_merged_into_id_fkey"
  FOREIGN KEY ("merged_into_id") REFERENCES "person"."persons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person"."persons"
  ADD CONSTRAINT "persons_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person"."contact_points"
  ADD CONSTRAINT "contact_points_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person"."addresses"
  ADD CONSTRAINT "addresses_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person"."staff_profiles"
  ADD CONSTRAINT "staff_profiles_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person"."guardian_relationships"
  ADD CONSTRAINT "guardian_relationships_guardian_person_id_fkey"
  FOREIGN KEY ("guardian_person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person"."guardian_relationships"
  ADD CONSTRAINT "guardian_relationships_ward_person_id_fkey"
  FOREIGN KEY ("ward_person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person"."relationship_history"
  ADD CONSTRAINT "relationship_history_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student-management"."students"
  ADD CONSTRAINT "students_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---- Back-fill (before RLS is enabled on the new tables) ------------
-- One Person per (tenant, user) that has an account in that tenant. Then link
-- students, materialise guardian relationships, and log a 'created' history row.
-- All in one DO block so the transaction-local platform GUC (needed for the
-- write to the RLS-forced `students` table) holds across every statement.

DO $backfill$
DECLARE
  n_persons  integer;
  n_students integer;
  n_guardian integer;
BEGIN
  PERFORM set_config('app.is_platform', 'on', true);

  -- 1. Person per (tenant, user). The representative account is the earliest
  --    UserTenant for that user in that tenant.
  INSERT INTO "person"."persons"
    ("id", "tenant_id", "first_name", "last_name", "user_tenant_id",
     "source_system", "source_id", "status", "created_at", "updated_at")
  SELECT
    gen_random_uuid()::text,
    du.tenant_id,
    COALESCE(NULLIF(u.first_name, ''), 'Unknown'),
    COALESCE(NULLIF(u.last_name, ''), 'Unknown'),
    (SELECT ut2.id FROM "profile"."user_tenants" ut2
      WHERE ut2.user_id = du.user_id AND ut2.tenant_id = du.tenant_id
      ORDER BY ut2.added_at ASC, ut2.id ASC LIMIT 1),
    'legacy',
    'user:' || du.user_id,
    'active',
    now(), now()
  FROM (SELECT DISTINCT user_id, tenant_id FROM "profile"."user_tenants") du
  JOIN "user-management"."users" u ON u.id = du.user_id
  ON CONFLICT ("tenant_id", "source_system", "source_id") DO NOTHING;
  GET DIAGNOSTICS n_persons = ROW_COUNT;

  -- 2. Anchor each student to the Person of its account's user. On dirty legacy
  --    data a single Person can back more than one student row, and
  --    students.person_id is UNIQUE — so pick exactly ONE student per Person
  --    (the earliest by id). A set-based NOT EXISTS cannot see assignments made
  --    by the same UPDATE statement, so it would let two students take the same
  --    Person and violate the unique index (aborting the whole migration);
  --    DISTINCT ON resolves the winner before the write.
  UPDATE "student-management"."students" s
  SET "person_id" = m.person_id
  FROM (
    SELECT DISTINCT ON (p.id) s2.id AS student_id, p.id AS person_id
    FROM "student-management"."students" s2
    JOIN "profile"."user_tenants" ut ON ut.id = s2.user_tenant_id
    JOIN "person"."persons" p
      ON p.source_system = 'legacy'
     AND p.source_id = 'user:' || ut.user_id
     AND p.tenant_id = ut.tenant_id
    WHERE s2.person_id IS NULL
    ORDER BY p.id, s2.id
  ) m
  WHERE s.id = m.student_id;
  GET DIAGNOSTICS n_students = ROW_COUNT;

  -- 3. Materialise guardian relationships from the legacy StudentGuardian links.
  INSERT INTO "person"."guardian_relationships"
    ("id", "tenant_id", "guardian_person_id", "ward_person_id", "relationship",
     "is_primary", "legal_guardian", "contact_priority", "effective_from",
     "created_at", "updated_at")
  SELECT
    gen_random_uuid()::text, sg.tenant_id, gp.id, s.person_id,
    sg.relationship, sg.is_primary, sg.legal_guardian, sg.contact_priority,
    now(), now(), now()
  FROM "student-management"."student_guardians" sg
  JOIN "profile"."user_tenants" gut ON gut.id = sg.user_tenant_id
  JOIN "person"."persons" gp
    ON gp.source_system = 'legacy'
   AND gp.source_id = 'user:' || gut.user_id
   AND gp.tenant_id = sg.tenant_id
  JOIN "student-management"."students" s ON s.id = sg.student_id AND s.person_id IS NOT NULL
  ON CONFLICT ("guardian_person_id", "ward_person_id") DO NOTHING;
  GET DIAGNOSTICS n_guardian = ROW_COUNT;

  -- 4. History: a 'created' row for every back-filled Person.
  INSERT INTO "person"."relationship_history"
    ("id", "tenant_id", "person_id", "change_type", "summary", "effective_at", "created_at")
  SELECT gen_random_uuid()::text, p.tenant_id, p.id, 'created',
         'Back-filled from legacy account', now(), now()
  FROM "person"."persons" p
  WHERE p.source_system = 'legacy';

  RAISE NOTICE 'F1 back-fill: % person(s), % student link(s), % guardian rel(s)',
    n_persons, n_students, n_guardian;
END
$backfill$;

-- ---- RLS + grants (after back-fill) ---------------------------------
-- tenant_id is NON-NULL here (Person is tenant-scoped): a row is visible only
-- to its tenant, or under the audited platform bypass. Mirrors the jobs policy.

DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'persons', 'contact_points', 'addresses',
    'staff_profiles', 'guardian_relationships', 'relationship_history'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'person', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'person', t);
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
        )$p$, 'person', t);
  END LOOP;
END
$rls$;

GRANT USAGE ON SCHEMA "person" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "person" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "person"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
