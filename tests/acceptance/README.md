# Acceptance Tests

Real-world acceptance tests that validate puppeteer-mcp functionality against live websites and APIs.

## Test Categories

### 1. Basic Web Interactions (`basic/`)
- Form filling and submission
- Navigation and page interactions
- Element selection and manipulation
- Screenshot and content capture

### 2. API Interactions (`api/`)
- REST API calls and data extraction
- HTTP method testing
- Error handling and retries
- Response parsing and validation

### 3. Complex Workflows (`workflows/`)
- E-commerce complete flows
- Authentication scenarios
- Multi-step processes
- State management

### 4. Real-World Sites (`real-world/`)
- Public testing sites
- Government data sources
- News and content sites
- Performance benchmarks

## Test Configuration

Tests are configured to use stable, public testing targets that are:
- Publicly accessible
- Testing-friendly (don't require authentication)
- Stable and reliable for CI/CD
- Representative of real-world usage

## Environment Variables

- `ACCEPTANCE_TEST_TIMEOUT`: Test timeout in ms (default: 30000)
- `ACCEPTANCE_TEST_RETRIES`: Number of retries for flaky tests (default: 2)
- `ACCEPTANCE_TEST_HEADLESS`: Run in headless mode (default: true)
- `ACCEPTANCE_TEST_SLOW_MO`: Slow down Puppeteer actions in ms (default: 0)

## Running Tests

```bash
# Run all acceptance tests
npm run test:acceptance

# Run specific category
npm run test:acceptance -- --testPathPattern=basic
npm run test:acceptance -- --testPathPattern=api
npm run test:acceptance -- --testPathPattern=workflows

# Run with debugging (non-headless)
ACCEPTANCE_TEST_HEADLESS=false npm run test:acceptance

# Run with slow motion for debugging
ACCEPTANCE_TEST_SLOW_MO=100 npm run test:acceptance
```

## Test Utilities

The `utils/` directory contains shared utilities for:
- MCP client setup and teardown
- Common assertions and helpers
- Retry logic for flaky external services
- Screenshot and artifact collection
- Performance measurement

## Best Practices

1. **Use stable test targets** - Only test against sites designed for automation
2. **Handle flakiness** - Use retries and wait strategies for external dependencies
3. **Respect rate limits** - Add appropriate delays between requests
4. **Clean up resources** - Always close browser contexts and sessions
5. **Collect artifacts** - Save screenshots and logs on failure
6. **Environment isolation** - Don't depend on specific network conditions