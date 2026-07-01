-- ============================================================
-- Library domain — Step 8 of backend remediation
-- ============================================================
-- Creates library_books in the "library" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "library";

-- ---- library_books -------------------------------------------------

CREATE TABLE "library"."library_books" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "author"              TEXT NOT NULL,
  "isbn"                TEXT,
  "category"            TEXT,
  "copy_label"          TEXT,
  "status"              TEXT NOT NULL DEFAULT 'available',
  "borrower_student_id" TEXT,
  "due_date"            DATE,
  "created_by"          TEXT,
  "updated_by"          TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_books_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_books_borrower_student_id_fkey"
    FOREIGN KEY ("borrower_student_id")
    REFERENCES "student-management"."students"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "library_books_tenant_id_idx"
  ON "library"."library_books"("tenant_id");
CREATE INDEX "library_books_tenant_id_status_idx"
  ON "library"."library_books"("tenant_id", "status");
CREATE INDEX "library_books_tenant_id_category_idx"
  ON "library"."library_books"("tenant_id", "category");
CREATE INDEX "library_books_borrower_student_id_idx"
  ON "library"."library_books"("borrower_student_id");

-- ---- RLS: library_books ----------------------------------------------

ALTER TABLE "library"."library_books"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library"."library_books"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "library"."library_books"
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grant library schema to app_runtime ------------------------------

GRANT USAGE ON SCHEMA "library" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "library" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "library"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
