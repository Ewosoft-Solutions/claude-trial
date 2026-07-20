# Database Design Specification

## Overview

This document defines the complete database architecture for the polymorphic school management application, supporting multi-tenant SaaS deployment with flexible, adaptive data models for different educational levels.

## Architecture Strategy

### **Multi-Tenant Database Design**

**Hybrid Approach (Most Secure & Scalable):**

- **Shared Database** with `tenant_id` for non-sensitive data (courses, schedules, settings)
- **Separate Schemas** per tenant for sensitive data (student records, grades, personal info)
- **Row-Level Security (RLS)** policies as additional protection layer
- **Encryption at Rest** for all sensitive data

### **Polymorphic Data Model**

**Flexible Entity Structure:**

- **Base Entities** with polymorphic relationships
- **Configurable Attributes** for different school types
- **Extensible Schema** for custom fields per tenant
- **Versioned Data Models** for schema evolution

## Technology Stack

### **Primary Database: PostgreSQL 15+**

**Why PostgreSQL:**

- **JSONB Support** for flexible, polymorphic data
- **Row-Level Security** for tenant isolation
- **Full-Text Search** for AI knowledge bases
- **Extensions** (pgvector for AI embeddings)
- **ACID Compliance** for data integrity
- **Scalability** with read replicas

### **Vector Database: pgvector Extension**

**For AI Integration:**

- **Embeddings Storage** for lesson materials
- **Similarity Search** for AI responses
- **Integrated** with main database
- **Cost-Effective** (no separate service)

## Core Entity Design

### **1. User Management System**

#### **Users Table (Polymorphic Base)**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN (
        'architect', 'superadmin', 'owner', 'management', 'itsupport',
        'finance', 'operations', 'teacher', 'parent', 'student', 'guest'
    )),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_tenant_type ON users(tenant_id, user_type);
```

#### **User Profiles (Polymorphic)**

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_type VARCHAR(50) NOT NULL, -- 'student_profile', 'teacher_profile', etc.
    profile_data JSONB NOT NULL DEFAULT '{}',
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_type ON user_profiles(profile_type);
CREATE INDEX idx_user_profiles_data ON user_profiles USING GIN (profile_data);
```

#### **Roles and Permissions**

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN (
        'system', 'custom', 'platform'
    )),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, name)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    context VARCHAR(100), -- 'tenant', 'school', 'class', 'student'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id, tenant_id)
);
```

### **2. Multi-Tenant Architecture**

#### **Tenants Table**

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'suspended', 'pending', 'cancelled'
    )),
    plan_type VARCHAR(50) DEFAULT 'basic' CHECK (plan_type IN (
        'basic', 'standard', 'premium', 'enterprise'
    )),
    settings JSONB DEFAULT '{}',
    billing_info JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
```

#### **Schools Table (Tenant-Specific)**

```sql
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    school_type VARCHAR(50) NOT NULL CHECK (school_type IN (
        'elementary', 'middle_school', 'high_school', 'university',
        'vocational', 'special_education', 'international'
    )),
    address JSONB,
    contact_info JSONB,
    academic_config JSONB DEFAULT '{}',
    branding_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_schools_tenant_id ON schools(tenant_id);
CREATE INDEX idx_schools_type ON schools(school_type);
CREATE INDEX idx_schools_tenant_type ON schools(tenant_id, school_type);
```

### **3. Academic Structure (Polymorphic)**

#### **Academic Years and Terms**

```sql
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, school_id, name)
);

CREATE TABLE academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    term_number INTEGER NOT NULL,
    is_current BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(academic_year_id, name)
);
```

#### **Courses (Polymorphic)**

```sql
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    course_type VARCHAR(50) NOT NULL CHECK (course_type IN (
        'core', 'elective', 'extracurricular', 'remedial', 'advanced'
    )),
    subject_area VARCHAR(100),
    grade_level VARCHAR(50),
    credits DECIMAL(3,1),
    prerequisites JSONB DEFAULT '[]',
    learning_objectives JSONB DEFAULT '[]',
    assessment_criteria JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, school_id, course_code)
);

-- Indexes
CREATE INDEX idx_courses_tenant_school ON courses(tenant_id, school_id);
CREATE INDEX idx_courses_type ON courses(course_type);
CREATE INDEX idx_courses_subject ON courses(subject_area);
CREATE INDEX idx_courses_grade_level ON courses(grade_level);
```

#### **Classes and Sections**

```sql
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    section VARCHAR(50),
    capacity INTEGER,
    current_enrollment INTEGER DEFAULT 0,
    room VARCHAR(100),
    schedule JSONB DEFAULT '{}',
    teacher_id UUID REFERENCES users(id),
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, school_id, class_code, academic_year_id)
);

-- Indexes
CREATE INDEX idx_classes_tenant_school ON classes(tenant_id, school_id);
CREATE INDEX idx_classes_course ON classes(course_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year_id);
```

