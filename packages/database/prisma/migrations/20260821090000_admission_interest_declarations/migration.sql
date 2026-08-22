-- Declared conflicts of interest on an admission application (WB3).
--
-- The other self-approval guards compare ids; admissions has none to compare,
-- because the applicant is an external prospect rather than a user. The real
-- conflict is a staff member deciding on an application for their own child,
-- which no matching rule can reliably detect — so the person declares it, and
-- the declaration is what gates the decision.
--
-- Additive + idempotent, and RLS is applied in the same statement block, so a
-- tenant can never read or write another tenant's declarations.

CREATE TABLE IF NOT EXISTS "admissions"."admission_interest_declarations" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "relationship"   TEXT NOT NULL,
    "note"           TEXT,
    "declared_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_interest_declarations_pkey" PRIMARY KEY ("id")
);

-- One declaration per person per application: declaring twice is a no-op, not
-- an error, and the guard only ever asks whether a row exists.
CREATE UNIQUE INDEX IF NOT EXISTS "admission_interest_declarations_tenant_application_user_key"
    ON "admissions"."admission_interest_declarations"("tenant_id", "application_id", "user_id");
CREATE INDEX IF NOT EXISTS "admission_interest_declarations_tenant_id_idx"
    ON "admissions"."admission_interest_declarations"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_interest_declarations_tenant_application_idx"
    ON "admissions"."admission_interest_declarations"("tenant_id", "application_id");

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admission_interest_declarations_application_id_fkey'
  ) THEN
    ALTER TABLE "admissions"."admission_interest_declarations"
      ADD CONSTRAINT "admission_interest_declarations_application_id_fkey"
      FOREIGN KEY ("application_id")
      REFERENCES "admissions"."admission_applications"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$fk$;

DO $rls$
DECLARE
  sch text := 'admissions';
  tbl text := 'admission_interest_declarations';
BEGIN
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
END
$rls$;
