-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "academic-structure";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit-logging";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "communication";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "jwt-secrets";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "profile";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "roles-permissions";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "security-policy";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "student-management";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "user-management";

-- CreateTable
CREATE TABLE "academic-structure"."academic_years" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."terms" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "description" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."courses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "subject" TEXT,
    "grade_levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credits" DECIMAL(65,30),
    "hours" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'active',
    "prerequisites" TEXT,
    "objectives" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."classes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "current_enrollment" INTEGER NOT NULL DEFAULT 0,
    "schedule" JSONB,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."class_teachers" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,
    "unassigned_at" TIMESTAMP(3),
    "unassigned_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."grading_systems" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_type" TEXT NOT NULL,
    "gradeScale" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grading_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."assessments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "max_points" DECIMAL(65,30) NOT NULL,
    "weight" DECIMAL(65,30),
    "grading_system_id" TEXT,
    "assigned_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "graded_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "instructions" TEXT,
    "rubric" JSONB,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic-structure"."grades" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "points_earned" DECIMAL(65,30),
    "percentage" DECIMAL(65,30),
    "letter_grade" TEXT,
    "gpa_points" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "graded_at" TIMESTAMP(3),
    "graded_by" TEXT,
    "feedback" TEXT,
    "rubric_score" JSONB,
    "notes" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit-logging"."audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "event_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "actor_id" TEXT,
    "actor_profile_id" TEXT,
    "actor_role" TEXT,
    "actor_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "session_id" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "changes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_code" TEXT,
    "error_message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication"."announcements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publish_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "attachments" JSONB DEFAULT '[]',
    "metadata" JSONB,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication"."messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "sender_id" TEXT NOT NULL,
    "recipient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "attachments" JSONB DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication"."message_read_receipts" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "reader_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwt-secrets"."tenant_jwt_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "jwt_secret" TEXT NOT NULL,
    "secret_source" TEXT NOT NULL DEFAULT 'auto_generated',
    "secret_rotation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_secrets" JSONB NOT NULL DEFAULT '[]',
    "rotation_reason" TEXT,
    "emergency_rotation" BOOLEAN NOT NULL DEFAULT false,
    "managed_by" TEXT NOT NULL DEFAULT 'platform_admin',
    "accessible_by_schools" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_jwt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile"."user_tenants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspended_at" TIMESTAMP(3),
    "suspended_by" TEXT,
    "suspension_reason" TEXT,
    "invitation_token" TEXT,
    "invitation_expires_at" TIMESTAMP(3),
    "invitation_accepted_at" TIMESTAMP(3),
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile"."user_tenant_roles" (
    "id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "user_tenant_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile"."user_tenant_permissions" (
    "id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,

    CONSTRAINT "user_tenant_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role_type" TEXT NOT NULL,
    "clearance_level" INTEGER NOT NULL,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "tenant_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "context" TEXT,
    "category" TEXT NOT NULL,
    "required_clearance_level" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."permission_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clearance_level" INTEGER NOT NULL,
    "description" TEXT,
    "is_system_pool" BOOLEAN NOT NULL DEFAULT true,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."permission_pool_permissions" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT,

    CONSTRAINT "permission_pool_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles-permissions"."role_permission_pools" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "role_permission_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security-policy"."school_security_policies" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "policy_tier" TEXT NOT NULL,
    "require_mfa" BOOLEAN NOT NULL DEFAULT true,
    "require_mfa_for_sensitive_operations" BOOLEAN NOT NULL DEFAULT true,
    "sensitive_operations" JSONB NOT NULL DEFAULT '[]',
    "password_min_length" INTEGER NOT NULL DEFAULT 8,
    "password_require_uppercase" BOOLEAN NOT NULL DEFAULT true,
    "password_require_lowercase" BOOLEAN NOT NULL DEFAULT true,
    "password_require_numbers" BOOLEAN NOT NULL DEFAULT true,
    "password_require_special_chars" BOOLEAN NOT NULL DEFAULT false,
    "password_max_age" INTEGER NOT NULL DEFAULT 90,
    "password_prevent_reuse" INTEGER NOT NULL DEFAULT 5,
    "session_timeout" INTEGER NOT NULL DEFAULT 30,
    "require_mfa_for_session_extension" BOOLEAN NOT NULL DEFAULT true,
    "max_concurrent_sessions" INTEGER NOT NULL DEFAULT 3,
    "device_management" TEXT NOT NULL DEFAULT 'basic',
    "login_attempt_limit" INTEGER NOT NULL DEFAULT 5,
    "lockout_duration" INTEGER NOT NULL DEFAULT 15,
    "time_restrictions" JSONB,
    "ip_whitelist" JSONB,
    "require_vpn" BOOLEAN NOT NULL DEFAULT false,
    "audit_level" TEXT NOT NULL DEFAULT 'standard',
    "audit_retention" INTEGER NOT NULL DEFAULT 365,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "enforced_by" TEXT,
    "enforced_by_user_id" TEXT,
    "enforced_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "school_security_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student-management"."students" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "admission_number" TEXT,
    "admission_date" TIMESTAMP(3),
    "grade_level" TEXT,
    "enrollment_status" TEXT NOT NULL DEFAULT 'active',
    "personal_info" JSONB DEFAULT '{}',
    "academic_info" JSONB DEFAULT '{}',
    "health_info" JSONB DEFAULT '{}',
    "emergency_contacts" JSONB DEFAULT '[]',
    "guardian_info" JSONB DEFAULT '[]',
    "special_needs" JSONB DEFAULT '[]',
    "enrollment_date" TIMESTAMP(3),
    "graduation_date" TIMESTAMP(3),
    "withdrawal_date" TIMESTAMP(3),
    "transfer_date" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student-management"."enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "enrollment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "final_grade" TEXT,
    "credits_earned" DECIMAL(65,30),
    "gpa_points" DECIMAL(65,30),
    "notes" TEXT,
    "dropped_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "email_domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "settings" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."password_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."login_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_tenant_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_fingerprint" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."mfa_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "phone_number" TEXT,
    "email_address" TEXT,
    "webauthn_id" TEXT,
    "webauthn_public_key" TEXT,
    "webauthn_counter" INTEGER DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."mfa_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mfa_method_id" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "code_expires_at" TIMESTAMP(3),
    "webauthn_challenge" TEXT,
    "operation" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user-management"."mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_tenant_id_idx" ON "academic-structure"."academic_years"("tenant_id");

