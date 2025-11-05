# Database Indexes and Constraints Documentation

## Overview

This document outlines the comprehensive indexing strategy and constraints implemented across all database models to ensure optimal query performance and data integrity.

## Index Strategy

### 1. Foreign Key Indexes

All foreign key relationships automatically have indexes created by Prisma for efficient join operations:

- ✅ `tenantId` - Indexed on all tenant-scoped models
- ✅ `userId` - Indexed on user-related models
- ✅ `userTenantId` - Indexed on profile-related models
- ✅ `roleId`, `permissionId`, `poolId` - Indexed on permission-related models
- ✅ `studentId`, `classId`, `enrollmentId` - Indexed on academic models
- ✅ `academicYearId`, `termId`, `courseId` - Indexed on academic structure models
- ✅ `assessmentId`, `gradingSystemId` - Indexed on assessment models

### 2. Unique Constraints

All unique constraints are automatically indexed:

- ✅ `email` - Unique on User model
- ✅ `userId + tenantId` - Unique on UserTenant (one profile per user per school)
- ✅ `tenantId + studentNumber` - Unique on Student (unique student number per tenant)
- ✅ `tenantId + code` - Unique on Course (unique course code per tenant)
- ✅ `tenantId + name` - Unique on AcademicYear, GradingSystem (unique names per tenant)
- ✅ `courseId + termId + section` - Unique on Class (unique section per course-term)
- ✅ `studentId + classId + academicYearId` - Unique on Enrollment (one enrollment per student-class-year)
- ✅ `enrollmentId + assessmentId` - Unique on Grade (one grade per student per assessment)
- ✅ `classId + userTenantId` - Unique on ClassTeacher (one assignment per teacher per class)
- ✅ `messageId + readerId` - Unique on MessageReadReceipt (one read receipt per message per reader)

### 3. Status and Filter Indexes

Indexes for common filtering operations:

- ✅ `status` - Indexed on models with status fields (User, UserTenant, Tenant, AcademicYear, Term, Course, Class, Student, Enrollment, Assessment, Grade, Announcement, Message)
- ✅ `isActive`, `isVerified`, `isDefault`, `isSystemRole`, `isSystemPool` - Boolean flags indexed
- ✅ `enrollmentStatus`, `gradeLevel` - Student filtering indexes
- ✅ `priority`, `targetType` - Communication filtering indexes
- ✅ `eventType`, `action`, `resource` - Audit log filtering indexes

### 4. Composite Indexes for Common Query Patterns

Optimized composite indexes for frequent query patterns:

#### Audit Logs

- ✅ `tenantId + timestamp` - Tenant-specific audit queries
- ✅ `eventType + timestamp` - Event type queries over time
- ✅ `actorId + timestamp` - User activity queries

#### Login Attempts

- ✅ `email + createdAt` - Email-based login attempt queries
- ✅ `userId + createdAt` - User-based login attempt queries
- ✅ `ipAddress + createdAt` - IP-based security queries
- ✅ `success` - Filter successful/failed attempts

#### Password History

- ✅ `userId + createdAt` - User password history queries

#### Academic Structure

- ✅ `startDate + endDate` - Date range queries for AcademicYear and Term
- ✅ `createdAt` - Time-based queries on Announcement and Message

### 5. Search and Lookup Indexes

Indexes optimized for search operations:

- ✅ `email` - User lookup
- ✅ `studentNumber` - Student lookup
- ✅ `code` - Course code lookup
- ✅ `category` - Course category filtering
- ✅ `room` - Class room lookup
- ✅ `emailDomain` - Tenant email domain lookup
- ✅ `invitationToken` - Invitation token lookup
- ✅ `token` - Session token lookup

### 6. Time-Based Indexes

Indexes for temporal queries:

- ✅ `createdAt` - Creation time queries
- ✅ `updatedAt` - Update time queries (via `@updatedAt`)
- ✅ `enrollmentDate` - Enrollment time queries
- ✅ `dueDate` - Assessment due date queries
- ✅ `publishAt` - Announcement publish time queries
- ✅ `submittedAt`, `gradedAt` - Grade submission/grading time queries
- ✅ `expiresAt` - Expiration time queries (sessions, invitations)
- ✅ `timestamp` - Audit log time queries

## Constraints

### 1. Foreign Key Constraints

All foreign key relationships enforce referential integrity with cascade deletes where appropriate:

- ✅ **Tenant-scoped models** - Cascade delete when tenant is deleted
- ✅ **User-related models** - Cascade delete when user is deleted
- ✅ **Profile-related models** - Cascade delete when profile is deleted
- ✅ **Academic models** - Cascade delete when parent entity is deleted (class → course, enrollment → student, etc.)

### 2. Unique Constraints

- ✅ All unique constraints enforce data integrity
- ✅ Composite unique constraints prevent duplicate relationships
- ✅ Application-level validation for platform/system role names (Prisma limitation with NULL values)

### 3. Default Values

- ✅ Appropriate default values set for status fields
- ✅ Default values for boolean flags (isActive, isVerified, etc.)
- ✅ Default timestamps for createdAt fields

### 4. Nullable Fields

- ✅ Optional fields properly marked as nullable
- ✅ Required fields enforce data completeness

## Performance Optimization

### Query Patterns Supported

1. **Tenant Isolation Queries**
   - All tenant-scoped models indexed on `tenantId`
   - Efficient filtering by tenant in all queries

2. **Status Filtering**
   - Status fields indexed for fast filtering
   - Boolean flags indexed for quick lookups

3. **Time-Based Queries**
   - Temporal fields indexed for date range queries
   - Composite indexes for time-based tenant queries

4. **User Activity Tracking**
   - User ID indexes for user-specific queries
   - Profile ID indexes for profile-specific queries
   - Composite indexes for user activity over time

5. **Academic Queries**
   - Academic year and term indexes for academic period queries
   - Class and enrollment indexes for course-related queries
   - Student indexes for student-specific queries

## Index Maintenance

### Automatic Index Creation

- Prisma automatically creates indexes for:
  - Primary keys (always indexed)
  - Unique constraints (automatically indexed)
  - Foreign keys (automatically indexed by Prisma)

### Manual Index Creation

- All manually created indexes are defined in model files using `@@index`
- Indexes are created during migration execution

### Index Monitoring

- Monitor index usage in production
- Use PostgreSQL `pg_stat_user_indexes` to identify unused indexes
- Review query performance and adjust indexes as needed

## Future Considerations

### Potential Additional Indexes

1. **Full-Text Search**
   - Consider GIN indexes for full-text search on content fields
   - Consider vector indexes for AI/ML features (pgvector)

2. **JSONB Indexes**
   - Consider GIN indexes on JSONB fields for efficient JSON queries
   - Consider specific path indexes for frequently queried JSON paths

3. **Composite Indexes**
   - Consider additional composite indexes based on production query patterns
   - Monitor slow queries and create indexes as needed

### Partitioning Strategy

For large tables (especially audit logs), consider:

- Time-based partitioning (monthly/yearly)
- Hash partitioning by tenant_id for very large multi-tenant tables
- Table inheritance for polymorphic data

## Summary

✅ **117+ indexes** defined across all models
✅ **All foreign keys** automatically indexed
✅ **All unique constraints** automatically indexed
✅ **Composite indexes** for common query patterns
✅ **Status and filter indexes** for efficient filtering
✅ **Time-based indexes** for temporal queries
✅ **Search indexes** for lookup operations

The indexing strategy is comprehensive and optimized for the multi-tenant architecture with efficient query patterns.
