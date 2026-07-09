-- ============================================================
-- Learning domain — Step 4 of docs/ai-integration-plan.md
-- ============================================================
-- Lesson content substrate for the Academic AI tutor:
--   lessons          — teacher-authored units attached to a class
--   lesson_materials — uploaded files (binary behind StorageProvider)
--   material_chunks  — extracted text + pgvector embedding (retrieval)
-- Tenant-scoped (tenant_id NOT NULL) in the "learning" schema. RLS
-- applied explicitly so db:rls:check passes from day one.
-- material_chunks additionally denormalizes lesson_id: retrieval is
-- always scoped (tenant_id, lesson_id) — the tutor's privacy boundary.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "learning";

-- pgvector for embedding storage + similarity search (types/operators in
-- "public", which stays on the default search_path for app connections).
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- ---- lessons --------------------------------------------------------

CREATE TABLE "learning"."lessons" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "class_id"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "status"      TEXT NOT NULL DEFAULT 'draft',
  "created_by"  TEXT,
  "updated_by"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lessons_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lessons_class_id_fkey"
    FOREIGN KEY ("class_id")
    REFERENCES "academic-structure"."classes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "lessons_tenant_id_idx"
  ON "learning"."lessons"("tenant_id");
CREATE INDEX "lessons_tenant_id_class_id_idx"
  ON "learning"."lessons"("tenant_id", "class_id");
CREATE INDEX "lessons_tenant_id_status_idx"
  ON "learning"."lessons"("tenant_id", "status");

-- ---- lesson_materials ----------------------------------------------

CREATE TABLE "learning"."lesson_materials" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "lesson_id"         TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "file_name"         TEXT NOT NULL,
  "mime_type"         TEXT NOT NULL,
  "size_bytes"        INTEGER NOT NULL,
  "storage_key"       TEXT NOT NULL,
  "extraction_status" TEXT NOT NULL DEFAULT 'pending',
  "extraction_error"  TEXT,
  "chunk_count"       INTEGER NOT NULL DEFAULT 0,
  "created_by"        TEXT,
  "updated_by"        TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lesson_materials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_materials_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_materials_lesson_id_fkey"
    FOREIGN KEY ("lesson_id")
    REFERENCES "learning"."lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "lesson_materials_tenant_id_idx"
  ON "learning"."lesson_materials"("tenant_id");
CREATE INDEX "lesson_materials_tenant_id_lesson_id_idx"
  ON "learning"."lesson_materials"("tenant_id", "lesson_id");
CREATE INDEX "lesson_materials_tenant_id_extraction_status_idx"
  ON "learning"."lesson_materials"("tenant_id", "extraction_status");

-- ---- material_chunks ------------------------------------------------

CREATE TABLE "learning"."material_chunks" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "lesson_id"   TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content"     TEXT NOT NULL,
  "embedding"   public.vector(1024),
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_chunks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "material_chunks_lesson_id_fkey"
    FOREIGN KEY ("lesson_id")
    REFERENCES "learning"."lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "material_chunks_material_id_fkey"
    FOREIGN KEY ("material_id")
    REFERENCES "learning"."lesson_materials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "material_chunks_tenant_id_idx"
  ON "learning"."material_chunks"("tenant_id");
CREATE INDEX "material_chunks_tenant_id_lesson_id_idx"
  ON "learning"."material_chunks"("tenant_id", "lesson_id");
CREATE INDEX "material_chunks_material_id_chunk_index_idx"
  ON "learning"."material_chunks"("material_id", "chunk_index");

-- ANN index for cosine similarity (HNSW needs no training data, fine to
-- create on an empty table; pgvector >= 0.5).
CREATE INDEX "material_chunks_embedding_idx"
  ON "learning"."material_chunks"
  USING hnsw ("embedding" public.vector_cosine_ops);

-- ---- RLS: lessons ----------------------------------------------------

ALTER TABLE "learning"."lessons"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning"."lessons"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "learning"."lessons"
  AS PERMISSIVE
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

-- ---- RLS: lesson_materials -------------------------------------------

ALTER TABLE "learning"."lesson_materials"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning"."lesson_materials"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "learning"."lesson_materials"
  AS PERMISSIVE
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

-- ---- RLS: material_chunks --------------------------------------------

ALTER TABLE "learning"."material_chunks"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning"."material_chunks"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "learning"."material_chunks"
  AS PERMISSIVE
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

-- ---- Grant learning schema to app_runtime ----------------------------

GRANT USAGE ON SCHEMA "learning" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "learning" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "learning"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