-- CreateIndex
CREATE INDEX "academic_years_status_idx" ON "academic-structure"."academic_years"("status");

-- CreateIndex
CREATE INDEX "academic_years_is_default_idx" ON "academic-structure"."academic_years"("is_default");

-- CreateIndex
CREATE INDEX "academic_years_start_date_end_date_idx" ON "academic-structure"."academic_years"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenant_id_name_key" ON "academic-structure"."academic_years"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "terms_academic_year_id_idx" ON "academic-structure"."terms"("academic_year_id");

-- CreateIndex
CREATE INDEX "terms_status_idx" ON "academic-structure"."terms"("status");

-- CreateIndex
CREATE INDEX "terms_order_idx" ON "academic-structure"."terms"("order");

-- CreateIndex
CREATE INDEX "terms_start_date_end_date_idx" ON "academic-structure"."terms"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "terms_academic_year_id_name_key" ON "academic-structure"."terms"("academic_year_id", "name");

-- CreateIndex
CREATE INDEX "courses_tenant_id_idx" ON "academic-structure"."courses"("tenant_id");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "academic-structure"."courses"("status");

-- CreateIndex
CREATE INDEX "courses_category_idx" ON "academic-structure"."courses"("category");

-- CreateIndex
CREATE INDEX "courses_code_idx" ON "academic-structure"."courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_tenant_id_code_key" ON "academic-structure"."courses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "classes_course_id_idx" ON "academic-structure"."classes"("course_id");

