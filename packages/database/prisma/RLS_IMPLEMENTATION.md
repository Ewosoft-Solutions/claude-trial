# Row-Level Security (RLS) Implementation Guide

## Overview

Row-Level Security (RLS) provides database-level data isolation for multi-tenant applications. This document describes how RLS is implemented and how to use it.

## What is Row-Level Security?

RLS is a PostgreSQL feature that automatically filters rows based on policies. Even if application-level filtering fails or is bypassed, RLS ensures users can only access data they're authorized to see.

## Implementation Strategy

### 1. Enable RLS on Tables

RLS must be enabled on all tenant-scoped tables:

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
-- ... enable for all tenant-scoped tables
```

### 2. Create RLS Policies

RLS policies define what data users can access. Policies use PostgreSQL session variables to get tenant context:

```sql
CREATE POLICY tenant_isolation_students ON students
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

### 3. Set Tenant Context

Before executing queries, set the tenant context in the database session:

```typescript
import { setTenantContext } from '@workspace/database/rls';

await setTenantContext(prisma, tenantId);
const students = await prisma.student.findMany();
```

## Usage

### Basic Usage

```typescript
import { prisma } from '@workspace/database/client';
import { withTenantContext } from '@workspace/database/rls';

// Execute query with tenant context
const students = await withTenantContext(prisma, tenantId, async () => {
  return await prisma.student.findMany();
});
```

### In Middleware

Tenant context should be set in database connection middleware:

```typescript
// In NestJS middleware or database interceptor
export class TenantContextInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantContext = TenantContextService.getFromRequest(request);

    if (tenantContext) {
      await setTenantContext(prisma, tenantContext.tenantId);
      if (TenantContextService.isAuthenticated(tenantContext)) {
        await setUserContext(prisma, tenantContext.userId);
      }
    }

    return next.handle();
  }
}
```

### Manual Context Management

```typescript
import { setContext, clearContext } from '@workspace/database/rls';

// Set context
await setContext(prisma, tenantId, userId);

try {
  // Execute queries - RLS will automatically filter by tenant
  const students = await prisma.student.findMany();
} finally {
  // Always clear context
  await clearContext(prisma);
}
```

## Security Considerations

### 1. Always Set Context

**Critical**: Tenant context must be set before any database queries. If context is not set, RLS policies will block all queries.

### 2. Transaction Scope

- Use `SET LOCAL` for transaction-scoped context (recommended)
- Use `SET` for session-scoped context (use carefully)

### 3. Platform Admin Bypass

Platform admins (Architect, SuperAdmin) need to access all tenants. This should be handled at the application level:

```typescript
// Check if user is platform admin
if (isPlatformAdmin(user)) {
  // Don't set tenant context - RLS policies won't apply
  // Application-level filtering still required
} else {
  await setTenantContext(prisma, tenantId);
}
```

### 4. Error Handling

Always clear context in finally blocks to prevent context leakage:

```typescript
try {
  await setContext(prisma, tenantId, userId);
  // ... queries
} finally {
  await clearContext(prisma);
}
```

## Policy Examples

### Simple Tenant Isolation

```sql
CREATE POLICY tenant_isolation_students ON students
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

### User-Specific Access

```sql
CREATE POLICY user_student_access ON students
    FOR SELECT
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND (
            -- Students can see their own data
            (user_id = current_setting('app.current_user_id', true)::UUID)
            OR
            -- Teachers can see their students
            (class_id IN (SELECT class_id FROM class_teachers WHERE user_id = current_setting('app.current_user_id', true)::UUID))
        )
    );
```

## Testing RLS

### Test Tenant Isolation

```typescript
// Test that users can only see their tenant's data
await setTenantContext(prisma, tenant1Id);
const students1 = await prisma.student.findMany();
// Should only return students from tenant1

await setTenantContext(prisma, tenant2Id);
const students2 = await prisma.student.findMany();
// Should only return students from tenant2
// Should not include students from tenant1
```

### Test Without Context

```typescript
// Clear context
await clearTenantContext(prisma);

// Queries should fail or return empty
const students = await prisma.student.findMany();
// Should return empty or throw error
```

## Migration Strategy

### Initial Setup

1. Create RLS policies migration (see `0001_enable_rls_policies.sql`)
2. Test policies in development
3. Deploy to staging
4. Deploy to production

### Updating Policies

1. Create new migration for policy changes
2. Test thoroughly
3. Deploy during maintenance window if needed

## Performance Considerations

### Index Usage

RLS policies use indexes, so ensure proper indexes are in place:

```sql
-- Index on tenant_id for RLS policies
CREATE INDEX idx_students_tenant_id ON students(tenant_id);
```

### Policy Complexity

Keep policies simple and efficient. Complex policies can impact query performance.

### Context Setting

Setting context is a lightweight operation, but do it once per transaction, not per query.

## Best Practices

1. ✅ Always set tenant context before queries
2. ✅ Always clear context in finally blocks
3. ✅ Use `withTenantContext` helper for automatic context management
4. ✅ Test RLS policies thoroughly
5. ✅ Monitor query performance with RLS enabled
6. ✅ Document custom RLS policies
7. ✅ Use transaction-scoped context (`SET LOCAL`)
8. ✅ Handle platform admin access at application level

## Troubleshooting

### Queries Return Empty Results

**Cause**: Tenant context not set or incorrect tenant ID.

**Solution**: Verify context is set before queries:

```typescript
// Check if context is set
const currentTenant = await prisma.$queryRaw`
  SELECT current_setting('app.current_tenant_id', true)
`;
```

### Queries Fail with Permission Error

**Cause**: RLS policy is blocking access.

**Solution**:

1. Verify tenant context is set correctly
2. Check RLS policy conditions
3. Verify user has access to tenant

### Performance Issues

**Cause**: RLS policies may be too complex or missing indexes.

**Solution**:

1. Review policy complexity
2. Ensure indexes on tenant_id columns
3. Use EXPLAIN ANALYZE to identify bottlenecks

## Summary

RLS provides an additional security layer for multi-tenant applications. When properly implemented:

- ✅ Database-level data isolation
- ✅ Defense in depth (application + database)
- ✅ Protection against application bugs
- ✅ Compliance support (additional security layer)

Remember: RLS is a security enhancement, not a replacement for application-level filtering. Both layers should be used together.
