---
title: Testing Guide
description: 'Version 1.0.13 - Comprehensive testing guide'
---

# Testing Guide

**Version:** 1.0.13  
**Status:** Active

## Overview

This guide covers testing strategies, patterns, and requirements for the Puppeteer MCP project. We
maintain comprehensive test coverage across unit, integration, and end-to-end tests.

## Test Infrastructure

### Technology Stack

- **Test Runner**: Jest with ESM support
- **Assertion Library**: Built-in Jest matchers
- **Mocking**: Jest mocks + custom Puppeteer mocks
- **Coverage**: Jest coverage with tiered thresholds

### Test Organization

```text
tests/
├── unit/                 # Unit tests for individual components
├── integration/          # Integration tests for subsystems
├── e2e/                  # End-to-end workflow tests
├── benchmark/            # Performance benchmarks
└── __mocks__/           # Shared mock implementations
```

## Testing Standards

### Coverage Requirements

Following TS:JEST standards from
[William Zujkowski's Standards](https://github.com/williamzujkowski/standards):

| Component       | Coverage Target | Current |
| --------------- | --------------- | ------- |
| Global          | 15-18%          | ✅      |
| Auth/Security   | 80-90%          | ✅      |
| Utilities       | 50-80%          | ✅      |
| Browser Actions | 70%+            | ✅      |

### Test Categories

#### Unit Tests

Test individual functions and classes in isolation:

```typescript
describe('BrowserPool', () => {
  it('should acquire browser instance', async () => {
    const pool = new BrowserPool({ maxSize: 2 });
    const browser = await pool.acquire();

    expect(browser).toBeDefined();
    expect(pool.getActiveCount()).toBe(1);
  });
});
```

#### Integration Tests

Test component interactions:

```typescript
describe('Session with Context Integration', () => {
  it('should create context with valid session', async () => {
    const sessionId = await sessionStore.create(userId);
    const contextId = await contextStore.create(sessionId, {
      name: 'test-context',
    });

    expect(contextId).toMatch(/^ctx-/);
  });
});
```

#### E2E Tests

Test complete workflows:

```typescript
describe('Browser Automation Workflow', () => {
  it('should complete form submission', async () => {
    // Create context
    const context = await api.post('/contexts', {
      name: 'form-test',
    });

    // Navigate and interact
    await api.post(`/contexts/${context.id}/execute`, {
      action: 'navigate',
      params: { url: 'https://example.com/form' },
    });

    // Verify results
    const screenshot = await api.post(`/contexts/${context.id}/execute`, {
      action: 'screenshot',
    });

    expect(screenshot.data).toBeDefined();
  });
});
```

## Writing Tests

### Test Structure

Follow the AAA pattern:

```typescript
describe('FeatureName', () => {
  // Arrange - Setup
  beforeEach(() => {
    // Setup test environment
  });

  it('should perform expected behavior', async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await performAction(input);

    // Assert
    expect(result).toMatchExpectedOutput();
  });

  // Cleanup
  afterEach(() => {
    // Restore state
  });
});
```

### Mocking Strategies

#### Puppeteer Mocking

Use our custom Puppeteer mock for unit tests:

```typescript
import { createMockBrowser } from '../__mocks__/puppeteer';

const mockBrowser = createMockBrowser({
  pages: [
    {
      url: 'https://example.com',
      title: 'Example Page',
    },
  ],
});
```

#### External Services

Mock external dependencies:

```typescript
jest.mock('../../src/store/session-store');
const mockSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

mockSessionStore.get.mockResolvedValue({
  id: 'session-123',
  userId: 'user-456',
});
```

### Testing Browser Actions

Each browser action should have comprehensive tests:

```typescript
describe('ClickAction', () => {
  it('should click element by selector', async () => {
    const page = createMockPage();
    const action = new ClickAction();

    await action.execute(page, {
      selector: '#submit-button',
    });

    expect(page.click).toHaveBeenCalledWith('#submit-button');
  });

  it('should handle missing elements gracefully', async () => {
    const page = createMockPage();
    page.click.mockRejectedValue(new Error('Element not found'));

    await expect(
      action.execute(page, {
        selector: '#missing',
      }),
    ).rejects.toThrow('Element not found');
  });
});
```

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- auth.test.ts

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run only unit tests
npm test -- tests/unit

# Run only integration tests
npm run test:integration

# Run benchmarks
npm run test:benchmark
```

### Debug Mode

```bash
# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug specific test
npm test -- --testNamePattern="should authenticate" --verbose
```

## Test Patterns

### Async Testing

Always properly handle async operations:

```typescript
// Good - Proper async handling
it('should handle async operation', async () => {
  const result = await asyncOperation();
  expect(result).toBeDefined();
});

// Bad - Missing await
it('should handle async operation', () => {
  const result = asyncOperation(); // Missing await!
  expect(result).toBeDefined(); // Tests Promise, not result
});
```

### Error Testing

Test both success and failure paths:

```typescript
describe('Error Handling', () => {
  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(apiCall()).rejects.toThrow('Network error');
  });

  it('should handle validation errors', async () => {
    const result = await validateInput({ invalid: true });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Performance Testing

Include performance benchmarks:

```typescript
describe('Performance', () => {
  it('should process requests within SLA', async () => {
    const start = performance.now();

    await processRequest(testData);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 100ms SLA
  });
});
```

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset test state
});
```

### 2. Descriptive Names

Use clear, behavior-focused names:

```typescript
// Good
it('should return 401 when authentication token is expired');

// Bad
it('test auth');
```

### 3. Avoid Test Logic

Keep tests simple and declarative:

```typescript
// Good
expect(result).toEqual(expectedOutput);

// Bad
if (condition) {
  expect(result).toBe(value1);
} else {
  expect(result).toBe(value2);
}
```

### 4. Use Test Builders

Create reusable test data builders:

```typescript
const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  role: 'user',
  ...overrides,
});
```

## Continuous Integration

Tests run automatically on:

- Every push via Git hooks
- Pull requests via GitHub Actions
- Scheduled nightly runs

### CI Requirements

- All tests must pass
- Coverage thresholds must be met
- No ESLint errors in test files
- Performance benchmarks within limits

## Troubleshooting

### Common Issues

#### Timeout Errors

```typescript
// Increase timeout for slow operations
it('should handle large file', async () => {
  await processLargeFile();
}, 30000); // 30 second timeout
```

#### Memory Leaks

```typescript
// Ensure cleanup
afterEach(async () => {
  await browserPool.closeAll();
  global.gc?.(); // Force garbage collection if available
});
```

#### Flaky Tests

- Add retries for network-dependent tests
- Use stable test data
- Avoid time-dependent assertions
- Mock external dependencies

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Project Testing Standards](https://github.com/williamzujkowski/standards)
