# Security Testing Suite for Puppeteer MCP

This directory contains the comprehensive security testing suite for the Puppeteer MCP project, implementing the security testing strategy outlined in `/starlight-docs/src/content/docs/testing/security-testing.md`.

## Directory Structure

```
tests/security/
├── auth/                    # Authentication & Authorization tests
│   ├── jwt-validation.test.ts
│   ├── api-key-security.test.ts
│   ├── session-hijacking.test.ts
│   ├── privilege-escalation.test.ts
│   └── multi-user-isolation.test.ts
├── injection/              # Input validation & Injection tests
│   ├── xss-prevention.test.ts
│   ├── sql-injection.test.ts
│   ├── command-injection.test.ts
│   ├── path-traversal.test.ts
│   └── buffer-overflow.test.ts
├── network/               # Network security tests
│   ├── tls-configuration.test.ts
│   ├── certificate-management.test.ts
│   ├── mitm-prevention.test.ts
│   ├── dos-resistance.test.ts
│   └── rate-limiting.test.ts
├── privacy/               # Data protection & Privacy tests
│   ├── session-isolation.test.ts
│   ├── pii-handling.test.ts
│   ├── credential-storage.test.ts
│   ├── data-encryption.test.ts
│   └── gdpr-compliance.test.ts
├── browser/               # Browser security tests
│   ├── sandbox-escape.test.ts
│   ├── malicious-sites.test.ts
│   ├── download-security.test.ts
│   ├── cookie-security.test.ts
│   └── proxy-security.test.ts
├── compliance/            # Compliance & Audit tests
│   ├── nist-controls.test.ts
│   ├── security-logging.test.ts
│   ├── audit-trail.test.ts
│   ├── incident-response.test.ts
│   └── vulnerability-scanning.test.ts
├── fixtures/              # Test fixtures and payloads
│   ├── xss-payloads.json
│   ├── sql-payloads.json
│   ├── command-payloads.json
│   └── malicious-urls.json
├── utils/                 # Test utilities
│   ├── security-test-helpers.ts
│   ├── mock-services.ts
│   └── test-data-generators.ts
├── config/                # Test configuration
│   ├── jest.config.js
│   ├── security-test.env
│   └── test-users.json
└── reports/               # Test reports (gitignored)
    └── .gitkeep
```

## Running Security Tests

### Run All Security Tests
```bash
npm run test:security
```

### Run Specific Test Categories
```bash
npm run test:security:auth          # Authentication tests
npm run test:security:injection     # Injection prevention tests
npm run test:security:network       # Network security tests
npm run test:security:privacy       # Privacy tests
npm run test:security:browser       # Browser security tests
npm run test:security:compliance    # Compliance tests
```

### Run Individual Test Suites
```bash
npm test tests/security/auth/jwt-validation.test.ts
```

### Run with Coverage
```bash
npm run test:security:coverage
```

## Test Categories

### 1. Authentication & Authorization (`/auth`)
- JWT token validation and expiration
- API key security and rotation
- Session hijacking prevention
- Privilege escalation testing
- Multi-user isolation verification

### 2. Input Validation & Injection (`/injection`)
- XSS prevention in evaluate commands
- SQL injection attempts
- Command injection prevention
- Path traversal testing
- Buffer overflow testing

### 3. Network Security (`/network`)
- HTTPS/TLS configuration validation
- Certificate management testing
- MITM attack prevention
- DoS/DDoS resistance
- Rate limiting effectiveness

### 4. Data Protection & Privacy (`/privacy`)
- Session data isolation
- PII handling in browser content
- Secure storage of credentials
- Data encryption validation
- GDPR compliance testing

### 5. Browser Security (`/browser`)
- Sandbox escape prevention
- Malicious site interaction
- Download security validation
- Cookie security and isolation
- Proxy security testing

### 6. Compliance & Audit (`/compliance`)
- NIST control validation
- Security event logging
- Audit trail completeness
- Incident response testing
- Vulnerability scanning

## Security Test Utilities

### Test Helpers (`utils/security-test-helpers.ts`)
```typescript
import { SecurityTestHelpers } from './utils/security-test-helpers';

// Generate malicious payloads
const xssPayloads = SecurityTestHelpers.getXSSPayloads();
const sqlPayloads = SecurityTestHelpers.getSQLPayloads();

// Create authenticated sessions
const adminSession = await SecurityTestHelpers.createAdminSession();
const userSession = await SecurityTestHelpers.createUserSession();

// Simulate attacks
await SecurityTestHelpers.simulateBruteForce(endpoint, attempts);
await SecurityTestHelpers.simulateDDoS(target, duration);
```

### Mock Services (`utils/mock-services.ts`)
```typescript
import { MockServices } from './utils/mock-services';

// Mock external services
const mockAuth = MockServices.createAuthService();
const mockDatabase = MockServices.createDatabase();
const mockBrowser = MockServices.createBrowser();
```

## Environment Configuration

### Test Environment Variables
Create a `.env.test` file:
```bash
# Test Database
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/puppeteer_mcp_test

# Test Authentication
TEST_JWT_SECRET=test-secret-key-for-testing-only
TEST_API_KEY=pmcp_test_key_12345

# Test URLs
TEST_BASE_URL=https://localhost:8443
TEST_WEBSOCKET_URL=wss://localhost:8443/ws

# Security Testing
ENABLE_DESTRUCTIVE_TESTS=false
SECURITY_TEST_TIMEOUT=30000
```

## Writing Security Tests

### Test Template
```typescript
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { SecurityTestHelpers } from '../utils/security-test-helpers';

describe('Security: [Feature Name]', () => {
  let session: TestSession;
  
  beforeAll(async () => {
    session = await SecurityTestHelpers.createTestSession();
  });
  
  afterAll(async () => {
    await session.cleanup();
  });
  
  describe('[Attack Vector]', () => {
    test('should prevent [specific attack]', async () => {
      // Arrange
      const maliciousPayload = 'attack-payload';
      
      // Act
      const response = await session.request('/api/endpoint', {
        method: 'POST',
        body: { data: maliciousPayload }
      });
      
      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Security violation');
      
      // Verify no damage was done
      const systemState = await session.checkSystemState();
      expect(systemState).toBe('secure');
    });
  });
});
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Security Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *' # Daily security scan

jobs:
  security-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security tests
        run: npm run test:security
        env:
          CI: true
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: security-test-results
          path: tests/security/reports/
```

## Security Test Reports

Test results are generated in multiple formats:

### JUnit XML (for CI/CD)
```
tests/security/reports/junit.xml
```

### HTML Report (for developers)
```
tests/security/reports/index.html
```

### JSON Report (for automation)
```
tests/security/reports/security-test-results.json
```

## Best Practices

1. **Isolation**: Each test should be completely isolated and not affect others
2. **Non-Destructive**: Tests should not damage the test environment
3. **Comprehensive**: Cover both positive and negative test cases
4. **Realistic**: Use real-world attack vectors and payloads
5. **Maintainable**: Keep tests simple and well-documented
6. **Fast**: Optimize for quick execution in CI/CD pipelines

## Contributing

When adding new security tests:

1. Place tests in the appropriate category directory
2. Follow the naming convention: `[feature]-[attack].test.ts`
3. Add test data to the fixtures directory
4. Update this README with new test descriptions
5. Ensure tests are idempotent and can run in parallel
6. Add appropriate timeout values for long-running tests

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST SP 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [Security Testing Strategy](/starlight-docs/src/content/docs/testing/security-testing.md)
- [Project Security Policy](/SECURITY.md)