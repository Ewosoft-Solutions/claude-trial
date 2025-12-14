# Load Testing Guide

## Overview

This document outlines load testing procedures, performance benchmarks, and optimization strategies for the School With Ease.

## Load Testing Objectives

1. **Performance Baseline**: Establish baseline performance metrics
2. **Capacity Planning**: Determine system capacity and scaling needs
3. **Bottleneck Identification**: Identify performance bottlenecks
4. **Stress Testing**: Test system behavior under extreme load
5. **Database Performance**: Test database query performance and optimization

## Tools

### Recommended Tools

- **k6**: Modern load testing tool (recommended)
- **Artillery**: Node.js load testing toolkit
- **Apache Bench (ab)**: Simple HTTP benchmarking tool
- **JMeter**: Java-based load testing tool
- **PostgreSQL Performance Testing**: pgbench, EXPLAIN ANALYZE

## Performance Metrics

### Key Metrics

- **Response Time**: Time to first byte (TTFB), total response time
- **Throughput**: Requests per second (RPS)
- **Error Rate**: Percentage of failed requests
- **Concurrent Users**: Number of simultaneous users
- **Database Query Time**: Query execution time
- **Memory Usage**: Memory consumption under load
- **CPU Usage**: CPU utilization

### Target Metrics

- **API Response Time**: < 200ms (p95)
- **Database Query Time**: < 100ms (p95)
- **Throughput**: > 1000 RPS
- **Error Rate**: < 0.1%
- **Concurrent Users**: Support 10,000+ concurrent users

## Load Testing Scenarios

### 1. Authentication Load Test

**Scenario**: Multiple users logging in simultaneously

```javascript
// k6 script
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
};

export default function () {
  const response = http.post(
    'http://localhost:3000/auth/login',
    JSON.stringify({
      email: `user${__VU}@example.com`,
      password: 'TestPassword123',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### 2. Database Query Load Test

**Scenario**: Test database query performance under load

```sql
-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM users
WHERE tenant_id = 'tenant-id'
AND status = 'active';

-- Test with indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_status
ON users(tenant_id, status);

-- Run pgbench for load testing
pgbench -c 10 -j 2 -T 60 -f test_queries.sql
```

### 3. Multi-Tenant Load Test

**Scenario**: Multiple tenants accessing data simultaneously

```javascript
// k6 script for multi-tenant load
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const tenantId = `tenant-${__VU % 10}`; // 10 tenants
  const token = `token-for-${tenantId}`;

  const response = http.get(`http://localhost:3000/api/resources`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
}
```

### 4. Stress Test

**Scenario**: Test system behavior under extreme load

```javascript
// k6 stress test
export const options = {
  stages: [
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '1m', target: 5000 }, // Extreme load
    { duration: '2m', target: 5000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};
```

## Database Performance Testing

### Query Performance Analysis

```sql
-- Enable query logging
SET log_min_duration_statement = 100; -- Log queries > 100ms

-- Analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Test index effectiveness
EXPLAIN ANALYZE
SELECT * FROM students
WHERE tenant_id = 'tenant-id'
AND class_id = 'class-id';
```

### Connection Pool Testing

```javascript
// Test connection pool under load
import { Pool } from 'pg';

const pool = new Pool({
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test concurrent queries
const queries = Array(100)
  .fill(null)
  .map(() =>
    pool.query('SELECT * FROM users WHERE tenant_id = $1', ['tenant-id']),
  );

await Promise.all(queries);
```

## Performance Optimization

### Database Optimization

1. **Indexes**: Create indexes on frequently queried columns
2. **Query Optimization**: Use EXPLAIN ANALYZE to optimize queries
3. **Connection Pooling**: Configure appropriate pool size
4. **Caching**: Implement Redis caching for frequently accessed data

### API Optimization

1. **Response Compression**: Enable gzip compression
2. **Pagination**: Implement pagination for large datasets
3. **Caching**: Cache frequently accessed data
4. **Async Processing**: Use background jobs for heavy operations

### Example Optimizations

```typescript
// Add database indexes
CREATE INDEX idx_user_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_student_tenant_class ON students(tenant_id, class_id);

// Implement caching
import Redis from 'ioredis';
const redis = new Redis();

async function getCachedUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
  return user;
}
```

## Load Testing Checklist

### Pre-Testing

- [ ] Set up test environment
- [ ] Prepare test data
- [ ] Configure monitoring
- [ ] Set up load testing tools
- [ ] Define test scenarios

### During Testing

- [ ] Monitor system resources (CPU, memory, disk)
- [ ] Monitor database performance
- [ ] Monitor API response times
- [ ] Monitor error rates
- [ ] Document any issues

### Post-Testing

- [ ] Analyze results
- [ ] Identify bottlenecks
- [ ] Create optimization plan
- [ ] Document findings
- [ ] Plan retesting

## Reporting

### Load Test Report Template

1. **Test Summary**
   - Test duration
   - Number of users
   - Total requests
   - Success rate

2. **Performance Metrics**
   - Response times (p50, p95, p99)
   - Throughput (RPS)
   - Error rates
   - Resource utilization

3. **Findings**
   - Bottlenecks identified
   - Performance issues
   - Optimization opportunities

4. **Recommendations**
   - Immediate fixes
   - Long-term improvements
   - Scaling strategies

## Continuous Performance Testing

### Automated Performance Tests

- Run performance tests in CI/CD pipeline
- Monitor performance metrics in production
- Set up performance alerts
- Regular performance reviews

### Performance Monitoring

- Use APM tools (DataDog, New Relic, etc.)
- Monitor database query performance
- Track API response times
- Monitor resource utilization

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Web Performance Best Practices](https://web.dev/performance/)