-- CreateIndex
CREATE INDEX "classes_term_id_idx" ON "academic-structure"."classes"("term_id");

-- CreateIndex
CREATE INDEX "classes_academic_year_id_idx" ON "academic-structure"."classes"("academic_year_id");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "academic-structure"."classes"("status");

-- CreateIndex
CREATE INDEX "classes_room_idx" ON "academic-structure"."classes"("room");

-- CreateIndex
CREATE UNIQUE INDEX "classes_course_id_term_id_section_key" ON "academic-structure"."classes"("course_id", "term_id", "section");

-- CreateIndex
CREATE INDEX "class_teachers_class_id_idx" ON "academic-structure"."class_teachers"("class_id");

-- CreateIndex
CREATE INDEX "class_teachers_user_tenant_id_idx" ON "academic-structure"."class_teachers"("user_tenant_id");

-- CreateIndex
CREATE INDEX "class_teachers_is_active_idx" ON "academic-structure"."class_teachers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "class_teachers_class_id_user_tenant_id_key" ON "academic-structure"."class_teachers"("class_id", "user_tenant_id");

-- CreateIndex
CREATE INDEX "grading_systems_tenant_id_idx" ON "academic-structure"."grading_systems"("tenant_id");

-- CreateIndex
CREATE INDEX "grading_systems_system_type_idx" ON "academic-structure"."grading_systems"("system_type");

-- CreateIndex
CREATE INDEX "grading_systems_is_default_idx" ON "academic-structure"."grading_systems"("is_default");

-- CreateIndex
CREATE INDEX "grading_systems_is_active_idx" ON "academic-structure"."grading_systems"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "grading_systems_tenant_id_name_key" ON "academic-structure"."grading_systems"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "assessments_class_id_idx" ON "academic-structure"."assessments"("class_id");

-- CreateIndex
CREATE INDEX "assessments_academic_year_id_idx" ON "academic-structure"."assessments"("academic_year_id");

-- CreateIndex
CREATE INDEX "assessments_term_id_idx" ON "academic-structure"."assessments"("term_id");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "academic-structure"."assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_due_date_idx" ON "academic-structure"."assessments"("due_date");

-- CreateIndex
CREATE INDEX "assessments_type_idx" ON "academic-structure"."assessments"("type");

-- CreateIndex
CREATE INDEX "grades_enrollment_id_idx" ON "academic-structure"."grades"("enrollment_id");

-- CreateIndex
CREATE INDEX "grades_assessment_id_idx" ON "academic-structure"."grades"("assessment_id");

-- CreateIndex
CREATE INDEX "grades_status_idx" ON "academic-structure"."grades"("status");

-- CreateIndex
CREATE INDEX "grades_submitted_at_idx" ON "academic-structure"."grades"("submitted_at");

-- CreateIndex
CREATE INDEX "grades_graded_at_idx" ON "academic-structure"."grades"("graded_at");

