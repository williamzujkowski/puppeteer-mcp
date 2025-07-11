/**
 * Test Suite: Invalid URL Error Handling
 * Tests error handling for malformed URLs, non-existent domains, and protocol errors
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

// Test URLs
const TEST_URLS = {
  malformed: [
    'htp://invalid-protocol',
    'http:/malformed',
    'http://missing-tld.',
    'http://...',
    'http://[invalid-ipv6',
    'http://invalid space.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,<script>alert(1)</script>',
    'about:blank',
    '://no-protocol.com',
    'http://:80',
    'http://user@:password@site.com',
    'http://256.256.256.256', // Invalid IP
    'http://example..com',
    'http://-example.com',
    'http://example-.com',
    'http://exa mple.com',
    'http://example.com:99999', // Invalid port
    'http://example.com:-1',
    'http://example.com:abc',
  ],
  nonExistent: [
    'https://this-domain-definitely-does-not-exist-12345.com',
    'https://non-existent-subdomain.definitely-not-real-domain-98765.org',
    'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.com',
    'https://test-' + Date.now() + '-nonexistent.com',
    'https://192.0.2.1', // TEST-NET-1 (should not exist)
    'https://[2001:db8::1]', // IPv6 documentation prefix
  ],
  protocolErrors: [
    'ftp://ftp.example.com',
    'ssh://ssh.example.com',
    'telnet://telnet.example.com',
    'gopher://gopher.example.com',
    'ws://websocket.example.com',
    'wss://websocket.example.com',
    'chrome://settings',
    'chrome-extension://abc123',
    'view-source:http://example.com',
    'blob:http://example.com/123',
    'filesystem:http://example.com/temporary/',
  ],
};

// Helper functions
async function setupSession() {
  try {
    // Use dev-create endpoint for testing
    const response = await axios.post(`${API_BASE}/v1/sessions/dev-create`, {}, {});
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

async function testInvalidUrl(sessionId, url, category) {
  const startTime = Date.now();
  let result = {
    url,
    category,
    timestamp: new Date().toISOString(),
    success: false,
    error: null,
    errorCode: null,
    errorMessage: null,
    responseTime: 0,
    httpStatus: null,
  };

  try {
    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url },
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 10000,
        validateStatus: () => true, // Accept any status
      },
    );

    result.httpStatus = response.status;
    result.responseTime = Date.now() - startTime;

    if (response.status >= 200 && response.status < 300) {
      // Should not succeed for invalid URLs
      result.success = false;
      result.error = 'UNEXPECTED_SUCCESS';
      result.errorMessage = 'Invalid URL was accepted when it should have been rejected';
      result.response = response.data;
    } else {
      // Expected error
      result.success = true; // Success means we properly caught the error
      result.error = response.data.error || 'UNKNOWN_ERROR';
      result.errorCode = response.data.code || response.status;
      result.errorMessage = response.data.message || response.statusText;
      result.details = response.data.details || null;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.success = true; // Network errors are expected for some URLs
    result.error = error.code || 'NETWORK_ERROR';
    result.errorMessage = error.message;

    if (error.response) {
      result.httpStatus = error.response.status;
      result.errorCode = error.response.data?.code || error.response.status;
      result.details = error.response.data;
    }
  }

  return result;
}

async function testResourceCleanup(sessionId) {
  // Test that resources are properly cleaned up after errors
  const startTime = Date.now();
  let result = {
    test: 'resource_cleanup',
    timestamp: new Date().toISOString(),
    success: false,
    checks: [],
  };

  try {
    // Get session info before
    const beforeResponse = await axios.get(`${API_BASE}/v1/sessions/dev-create/${sessionId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const pagesBefore = beforeResponse.data.data.pages?.length || 0;

    // Try multiple invalid URLs
    for (let i = 0; i < 5; i++) {
      await testInvalidUrl(sessionId, TEST_URLS.malformed[i], 'cleanup-test');
    }

    // Get session info after
    const afterResponse = await axios.get(`${API_BASE}/v1/sessions/dev-create/${sessionId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const pagesAfter = afterResponse.data.data.pages?.length || 0;

    result.checks.push({
      name: 'page_count_unchanged',
      passed: pagesBefore === pagesAfter,
      expected: pagesBefore,
      actual: pagesAfter,
    });

    // Check session is still active
    result.checks.push({
      name: 'session_still_active',
      passed: afterResponse.data.data.active === true,
      details: afterResponse.data.data,
    });

    result.success = result.checks.every((check) => check.passed);
    result.duration = Date.now() - startTime;
  } catch (error) {
    result.error = error.message;
    result.duration = Date.now() - startTime;
  }

  return result;
}

async function runTests() {
  console.log('Starting Invalid URL Error Handling Tests...\n');

  const results = {
    testSuite: 'invalid-url-handling',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {},
    },
    tests: [],
    resourceCleanup: null,
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test each category
    for (const [category, urls] of Object.entries(TEST_URLS)) {
      console.log(`\nTesting ${category} URLs:`);
      console.log('='.repeat(50));

      results.summary.categories[category] = {
        total: urls.length,
        passed: 0,
        failed: 0,
      };

      for (const url of urls) {
        process.stdout.write(`Testing: ${url.substring(0, 50)}...`);
        const result = await testInvalidUrl(sessionId, url, category);

        results.tests.push(result);
        results.summary.total++;

        if (result.success) {
          results.summary.passed++;
          results.summary.categories[category].passed++;
          console.log(' ✓ ERROR CAUGHT');
          console.log(`  └─ ${result.errorCode}: ${result.errorMessage}`);
        } else {
          results.summary.failed++;
          results.summary.categories[category].failed++;
          console.log(' ✗ FAILED');
          console.log(`  └─ ${result.errorMessage}`);
        }

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Test resource cleanup
    console.log('\n\nTesting Resource Cleanup:');
    console.log('='.repeat(50));
    results.resourceCleanup = await testResourceCleanup(sessionId);

    if (results.resourceCleanup.success) {
      console.log('✓ Resources properly cleaned up after errors');
    } else {
      console.log('✗ Resource cleanup issues detected');
      results.resourceCleanup.checks.forEach((check) => {
        console.log(`  - ${check.name}: ${check.passed ? '✓' : '✗'}`);
      });
    }
  } catch (error) {
    console.error('\nTest suite error:', error.message);
    results.error = error.message;
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        await axios.delete(`${API_BASE}/v1/sessions/dev-create/${sessionId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        console.log('\nTest session cleaned up');
      } catch (error) {
        console.error('Failed to cleanup session:', error.message);
      }
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, 'results', `invalid-urls-${Date.now()}.json`);
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n\nTest Summary:');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(
    `Passed: ${results.summary.passed} (${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%)`,
  );
  console.log(`Failed: ${results.summary.failed}`);

  console.log('\nBy Category:');
  for (const [category, stats] of Object.entries(results.summary.categories)) {
    console.log(`  ${category}: ${stats.passed}/${stats.total} passed`);
  }

  // Identify vulnerabilities
  console.log('\n\nVulnerability Analysis:');
  console.log('='.repeat(50));

  const vulnerabilities = results.tests.filter((t) => !t.success);
  if (vulnerabilities.length === 0) {
    console.log('✓ No vulnerabilities found - all invalid URLs properly rejected');
  } else {
    console.log(`⚠️  Found ${vulnerabilities.length} potential vulnerabilities:`);
    vulnerabilities.forEach((v) => {
      console.log(`  - ${v.url}: ${v.errorMessage}`);
    });
  }

  // Check for consistent error handling
  const errorCodes = [...new Set(results.tests.map((t) => t.errorCode))].filter(Boolean);
  console.log(`\nError codes encountered: ${errorCodes.join(', ')}`);

  return results;
}

// Run tests
runTests().catch(console.error);
