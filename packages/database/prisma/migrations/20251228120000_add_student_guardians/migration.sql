-- CreateTable
CREATE TABLE "student-management"."student_guardians" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'parent',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "legal_guardian" BOOLEAN NOT NULL DEFAULT false,
    "contact_priority" INTEGER,
    "notes" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_student_id_user_tenant_id_key" ON "student-management"."student_guardians"("student_id", "user_tenant_id");

-- CreateIndex
CREATE INDEX "student_guardians_tenant_id_idx" ON "student-management"."student_guardians"("tenant_id");

-- CreateIndex
CREATE INDEX "student_guardians_student_id_idx" ON "student-management"."student_guardians"("student_id");

-- CreateIndex
CREATE INDEX "student_guardians_user_tenant_id_idx" ON "student-management"."student_guardians"("user_tenant_id");

-- AddForeignKey
ALTER TABLE "student-management"."student_guardians" ADD CONSTRAINT "student_guardians_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."student_guardians" ADD CONSTRAINT "student_guardians_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