### **4. Student Management**

#### **Students Table**

```sql
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL,
    admission_number VARCHAR(50),
    admission_date DATE,
    grade_level VARCHAR(50),
    class_id UUID REFERENCES classes(id),
    enrollment_status VARCHAR(50) DEFAULT 'active' CHECK (enrollment_status IN (
        'active', 'inactive', 'suspended', 'graduated', 'transferred', 'withdrawn'
    )),
    personal_info JSONB DEFAULT '{}',
    academic_info JSONB DEFAULT '{}',
    health_info JSONB DEFAULT '{}',
    emergency_contacts JSONB DEFAULT '[]',
    guardian_info JSONB DEFAULT '[]',
    special_needs JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, school_id, student_number)
);

-- Indexes
CREATE INDEX idx_students_tenant_school ON students(tenant_id, school_id);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_status ON students(enrollment_status);
CREATE INDEX idx_students_grade ON students(grade_level);
```

#### **Enrollments**

```sql
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    enrollment_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'dropped', 'completed', 'failed'
    )),
    final_grade VARCHAR(10),
    credits_earned DECIMAL(3,1),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, class_id, academic_year_id)
);

-- Indexes
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_academic_year ON enrollments(academic_year_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
```

### **5. Assessment and Grading**

#### **Grading Systems (Polymorphic)**

```sql
CREATE TABLE grading_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    system_type VARCHAR(50) NOT NULL CHECK (system_type IN (
        'percentage', 'letter_grade', 'gpa', 'pass_fail', 'custom'
    )),
    grade_scale JSONB NOT NULL, -- Flexible grade definitions
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Example grade_scale JSONB structure:
-- {
--   "A+": {"min": 97, "max": 100, "points": 4.0},
--   "A": {"min": 93, "max": 96, "points": 4.0},
--   "A-": {"min": 90, "max": 92, "points": 3.7}
-- }
```

#### **Assessments**

```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    assessment_type VARCHAR(50) NOT NULL CHECK (assessment_type IN (
        'exam', 'quiz', 'assignment', 'project', 'presentation', 'participation'
    )),
    total_points DECIMAL(6,2) NOT NULL,
    weight DECIMAL(5,2) NOT NULL, -- Percentage weight in final grade
    due_date TIMESTAMP,
    instructions TEXT,
    rubric JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_assessments_class ON assessments(class_id);
CREATE INDEX idx_assessments_type ON assessments(assessment_type);
CREATE INDEX idx_assessments_due_date ON assessments(due_date);
```

#### **Grades**

```sql
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    points_earned DECIMAL(6,2),
    percentage DECIMAL(5,2),
    letter_grade VARCHAR(10),
    gpa_points DECIMAL(3,2),
    feedback TEXT,
    graded_at TIMESTAMP,
    graded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, assessment_id)
);

-- Indexes
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_grades_assessment ON grades(assessment_id);
CREATE INDEX idx_grades_graded_by ON grades(graded_by);
```

### **6. AI Integration**

#### **AI Knowledge Base**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
        'lesson', 'document', 'resource', 'faq', 'policy'
    )),
    content_id UUID, -- Reference to source content
    title VARCHAR(255) NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding vector
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_ai_knowledge_tenant ON ai_knowledge_base(tenant_id);
CREATE INDEX idx_ai_knowledge_type ON ai_knowledge_base(content_type);
CREATE INDEX idx_ai_knowledge_tags ON ai_knowledge_base USING GIN (tags);
CREATE INDEX idx_ai_knowledge_metadata ON ai_knowledge_base USING GIN (metadata);
-- Vector similarity search index
CREATE INDEX idx_ai_knowledge_embedding ON ai_knowledge_base
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### **AI Chat Sessions**

```sql
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN (
        'academic', 'analytics', 'general'
    )),
    title VARCHAR(255),
    messages JSONB DEFAULT '[]', -- Chat history
    context JSONB DEFAULT '{}', -- Session context
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_chat_tenant_user ON ai_chat_sessions(tenant_id, user_id);
CREATE INDEX idx_ai_chat_type ON ai_chat_sessions(session_type);
CREATE INDEX idx_ai_chat_active ON ai_chat_sessions(is_active);
CREATE INDEX idx_ai_chat_last_message ON ai_chat_sessions(last_message_at);
```

### **7. Communication System**

#### **Messages**

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_group VARCHAR(50), -- 'all_students', 'all_teachers', 'all_parents'
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN (
        'announcement', 'notification', 'reminder', 'alert', 'personal'
    )),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_priority ON messages(priority);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### **8. Audit and Monitoring**

