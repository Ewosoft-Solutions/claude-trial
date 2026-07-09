-- ============================================================
-- AI governance — Step 6 of docs/ai-integration-plan.md
-- ============================================================
-- Adds tenant AI settings, monthly usage aggregates, and short-lived
-- concurrency leases. All tables are tenant-scoped in the "ai" schema and
-- RLS-protected. Existing ChatMessage rows keep their per-message metadata;
-- ai_usage_monthly is the enforcement/visibility roll-up.
-- ============================================================

-- ---- ai_settings ----------------------------------------------------

CREATE TABLE "ai"."ai_settings" (
  "id"                        TEXT NOT NULL,
  "tenant_id"                 TEXT NOT NULL,
  "model_tier"                TEXT NOT NULL DEFAULT 'standard',
  "analytics_enabled"         BOOLEAN NOT NULL DEFAULT true,
  "tutor_enabled"             BOOLEAN NOT NULL DEFAULT true,
  "monthly_token_budget"      INTEGER NOT NULL DEFAULT 1000000,
  "concurrency_limit"         INTEGER NOT NULL DEFAULT 3,
  "alert_threshold_percent"   INTEGER NOT NULL DEFAULT 80,
  "byok_provider"             TEXT,
  "encrypted_api_key"         TEXT,
  "key_last4"                 TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_settings_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "ai_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ai_settings_tenant_id_idx"
  ON "ai"."ai_settings"("tenant_id");

INSERT INTO "ai"."ai_settings" (
  "id",
  "tenant_id",
  "model_tier",
  "analytics_enabled",
  "tutor_enabled",
  "monthly_token_budget",
  "concurrency_limit",
  "alert_threshold_percent",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  'standard',
  true,
  true,
  1000000,
  3,
  80,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenant"."tenants" t
ON CONFLICT ("tenant_id") DO NOTHING;

-- ---- ai_usage_monthly -----------------------------------------------

CREATE TABLE "ai"."ai_usage_monthly" (
  "id"                           TEXT NOT NULL,
  "tenant_id"                    TEXT NOT NULL,
  "month"                        TEXT NOT NULL,
  "feature"                      TEXT NOT NULL,
  "request_count"                INTEGER NOT NULL DEFAULT 0,
  "input_tokens"                 INTEGER NOT NULL DEFAULT 0,
  "output_tokens"                INTEGER NOT NULL DEFAULT 0,
  "cache_read_input_tokens"      INTEGER NOT NULL DEFAULT 0,
  "cache_creation_input_tokens"  INTEGER NOT NULL DEFAULT 0,
  "total_tokens"                 INTEGER NOT NULL DEFAULT 0,
  "last_provider"                TEXT,
  "last_model"                   TEXT,
  "last_used_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "alert_sent_at"                TIMESTAMP(3),
  "created_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_usage_monthly_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_monthly_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_usage_monthly_tenant_id_month_feature_key"
  ON "ai"."ai_usage_monthly"("tenant_id", "month", "feature");
CREATE INDEX "ai_usage_monthly_tenant_id_month_idx"
  ON "ai"."ai_usage_monthly"("tenant_id", "month");

-- ---- ai_concurrency_leases ------------------------------------------

CREATE TABLE "ai"."ai_concurrency_leases" (
  "id"         TEXT NOT NULL,
  "tenant_id"  TEXT NOT NULL,
  "feature"    TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_concurrency_leases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_concurrency_leases_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ai_concurrency_leases_tenant_id_expires_at_idx"
  ON "ai"."ai_concurrency_leases"("tenant_id", "expires_at");
CREATE INDEX "ai_concurrency_leases_tenant_id_feature_idx"
  ON "ai"."ai_concurrency_leases"("tenant_id", "feature");

-- ---- RLS -------------------------------------------------------------

ALTER TABLE "ai"."ai_settings"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."ai_settings"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "ai"."ai_settings"
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

ALTER TABLE "ai"."ai_usage_monthly"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."ai_usage_monthly"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "ai"."ai_usage_monthly"
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

ALTER TABLE "ai"."ai_concurrency_leases"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."ai_concurrency_leases"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "ai"."ai_concurrency_leases"
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

-- ---- Grants ----------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "ai"."ai_settings",
     "ai"."ai_usage_monthly",
     "ai"."ai_concurrency_leases"
  TO app_runtime;
