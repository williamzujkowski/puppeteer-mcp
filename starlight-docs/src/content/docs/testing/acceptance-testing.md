---
title: Acceptance Testing Framework
description: Comprehensive acceptance testing framework for puppeteer-mcp, designed to validate real-world functionality against live websites and APIs with end-to-end validation
---

# Acceptance Testing Framework

The acceptance testing framework provides end-to-end validation of puppeteer-mcp's capabilities by testing against publicly available, stable websites and APIs. These tests ensure that the system works correctly in real-world scenarios.

:::note[Real-World Validation]
Acceptance tests validate puppeteer-mcp against live websites and APIs to ensure real-world functionality, complementing unit and integration tests with comprehensive end-to-end scenarios.
:::

## Test Structure

### Test Categories

1. **Basic Web Interactions** (`tests/acceptance/basic/`)
   - Navigation and page loading
   - Form filling and submission
   - Element selection and interaction
   - Content extraction and validation

2. **API Interactions** (`tests/acceptance/api/`)
   - REST API calls and responses
   - HTTP method testing
   - Error handling and status codes
   - Data parsing and validation

3. **Complex Workflows** (`tests/acceptance/workflows/`)
   - E-commerce complete purchase flows
   - Authentication and session management
   - Multi-step business processes
   - State management across pages

### Test Targets

All tests use publicly available, testing-friendly targets:

- **E-commerce**: Sauce Demo, Automation Practice
- **APIs**: HTTPBin, JSONPlaceholder, ReqRes, World Bank API
- **Testing Sites**: The Internet, UI Testing Playground, DemoQA
- **Real-world**: Hacker News, Angular/React demos

See `testing-targets-reference.md` for complete list and details.

## Running Tests

### Local Development

```bash
# Run all acceptance tests
npm run test:acceptance

# Run specific test categories
npm run test:acceptance:basic
npm run test:acceptance:api
npm run test:acceptance:workflows

# Run with debugging (visible browser)
ACCEPTANCE_TEST_HEADLESS=false npm run test:acceptance:basic

# Run with slow motion for debugging
ACCEPTANCE_TEST_SLOW_MO=100 npm run test:acceptance:basic
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCEPTANCE_TEST_TIMEOUT` | Test timeout in ms | `60000` |
| `ACCEPTANCE_TEST_RETRIES` | Number of retries for flaky tests | `2` |
| `ACCEPTANCE_TEST_HEADLESS` | Run in headless mode | `true` |
| `ACCEPTANCE_TEST_SLOW_MO` | Slow down actions in ms | `0` |

### CI/CD Integration

Acceptance tests run:

- **Manual**: Via GitHub Actions workflow dispatch
- **Scheduled**: Weekly on Sundays at 6 AM UTC
- **Optional**: Can be triggered for specific test suites

```bash
# GitHub Actions provides these options:
# - Test suite selection (all, basic, api, workflows)
# - Headless mode toggle
# - Custom timeout settings
```

## Test Framework Components

### MCP Client Utilities (`utils/mcp-client.ts`)

Provides high-level MCP interaction methods:

- `createMCPClient()`: Start MCP server and connect client
- `createMCPSession()`: Create browser session and context
- `mcpNavigate()`, `mcpClick()`, `mcpType()`: Browser actions
- `mcpGetContent()`, `mcpScreenshot()`: Data extraction
- `cleanupMCPSession()`: Resource cleanup

### Test Helpers (`utils/test-helpers.ts`)

Common utilities for robust testing:

- `retryOperation()`: Retry with exponential backoff
- `waitForCondition()`: Polling for conditions
- `makeRequest()`: HTTP requests with retry logic
- `PerformanceTracker`: Timing and performance measurement
- `AssertionHelpers`: Specialized assertion methods

### Configuration (`utils/test-config.ts`)

Centralized configuration for:

- Test timeouts and retry settings
- Target URLs and endpoints
- Test credentials for demo sites
- Browser and viewport settings

## Best Practices

:::tip[Test Design Guidelines]

### Robust Test Design

