/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,guardian_identifier]` on the table `student_guardians` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "student-management"."student_guardians" ADD COLUMN     "guardian_identifier" TEXT;

-- CreateIndex
CREATE INDEX "student_guardians_guardian_identifier_idx" ON "student-management"."student_guardians"("guardian_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_tenant_id_guardian_identifier_key" ON "student-management"."student_guardians"("tenant_id", "guardian_identifier");
