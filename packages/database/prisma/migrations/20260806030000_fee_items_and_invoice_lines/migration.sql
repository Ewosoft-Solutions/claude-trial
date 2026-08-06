-- ============================================================
-- Billing/AR P1 slice 1 — fee-item catalogue + invoice line items
-- ============================================================
-- Additive + idempotent. Introduces:
--   finance.fee_items         — per-tenant catalogue of billable items
--   finance.fee_invoice_lines — itemisation of an invoice (gross = Σ lines)
-- Seeds a starter catalogue for existing tenants and backfills one line per
-- existing invoice (Tuition item, amount = amount_due). The flat
-- fee_invoices.amount_due stays in parallel/compat for now.

-- ---- fee_items ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."fee_items" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "default_amount" INTEGER,
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_items_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_items_tenant_id_code_key"
  ON "finance"."fee_items"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "fee_items_tenant_id_idx"
  ON "finance"."fee_items"("tenant_id");

-- ---- fee_invoice_lines ----------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."fee_invoice_lines" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "invoice_id"  TEXT NOT NULL,
  "fee_item_id" TEXT NOT NULL,
  "description" TEXT,
  "amount"      INTEGER NOT NULL DEFAULT 0,
  "quantity"    INTEGER NOT NULL DEFAULT 1,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_invoice_lines_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "finance"."fee_invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_invoice_lines_fee_item_id_fkey"
    FOREIGN KEY ("fee_item_id") REFERENCES "finance"."fee_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "fee_invoice_lines_tenant_id_idx"
  ON "finance"."fee_invoice_lines"("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_invoice_lines_invoice_id_idx"
  ON "finance"."fee_invoice_lines"("invoice_id");
CREATE INDEX IF NOT EXISTS "fee_invoice_lines_fee_item_id_idx"
  ON "finance"."fee_invoice_lines"("fee_item_id");

-- ---- RLS: tenant isolation (required by db:rls:check) ----------------
ALTER TABLE "finance"."fee_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."fee_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."fee_items";
CREATE POLICY "tenant_isolation" ON "finance"."fee_items"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

ALTER TABLE "finance"."fee_invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."fee_invoice_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."fee_invoice_lines";
CREATE POLICY "tenant_isolation" ON "finance"."fee_invoice_lines"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grants (finance ALTER DEFAULT PRIVILEGES exists; be explicit) ---
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."fee_items" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."fee_invoice_lines" TO app_runtime;

-- ---- Seed catalogue + backfill lines --------------------------------
-- Must set app.is_platform in the SAME statement as the writes: the tables
-- FORCE row-level security, so a bare INSERT would be filtered to 0 rows.
DO $$
BEGIN
  PERFORM set_config('app.is_platform', 'on', true);

  INSERT INTO "finance"."fee_items"
    ("id","tenant_id","code","name","active","created_at","updated_at")
  SELECT gen_random_uuid(), t."id", v.code, v.name, true,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "tenant"."tenants" t
  CROSS JOIN (VALUES
    ('tuition','Tuition'),
    ('bus','Bus'),
    ('books','Books'),
    ('lab','Lab'),
    ('uniform','Uniform'),
    ('exam','Exam'),
    ('boarding','Boarding'),
    ('pta_levy','PTA levy'),
    ('excursion','Excursion'),
    ('id_card','ID card')
  ) AS v(code,name)
  ON CONFLICT ("tenant_id","code") DO NOTHING;

  INSERT INTO "finance"."fee_invoice_lines"
    ("id","tenant_id","invoice_id","fee_item_id","description","amount","quantity","created_at","updated_at")
  SELECT gen_random_uuid(), fi."tenant_id", fi."id", item."id",
         'Tuition (migrated)', fi."amount_due", 1,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "finance"."fee_invoices" fi
  JOIN "finance"."fee_items" item
    ON item."tenant_id" = fi."tenant_id" AND item."code" = 'tuition'
  WHERE NOT EXISTS (
    SELECT 1 FROM "finance"."fee_invoice_lines" l WHERE l."invoice_id" = fi."id"
  );
END $$;