-- CreateIndex
CREATE UNIQUE INDEX "grades_enrollment_id_assessment_id_key" ON "academic-structure"."grades"("enrollment_id", "assessment_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit-logging"."audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit-logging"."audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit-logging"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit-logging"."audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit-logging"."audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit-logging"."audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_profile_id_idx" ON "audit-logging"."audit_logs"("actor_profile_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit-logging"."audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_status_idx" ON "audit-logging"."audit_logs"("status");

-- CreateIndex
CREATE INDEX "audit_logs_ip_address_idx" ON "audit-logging"."audit_logs"("ip_address");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_timestamp_idx" ON "audit-logging"."audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_timestamp_idx" ON "audit-logging"."audit_logs"("event_type", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_timestamp_idx" ON "audit-logging"."audit_logs"("actor_id", "timestamp");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_idx" ON "communication"."announcements"("tenant_id");

-- CreateIndex
CREATE INDEX "announcements_target_type_idx" ON "communication"."announcements"("target_type");

-- CreateIndex
CREATE INDEX "announcements_status_idx" ON "communication"."announcements"("status");

-- CreateIndex
CREATE INDEX "announcements_priority_idx" ON "communication"."announcements"("priority");

-- CreateIndex
CREATE INDEX "announcements_publish_at_idx" ON "communication"."announcements"("publish_at");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "communication"."announcements"("created_at");

-- CreateIndex
CREATE INDEX "messages_tenant_id_idx" ON "communication"."messages"("tenant_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "communication"."messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "communication"."messages"("thread_id");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "communication"."messages"("status");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "communication"."messages"("created_at");

-- CreateIndex
CREATE INDEX "messages_sent_at_idx" ON "communication"."messages"("sent_at");

-- CreateIndex
CREATE INDEX "message_read_receipts_message_id_idx" ON "communication"."message_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_reader_id_idx" ON "communication"."message_read_receipts"("reader_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_read_at_idx" ON "communication"."message_read_receipts"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_receipts_message_id_reader_id_key" ON "communication"."message_read_receipts"("message_id", "reader_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_jwt_configs_tenant_id_key" ON "jwt-secrets"."tenant_jwt_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_jwt_configs_tenant_id_idx" ON "jwt-secrets"."tenant_jwt_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_jwt_configs_secret_rotation_date_idx" ON "jwt-secrets"."tenant_jwt_configs"("secret_rotation_date");

-- CreateIndex
CREATE INDEX "user_tenants_user_id_idx" ON "profile"."user_tenants"("user_id");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "profile"."user_tenants"("tenant_id");

-- CreateIndex
CREATE INDEX "user_tenants_status_idx" ON "profile"."user_tenants"("status");

-- CreateIndex
CREATE INDEX "user_tenants_suspended_idx" ON "profile"."user_tenants"("suspended");

-- CreateIndex
CREATE INDEX "user_tenants_invitation_token_idx" ON "profile"."user_tenants"("invitation_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenants_user_id_tenant_id_key" ON "profile"."user_tenants"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "user_tenant_roles_user_tenant_id_idx" ON "profile"."user_tenant_roles"("user_tenant_id");

-- CreateIndex
CREATE INDEX "user_tenant_roles_role_id_idx" ON "profile"."user_tenant_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_tenant_roles_is_primary_idx" ON "profile"."user_tenant_roles"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenant_roles_user_tenant_id_role_id_key" ON "profile"."user_tenant_roles"("user_tenant_id", "role_id");

-- CreateIndex
CREATE INDEX "user_tenant_permissions_user_tenant_id_idx" ON "profile"."user_tenant_permissions"("user_tenant_id");

-- CreateIndex
CREATE INDEX "user_tenant_permissions_permission_id_idx" ON "profile"."user_tenant_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenant_permissions_user_tenant_id_permission_id_key" ON "profile"."user_tenant_permissions"("user_tenant_id", "permission_id");

-- CreateIndex
CREATE INDEX "roles_role_type_idx" ON "roles-permissions"."roles"("role_type");

-- CreateIndex
CREATE INDEX "roles_clearance_level_idx" ON "roles-permissions"."roles"("clearance_level");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles-permissions"."roles"("tenant_id");

-- CreateIndex
CREATE INDEX "roles_is_system_role_idx" ON "roles-permissions"."roles"("is_system_role");

-- CreateIndex
CREATE INDEX "roles_role_type_name_idx" ON "roles-permissions"."roles"("role_type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_tenant_id_key" ON "roles-permissions"."roles"("name", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "roles-permissions"."permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "roles-permissions"."permissions"("resource");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "roles-permissions"."permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "roles-permissions"."permissions"("category");

-- CreateIndex
CREATE INDEX "permissions_required_clearance_level_idx" ON "roles-permissions"."permissions"("required_clearance_level");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "roles-permissions"."permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "roles-permissions"."role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "roles-permissions"."role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "roles-permissions"."role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "permission_pools_clearance_level_idx" ON "roles-permissions"."permission_pools"("clearance_level");

-- CreateIndex
CREATE INDEX "permission_pools_is_system_pool_idx" ON "roles-permissions"."permission_pools"("is_system_pool");

-- CreateIndex
CREATE INDEX "permission_pools_tenant_id_idx" ON "roles-permissions"."permission_pools"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_pools_name_tenant_id_key" ON "roles-permissions"."permission_pools"("name", "tenant_id");

-- CreateIndex
CREATE INDEX "permission_pool_permissions_pool_id_idx" ON "roles-permissions"."permission_pool_permissions"("pool_id");

-- CreateIndex
CREATE INDEX "permission_pool_permissions_permission_id_idx" ON "roles-permissions"."permission_pool_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_pool_permissions_pool_id_permission_id_key" ON "roles-permissions"."permission_pool_permissions"("pool_id", "permission_id");

-- CreateIndex
CREATE INDEX "role_permission_pools_role_id_idx" ON "roles-permissions"."role_permission_pools"("role_id");

-- CreateIndex
CREATE INDEX "role_permission_pools_pool_id_idx" ON "roles-permissions"."role_permission_pools"("pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_pools_role_id_pool_id_key" ON "roles-permissions"."role_permission_pools"("role_id", "pool_id");

-- CreateIndex
CREATE INDEX "school_security_policies_policy_tier_idx" ON "security-policy"."school_security_policies"("policy_tier");

-- CreateIndex
CREATE INDEX "school_security_policies_is_emergency_idx" ON "security-policy"."school_security_policies"("is_emergency");

-- CreateIndex
CREATE UNIQUE INDEX "school_security_policies_school_id_key" ON "security-policy"."school_security_policies"("school_id");

-- CreateIndex
CREATE INDEX "students_tenant_id_idx" ON "student-management"."students"("tenant_id");

-- CreateIndex
CREATE INDEX "students_user_tenant_id_idx" ON "student-management"."students"("user_tenant_id");

-- CreateIndex
CREATE INDEX "students_enrollment_status_idx" ON "student-management"."students"("enrollment_status");

-- CreateIndex
CREATE INDEX "students_grade_level_idx" ON "student-management"."students"("grade_level");

-- CreateIndex
CREATE INDEX "students_studentNumber_idx" ON "student-management"."students"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_studentNumber_key" ON "student-management"."students"("tenant_id", "studentNumber");

-- CreateIndex
CREATE INDEX "enrollments_student_id_idx" ON "student-management"."enrollments"("student_id");

-- CreateIndex
CREATE INDEX "enrollments_class_id_idx" ON "student-management"."enrollments"("class_id");

-- CreateIndex
CREATE INDEX "enrollments_academic_year_id_idx" ON "student-management"."enrollments"("academic_year_id");

-- CreateIndex
CREATE INDEX "enrollments_term_id_idx" ON "student-management"."enrollments"("term_id");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "student-management"."enrollments"("status");

-- CreateIndex
CREATE INDEX "enrollments_enrollment_date_idx" ON "student-management"."enrollments"("enrollment_date");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_class_id_academic_year_id_key" ON "student-management"."enrollments"("student_id", "class_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenant"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenant"."tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_email_domain_idx" ON "tenant"."tenants"("email_domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "user-management"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "user-management"."users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "user-management"."users"("is_active");

-- CreateIndex
CREATE INDEX "users_is_verified_idx" ON "user-management"."users"("is_verified");

-- CreateIndex
CREATE INDEX "password_histories_user_id_created_at_idx" ON "user-management"."password_histories"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "user-management"."login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_user_id_created_at_idx" ON "user-management"."login_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_created_at_idx" ON "user-management"."login_attempts"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_success_idx" ON "user-management"."login_attempts"("success");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "user-management"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "user-management"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_tenant_id_idx" ON "user-management"."sessions"("user_tenant_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "user-management"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "user-management"."sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "user-management"."sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "mfa_methods_user_id_idx" ON "user-management"."mfa_methods"("user_id");

-- CreateIndex
CREATE INDEX "mfa_methods_user_id_type_idx" ON "user-management"."mfa_methods"("user_id", "type");

-- CreateIndex
CREATE INDEX "mfa_methods_user_id_is_active_idx" ON "user-management"."mfa_methods"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "mfa_methods_user_id_is_primary_idx" ON "user-management"."mfa_methods"("user_id", "is_primary");

-- CreateIndex
CREATE INDEX "mfa_challenges_user_id_idx" ON "user-management"."mfa_challenges"("user_id");

-- CreateIndex
CREATE INDEX "mfa_challenges_user_id_verified_idx" ON "user-management"."mfa_challenges"("user_id", "verified");

-- CreateIndex
CREATE INDEX "mfa_challenges_user_id_expires_at_idx" ON "user-management"."mfa_challenges"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "mfa_challenges_code_idx" ON "user-management"."mfa_challenges"("code");

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "user-management"."mfa_recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_user_id_used_idx" ON "user-management"."mfa_recovery_codes"("user_id", "used");

-- AddForeignKey
ALTER TABLE "academic-structure"."academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."terms" ADD CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."classes" ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic-structure"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."classes" ADD CONSTRAINT "classes_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic-structure"."terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."class_teachers" ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic-structure"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."class_teachers" ADD CONSTRAINT "class_teachers_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."grading_systems" ADD CONSTRAINT "grading_systems_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."assessments" ADD CONSTRAINT "assessments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic-structure"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."assessments" ADD CONSTRAINT "assessments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."assessments" ADD CONSTRAINT "assessments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic-structure"."terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."assessments" ADD CONSTRAINT "assessments_grading_system_id_fkey" FOREIGN KEY ("grading_system_id") REFERENCES "academic-structure"."grading_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."grades" ADD CONSTRAINT "grades_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "student-management"."enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic-structure"."grades" ADD CONSTRAINT "grades_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "academic-structure"."assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit-logging"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."announcements" ADD CONSTRAINT "announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "communication"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "communication"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."message_read_receipts" ADD CONSTRAINT "message_read_receipts_reader_id_fkey" FOREIGN KEY ("reader_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jwt-secrets"."tenant_jwt_configs" ADD CONSTRAINT "tenant_jwt_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles-permissions"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenant_permissions" ADD CONSTRAINT "user_tenant_permissions_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_tenant_permissions" ADD CONSTRAINT "user_tenant_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "roles-permissions"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles-permissions"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "roles-permissions"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."permission_pools" ADD CONSTRAINT "permission_pools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."permission_pool_permissions" ADD CONSTRAINT "permission_pool_permissions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "roles-permissions"."permission_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."permission_pool_permissions" ADD CONSTRAINT "permission_pool_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "roles-permissions"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."role_permission_pools" ADD CONSTRAINT "role_permission_pools_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles-permissions"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles-permissions"."role_permission_pools" ADD CONSTRAINT "role_permission_pools_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "roles-permissions"."permission_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security-policy"."school_security_policies" ADD CONSTRAINT "school_security_policies_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."students" ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."students" ADD CONSTRAINT "students_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student-management"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic-structure"."classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."enrollments" ADD CONSTRAINT "enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic-structure"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student-management"."enrollments" ADD CONSTRAINT "enrollments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic-structure"."terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user-management"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user-management"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."password_histories" ADD CONSTRAINT "password_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."sessions" ADD CONSTRAINT "sessions_user_tenant_id_fkey" FOREIGN KEY ("user_tenant_id") REFERENCES "profile"."user_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."mfa_challenges" ADD CONSTRAINT "mfa_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."mfa_challenges" ADD CONSTRAINT "mfa_challenges_mfa_method_id_fkey" FOREIGN KEY ("mfa_method_id") REFERENCES "user-management"."mfa_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user-management"."mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user-management"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
