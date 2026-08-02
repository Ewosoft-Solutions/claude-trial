-- ============================================================
-- F5 · Communication delivery abstraction (ADR-07)
-- ============================================================
-- Adds the provider-agnostic delivery layer to the existing "communication"
-- schema: a ContactPreference (consent/DND/quiet-hours), MessageTemplate +
-- TemplateVersion, Campaign + CampaignRecipient, the DeliveryAttempt ledger
-- (metered cost + DND classification + failure class — reproduces the legacy
-- SMS-balance + delivery log), and SecureLink (permission-checked, expiring
-- tokens that replace public result/payment URLs).
--
-- Every table is tenant-scoped (tenant_id NOT NULL) and gets the STANDARD
-- PERMISSIVE tenant_isolation RLS policy + FORCE + app_runtime DML grants, so
-- db:rls:check stays green. Following the jobs/directory infra convention, the
-- tenant_id FK to tenant.tenants is a DB-level FK (no Prisma relation); the
-- high-volume ledger is never navigated from the aggregate. Cross-schema
-- person references are scalar FKs (ON DELETE SET NULL / CASCADE as noted).
-- ============================================================

-- ---- ContactPreference -------------------------------------------------
CREATE TABLE "communication"."contact_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "opted_in" BOOLEAN NOT NULL DEFAULT true,
    "is_dnd" BOOLEAN NOT NULL DEFAULT false,
    "consent_source" TEXT,
    "consent_at" TIMESTAMP(3),
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contact_preferences_person_id_channel_key" ON "communication"."contact_preferences"("person_id", "channel");
CREATE INDEX "contact_preferences_tenant_id_idx" ON "communication"."contact_preferences"("tenant_id");
CREATE INDEX "contact_preferences_tenant_id_channel_idx" ON "communication"."contact_preferences"("tenant_id", "channel");
CREATE INDEX "contact_preferences_person_id_idx" ON "communication"."contact_preferences"("person_id");

-- ---- MessageTemplate ---------------------------------------------------
CREATE TABLE "communication"."message_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_templates_tenant_id_key_key" ON "communication"."message_templates"("tenant_id", "key");
CREATE INDEX "message_templates_tenant_id_idx" ON "communication"."message_templates"("tenant_id");

-- ---- TemplateVersion ---------------------------------------------------
CREATE TABLE "communication"."template_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "template_versions_template_id_channel_locale_version_key" ON "communication"."template_versions"("template_id", "channel", "locale", "version");
CREATE INDEX "template_versions_tenant_id_idx" ON "communication"."template_versions"("tenant_id");
CREATE INDEX "template_versions_template_id_idx" ON "communication"."template_versions"("template_id");

-- ---- Campaign ----------------------------------------------------------
CREATE TABLE "communication"."campaigns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'marketing',
    "template_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "audience" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "suppressed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaigns_tenant_id_idx" ON "communication"."campaigns"("tenant_id");
CREATE INDEX "campaigns_tenant_id_status_idx" ON "communication"."campaigns"("tenant_id", "status");

-- ---- CampaignRecipient -------------------------------------------------
CREATE TABLE "communication"."campaign_recipients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "person_id" TEXT,
    "redacted_destination" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suppress_reason" TEXT,
    "delivery_attempt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_person_id_key" ON "communication"."campaign_recipients"("campaign_id", "person_id");
CREATE INDEX "campaign_recipients_tenant_id_idx" ON "communication"."campaign_recipients"("tenant_id");
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "communication"."campaign_recipients"("campaign_id");
CREATE INDEX "campaign_recipients_person_id_idx" ON "communication"."campaign_recipients"("person_id");

-- ---- DeliveryAttempt (the ledger) --------------------------------------
CREATE TABLE "communication"."delivery_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'log',
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "recipient_person_id" TEXT,
    "recipient_profile_id" TEXT,
    "redacted_destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "failure_class" TEXT,
    "provider_message_id" TEXT,
    "error" TEXT,
    "cost_units" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'unit',
    "dnd_flag" BOOLEAN NOT NULL DEFAULT false,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "template_id" TEXT,
    "campaign_id" TEXT,
    "secure_link_id" TEXT,
    "dedupe_key" TEXT,
    "actor_id" TEXT,
    "metadata" JSONB,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delivery_attempts_tenant_id_dedupe_key_key" ON "communication"."delivery_attempts"("tenant_id", "dedupe_key");
CREATE INDEX "delivery_attempts_tenant_id_idx" ON "communication"."delivery_attempts"("tenant_id");
CREATE INDEX "delivery_attempts_tenant_id_channel_status_idx" ON "communication"."delivery_attempts"("tenant_id", "channel", "status");
CREATE INDEX "delivery_attempts_tenant_id_created_at_idx" ON "communication"."delivery_attempts"("tenant_id", "created_at");
CREATE INDEX "delivery_attempts_campaign_id_idx" ON "communication"."delivery_attempts"("campaign_id");
CREATE INDEX "delivery_attempts_recipient_person_id_idx" ON "communication"."delivery_attempts"("recipient_person_id");

-- ---- SecureLink --------------------------------------------------------
CREATE TABLE "communication"."secure_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "required_permission" TEXT,
    "audience_person_id" TEXT,
    "audience_profile_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secure_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "secure_links_token_hash_key" ON "communication"."secure_links"("token_hash");
CREATE INDEX "secure_links_tenant_id_idx" ON "communication"."secure_links"("tenant_id");
CREATE INDEX "secure_links_tenant_id_purpose_idx" ON "communication"."secure_links"("tenant_id", "purpose");
CREATE INDEX "secure_links_target_type_target_id_idx" ON "communication"."secure_links"("target_type", "target_id");

-- ---- Foreign keys ------------------------------------------------------
-- tenant_id → tenant.tenants (infra FK, no Prisma relation) on every table.
ALTER TABLE "communication"."contact_preferences"
  ADD CONSTRAINT "contact_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication"."contact_preferences"
  ADD CONSTRAINT "contact_preferences_person_id_fkey" FOREIGN KEY ("person_id")
  REFERENCES "person"."persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication"."message_templates"
  ADD CONSTRAINT "message_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication"."template_versions"
  ADD CONSTRAINT "template_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication"."template_versions"
  ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id")
  REFERENCES "communication"."message_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication"."campaigns"
  ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication"."campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication"."campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id")
  REFERENCES "communication"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication"."campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_person_id_fkey" FOREIGN KEY ("person_id")
  REFERENCES "person"."persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication"."delivery_attempts"
  ADD CONSTRAINT "delivery_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication"."delivery_attempts"
  ADD CONSTRAINT "delivery_attempts_recipient_person_id_fkey" FOREIGN KEY ("recipient_person_id")
  REFERENCES "person"."persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication"."secure_links"
  ADD CONSTRAINT "secure_links_tenant_id_fkey" FOREIGN KEY ("tenant_id")
  REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- RLS + grants ------------------------------------------------------
-- Standard tenant isolation: a row is visible only to its tenant, or under the
-- audited platform bypass (app.is_platform). PERMISSIVE so db:rls:check passes.
DO $rls$
DECLARE
  t text;
  tables text[] := ARRAY[
    'contact_preferences','message_templates','template_versions',
    'campaigns','campaign_recipients','delivery_attempts','secure_links'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'communication', t);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', 'communication', t);
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
    $p$, 'communication', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO app_runtime', 'communication', t);
  END LOOP;
END
$rls$;