#### **Audit Logs**

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY HASH (tenant_id);

-- Create partitions for audit logs
CREATE TABLE audit_logs_0 PARTITION OF audit_logs
    FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE audit_logs_1 PARTITION OF audit_logs
    FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE audit_logs_2 PARTITION OF audit_logs
    FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE audit_logs_3 PARTITION OF audit_logs
    FOR VALUES WITH (modulus 4, remainder 3);

-- Indexes
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

#### **System Monitoring**

```sql
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_system_metrics_tenant ON system_metrics(tenant_id);
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at);
```

## Security Implementation

### **Row-Level Security (RLS)**

#### **Enable RLS on All Tenant Tables**

```sql
-- Enable RLS on all tables with tenant_id
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ... enable for all tenant-specific tables
```

#### **Create RLS Policies**

```sql
-- Tenant isolation policy for users
CREATE POLICY tenant_isolation_users ON users
    FOR ALL TO authenticated_users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Tenant isolation policy for students
CREATE POLICY tenant_isolation_students ON students
    FOR ALL TO authenticated_users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Role-based access policy for sensitive data
CREATE POLICY student_data_access ON students
    FOR ALL TO authenticated_users
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            -- Students can only see their own data
            (current_setting('app.current_user_type') = 'student' AND user_id = current_setting('app.current_user_id')::UUID)
            OR
            -- Teachers can see students in their classes
            (current_setting('app.current_user_type') = 'teacher' AND class_id IN (
                SELECT id FROM classes WHERE teacher_id = current_setting('app.current_user_id')::UUID
            ))
            OR
            -- Parents can see their children's data
            (current_setting('app.current_user_type') = 'parent' AND user_id IN (
                SELECT user_id FROM students WHERE guardian_info @>
                jsonb_build_array(jsonb_build_object('user_id', current_setting('app.current_user_id')::UUID))
            ))
            OR
            -- Admins and management can see all data
            current_setting('app.current_user_type') IN ('admin', 'management', 'superadmin')
        )
    );
```

### **Data Encryption**

#### **Encrypt Sensitive Fields**

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted columns for sensitive data
ALTER TABLE students ADD COLUMN ssn_encrypted BYTEA;
ALTER TABLE students ADD COLUMN medical_info_encrypted BYTEA;

-- Example encryption function
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

-- Example decryption function
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, key);
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

### **Indexing Strategy**

#### **Tenant-Based Indexes**

```sql
-- Multi-column indexes for tenant queries
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_students_tenant_school ON students(tenant_id, school_id);
CREATE INDEX idx_courses_tenant_school ON courses(tenant_id, school_id);
CREATE INDEX idx_classes_tenant_school ON classes(tenant_id, school_id);
```

#### **Polymorphic Indexes**

```sql
-- Indexes for polymorphic queries
CREATE INDEX idx_user_profiles_user_type ON user_profiles(user_id, profile_type);
CREATE INDEX idx_courses_school_type ON courses(school_id, course_type);
CREATE INDEX idx_assessments_class_type ON assessments(class_id, assessment_type);
```

#### **AI-Specific Indexes**

```sql
-- Vector similarity search index
CREATE INDEX idx_ai_knowledge_embedding ON ai_knowledge_base
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_ai_knowledge_content_fts ON ai_knowledge_base
    USING gin(to_tsvector('english', content_text));
```

### **Partitioning Strategy**

#### **Time-Based Partitioning for Audit Logs**

```sql
-- Partition audit logs by month
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_y2024m02 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

#### **Hash Partitioning for Large Tables**

```sql
-- Partition large tables by tenant_id
CREATE TABLE messages_partitioned (
    LIKE messages INCLUDING ALL
) PARTITION BY HASH (tenant_id);

-- Create hash partitions
CREATE TABLE messages_0 PARTITION OF messages_partitioned
    FOR VALUES WITH (modulus 4, remainder 0);
```

## Migration Strategy

### **Schema Versioning**

```sql
-- Migration tracking table
CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW(),
    description TEXT,
    checksum VARCHAR(64)
);

-- Insert initial migration
INSERT INTO schema_migrations (version, description)
VALUES ('001_initial_schema', 'Initial database schema creation');
```

### **Migration Scripts**

#### **Initial Schema Migration**

```sql
-- 001_initial_schema.sql
BEGIN;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create tables (as defined above)
-- ... all table creation statements ...

-- Create indexes
-- ... all index creation statements ...

-- Create RLS policies
-- ... all policy creation statements ...

-- Insert default data
INSERT INTO permissions (name, description, resource, action, context) VALUES
('users.create', 'Create new users', 'users', 'create', 'tenant'),
('users.read', 'Read user information', 'users', 'read', 'tenant'),
('users.update', 'Update user information', 'users', 'update', 'tenant'),
('users.delete', 'Delete users', 'users', 'delete', 'tenant'),
-- ... add all 300+ permissions ...