1. **Use Stable Targets**: Only test against sites designed for automation
2. **Handle Flakiness**: Implement retries and appropriate wait strategies
3. **Respect Rate Limits**: Add delays between requests to external services
4. **Clean Resources**: Always close browser contexts and sessions
5. **Collect Artifacts**: Save screenshots and logs on failure

### Error Handling Pattern

```typescript
// Example retry pattern
await retryOperation(async () => {
  await mcpNavigate(client, contextId, url);
  const content = await mcpGetContent(client, contextId);
  AssertionHelpers.containsText(content, expectedText);
}, 3); // 3 retries
```

### Performance Monitoring

```typescript
const performance = new PerformanceTracker();
await mcpNavigate(client, contextId, url);
performance.checkpoint('navigation');
await mcpClick(client, contextId, selector);
performance.checkpoint('interaction');

console.log('Performance report:', performance.getReport());
expect(performance.getElapsed()).toBeLessThan(10000);
```
:::

## Troubleshooting

### Common Issues

:::caution[Common Issues and Solutions]

1. **External Service Unavailable**
   - Tests validate URL accessibility before running
   - Warnings logged for inaccessible targets
   - Tests skip gracefully with appropriate messages

2. **Network Timeouts**
   - Increased timeouts for CI environments
   - Retry logic with exponential backoff
   - Environment-specific configuration

3. **Browser Issues**
   - Chrome dependencies installed in CI
   - Headless mode for CI, visible for debugging
   - Resource cleanup to prevent memory leaks
:::

### Debugging Commands

```bash
# Run with visible browser and slow motion
ACCEPTANCE_TEST_HEADLESS=false ACCEPTANCE_TEST_SLOW_MO=250 npm run test:acceptance:basic

# Run single test file
npx jest --config jest.acceptance.config.mjs tests/acceptance/basic/navigation.test.ts

# Collect detailed logs
DEBUG=puppeteer:* npm run test:acceptance:basic
```

## Configuration Files

| File | Purpose |
|------|---------|
| `jest.acceptance.config.mjs` | Jest configuration for acceptance tests |
| `package.json` | Test scripts and dependencies |
| `.github/workflows/acceptance-tests.yml` | CI/CD workflow |
| `tests/acceptance/utils/` | Framework utilities and configuration |

## Maintenance

### Adding New Tests

1. Follow existing patterns in test categories
2. Use stable, public testing targets
3. Implement proper retry and error handling
4. Add performance tracking for critical paths
5. Document any new test targets in the reference

### Updating Test Targets

1. Validate new targets for stability and accessibility
2. Add to `test-config.ts` with appropriate categorization
3. Test against new targets before committing
4. Update documentation with any special considerations

### Monitoring

- Tests run weekly to catch regressions
- Artifacts collected on failures for debugging
- Performance metrics tracked over time
- External service health monitored

## Integration with Development Workflow

Acceptance tests complement the existing test suite:

| Test Type | Purpose | Scope |
|-----------|---------|-------|
| **Unit Tests** | Fast, isolated component testing | Individual functions |
| **Integration Tests** | Internal API and component integration | System components |
| **Acceptance Tests** | Real-world end-to-end validation | Complete workflows |
| **Security Tests** | Automated security scanning | Security compliance |

This multi-layered approach ensures comprehensive coverage from individual functions to complete user workflows.

## Future Enhancements

Planned improvements to the acceptance testing framework:

1. **Visual Regression Testing**: Screenshot comparison across runs
2. **Performance Benchmarking**: Automated performance regression detection
3. **Mobile Testing**: Mobile browser and responsive design validation
4. **Accessibility Testing**: Automated accessibility compliance checking
5. **Load Testing**: Concurrent session and performance testing

## Related Documentation

- [Testing Overview](/testing/) for complete testing strategy
- [Security Testing](/testing/security-testing) for security validation
- [Performance Testing](/testing/performance-testing) for performance validation
- [UX Testing](/testing/ux-testing) for user experience validation

## Conclusion

The acceptance testing framework provides confidence that puppeteer-mcp works correctly in real-world scenarios while maintaining reliability and performance standards. By testing against stable public targets with robust retry mechanisms and comprehensive monitoring, the framework ensures system reliability in production environments.