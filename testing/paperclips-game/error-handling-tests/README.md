# Puppeteer-MCP Error Handling Test Suite

This comprehensive test suite validates error handling and edge cases for the puppeteer-mcp platform to ensure production stability.

## Test Coverage

### 1. Invalid URLs (`test-invalid-urls.js`)
- Malformed URLs (invalid protocols, syntax errors)
- Non-existent domains
- Protocol errors (ftp://, ssh://, etc.)
- Resource cleanup after URL errors

### 2. Timeout Scenarios (`test-timeout-scenarios.js`)
- Navigation timeouts
- Element wait timeouts
- Script execution timeouts
- Concurrent timeout handling
- Recovery after timeouts

### 3. Network Errors (`test-network-errors.js`)
- DNS failures
- Connection refused
- Network unreachable
- Certificate errors (expired, self-signed, wrong host)
- HTTP error status codes
- Offline mode simulation

### 4. JavaScript Errors (`test-javascript-errors.js`)
- Syntax errors
- Runtime errors (TypeError, ReferenceError, RangeError)
- Async errors and unhandled promise rejections
- Page console errors
- Error isolation between contexts

### 5. Invalid Selectors (`test-invalid-selectors.js`)
- Invalid CSS selectors
- Invalid XPath expressions
- Non-existent elements
- Ambiguous selectors
- Edge cases (null, undefined, very long selectors)

### 6. Concurrent Operations (`test-concurrent-operations.js`)
- Simultaneous navigations
- Concurrent element interactions
- Resource contention
- Race condition detection
- Deadlock prevention

## Running the Tests

### Prerequisites
1. Start the puppeteer-mcp server:
   ```bash
   cd /home/william/git/puppeteer-mcp
   npm run dev
   ```

2. Setup the tests:
   ```bash
   cd testing/paperclips-game/error-handling-tests
   ./setup-tests.sh
   ```

### Run All Tests
```bash
./run-all-error-tests.js
```

### Run Individual Test Suites
```bash
node test-invalid-urls.js
node test-timeout-scenarios.js
node test-network-errors.js
node test-javascript-errors.js
node test-invalid-selectors.js
node test-concurrent-operations.js
```

## Test Results

Results are saved in the `results/` directory:
- Individual test results: `results/<test-name>-<timestamp>.json`
- Comprehensive report: `ERROR_HANDLING_REPORT.md`
- Full JSON report: `results/comprehensive-error-report-<timestamp>.json`

## Interpreting Results

### Success Criteria
- ✅ All invalid inputs are rejected
- ✅ All timeouts are handled gracefully
- ✅ Network errors don't crash the system
- ✅ JavaScript errors are isolated
- ✅ Resources are cleaned up after errors
- ✅ Concurrent operations don't cause deadlocks

### Vulnerability Indicators
- ❌ Invalid URLs accepted
- ❌ Timeouts not enforced
- ❌ Resources not cleaned up
- ❌ Errors affecting other sessions
- ❌ Race conditions detected

## Test URLs Used

### Valid URLs
- https://williamzujkowski.github.io/paperclips/index2.html
- https://williamzujkowski.github.io/
- https://example.com

### Invalid/Test URLs
- https://this-domain-definitely-does-not-exist-12345.com
- https://httpstat.us/200?sleep=60000 (timeout simulation)
- https://expired.badssl.com/ (certificate errors)
- Various malformed URLs for testing

## Security Considerations

These tests specifically look for:
1. **Input Validation**: Ensuring all user inputs are properly validated
2. **Resource Management**: Preventing resource leaks and DoS vulnerabilities
3. **Error Information Leakage**: Ensuring errors don't expose sensitive information
4. **Session Isolation**: Verifying errors in one session don't affect others
5. **Timeout Enforcement**: Preventing infinite loops and hanging operations

## Recommendations

Based on test results, the system should:
1. Implement strict input validation for all user-provided data
2. Enforce reasonable timeouts on all operations
3. Properly clean up resources after errors
4. Isolate errors to prevent cascade failures
5. Return appropriate error messages without exposing internals

## Contributing

When adding new error tests:
1. Follow the existing test structure
2. Test both expected failures and recovery
3. Include resource cleanup verification
4. Document the specific vulnerability being tested
5. Update this README with the new test coverage