COMMIT;
```

#### **Polymorphic Feature Migration**

```sql
-- 002_polymorphic_features.sql
BEGIN;

-- Add polymorphic columns to existing tables
ALTER TABLE schools ADD COLUMN academic_config JSONB DEFAULT '{}';
ALTER TABLE schools ADD COLUMN branding_config JSONB DEFAULT '{}';

-- Create polymorphic user profiles table
CREATE TABLE user_profiles (
    -- ... table definition ...
);

-- Update existing data
UPDATE schools SET academic_config = '{}' WHERE academic_config IS NULL;
UPDATE schools SET branding_config = '{}' WHERE branding_config IS NULL;

COMMIT;
```

### **Data Migration Scripts**

#### **Tenant Data Migration**

```sql
-- migrate_tenant_data.sql
DO $$
DECLARE
    tenant_record RECORD;
    new_tenant_id UUID;
BEGIN
    -- Create new tenant
    INSERT INTO tenants (name, slug, subdomain, status, plan_type)
    VALUES ('Sample School', 'sample-school', 'sample', 'active', 'basic')
    RETURNING id INTO new_tenant_id;

    -- Migrate existing data to new tenant
    UPDATE users SET tenant_id = new_tenant_id WHERE tenant_id IS NULL;
    UPDATE schools SET tenant_id = new_tenant_id WHERE tenant_id IS NULL;
    -- ... update all tenant-specific tables ...

    RAISE NOTICE 'Tenant migration completed for tenant_id: %', new_tenant_id;
END $$;
```

## Backup and Recovery

### **Backup Strategy**

```sql
-- Full backup script
-- pg_dump -h localhost -U postgres -d school_management --format=custom --compress=9 --file=backup_$(date +%Y%m%d_%H%M%S).dump

-- Tenant-specific backup
-- pg_dump -h localhost -U postgres -d school_management --format=custom --compress=9 --file=tenant_backup_$(date +%Y%m%d_%H%M%S).dump --table=tenants --table=users --table=students
```

### **Point-in-Time Recovery**

```sql
-- Enable WAL archiving
-- archive_mode = on
-- archive_command = 'cp %p /backup/wal/%f'
-- wal_level = replica
-- max_wal_senders = 3
-- wal_keep_segments = 64
```

## Monitoring and Maintenance

### **Performance Monitoring Queries**

```sql
-- Slow query detection
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000 -- queries taking more than 1 second
ORDER BY mean_time DESC;

-- Table size monitoring
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage monitoring
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0 -- unused indexes
ORDER BY schemaname, tablename;
```

### **Maintenance Tasks**

```sql
-- Vacuum and analyze tables
VACUUM ANALYZE;

-- Reindex large tables
REINDEX TABLE users;
REINDEX TABLE students;
REINDEX TABLE grades;

-- Update table statistics
ANALYZE;
```

## Implementation Phases

### **Phase 1: Core Foundation (Weeks 1-2)**

1. **User Management** - Authentication and authorization
2. **Tenant Isolation** - Multi-tenant security
3. **Basic Academic Structure** - Schools, courses, users

### **Phase 2: Polymorphic Features (Weeks 3-4)**

1. **Configurable Attributes** - School-specific fields
2. **Flexible Relationships** - Polymorphic associations
3. **Dynamic Schemas** - Runtime configuration

### **Phase 3: AI Integration (Weeks 5-6)**

1. **Vector Database** - pgvector setup
2. **Knowledge Base** - Content embeddings
3. **Chat History** - Persistent conversations

### **Phase 4: Performance & Scale (Weeks 7-8)**

1. **Indexing Strategy** - Performance optimization
2. **Partitioning** - Large table management
3. **Caching Layer** - Redis integration

## Database Sizing and Scaling

### **Initial Sizing**

- **Database Size**: 100GB for 100 schools, 10K students each
- **Growth Rate**: 10% monthly data increase
- **Peak Load**: 1000 concurrent users per tenant

### **Scaling Strategy**

- **Read Replicas**: For read-heavy operations
- **Connection Pooling**: PgBouncer for connection management
- **Horizontal Partitioning**: By tenant for very large deployments
- **Caching**: Redis for frequently accessed data

### **Resource Requirements**

- **CPU**: 8 cores minimum, 16 cores recommended
- **RAM**: 32GB minimum, 64GB recommended
- **Storage**: SSD with 500GB minimum, 1TB recommended
- **Network**: 1Gbps minimum, 10Gbps recommended

This comprehensive database design provides a solid foundation for the polymorphic school management application with multi-tenant support, AI integration, and scalable architecture.
