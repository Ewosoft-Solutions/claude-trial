# Testing Guide

## Overview

This directory contains integration and end-to-end tests for the API application.

## Test Structure

### Unit Tests
- Located in `src/**/*.spec.ts`
- Test individual services, controllers, and utilities in isolation
- Use mocks for dependencies

### Integration Tests
- Located in `test/**/*.e2e-spec.ts`
- Test complete flows and interactions between components
- May use test database or mocks

## Running Tests

### Run all tests
```bash
npm test
```

### Run unit tests only
```bash
npm test -- --testPathPattern=spec.ts
```

### Run integration tests only
```bash
npm test:e2e
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm test -- --coverage
```

## Test Database Setup

For integration tests that require a database:

1. Set up a test database (separate from development/production)
2. Configure `DATABASE_URL` in test environment
3. Run migrations before tests
4. Clean up test data after each test

Example test database setup:
```typescript
beforeAll(async () => {
  // Run migrations
  await exec('npm run db:migrate');
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
});
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage for core services
- **Integration Tests**: Cover all critical user flows
- **E2E Tests**: Cover complete authentication and authorization flows

## Writing Tests

### Unit Test Example
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: Dependency,
          useValue: createMockDependency(),
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should do something', () => {
    // Test implementation
  });
});
```

### Integration Test Example
```typescript
describe('Feature (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaClient);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('should complete flow', async () => {
    // Test implementation
  });
});
```

## Test Utilities

Test utilities are available in `src/common/__tests__/test-utils.ts`:
- `createMockPrismaClient()` - Create mocked Prisma client
- `resetMockPrismaClient()` - Reset all mocks

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Mocks**: Use mocks for external dependencies
4. **Assertions**: Use descriptive assertions
5. **Naming**: Use descriptive test names
6. **Structure**: Follow AAA pattern (Arrange, Act, Assert)

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled nightly runs

## Debugging Tests

### Debug in VS Code
1. Set breakpoints in test files
2. Run "Debug Jest Tests" configuration
3. Step through code

### Debug with Node
```bash
npm run test:debug
```

## Performance Testing

For load testing, see:
- `test/load/` - Load test scripts
- Use tools like k6, Artillery, or Apache Bench

## Security Testing

Security tests include:
- Authentication bypass attempts
- Authorization boundary testing
- Input validation testing
- SQL injection attempts
- XSS attempts

See `test/security/` for security test suites.


