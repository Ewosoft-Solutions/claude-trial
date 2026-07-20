-- CreateIndex
CREATE INDEX "announcements_tenant_id_status_idx" ON "communication"."announcements"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_created_at_idx" ON "communication"."announcements"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_tenant_id_sender_id_idx" ON "communication"."messages"("tenant_id", "sender_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_created_at_idx" ON "communication"."messages"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "students_tenant_id_enrollment_status_idx" ON "student-management"."students"("tenant_id", "enrollment_status");

-- CreateIndex
CREATE INDEX "students_tenant_id_grade_level_idx" ON "student-management"."students"("tenant_id", "grade_level");
