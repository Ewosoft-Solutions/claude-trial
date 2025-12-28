-- CreateTable
CREATE TABLE "roles-permissions"."maker_checker_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "operation" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maker_id" TEXT NOT NULL,
    "maker_clearance_level" INTEGER NOT NULL,
    "checker_id" TEXT,
    "checker_clearance_level" INTEGER,
    "request_data" JSONB NOT NULL,
    "approval_reason" TEXT,
    "rejection_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maker_checker_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maker_checker_requests_tenant_id_idx" ON "roles-permissions"."maker_checker_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "maker_checker_requests_operation_idx" ON "roles-permissions"."maker_checker_requests"("operation");

-- CreateIndex
CREATE INDEX "maker_checker_requests_status_idx" ON "roles-permissions"."maker_checker_requests"("status");
