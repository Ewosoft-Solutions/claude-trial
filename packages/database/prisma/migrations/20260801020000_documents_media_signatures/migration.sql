-- ============================================================
-- Document / media platform + signature assets (F4) — ADR-08
-- ============================================================
-- New "documents" schema. No back-fill (a new domain). Every table is
-- tenant-scoped (tenant_id non-null) with RLS enabled + forced + a permissive
-- tenant_isolation policy, and granted to app_runtime — same posture as the
-- jobs/person schemas.
--
-- signing_authorities.person_id references person.persons via a DB-level FK
-- (the documents module stays decoupled from the Prisma person model). The
-- signature IMAGE, when present, is a restricted Document referenced by
-- signature_document_id — never an image row in a browsable table.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "documents";

-- ---- documents.document_types ---------------------------------------

CREATE TABLE "documents"."document_types" (
  "id"                     TEXT NOT NULL,
  "tenant_id"              TEXT NOT NULL,
  "key"                    TEXT NOT NULL,
  "label"                  TEXT NOT NULL,
  "description"            TEXT,
  "default_visibility"     TEXT NOT NULL DEFAULT 'private',
  "default_retention_days" INTEGER,
  "is_signature_asset"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_types_tenant_key_key" ON "documents"."document_types"("tenant_id", "key");
CREATE INDEX "document_types_tenant_id_idx" ON "documents"."document_types"("tenant_id");

-- ---- documents.documents --------------------------------------------

CREATE TABLE "documents"."documents" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "type_id"             TEXT,
  "owner_type"          TEXT NOT NULL,
  "owner_id"            TEXT NOT NULL,
  "title"               TEXT,
  "visibility"          TEXT NOT NULL DEFAULT 'private',
  "sensitive"           BOOLEAN NOT NULL DEFAULT false,
  "retention_policy_id" TEXT,
  "retain_until"        TIMESTAMP(3),
  "legal_hold"          BOOLEAN NOT NULL DEFAULT false,
  "consent"             JSONB,
  "provenance"          JSONB,
  "scan_status"         TEXT NOT NULL DEFAULT 'pending',
  "current_version_id"  TEXT,
  "source_system"       TEXT,
  "source_id"           TEXT,
  "created_by"          TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documents_tenant_source_key" ON "documents"."documents"("tenant_id", "source_system", "source_id");
CREATE INDEX "documents_tenant_id_idx" ON "documents"."documents"("tenant_id");
CREATE INDEX "documents_owner_idx" ON "documents"."documents"("tenant_id", "owner_type", "owner_id");
CREATE INDEX "documents_visibility_idx" ON "documents"."documents"("tenant_id", "visibility");

-- ---- documents.document_versions ------------------------------------

CREATE TABLE "documents"."document_versions" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "document_id"   TEXT NOT NULL,
  "version_no"    INTEGER NOT NULL,
  "object_key"    TEXT NOT NULL,
  "checksum"      TEXT NOT NULL,
  "mime"          TEXT NOT NULL,
  "size"          INTEGER NOT NULL,
  "scan_status"   TEXT NOT NULL DEFAULT 'pending',
  "scan_detail"   TEXT,
  "thumbnail_key" TEXT,
  "created_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_versions_doc_version_key" ON "documents"."document_versions"("document_id", "version_no");
CREATE UNIQUE INDEX "document_versions_object_key_key" ON "documents"."document_versions"("object_key");
CREATE INDEX "document_versions_tenant_id_idx" ON "documents"."document_versions"("tenant_id");
CREATE INDEX "document_versions_document_id_idx" ON "documents"."document_versions"("document_id");
CREATE INDEX "document_versions_scan_status_idx" ON "documents"."document_versions"("scan_status");

-- ---- documents.signing_authorities ----------------------------------

CREATE TABLE "documents"."signing_authorities" (
  "id"                    TEXT NOT NULL,
  "tenant_id"             TEXT NOT NULL,
  "person_id"             TEXT NOT NULL,
  "role"                  TEXT NOT NULL,
  "signature_document_id" TEXT,
  "valid_from"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to"              TIMESTAMP(3),
  "status"                TEXT NOT NULL DEFAULT 'active',
  "created_by"            TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signing_authorities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signing_authorities_tenant_person_role_key" ON "documents"."signing_authorities"("tenant_id", "person_id", "role");
CREATE INDEX "signing_authorities_tenant_id_idx" ON "documents"."signing_authorities"("tenant_id");
CREATE INDEX "signing_authorities_person_id_idx" ON "documents"."signing_authorities"("person_id");
CREATE INDEX "signing_authorities_tenant_status_idx" ON "documents"."signing_authorities"("tenant_id", "status");

-- ---- documents.signature_uses ---------------------------------------

CREATE TABLE "documents"."signature_uses" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT NOT NULL,
  "signing_authority_id" TEXT NOT NULL,
  "artifact_type"        TEXT NOT NULL,
  "artifact_id"          TEXT NOT NULL,
  "produced_document_id" TEXT,
  "artifact_checksum"    TEXT,
  "status"               TEXT NOT NULL DEFAULT 'applied',
  "reason"               TEXT,
  "revoked_reason"       TEXT,
  "applied_by"           TEXT,
  "applied_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signature_uses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "signature_uses_tenant_id_idx" ON "documents"."signature_uses"("tenant_id");
CREATE INDEX "signature_uses_authority_idx" ON "documents"."signature_uses"("signing_authority_id");
CREATE INDEX "signature_uses_artifact_idx" ON "documents"."signature_uses"("tenant_id", "artifact_type", "artifact_id");

-- ---- Foreign keys ---------------------------------------------------

ALTER TABLE "documents"."document_types"
  ADD CONSTRAINT "document_types_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"."documents"
  ADD CONSTRAINT "documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"."documents"
  ADD CONSTRAINT "documents_type_id_fkey"
  FOREIGN KEY ("type_id") REFERENCES "documents"."document_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"."document_versions"
  ADD CONSTRAINT "document_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"."document_versions"
  ADD CONSTRAINT "document_versions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"."signing_authorities"
  ADD CONSTRAINT "signing_authorities_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"."signing_authorities"
  ADD CONSTRAINT "signing_authorities_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"."persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"."signing_authorities"
  ADD CONSTRAINT "signing_authorities_signature_document_id_fkey"
  FOREIGN KEY ("signature_document_id") REFERENCES "documents"."documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"."signature_uses"
  ADD CONSTRAINT "signature_uses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"."signature_uses"
  ADD CONSTRAINT "signature_uses_signing_authority_id_fkey"
  FOREIGN KEY ("signing_authority_id") REFERENCES "documents"."signing_authorities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- RLS + grants ---------------------------------------------------

DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_types', 'documents', 'document_versions',
    'signing_authorities', 'signature_uses'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'documents', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'documents', t);
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
        )$p$, 'documents', t);
  END LOOP;
END
$rls$;

GRANT USAGE ON SCHEMA "documents" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "documents" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "documents"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
