# Security Tests for puppeteer-mcp

This directory contains comprehensive security tests designed to validate input sanitization, XSS
prevention, and overall security posture of the puppeteer-mcp project.

## Test Coverage

The security test suite covers the following vulnerability categories:

### 1. **XSS Prevention** (`xss-prevention.test.ts`)

- URL parameter XSS
- Script injection in selectors
- HTML injection
- DOM-based XSS
- Stored XSS through localStorage
- Event handler XSS

### 2. **Path Traversal** (`path-traversal.test.ts`)

- Directory traversal in file operations
- URL path traversal
- Protocol smuggling
- File path sanitization
- Download path validation

### 3. **Command Injection** (`command-injection.test.ts`)

- Shell command injection
- Process spawning attempts
- Browser command injection
- Shell metacharacter handling
- Template injection
- Function constructor abuse

### 4. **SSRF Prevention** (`ssrf-prevention.test.ts`)

- Internal network access blocking
- DNS rebinding attacks
- URL parser confusion
- Redirect-based SSRF
- WebSocket SSRF
- Data exfiltration prevention

### 5. **CSP Bypass** (`csp-bypass.test.ts`)

- Content Security Policy enforcement
- Inline script blocking
- Nonce/hash bypass attempts
- JSONP endpoint abuse
- Base tag manipulation
- DOM clobbering
- SVG-based bypasses
- Web Worker bypasses

### 6. **Cookie Security** (`cookie-security.test.ts`)

- Secure cookie attributes
- Cookie theft prevention
- Cookie injection attacks
- Cross-site cookie access
- SameSite enforcement
- Session fixation
- Cookie tossing
- Unicode poisoning

### 7. **Authentication Bypass** (`auth-bypass.test.ts`)

- SQL injection in login forms
- Token manipulation
- Parameter pollution
- Race conditions
- IDOR vulnerabilities
- HTTP header bypass
- CORS bypass
- Privilege escalation
- Brute force protection

### 8. **Resource Exhaustion** (`resource-exhaustion.test.ts`)

- Memory exhaustion
- CPU exhaustion
- DOM exhaustion
- Storage exhaustion
- Network exhaustion
- Timer/animation flooding
- Browser API abuse
- Fork bomb prevention

### 9. **Prototype Pollution** (`prototype-pollution.test.ts`)

- Object prototype pollution
- JSON-based pollution
- Merge/extend pollution
- URL parameter pollution
- Class-based pollution
- DOM API pollution
- Web API pollution
- Built-in method pollution

### 10. **Unsafe JavaScript Execution** (`unsafe-js-execution.test.ts`)

- eval() abuse prevention
- Function constructor restrictions
- setTimeout/setInterval string execution
- Dynamic import restrictions
- WebAssembly controls
- Event handler execution
- CSS expression blocking
- Sandbox escape prevention

## Running the Tests

### Prerequisites

```bash
npm install
```

### Run All Security Tests

```bash
npm run test:security
```

This will run all security tests and generate a comprehensive report.

### Run Individual Test Suites

```bash
# XSS tests
npm run test:xss

# Path traversal tests
npm run test:path-traversal

# Command injection tests
npm run test:command-injection

# SSRF tests
npm run test:ssrf

# CSP tests
npm run test:csp

# Cookie security tests
npm run test:cookies

# Authentication tests
npm run test:auth

# Resource exhaustion tests
npm run test:resources

# Prototype pollution tests
npm run test:prototype

# JavaScript execution tests
npm run test:js-execution
```

### Run All Tests with Jest

```bash
npm test
```

## Security Reports

After running the security tests, two reports are generated:

1. **security-report.json** - Detailed JSON report with all test results
2. **SECURITY_REPORT.md** - Markdown report for easy reading

## Test Targets

The tests are run against:

- https://williamzujkowski.github.io/paperclips/index2.html
- https://williamzujkowski.github.io/

## Interpreting Results

### Severity Levels

- **CRITICAL** - Immediate action required, blocks production deployment
- **HIGH** - Must be fixed before production
- **MEDIUM** - Should be addressed for security hardening
- **LOW** - Nice to have improvements

### Exit Codes

- `0` - All tests passed or only low/medium issues found
- `1` - Critical or high severity vulnerabilities detected

## Security Recommendations

Based on test results, the report will provide specific recommendations for:

1. **Input Validation** - Proper sanitization and validation techniques
2. **Output Encoding** - Preventing XSS through proper encoding
3. **Access Controls** - Authentication and authorization improvements
4. **Security Headers** - CSP, HSTS, and other security headers
5. **Rate Limiting** - Preventing brute force and DoS attacks
6. **Error Handling** - Secure error messages and logging
7. **Dependencies** - Keeping libraries up to date
8. **Best Practices** - OWASP guidelines and security standards

## Continuous Security Testing

It's recommended to:

1. Run these tests in CI/CD pipelines
2. Add new tests as new features are developed
3. Regular security audits and penetration testing
4. Monitor for new vulnerability patterns
5. Keep test payloads updated with latest attack vectors

## Contributing

When adding new security tests:

1. Follow the existing test structure
2. Document what vulnerabilities are being tested
3. Include both positive and negative test cases
4. Add appropriate severity classifications
5. Update this README with new test coverage

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE Database](https://cwe.mitre.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Puppeteer Security](https://pptr.dev/guides/security)
