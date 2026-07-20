ALTER TABLE "security-policy"."school_security_policies"
ADD COLUMN "biometric_enrollment_policy" TEXT NOT NULL DEFAULT 'allow';

CREATE TABLE "security-policy"."sensitive_operation_policies" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requires_step_up" BOOLEAN NOT NULL DEFAULT true,
    "requires_maker_checker" BOOLEAN NOT NULL DEFAULT false,
    "freshness_minutes" INTEGER NOT NULL DEFAULT 5,
    "required_clearance_level" INTEGER NOT NULL DEFAULT 0,
    "required_permission" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitive_operation_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensitive_operation_policies_freshness_check"
      CHECK ("freshness_minutes" BETWEEN 1 AND 30),
    CONSTRAINT "sensitive_operation_policies_clearance_check"
      CHECK ("required_clearance_level" BETWEEN 0 AND 10)
);

CREATE UNIQUE INDEX "sensitive_operation_policies_operation_key"
ON "security-policy"."sensitive_operation_policies"("operation");

CREATE INDEX "sensitive_operation_policies_category_idx"
ON "security-policy"."sensitive_operation_policies"("category");

CREATE INDEX "sensitive_operation_policies_enabled_idx"
ON "security-policy"."sensitive_operation_policies"("enabled");

CREATE TABLE "security-policy"."sensitive_operation_policy_change_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requested_enabled" BOOLEAN,
    "requested_requires_step_up" BOOLEAN,
    "requested_requires_maker_checker" BOOLEAN,
    "requested_freshness_minutes" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "feedback" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitive_operation_policy_change_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sensitive_operation_policy_change_requests_status_check"
      CHECK ("status" IN ('pending', 'approved', 'rejected')),
    CONSTRAINT "sensitive_operation_policy_change_requests_freshness_check"
      CHECK (
        "requested_freshness_minutes" IS NULL OR
        "requested_freshness_minutes" BETWEEN 1 AND 30
      ),
    CONSTRAINT "sensitive_operation_policy_change_requests_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sensitive_operation_policy_change_requests_operation_fkey"
      FOREIGN KEY ("operation")
      REFERENCES "security-policy"."sensitive_operation_policies"("operation")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "sensitive_operation_policy_change_requests_tenant_id_status_idx"
ON "security-policy"."sensitive_operation_policy_change_requests"("tenant_id", "status");

CREATE INDEX "sensitive_operation_policy_change_requests_operation_status_idx"
ON "security-policy"."sensitive_operation_policy_change_requests"("operation", "status");

CREATE INDEX "sensitive_operation_policy_change_requests_status_created_at_idx"
ON "security-policy"."sensitive_operation_policy_change_requests"("status", "created_at");

CREATE UNIQUE INDEX "sensitive_operation_policy_change_requests_one_pending_key"
ON "security-policy"."sensitive_operation_policy_change_requests"("tenant_id", "operation")
WHERE "status" = 'pending';
