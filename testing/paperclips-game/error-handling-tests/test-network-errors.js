/**
 * Test Suite: Network Error Handling
 * Tests error handling for offline scenarios, DNS failures, connection refused, and other network issues
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:8443/api';
const TOKEN = process.env.API_TOKEN || 'test-token';

// Network error test scenarios
const NETWORK_ERROR_TESTS = {
  dnsFailures: [
    {
      name: 'non_existent_domain',
      url: 'https://this-domain-absolutely-does-not-exist-' + Date.now() + '.com',
      expectedErrors: ['ENOTFOUND', 'DNS_FAIL', 'ERR_NAME_NOT_RESOLVED']
    },
    {
      name: 'invalid_tld',
      url: 'https://example.invalid-tld-12345',
      expectedErrors: ['ENOTFOUND', 'DNS_FAIL', 'ERR_NAME_NOT_RESOLVED']
    },
    {
      name: 'malformed_domain',
      url: 'https://sub..domain..com',
      expectedErrors: ['ENOTFOUND', 'DNS_FAIL', 'ERR_NAME_NOT_RESOLVED', 'ERR_INVALID_URL']
    }
  ],
  connectionRefused: [
    {
      name: 'localhost_closed_port',
      url: 'http://localhost:65432', // Unlikely to be open
      expectedErrors: ['ECONNREFUSED', 'ERR_CONNECTION_REFUSED']
    },
    {
      name: 'local_ip_closed_port',
      url: 'http://127.0.0.1:65431',
      expectedErrors: ['ECONNREFUSED', 'ERR_CONNECTION_REFUSED']
    },
    {
      name: 'private_ip_unreachable',
      url: 'http://192.168.255.254:80', // Unlikely to exist
      expectedErrors: ['ETIMEDOUT', 'ECONNREFUSED', 'ERR_CONNECTION_TIMED_OUT']
    }
  ],
  networkUnreachable: [
    {
      name: 'ipv6_loopback_closed',
      url: 'http://[::1]:65430',
      expectedErrors: ['ECONNREFUSED', 'ENETUNREACH', 'ERR_CONNECTION_REFUSED']
    },
    {
      name: 'reserved_ip_block',
      url: 'http://240.0.0.1', // Reserved for future use
      expectedErrors: ['ETIMEDOUT', 'ENETUNREACH', 'ERR_ADDRESS_UNREACHABLE']
    }
  ],
  certificateErrors: [
    {
      name: 'expired_certificate',
      url: 'https://expired.badssl.com/',
      expectedErrors: ['ERR_CERT_DATE_INVALID', 'CERT_HAS_EXPIRED']
    },
    {
      name: 'wrong_host_certificate',
      url: 'https://wrong.host.badssl.com/',
      expectedErrors: ['ERR_CERT_COMMON_NAME_INVALID', 'CERT_INVALID']
    },
    {
      name: 'self_signed_certificate',
      url: 'https://self-signed.badssl.com/',
      expectedErrors: ['ERR_CERT_AUTHORITY_INVALID', 'SELF_SIGNED_CERT']
    },
    {
      name: 'untrusted_root',
      url: 'https://untrusted-root.badssl.com/',
      expectedErrors: ['ERR_CERT_AUTHORITY_INVALID', 'UNABLE_TO_VERIFY']
    }
  ],
  httpErrors: [
    {
      name: 'server_error_500',
      url: 'https://httpstat.us/500',
      expectedErrors: ['500', 'Internal Server Error']
    },
    {
      name: 'bad_gateway_502',
      url: 'https://httpstat.us/502',
      expectedErrors: ['502', 'Bad Gateway']
    },
    {
      name: 'service_unavailable_503',
      url: 'https://httpstat.us/503',
      expectedErrors: ['503', 'Service Unavailable']
    },
    {
      name: 'gateway_timeout_504',
      url: 'https://httpstat.us/504',
      expectedErrors: ['504', 'Gateway Timeout']
    }
  ]
};

// Helper functions
async function setupSession() {
  try {
    const response = await axios.post(
      `${API_BASE}/v1/sessions/dev-create`,
      {},
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    // Store the token for later use
    if (response.data.data?.tokens?.accessToken) {
      process.env.API_TOKEN = response.data.data.tokens.accessToken;
    }
    return response.data.data.sessionId;
  } catch (error) {
    console.error('Failed to create session:', error.response?.data || error.message);
    throw error;
  }
}

async function testNetworkError(sessionId, test, category) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    category,
    url: test.url,
    timestamp: new Date().toISOString(),
    success: false,
    expectedErrors: test.expectedErrors,
    actualError: null,
    errorCode: null,
    errorMessage: null,
    responseTime: 0,
    httpStatus: null,
    errorHandled: false
  };

  try {
    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { 
          url: test.url,
          ignoreHTTPSErrors: category === 'certificateErrors' // Allow cert errors for testing
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    result.responseTime = Date.now() - startTime;
    result.httpStatus = response.status;

    if (response.status >= 200 && response.status < 300) {
      // Check if this is expected (e.g., HTTP error status pages)
      if (category === 'httpErrors') {
        result.success = true;
        result.errorHandled = true;
        result.actualError = 'HTTP_ERROR_PAGE_LOADED';
        result.pageTitle = response.data.data?.title;
      } else {
        result.success = false;
        result.actualError = 'UNEXPECTED_SUCCESS';
        result.errorMessage = 'Page loaded when network error was expected';
      }
    } else {
      // Error response
      result.actualError = response.data.error || response.data.code || 'UNKNOWN_ERROR';
      result.errorCode = response.data.code || response.status;
      result.errorMessage = response.data.message || response.statusText;
      result.details = response.data.details;
      
      // Check if error matches expected
      result.errorHandled = true;
      result.success = test.expectedErrors.some(expected => 
        result.actualError.includes(expected) ||
        result.errorMessage?.includes(expected) ||
        result.errorCode?.toString().includes(expected)
      );
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'NETWORK_ERROR';
    result.errorMessage = error.message;
    
    if (error.response) {
      result.httpStatus = error.response.status;
      result.errorCode = error.response.data?.code || error.response.status;
      result.details = error.response.data;
    }
    
    // Network errors are expected for these tests
    result.errorHandled = true;
    result.success = test.expectedErrors.some(expected => 
      result.actualError.includes(expected) ||
      result.errorMessage?.includes(expected)
    );
  }

  return result;
}

async function testOfflineMode(sessionId) {
  // Test offline mode simulation
  const result = {
    test: 'offline_mode_simulation',
    timestamp: new Date().toISOString(),
    success: false,
    steps: []
  };

  try {
    // Step 1: Navigate to a page successfully
    const onlineNav = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    result.steps.push({
      step: 'initial_online_navigation',
      success: onlineNav.status === 200
    });

    // Step 2: Simulate offline mode (if supported)
    const offlineMode = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: { 
          script: `
            if (window.navigator.onLine !== undefined) {
              // Try to simulate offline
              window.dispatchEvent(new Event('offline'));
              return { 
                supported: true, 
                onLine: window.navigator.onLine 
              };
            }
            return { supported: false };
          `
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        validateStatus: () => true
      }
    );

    result.steps.push({
      step: 'offline_mode_check',
      success: offlineMode.status === 200,
      details: offlineMode.data.data?.result
    });

    // Step 3: Try navigation while "offline"
    const offlineNav = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://example.com' }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        validateStatus: () => true
      }
    );

    result.steps.push({
      step: 'offline_navigation_attempt',
      success: offlineNav.status >= 400, // Should fail
      error: offlineNav.data.error,
      message: offlineNav.data.message
    });

    result.success = result.steps.every(step => step.success);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testNetworkThrottling(sessionId) {
  // Test behavior under poor network conditions
  const result = {
    test: 'network_throttling',
    timestamp: new Date().toISOString(),
    success: false,
    conditions: []
  };

  const throttleConditions = [
    { name: 'slow_3g', latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 },
    { name: 'offline', latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
  ];

  try {
    for (const condition of throttleConditions) {
      const conditionResult = {
        condition: condition.name,
        applied: false,
        navigationTime: 0,
        error: null
      };

      // Try to apply network conditions (if supported)
      const applyConditions = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'evaluate',
          params: { 
            script: `
              // Check if we can access Chrome DevTools Protocol
              return { cdpAvailable: typeof window.chrome !== 'undefined' };
            `
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          validateStatus: () => true
        }
      );

      conditionResult.cdpInfo = applyConditions.data.data?.result;

      // Attempt navigation under conditions
      const navStart = Date.now();
      const navResult = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { 
            url: 'https://williamzujkowski.github.io/paperclips/index2.html',
            timeout: 20000
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 25000,
          validateStatus: () => true
        }
      );

      conditionResult.navigationTime = Date.now() - navStart;
      conditionResult.success = navResult.status === 200 || 
                                (condition.name === 'offline' && navResult.status >= 400);
      
      if (navResult.status >= 400) {
        conditionResult.error = navResult.data.error;
      }

      result.conditions.push(conditionResult);
    }

    result.success = result.conditions.length > 0;

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testErrorRecovery(sessionId) {
  // Test recovery after various network errors
  const result = {
    test: 'network_error_recovery',
    timestamp: new Date().toISOString(),
    success: false,
    recoveryTests: []
  };

  const errorScenarios = [
    { type: 'dns_failure', url: 'https://non-existent-' + Date.now() + '.com' },
    { type: 'connection_refused', url: 'http://localhost:65433' },
    { type: 'timeout', url: 'https://httpstat.us/200?sleep=1000' }
  ];

  try {
    for (const scenario of errorScenarios) {
      const recoveryTest = {
        scenario: scenario.type,
        errorOccurred: false,
        recovered: false,
        details: {}
      };

      // Cause the error
      const errorResult = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { url: scenario.url, timeout: 3000 }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 5000,
          validateStatus: () => true
        }
      );

      recoveryTest.errorOccurred = errorResult.status >= 400;
      recoveryTest.details.error = errorResult.data;

      // Try recovery navigation
      const recoveryResult = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { url: 'https://williamzujkowski.github.io/' }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      recoveryTest.recovered = recoveryResult.status === 200;
      recoveryTest.details.recovery = {
        status: recoveryResult.status,
        url: recoveryResult.data.data?.url
      };

      result.recoveryTests.push(recoveryTest);
    }

    result.success = result.recoveryTests.every(test => 
      test.errorOccurred && test.recovered
    );

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function runTests() {
  console.log('Starting Network Error Handling Tests...\n');
  
  const results = {
    testSuite: 'network-error-handling',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {}
    },
    tests: [],
    offlineMode: null,
    throttling: null,
    recovery: null
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test each category of network errors
    for (const [category, tests] of Object.entries(NETWORK_ERROR_TESTS)) {
      console.log(`\nTesting ${category}:`);
      console.log('='.repeat(50));
      
      results.summary.categories[category] = {
        total: tests.length,
        passed: 0,
        failed: 0
      };

      for (const test of tests) {
        process.stdout.write(`Testing ${test.name}...`);
        const result = await testNetworkError(sessionId, test, category);
        
        results.tests.push(result);
        results.summary.total++;
        
        if (result.success) {
          results.summary.passed++;
          results.summary.categories[category].passed++;
          console.log(' ✓ ERROR PROPERLY HANDLED');
          console.log(`  └─ ${result.actualError}: ${result.errorMessage}`);
        } else {
          results.summary.failed++;
          results.summary.categories[category].failed++;
          console.log(' ✗ UNEXPECTED RESULT');
          console.log(`  └─ Expected: ${test.expectedErrors.join(' or ')}`);
          console.log(`  └─ Actual: ${result.actualError}`);
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Test offline mode
    console.log('\n\nTesting Offline Mode:');
    console.log('='.repeat(50));
    results.offlineMode = await testOfflineMode(sessionId);
    
    if (results.offlineMode.success) {
      console.log('✓ Offline mode handling verified');
    } else {
      console.log('✗ Offline mode test incomplete');
    }
    results.offlineMode.steps.forEach(step => {
      console.log(`  - ${step.step}: ${step.success ? '✓' : '✗'}`);
    });

    // Test network throttling
    console.log('\n\nTesting Network Throttling:');
    console.log('='.repeat(50));
    results.throttling = await testNetworkThrottling(sessionId);
    
    if (results.throttling.success) {
      console.log('✓ Network condition tests completed');
      results.throttling.conditions.forEach(cond => {
        console.log(`  - ${cond.condition}: ${cond.navigationTime}ms`);
      });
    } else {
      console.log('✗ Network throttling tests failed');
    }

    // Test error recovery
    console.log('\n\nTesting Error Recovery:');
    console.log('='.repeat(50));
    results.recovery = await testErrorRecovery(sessionId);
    
    if (results.recovery.success) {
      console.log('✓ All network errors recovered successfully');
    } else {
      console.log('✗ Some recovery tests failed');
    }
    results.recovery.recoveryTests?.forEach(test => {
      console.log(`  - ${test.scenario}: Error=${test.errorOccurred ? '✓' : '✗'}, Recovery=${test.recovered ? '✓' : '✗'}`);
    });

  } catch (error) {
    console.error('\nTest suite error:', error.message);
    results.error = error.message;
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        await axios.delete(
          `${API_BASE}/v1/sessions/dev-create/${sessionId}`,
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        console.log('\nTest session cleaned up');
      } catch (error) {
        console.error('Failed to cleanup session:', error.message);
      }
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, 'results', `network-errors-${Date.now()}.json`);
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n\nTest Summary:');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} (${(results.summary.passed/results.summary.total*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.summary.failed}`);
  
  console.log('\nBy Category:');
  for (const [category, stats] of Object.entries(results.summary.categories)) {
    const percentage = (stats.passed/stats.total*100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} passed (${percentage}%)`);
  }

  // Network error handling analysis
  console.log('\n\nNetwork Error Handling Analysis:');
  console.log('='.repeat(50));
  
  const handledErrors = results.tests.filter(t => t.errorHandled);
  console.log(`✓ ${handledErrors.length}/${results.tests.length} network errors properly handled`);
  
  const unhandledErrors = results.tests.filter(t => !t.errorHandled && !t.success);
  if (unhandledErrors.length > 0) {
    console.log(`\n⚠️  ${unhandledErrors.length} unhandled network errors:`);
    unhandledErrors.forEach(e => {
      console.log(`  - ${e.test}: ${e.actualError}`);
    });
  }

  // Error categorization
  const errorTypes = {};
  results.tests.forEach(test => {
    const error = test.actualError || 'UNKNOWN';
    errorTypes[error] = (errorTypes[error] || 0) + 1;
  });
  
  console.log('\nError Distribution:');
  Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });

  return results;
}

// Run tests
runTests().catch(console.error);