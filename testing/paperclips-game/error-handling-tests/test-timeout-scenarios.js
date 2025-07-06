/**
 * Test Suite: Timeout Scenarios
 * Tests error handling for navigation timeouts, element wait timeouts, and script execution timeouts
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

// Test scenarios
const TIMEOUT_TESTS = {
  navigation: [
    {
      name: 'slow_loading_page',
      url: 'https://httpstat.us/200?sleep=60000',
      timeout: 5000,
      expectedError: 'NAVIGATION_TIMEOUT'
    },
    {
      name: 'extremely_slow_server',
      url: 'https://httpstat.us/200?sleep=120000',
      timeout: 3000,
      expectedError: 'NAVIGATION_TIMEOUT'
    },
    {
      name: 'never_responding_server',
      url: 'https://httpstat.us/200?sleep=300000',
      timeout: 10000,
      expectedError: 'NAVIGATION_TIMEOUT'
    }
  ],
  elementWait: [
    {
      name: 'wait_for_non_existent_element',
      url: 'https://williamzujkowski.github.io/paperclips/index2.html',
      selector: '#element-that-will-never-exist-12345',
      timeout: 5000,
      expectedError: 'WAIT_TIMEOUT'
    },
    {
      name: 'wait_for_hidden_element',
      url: 'https://williamzujkowski.github.io/',
      selector: 'div[style*="display: none"]',
      timeout: 3000,
      visible: true,
      expectedError: 'WAIT_TIMEOUT'
    },
    {
      name: 'wait_for_element_with_short_timeout',
      url: 'https://williamzujkowski.github.io/paperclips/index2.html',
      selector: 'body',
      timeout: 1, // 1ms timeout - should always fail
      expectedError: 'WAIT_TIMEOUT'
    }
  ],
  scriptExecution: [
    {
      name: 'infinite_loop_script',
      url: 'https://williamzujkowski.github.io/',
      script: 'while(true) { }',
      timeout: 5000,
      expectedError: 'SCRIPT_TIMEOUT'
    },
    {
      name: 'long_running_computation',
      url: 'https://williamzujkowski.github.io/',
      script: `
        let result = 0;
        for(let i = 0; i < 1000000000000; i++) {
          result += Math.sqrt(i);
        }
        return result;
      `,
      timeout: 3000,
      expectedError: 'SCRIPT_TIMEOUT'
    },
    {
      name: 'recursive_timeout',
      url: 'https://williamzujkowski.github.io/',
      script: `
        function recurse(n) {
          if (n <= 0) return n;
          return recurse(n - 1) + recurse(n - 1);
        }
        return recurse(50);
      `,
      timeout: 2000,
      expectedError: 'SCRIPT_TIMEOUT'
    }
  ],
  concurrent: [
    {
      name: 'multiple_slow_navigations',
      urls: [
        'https://httpstat.us/200?sleep=10000',
        'https://httpstat.us/200?sleep=15000',
        'https://httpstat.us/200?sleep=20000'
      ],
      timeout: 5000,
      expectedError: 'NAVIGATION_TIMEOUT'
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

async function testNavigationTimeout(sessionId, test) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    type: 'navigation_timeout',
    timestamp: new Date().toISOString(),
    success: false,
    expectedError: test.expectedError,
    actualError: null,
    errorMessage: null,
    responseTime: 0,
    timedOut: false
  };

  try {
    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { 
          url: test.url,
          timeout: test.timeout
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: test.timeout + 5000, // Give extra time for proper error handling
        validateStatus: () => true
      }
    );

    result.responseTime = Date.now() - startTime;

    if (response.status >= 200 && response.status < 300) {
      // Should not succeed for timeout scenarios
      result.success = false;
      result.actualError = 'UNEXPECTED_SUCCESS';
      result.errorMessage = 'Navigation completed when it should have timed out';
    } else {
      // Check if we got the expected timeout error
      const errorCode = response.data.error || response.data.code;
      result.actualError = errorCode;
      result.errorMessage = response.data.message;
      result.success = errorCode === test.expectedError || 
                      errorCode?.includes('TIMEOUT') ||
                      result.errorMessage?.toLowerCase().includes('timeout');
      result.timedOut = result.success;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'NETWORK_ERROR';
    result.errorMessage = error.message;
    
    // Axios timeout or navigation timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      result.timedOut = true;
      result.success = true;
    }
  }

  // Verify timeout occurred within reasonable bounds
  if (result.timedOut) {
    const expectedTimeout = test.timeout;
    const actualTimeout = result.responseTime;
    const tolerance = 2000; // 2 second tolerance
    
    result.timeoutAccuracy = {
      expected: expectedTimeout,
      actual: actualTimeout,
      withinTolerance: Math.abs(actualTimeout - expectedTimeout) <= tolerance
    };
  }

  return result;
}

async function testElementWaitTimeout(sessionId, test) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    type: 'element_wait_timeout',
    timestamp: new Date().toISOString(),
    success: false,
    expectedError: test.expectedError,
    actualError: null,
    errorMessage: null,
    responseTime: 0,
    timedOut: false
  };

  try {
    // First navigate to the page
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: test.url }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    // Then wait for element
    const waitStartTime = Date.now();
    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'wait',
        params: { 
          selector: test.selector,
          timeout: test.timeout,
          visible: test.visible
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: test.timeout + 5000,
        validateStatus: () => true
      }
    );

    result.responseTime = Date.now() - waitStartTime;

    if (response.status >= 200 && response.status < 300) {
      result.success = false;
      result.actualError = 'UNEXPECTED_SUCCESS';
      result.errorMessage = 'Element found when it should have timed out';
    } else {
      const errorCode = response.data.error || response.data.code;
      result.actualError = errorCode;
      result.errorMessage = response.data.message;
      result.success = errorCode === test.expectedError || 
                      errorCode?.includes('TIMEOUT') ||
                      result.errorMessage?.toLowerCase().includes('timeout');
      result.timedOut = result.success;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'ERROR';
    result.errorMessage = error.message;
    result.timedOut = error.message.includes('timeout');
    result.success = result.timedOut;
  }

  return result;
}

async function testScriptTimeout(sessionId, test) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    type: 'script_execution_timeout',
    timestamp: new Date().toISOString(),
    success: false,
    expectedError: test.expectedError,
    actualError: null,
    errorMessage: null,
    responseTime: 0,
    timedOut: false
  };

  try {
    // First navigate to the page
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: test.url }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    // Then execute script with timeout
    const scriptStartTime = Date.now();
    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: { 
          script: test.script,
          timeout: test.timeout
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: test.timeout + 10000, // Extra time for proper error handling
        validateStatus: () => true
      }
    );

    result.responseTime = Date.now() - scriptStartTime;

    if (response.status >= 200 && response.status < 300) {
      result.success = false;
      result.actualError = 'UNEXPECTED_SUCCESS';
      result.errorMessage = 'Script completed when it should have timed out';
      result.returnValue = response.data.data?.result;
    } else {
      const errorCode = response.data.error || response.data.code;
      result.actualError = errorCode;
      result.errorMessage = response.data.message;
      result.success = errorCode === test.expectedError || 
                      errorCode?.includes('TIMEOUT') ||
                      result.errorMessage?.toLowerCase().includes('timeout');
      result.timedOut = result.success;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'ERROR';
    result.errorMessage = error.message;
    result.timedOut = error.message.includes('timeout');
    result.success = result.timedOut;
  }

  return result;
}

async function testConcurrentTimeouts(sessionId, test) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    type: 'concurrent_timeout',
    timestamp: new Date().toISOString(),
    success: false,
    operations: [],
    allTimedOut: false
  };

  try {
    // Launch multiple navigation requests concurrently
    const promises = test.urls.map((url, index) => {
      return axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { 
            url,
            timeout: test.timeout
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: test.timeout + 5000,
          validateStatus: () => true
        }
      ).then(response => ({
        index,
        url,
        status: response.status,
        error: response.data.error,
        message: response.data.message,
        timedOut: response.status >= 400 && 
                  (response.data.error?.includes('TIMEOUT') || 
                   response.data.message?.toLowerCase().includes('timeout'))
      })).catch(error => ({
        index,
        url,
        error: error.code,
        message: error.message,
        timedOut: error.code === 'ECONNABORTED' || error.message.includes('timeout')
      }));
    });

    result.operations = await Promise.all(promises);
    result.duration = Date.now() - startTime;
    result.allTimedOut = result.operations.every(op => op.timedOut);
    result.success = result.allTimedOut;

  } catch (error) {
    result.error = error.message;
    result.duration = Date.now() - startTime;
  }

  return result;
}

async function testTimeoutRecovery(sessionId) {
  // Test that session remains usable after timeouts
  const result = {
    test: 'timeout_recovery',
    timestamp: new Date().toISOString(),
    success: false,
    steps: []
  };

  try {
    // Step 1: Cause a timeout
    const timeoutResult = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { 
          url: 'https://httpstat.us/200?sleep=10000',
          timeout: 2000
        }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 5000,
        validateStatus: () => true
      }
    );

    result.steps.push({
      step: 'cause_timeout',
      success: timeoutResult.status >= 400,
      details: timeoutResult.data
    });

    // Step 2: Try a normal navigation
    const recoveryResult = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' }
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 10000
      }
    );

    result.steps.push({
      step: 'recovery_navigation',
      success: recoveryResult.status === 200,
      details: recoveryResult.data
    });

    // Step 3: Verify page functionality
    const functionalityResult = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: { script: 'return document.title' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    result.steps.push({
      step: 'verify_functionality',
      success: functionalityResult.status === 200,
      title: functionalityResult.data.data?.result
    });

    result.success = result.steps.every(step => step.success);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function runTests() {
  console.log('Starting Timeout Scenario Tests...\n');
  
  const results = {
    testSuite: 'timeout-scenarios',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {}
    },
    tests: [],
    recovery: null
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test navigation timeouts
    console.log('\nTesting Navigation Timeouts:');
    console.log('='.repeat(50));
    results.summary.categories.navigation = { total: 0, passed: 0 };
    
    for (const test of TIMEOUT_TESTS.navigation) {
      process.stdout.write(`Testing ${test.name}...`);
      const result = await testNavigationTimeout(sessionId, test);
      
      results.tests.push(result);
      results.summary.total++;
      results.summary.categories.navigation.total++;
      
      if (result.success) {
        results.summary.passed++;
        results.summary.categories.navigation.passed++;
        console.log(' ✓ TIMED OUT AS EXPECTED');
        if (result.timeoutAccuracy) {
          console.log(`  └─ Timeout: ${result.timeoutAccuracy.actual}ms (expected ~${result.timeoutAccuracy.expected}ms)`);
        }
      } else {
        results.summary.failed++;
        console.log(' ✗ FAILED');
        console.log(`  └─ ${result.errorMessage}`);
      }
    }

    // Test element wait timeouts
    console.log('\n\nTesting Element Wait Timeouts:');
    console.log('='.repeat(50));
    results.summary.categories.elementWait = { total: 0, passed: 0 };
    
    for (const test of TIMEOUT_TESTS.elementWait) {
      process.stdout.write(`Testing ${test.name}...`);
      const result = await testElementWaitTimeout(sessionId, test);
      
      results.tests.push(result);
      results.summary.total++;
      results.summary.categories.elementWait.total++;
      
      if (result.success) {
        results.summary.passed++;
        results.summary.categories.elementWait.passed++;
        console.log(' ✓ TIMED OUT AS EXPECTED');
        console.log(`  └─ Timeout after ${result.responseTime}ms`);
      } else {
        results.summary.failed++;
        console.log(' ✗ FAILED');
        console.log(`  └─ ${result.errorMessage}`);
      }
    }

    // Test script execution timeouts
    console.log('\n\nTesting Script Execution Timeouts:');
    console.log('='.repeat(50));
    results.summary.categories.scriptExecution = { total: 0, passed: 0 };
    
    for (const test of TIMEOUT_TESTS.scriptExecution) {
      process.stdout.write(`Testing ${test.name}...`);
      const result = await testScriptTimeout(sessionId, test);
      
      results.tests.push(result);
      results.summary.total++;
      results.summary.categories.scriptExecution.total++;
      
      if (result.success) {
        results.summary.passed++;
        results.summary.categories.scriptExecution.passed++;
        console.log(' ✓ TIMED OUT AS EXPECTED');
        console.log(`  └─ Script timeout after ${result.responseTime}ms`);
      } else {
        results.summary.failed++;
        console.log(' ✗ FAILED');
        console.log(`  └─ ${result.errorMessage}`);
      }
    }

    // Test concurrent timeouts
    console.log('\n\nTesting Concurrent Timeouts:');
    console.log('='.repeat(50));
    results.summary.categories.concurrent = { total: 0, passed: 0 };
    
    for (const test of TIMEOUT_TESTS.concurrent) {
      process.stdout.write(`Testing ${test.name}...`);
      const result = await testConcurrentTimeouts(sessionId, test);
      
      results.tests.push(result);
      results.summary.total++;
      results.summary.categories.concurrent.total++;
      
      if (result.success) {
        results.summary.passed++;
        results.summary.categories.concurrent.passed++;
        console.log(' ✓ ALL OPERATIONS TIMED OUT');
        console.log(`  └─ ${result.operations.length} concurrent timeouts in ${result.duration}ms`);
      } else {
        results.summary.failed++;
        console.log(' ✗ FAILED');
        console.log(`  └─ Not all operations timed out`);
      }
    }

    // Test timeout recovery
    console.log('\n\nTesting Timeout Recovery:');
    console.log('='.repeat(50));
    results.recovery = await testTimeoutRecovery(sessionId);
    
    if (results.recovery.success) {
      console.log('✓ Session recovered successfully after timeout');
    } else {
      console.log('✗ Session recovery failed');
      results.recovery.steps.forEach(step => {
        console.log(`  - ${step.step}: ${step.success ? '✓' : '✗'}`);
      });
    }

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
  const resultsPath = path.join(__dirname, 'results', `timeout-scenarios-${Date.now()}.json`);
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
    console.log(`  ${category}: ${stats.passed}/${stats.total} passed`);
  }

  // Timeout handling analysis
  console.log('\n\nTimeout Handling Analysis:');
  console.log('='.repeat(50));
  
  const timeoutTests = results.tests.filter(t => t.timedOut);
  console.log(`✓ ${timeoutTests.length} operations properly timed out`);
  
  const accurateTimeouts = results.tests.filter(t => 
    t.timeoutAccuracy?.withinTolerance
  );
  if (accurateTimeouts.length > 0) {
    console.log(`✓ ${accurateTimeouts.length} timeouts occurred within tolerance`);
  }

  const failed = results.tests.filter(t => !t.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} timeout tests failed:`);
    failed.forEach(f => {
      console.log(`  - ${f.test}: Expected ${f.expectedError}, got ${f.actualError}`);
    });
  }

  return results;
}

// Run tests
runTests().catch(console.error);