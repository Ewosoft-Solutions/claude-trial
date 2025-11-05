-- ============================================
-- Row-Level Security (RLS) Policies
-- ============================================
-- 
-- This migration enables Row-Level Security on all tenant-scoped tables
-- and creates policies to enforce tenant data isolation.
-- 
-- RLS provides an additional security layer at the database level,
-- ensuring that even if application-level filtering fails, data isolation is maintained.
--
-- ============================================

-- Enable RLS on all tenant-scoped tables
-- Note: This is a reference migration file. Actual RLS policies should be
-- created and managed through Prisma migrations or separate migration files.

-- ============================================
-- 1. Enable RLS on Tenant-Scoped Tables
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Create Tenant Isolation Policies
-- ============================================

-- Policy for AcademicYear table
CREATE POLICY tenant_isolation_academic_years ON academic_years
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy for Term table
CREATE POLICY tenant_isolation_terms ON terms
    FOR ALL
    USING (
        academic_year_id IN (
            SELECT id FROM academic_years 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

-- Policy for Course table
CREATE POLICY tenant_isolation_courses ON courses
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy for Class table
CREATE POLICY tenant_isolation_classes ON classes
    FOR ALL
    USING (
        course_id IN (
            SELECT id FROM courses 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

-- Policy for Student table
CREATE POLICY tenant_isolation_students ON students
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy for Enrollment table
CREATE POLICY tenant_isolation_enrollments ON enrollments
    FOR ALL
    USING (
        student_id IN (
            SELECT id FROM students 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

-- Policy for Assessment table
CREATE POLICY tenant_isolation_assessments ON assessments
    FOR ALL
    USING (
        class_id IN (
            SELECT id FROM classes 
            WHERE course_id IN (
                SELECT id FROM courses 
                WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
            )
        )
    );

-- Policy for Grade table
CREATE POLICY tenant_isolation_grades ON grades
    FOR ALL
    USING (
        enrollment_id IN (
            SELECT id FROM enrollments 
            WHERE student_id IN (
                SELECT id FROM students 
                WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
            )
        )
    );

-- Policy for GradingSystem table
CREATE POLICY tenant_isolation_grading_systems ON grading_systems
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy for Announcement table
CREATE POLICY tenant_isolation_announcements ON announcements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy for Message table
CREATE POLICY tenant_isolation_messages ON messages
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- 3. Special Policies for User-Tenant Tables
-- ============================================

-- Policy for UserTenant - users can only see their own profiles
CREATE POLICY user_tenant_isolation ON user_tenants
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::UUID
        OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

-- Policy for UserTenantRole - users can see roles for their profiles
CREATE POLICY user_tenant_role_isolation ON user_tenant_roles
    FOR SELECT
    USING (
        user_tenant_id IN (
            SELECT id FROM user_tenants 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

-- ============================================
-- 4. Platform Admin Bypass Policies
-- ============================================
-- 
-- Platform admins (Architect, SuperAdmin) need to bypass RLS
-- to access all tenants. This is handled at application level,
-- but we can create policies that allow bypass for specific roles.
--
-- Note: Platform admin bypass should be implemented carefully
-- and only through secure application-level checks.

-- ============================================
-- 5. Notes on RLS Implementation
-- ============================================
--
-- 1. Set tenant context before queries:
--    SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
--
-- 2. Set user context for user-specific policies:
--    SET LOCAL app.current_user_id = 'user-uuid-here';
--
-- 3. Context is session-local (not transaction-local)
--    Use SET LOCAL for transaction-scoped context
--    Use SET for session-scoped context
--
-- 4. Application must set context on every database connection
--    This should be done in database connection middleware
--
-- 5. RLS policies are evaluated for ALL operations (SELECT, INSERT, UPDATE, DELETE)
--    Policies using FOR ALL apply to all operations
--
-- 6. Platform admins should bypass RLS at application level,
--    not through database policies (security best practice)

