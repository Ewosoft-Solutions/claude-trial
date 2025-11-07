# AI Mediator Integration - Implementation Guide

## Overview

The AI Mediator Service provides secure, role-based access control for AI-powered queries in the school management platform. It integrates with the existing authorization system to ensure that AI queries respect clearance levels, access scopes, and permissions while maintaining comprehensive audit logging.

**Implementation Status**: ✅ Complete (Items 4b.1-4b.5)

## Table of Contents

- [Architecture](#architecture)
- [Core Features](#core-features)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Dependencies](#dependencies)
- [Usage Examples](#usage-examples)
- [Scope Limitations](#scope-limitations)
- [Future Work](#future-work)
- [API Reference](#api-reference)

## Architecture

The AI Mediator Service is built on top of the existing authorization infrastructure:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Mediator Service                        │
├─────────────────────────────────────────────────────────────┤
│  • Context Loading (4b.1)                                     │
│  • Access Scope Validation (4b.2)                             │
│  • Data Filtering (4b.3)                                      │
│  • Permission Pool Loading (4b.4)                             │
│  • Audit Logging (4b.5)                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Authorization Infrastructure                     │
├─────────────────────────────────────────────────────────────┤
│  • PermissionService                                          │
│  • PermissionPoolService                                      │
│  • Clearance Level System (0-10)                              │
│  • Access Scope System (OWN, DEPARTMENT, SCHOOL, PLATFORM)    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                              │
├─────────────────────────────────────────────────────────────┤
│  • Prisma Client                                              │
│  • Audit Logs                                                 │
│  • Permission Pools                                           │
│  • User Roles & Permissions                                   │
└─────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Clearance Level Context Integration (4b.1)

The service integrates user clearance levels (0-10) with AI queries to determine appropriate access:

- **Level 10 (Architect)**: Complete system access
- **Level 9 (SuperAdmin)**: Platform-wide access with maker-checker
- **Level 8 (Owner)**: Full school access
- **Level 7 (Management)**: Broad school access
- **Level 6 (ITSupport)**: Technical maintenance access
- **Level 5 (Finance)**: Financial and legal access
- **Level 4 (Operations)**: Logistics and operations access
- **Level 3 (Teacher)**: Classroom and student access
- **Level 2 (Parent)**: Children's information access
- **Level 1 (Student)**: Own academic information access
- **Level 0 (Guest)**: Limited public information access

### 2. Access Scope Validation (4b.2)

Validates queries based on access scope hierarchy:

- **PLATFORM**: Access to all platform data
- **SCHOOL**: Access to school-specific data
- **DEPARTMENT**: Access to department/class-level data
- **OWN**: Access only to user's own data

### 3. Data Filtering (4b.3)

Filters data based on:

- User's clearance level
- Access scope (OWN, DEPARTMENT, SCHOOL, PLATFORM)
- Resource types (configurable)
- Action types (configurable)
- Explicit permissions (optional)

### 4. Permission Pool Loading (4b.4)

Loads permission pools from the database based on:

- User's clearance level
- Tenant context (for tenant-specific pools)
- System pools (for platform-level access)

### 5. Audit Logging (4b.5)

Comprehensive audit logging for all AI queries:

- Query content (truncated for privacy)
- Query type (academic, analytics, general)
- Validation results
- User context (clearance level, access scope)
- Response metadata
- Error information (if applicable)

## How It Works

### Query Processing Flow

```
1. User submits AI query
   ↓
2. Get AI Mediator Context with Permission Pools
   - Load user permission context
   - Determine access scope from clearance level
   - Load permission pools for clearance level
   ↓
3. Validate Access Scope
   - Check clearance level requirements
   - Check access scope requirements
   ↓
4. Log Query to Audit Log
   - Record query details
   - Record validation results
   - Record user context
   ↓
5. Apply Data Filtering (if applicable)
   - Filter by access scope
   - Filter by resource types
   - Filter by action types
   - Filter by explicit permissions
   ↓
6. Return Processed Context and Validation Result
```

### Access Scope Determination

The access scope is automatically determined from the user's clearance level:

```typescript
// SuperAdmin or higher (Level 9-10)
if (clearanceLevel >= 9) {
  accessScope = AccessScope.PLATFORM;
}
// Management or higher (Level 7-8)
else if (clearanceLevel >= 7) {
  accessScope = AccessScope.SCHOOL;
}
// Teacher or higher (Level 3-6)
else if (clearanceLevel >= 3) {
  accessScope = AccessScope.DEPARTMENT;
}
// Student, Parent, Guest (Level 0-2)
else {
  accessScope = AccessScope.OWN;
}
```

### Data Filtering Logic

Data filtering applies hierarchical restrictions:

1. **Scope-based filtering**: Filters data based on access scope
   - OWN: Only user's own data
   - DEPARTMENT: Department/class-level data
   - SCHOOL: School-level data
   - PLATFORM: No filtering (all data)

2. **Resource-based filtering**: Filters by resource types (if configured)

3. **Action-based filtering**: Filters by action types (if configured)

4. **Permission-based filtering**: Filters by explicit permissions (if required)

## Configuration

### Service Configuration

The AI Mediator Service requires no additional configuration beyond the standard authorization system. It uses:

- **PermissionService**: For user permission context
- **PermissionPoolService**: For permission pool loading
- **PrismaClient**: For database access and audit logging

### Module Registration

The service is automatically registered in the `AuthModule`:

```typescript
@Module({
  providers: [
    // ... other services
    AIMediatorService,
  ],
  exports: [
    // ... other services
    AIMediatorService,
  ],
})
export class AuthModule {}
```

## Environment Variables

The AI Mediator Service uses the same environment variables as the rest of the application:

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string (required for database access)

### Optional Variables

- `NODE_ENV`: Environment mode (`development`, `production`, `test`)
- `DB_LOG_QUERIES`: Enable query logging (default: `false`)
- `DB_LOG_ERRORS`: Enable error logging (default: `true`)
- `DB_LOG_WARNINGS`: Enable warning logging (default: `true`)

### Example `.env` File

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/school_db

# Environment
NODE_ENV=development

# Database Logging (optional)
DB_LOG_QUERIES=false
DB_LOG_ERRORS=true
DB_LOG_WARNINGS=true
```

## Dependencies

### Internal Dependencies

- `@workspace/database`: Prisma client and database models
- `@workspace/api`: Shared types and enums (AccessScope, AIQueryType, etc.)
- `PermissionService`: User permission context
- `PermissionPoolService`: Permission pool management

### External Dependencies

- `@nestjs/common`: NestJS framework
- `class-validator`: DTO validation (already in project)
- `class-transformer`: DTO transformation (already in project)

### No Additional Third-Party Dependencies

The AI Mediator Service does **not** require any additional third-party dependencies beyond what's already in the project. It integrates with existing services and does not directly interact with AI providers (OpenAI, Anthropic, etc.).

**Note**: Actual AI provider integration (OpenAI, Anthropic, etc.) would be implemented in a separate service that uses the AI Mediator Service for access control.

## Usage Examples

### Basic Query Processing

```typescript
import { AIMediatorService } from './services/ai-mediator.service';
import { AIQueryType, AccessScope } from '@workspace/api';

// Inject the service
constructor(private readonly aiMediatorService: AIMediatorService) {}

// Process an AI query
const result = await this.aiMediatorService.processAIQuery(
  prisma,
  {
    query: 'What is the average performance of grade 4 students this term?',
    userId: 'user-123',
    tenantId: 'tenant-456',
    profileId: 'profile-789',
    queryType: AIQueryType.ANALYTICS,
    context: { term: 'first', year: '2024' },
  },
  7, // Required clearance level (Management)
  AccessScope.SCHOOL, // Required access scope
  {
    allowedResources: ['student', 'grade'],
    allowedActions: ['read'],
    maxDataScope: AccessScope.SCHOOL,
    requireExplicitPermission: false,
  },
  '192.168.1.1', // IP address
  'Mozilla/5.0...' // User agent
);

if (result.validation.allowed) {
  // Query is allowed, proceed with AI processing
  console.log('Context:', result.context);
  console.log('Filtered data:', result.filteredData);
} else {
  // Query rejected
  console.error('Query rejected:', result.validation.reason);
}
```

### Get AI Mediator Context

```typescript
// Get context with permission pools
const context = await this.aiMediatorService.getAIMediatorContextWithPools(
  prisma,
  userId,
  tenantId,
  profileId,
);

console.log('Clearance Level:', context.clearanceLevel);
console.log('Access Scope:', context.accessScope);
console.log('Permission Pools:', context.permissionPools);
console.log('Permissions:', context.permissions);
```

### Validate Query Access

```typescript
// Validate query access
const validation = await this.aiMediatorService.validateAIQueryAccessScope(
  prisma,
  {
    query: 'Show all student grades',
    userId: 'user-123',
    tenantId: 'tenant-456',
    profileId: 'profile-789',
    queryType: AIQueryType.ANALYTICS,
  },
  7, // Required clearance level
  AccessScope.SCHOOL, // Required access scope
);

if (!validation.allowed) {
  throw new Error(`Query rejected: ${validation.reason}`);
}
```

### Filter Data

```typescript
// Filter data based on clearance level
const filteredData = await this.aiMediatorService.filterAIDataByClearanceLevel(
  prisma,
  {
    query: 'Get student data',
    userId: 'user-123',
    tenantId: 'tenant-456',
    profileId: 'profile-789',
  },
  rawData, // Array of data to filter
  {
    allowedResources: ['student', 'grade'],
    allowedActions: ['read'],
    maxDataScope: AccessScope.DEPARTMENT,
    requireExplicitPermission: true,
  },
);
```

## Scope Limitations

### Current Limitations

1. **No Direct AI Provider Integration**
   - The service does not directly call AI providers (OpenAI, Anthropic, etc.)
   - It only provides access control and context for AI queries
   - Actual AI processing must be implemented in a separate service

2. **Data Filtering is Generic**
   - Data filtering assumes standard data structure (userId, tenantId, profileId, etc.)
   - Custom data structures may require additional filtering logic
   - Filtering is based on common field names and may need customization

3. **Permission Pool Loading**
   - Permission pools are loaded based on clearance level only
   - Role-specific permission pools are not currently loaded
   - This may be enhanced in future versions

4. **Audit Logging**
   - Query content is truncated to 100 characters in audit logs
   - Full query content is stored in metadata (JSON)
   - Large queries may impact audit log storage

5. **No Query Caching**
   - Context loading is performed on every query
   - No caching of permission contexts
   - May impact performance for high-frequency queries

6. **No Rate Limiting**
   - The service does not implement rate limiting
   - Rate limiting should be implemented at the API gateway or controller level

### Known Constraints

- **Database Dependency**: Requires active database connection for all operations
- **Synchronous Context Loading**: Context loading is synchronous and may block
- **No Async Filtering**: Data filtering is synchronous and may be slow for large datasets

## Future Work

### Planned Enhancements

1. **AI Provider Integration**
   - Integrate with OpenAI, Anthropic, or other AI providers
   - Implement query routing based on query type
   - Add response caching for common queries

2. **Enhanced Data Filtering**
   - Support custom data structures
   - Implement field-level filtering
   - Add data anonymization for sensitive queries

3. **Performance Optimizations**
   - Implement context caching (Redis)
   - Add query result caching
   - Optimize permission pool loading

4. **Advanced Features**
   - Query intent recognition
   - Automatic query classification
   - Query result ranking and relevance scoring

5. **Monitoring and Analytics**
   - Query performance metrics
   - Access pattern analysis
   - Security anomaly detection

6. **Role-Specific Permission Pools**
   - Load permission pools based on specific roles
   - Support role-based permission pool inheritance
   - Dynamic permission pool assignment

7. **Query Templates**
   - Pre-defined query templates for common use cases
   - Template-based access control
   - Template validation and sanitization

8. **Multi-Tenant Query Isolation**
   - Enhanced tenant isolation for AI queries
   - Cross-tenant query prevention
   - Tenant-specific AI model configuration

### Integration Points

The AI Mediator Service is designed to integrate with:

1. **AI Provider Services** (to be implemented)
   - OpenAI integration service
   - Anthropic integration service
   - Custom AI model services

2. **Query Processing Services** (to be implemented)
   - Natural language query parsing
   - Query intent recognition
   - Query result formatting

3. **Analytics Services** (to be implemented)
   - Query analytics and reporting
   - Usage pattern analysis
   - Performance monitoring

## API Reference

### AIMediatorService

#### Methods

##### `getAIMediatorContextWithPools()`

Get AI mediator context with permission pools loaded.

**Parameters:**

- `prisma: PrismaClient` - Prisma client instance
- `userId: string` - User ID
- `tenantId: string` - Tenant ID
- `profileId: string` - Profile ID

**Returns:** `Promise<AIMediatorContext>`

**Example:**

```typescript
const context = await aiMediatorService.getAIMediatorContextWithPools(
  prisma,
  userId,
  tenantId,
  profileId,
);
```

##### `validateAIQueryAccessScope()`

Validate AI query access scope.

**Parameters:**

- `prisma: PrismaClient` - Prisma client instance
- `request: AIQueryRequest` - AI query request
- `requiredClearanceLevel?: number` - Required clearance level
- `requiredAccessScope?: AccessScope` - Required access scope

**Returns:** `Promise<AIQueryValidationResult>`

**Example:**

```typescript
const validation = await aiMediatorService.validateAIQueryAccessScope(
  prisma,
  request,
  7, // Required clearance level
  AccessScope.SCHOOL, // Required access scope
);
```

##### `filterAIDataByClearanceLevel()`

Filter AI data based on clearance level.

**Parameters:**

- `prisma: PrismaClient` - Prisma client instance
- `request: AIQueryRequest` - AI query request
- `data: any[]` - Data to filter
- `filterConfig: AIDataFilterConfig` - Filter configuration

**Returns:** `Promise<any[]>`

**Example:**

```typescript
const filteredData = await aiMediatorService.filterAIDataByClearanceLevel(
  prisma,
  request,
  data,
  {
    allowedResources: ['student', 'grade'],
    allowedActions: ['read'],
    maxDataScope: AccessScope.SCHOOL,
    requireExplicitPermission: false,
  },
);
```

##### `logAIMediatorQuery()`

Log AI mediator query to audit log.

**Parameters:**

- `prisma: PrismaClient` - Prisma client instance
- `request: AIQueryRequest` - AI query request
- `validationResult: AIQueryValidationResult` - Validation result
- `responseMetadata?: object` - Response metadata
- `ipAddress?: string` - Request IP address
- `userAgent?: string` - Request user agent

**Returns:** `Promise<void>`

**Example:**

```typescript
await aiMediatorService.logAIMediatorQuery(
  prisma,
  request,
  validationResult,
  {
    queryType: AIQueryType.ANALYTICS,
    dataScope: AccessScope.SCHOOL,
    dataCount: 100,
    executionTime: 150,
  },
  '192.168.1.1',
  'Mozilla/5.0...',
);
```

##### `processAIQuery()`

Process AI query with full integration (context loading, validation, filtering, audit logging).

**Parameters:**

- `prisma: PrismaClient` - Prisma client instance
- `request: AIQueryRequest` - AI query request
- `requiredClearanceLevel?: number` - Required clearance level
- `requiredAccessScope?: AccessScope` - Required access scope
- `filterConfig?: AIDataFilterConfig` - Filter configuration
- `ipAddress?: string` - Request IP address
- `userAgent?: string` - Request user agent

**Returns:** `Promise<{ context: AIMediatorContext; validation: AIQueryValidationResult; filteredData?: any[] }>`

**Example:**

```typescript
const result = await aiMediatorService.processAIQuery(
  prisma,
  request,
  7, // Required clearance level
  AccessScope.SCHOOL, // Required access scope
  filterConfig,
  '192.168.1.1',
  'Mozilla/5.0...',
);
```

### Types and Interfaces

#### `AIQueryRequest`

```typescript
interface AIQueryRequest {
  query: string;
  userId: string;
  tenantId: string;
  profileId: string;
  queryType?: AIQueryType;
  context?: Record<string, any>;
}
```

#### `AIQueryValidationResult`

```typescript
interface AIQueryValidationResult {
  allowed: boolean;
  reason?: string;
  requiredClearanceLevel?: number;
  userClearanceLevel?: number;
  requiredAccessScope?: AccessScope;
  userAccessScope?: AccessScope;
}
```

#### `AIDataFilterConfig`

```typescript
interface AIDataFilterConfig {
  allowedResources: string[];
  allowedActions: string[];
  maxDataScope: AccessScope;
  requireExplicitPermission?: boolean;
}
```

### Enums

#### `AIQueryType`

```typescript
enum AIQueryType {
  ACADEMIC = 'academic',
  ANALYTICS = 'analytics',
  GENERAL = 'general',
}
```

**Location**: `packages/api/src/types/enums/ai-mediator.enums.ts`

## Security Considerations

1. **Access Control**: All queries are validated against clearance levels and access scopes
2. **Audit Logging**: All queries are logged for security and compliance
3. **Data Filtering**: Data is filtered based on user permissions
4. **Tenant Isolation**: Queries are scoped to the user's tenant context
5. **Permission Validation**: Explicit permission checks can be enforced

## Testing

### Unit Tests

Unit tests should cover:

- Context loading with permission pools
- Access scope validation
- Data filtering logic
- Audit logging functionality

### Integration Tests

Integration tests should cover:

- End-to-end query processing
- Database interactions
- Permission pool loading
- Audit log creation

## Troubleshooting

### Common Issues

1. **Permission Pool Not Loading**
   - Check that permission pools exist in the database
   - Verify clearance level matches pool clearance level
   - Check tenant context is correct

2. **Query Validation Failing**
   - Verify user has sufficient clearance level
   - Check access scope requirements
   - Review permission assignments

3. **Data Filtering Too Restrictive**
   - Review filter configuration
   - Check access scope settings
   - Verify permission assignments

4. **Audit Log Not Created**
   - Check database connection
   - Verify audit log table exists
   - Check for database errors in logs

## Support

For issues or questions:

1. Check this documentation
2. Review the code comments
3. Check the audit logs for error details
4. Contact the development team

---

**Last Updated**: 2024-11-05  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
