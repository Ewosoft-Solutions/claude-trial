-- AlterTable
ALTER TABLE "academic-structure"."assessments" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "academic-structure"."class_teachers" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "academic-structure"."classes" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "academic-structure"."grades" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "academic-structure"."terms" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "communication"."message_read_receipts" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "profile"."user_tenant_permissions" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "profile"."user_tenant_roles" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "student-management"."enrollments" ADD COLUMN     "tenant_id" TEXT;

-- CreateIndex
CREATE INDEX "assessments_tenant_id_idx" ON "academic-structure"."assessments"("tenant_id");

-- CreateIndex
CREATE INDEX "assessments_tenant_id_class_id_idx" ON "academic-structure"."assessments"("tenant_id", "class_id");

-- CreateIndex
CREATE INDEX "class_teachers_tenant_id_idx" ON "academic-structure"."class_teachers"("tenant_id");

-- CreateIndex
CREATE INDEX "classes_tenant_id_idx" ON "academic-structure"."classes"("tenant_id");

-- CreateIndex
CREATE INDEX "classes_tenant_id_term_id_idx" ON "academic-structure"."classes"("tenant_id", "term_id");

-- CreateIndex
CREATE INDEX "classes_tenant_id_status_idx" ON "academic-structure"."classes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "grades_tenant_id_idx" ON "academic-structure"."grades"("tenant_id");

-- CreateIndex
CREATE INDEX "grades_tenant_id_assessment_id_idx" ON "academic-structure"."grades"("tenant_id", "assessment_id");

-- CreateIndex
CREATE INDEX "terms_tenant_id_idx" ON "academic-structure"."terms"("tenant_id");

-- CreateIndex
CREATE INDEX "terms_tenant_id_academic_year_id_idx" ON "academic-structure"."terms"("tenant_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_tenant_id_idx" ON "communication"."message_read_receipts"("tenant_id");

-- CreateIndex
CREATE INDEX "user_tenant_permissions_tenant_id_idx" ON "profile"."user_tenant_permissions"("tenant_id");

-- CreateIndex
CREATE INDEX "user_tenant_roles_tenant_id_idx" ON "profile"."user_tenant_roles"("tenant_id");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_idx" ON "student-management"."enrollments"("tenant_id");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_class_id_idx" ON "student-management"."enrollments"("tenant_id", "class_id");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_student_id_idx" ON "student-management"."enrollments"("tenant_id", "student_id");

-- ============================================================
-- Backfill tenant_id from parent rows (order respects FKs).
-- ============================================================
UPDATE "academic-structure"."terms" t
  SET tenant_id = ay.tenant_id
  FROM "academic-structure"."academic_years" ay
  WHERE t.academic_year_id = ay.id;

UPDATE "academic-structure"."classes" c
  SET tenant_id = ay.tenant_id
  FROM "academic-structure"."academic_years" ay
  WHERE c.academic_year_id = ay.id;

UPDATE "academic-structure"."assessments" a
  SET tenant_id = ay.tenant_id
  FROM "academic-structure"."academic_years" ay
  WHERE a.academic_year_id = ay.id;

UPDATE "student-management"."enrollments" e
  SET tenant_id = ay.tenant_id
  FROM "academic-structure"."academic_years" ay
  WHERE e.academic_year_id = ay.id;

UPDATE "academic-structure"."class_teachers" ct
  SET tenant_id = c.tenant_id
  FROM "academic-structure"."classes" c
  WHERE ct.class_id = c.id;

UPDATE "academic-structure"."grades" g
  SET tenant_id = e.tenant_id
  FROM "student-management"."enrollments" e
  WHERE g.enrollment_id = e.id;

UPDATE "communication"."message_read_receipts" rr
  SET tenant_id = m.tenant_id
  FROM "communication"."messages" m
  WHERE rr.message_id = m.id;

UPDATE "profile"."user_tenant_roles" utr
  SET tenant_id = ut.tenant_id
  FROM "profile"."user_tenants" ut
  WHERE utr.user_tenant_id = ut.id;

UPDATE "profile"."user_tenant_permissions" utp
  SET tenant_id = ut.tenant_id
  FROM "profile"."user_tenants" ut
  WHERE utp.user_tenant_id = ut.id;

-- ============================================================
-- Extend RLS to the denormalized child tables (strict tenant scope,
-- with the same app.is_platform bypass branch as phase 1).
-- ============================================================
DO $rls_child$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('academic-structure', 'terms'),
      ('academic-structure', 'classes'),
      ('academic-structure', 'class_teachers'),
      ('academic-structure', 'assessments'),
      ('academic-structure', 'grades'),
      ('student-management', 'enrollments'),
      ('communication', 'message_read_receipts'),
      ('profile', 'user_tenant_roles'),
      ('profile', 'user_tenant_permissions')
    ) AS t(sch, tbl)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.sch, r.tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.sch, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.sch, r.tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I'
      || ' USING (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))'
      || ' WITH CHECK (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
      r.sch, r.tbl);
  END LOOP;
END
$rls_child$;
