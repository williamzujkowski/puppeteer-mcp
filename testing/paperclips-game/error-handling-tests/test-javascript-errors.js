/**
 * Test Suite: JavaScript Error Handling
 * Tests error handling for JavaScript errors on pages, console errors, and unhandled rejections
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

// JavaScript error test scenarios
const JS_ERROR_TESTS = {
  syntaxErrors: [
    {
      name: 'syntax_error_in_page',
      script: 'const x = {; // Syntax error',
      expectedError: 'SyntaxError',
    },
    {
      name: 'invalid_json_parse',
      script: 'JSON.parse("invalid json {{")',
      expectedError: 'SyntaxError',
    },
    {
      name: 'unexpected_token',
      script: 'function test() { return } // Missing value',
      expectedError: 'SyntaxError',
    },
  ],
  runtimeErrors: [
    {
      name: 'reference_error',
      script: 'nonExistentVariable.doSomething()',
      expectedError: 'ReferenceError',
    },
    {
      name: 'type_error_null',
      script: 'null.toString()',
      expectedError: 'TypeError',
    },
    {
      name: 'type_error_undefined',
      script: 'undefined.map(x => x)',
      expectedError: 'TypeError',
    },
    {
      name: 'range_error',
      script: 'new Array(-1)',
      expectedError: 'RangeError',
    },
    {
      name: 'stack_overflow',
      script: 'function recurse() { recurse() } recurse()',
      expectedError: 'RangeError',
    },
  ],
  asyncErrors: [
    {
      name: 'unhandled_promise_rejection',
      script: `
        new Promise((resolve, reject) => {
          reject(new Error('Unhandled rejection'));
        });
        'done';
      `,
      expectedError: 'UnhandledPromiseRejection',
    },
    {
      name: 'async_throw',
      script: `
        (async function() {
          throw new Error('Async error');
        })();
        'done';
      `,
      expectedError: 'UnhandledPromiseRejection',
    },
    {
      name: 'timeout_in_promise',
      script: `
        new Promise(resolve => {
          setTimeout(() => {
            throw new Error('Error in timeout');
          }, 100);
        });
        'done';
      `,
      expectedError: 'Error',
    },
  ],
  pageErrors: [
    {
      name: 'create_page_with_errors',
      html: `
        <html>
          <head>
            <script>
              console.error('Page console error');
              throw new Error('Page initialization error');
            </script>
          </head>
          <body>
            <h1>Page with errors</h1>
            <script>
              window.onerror = function() {
                console.log('Global error handler triggered');
              };
              nonExistentFunction();
            </script>
          </body>
        </html>
      `,
      expectedErrors: ['Page initialization error', 'nonExistentFunction'],
    },
  ],
  memoryErrors: [
    {
      name: 'memory_leak_simulation',
      script: `
        const leaks = [];
        for(let i = 0; i < 1000; i++) {
          leaks.push(new Array(1000000).fill('memory'));
        }
        'done';
      `,
      expectedError: 'MemoryError',
    },
  ],
};

// Helper functions
async function setupSession() {
  try {
    const response = await axios.post(
      `${API_BASE}/v1/sessions/dev-create`,
      {},
      { headers: { Authorization: `Bearer ${TOKEN}` } },
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

async function testJavaScriptError(sessionId, test, category) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    category,
    timestamp: new Date().toISOString(),
    success: false,
    expectedError: test.expectedError,
    actualError: null,
    errorMessage: null,
    consoleErrors: [],
    pageErrors: [],
    responseTime: 0,
    errorCaught: false,
  };

  try {
    // Navigate to a clean page first
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' },
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    // Set up console and error listeners
    const setupListeners = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: {
          script: `
            window.__errors = [];
            window.__consoleErrors = [];
            
            // Capture console errors
            const originalError = console.error;
            console.error = function(...args) {
              window.__consoleErrors.push(args.join(' '));
              originalError.apply(console, args);
            };
            
            // Capture page errors
            window.addEventListener('error', (event) => {
              window.__errors.push({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? event.error.toString() : null
              });
            });
            
            // Capture unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
              window.__errors.push({
                type: 'unhandledrejection',
                reason: event.reason ? event.reason.toString() : 'Unknown',
                promise: 'Promise'
              });
            });
            
            'listeners set up';
          `,
        },
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    // Execute the test script
    const scriptResult = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: {
          script: test.script,
        },
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 10000,
        validateStatus: () => true,
      },
    );

    result.responseTime = Date.now() - startTime;

    if (scriptResult.status >= 400) {
      // Script execution failed (expected for errors)
      result.errorCaught = true;
      result.actualError = scriptResult.data.error || scriptResult.data.code;
      result.errorMessage = scriptResult.data.message;

      // Check if the error matches expected
      result.success =
        result.actualError?.includes(test.expectedError) ||
        result.errorMessage?.includes(test.expectedError);
    } else {
      // Script executed without throwing (check for collected errors)
      const collectedErrors = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'evaluate',
          params: {
            script: `({ errors: window.__errors, consoleErrors: window.__consoleErrors })`,
          },
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );

      if (collectedErrors.data.data?.result) {
        result.pageErrors = collectedErrors.data.data.result.errors || [];
        result.consoleErrors = collectedErrors.data.data.result.consoleErrors || [];

        // Check if we caught the expected errors
        const allErrors = [
          ...result.pageErrors.map((e) => e.message || e.reason || ''),
          ...result.consoleErrors,
        ].join(' ');

        result.errorCaught = result.pageErrors.length > 0 || result.consoleErrors.length > 0;
        result.success =
          allErrors.includes(test.expectedError) ||
          (category === 'asyncErrors' &&
            result.pageErrors.some((e) => e.type === 'unhandledrejection'));
      }
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'ERROR';
    result.errorMessage = error.message;
    result.errorCaught = true;

    // Network/execution errors might indicate JS errors were caught
    result.success = error.message?.includes(test.expectedError);
  }

  return result;
}

async function testPageWithErrors(sessionId, test) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    category: 'pageErrors',
    timestamp: new Date().toISOString(),
    success: false,
    expectedErrors: test.expectedErrors,
    detectedErrors: [],
    responseTime: 0,
  };

  try {
    // Create a data URL with the error-prone HTML
    const dataUrl = `data:text/html,${encodeURIComponent(test.html)}`;

    // Navigate to the page with errors
    const navResult = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: dataUrl },
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        validateStatus: () => true,
      },
    );

    // Give time for errors to occur
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check for console messages and errors
    const errorCheck = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: {
          script: `
            const logs = [];
            // Try to get any error information from the page
            if (typeof window !== 'undefined') {
              logs.push('Page loaded');
            }
            logs;
          `,
        },
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        validateStatus: () => true,
      },
    );

    result.responseTime = Date.now() - startTime;

    // Check if navigation or evaluation reported errors
    if (navResult.status >= 400 || errorCheck.status >= 400) {
      const errorMessages = [navResult.data?.message, errorCheck.data?.message]
        .filter(Boolean)
        .join(' ');

      result.detectedErrors = test.expectedErrors.filter((expected) =>
        errorMessages.includes(expected),
      );
    }

    result.success = result.detectedErrors.length > 0;
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.error = error.message;
  }

  return result;
}

async function testErrorIsolation(sessionId) {
  // Test that JS errors in one context don't affect others
  const result = {
    test: 'error_isolation',
    timestamp: new Date().toISOString(),
    success: false,
    contexts: [],
  };

  try {
    // Create multiple contexts
    for (let i = 0; i < 3; i++) {
      const contextResult = {
        index: i,
        errorCaused: false,
        functionalAfterError: false,
      };

      // Navigate to a page
      await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { url: 'https://williamzujkowski.github.io/' },
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );

      if (i === 1) {
        // Cause an error in the middle context
        const errorResult = await axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: 'evaluate',
            params: { script: 'throw new Error("Deliberate error")' },
          },
          {
            headers: { Authorization: `Bearer ${TOKEN}` },
            validateStatus: () => true,
          },
        );
        contextResult.errorCaused = errorResult.status >= 400;
      }

      // Test functionality
      const funcTest = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'evaluate',
          params: { script: 'document.title' },
        },
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          validateStatus: () => true,
        },
      );

      contextResult.functionalAfterError = funcTest.status === 200;
      result.contexts.push(contextResult);
    }

    // All contexts should remain functional
    result.success = result.contexts.every((ctx, idx) =>
      idx === 1 ? ctx.errorCaused : ctx.functionalAfterError,
    );
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testErrorReporting(sessionId) {
  // Test error reporting and details
  const result = {
    test: 'error_reporting_details',
    timestamp: new Date().toISOString(),
    success: false,
    errorTypes: [],
  };

  const errorTypes = [
    { type: 'SyntaxError', script: 'const x = {]' },
    { type: 'TypeError', script: 'null.foo()' },
    { type: 'ReferenceError', script: 'unknownVar' },
    { type: 'RangeError', script: 'new Array(-1)' },
  ];

  try {
    for (const errorType of errorTypes) {
      const errorResult = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'evaluate',
          params: { script: errorType.script },
        },
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          validateStatus: () => true,
        },
      );

      const errorDetail = {
        type: errorType.type,
        reported: false,
        correctType: false,
        hasStackTrace: false,
        hasLineNumber: false,
        details: {},
      };

      if (errorResult.status >= 400) {
        errorDetail.reported = true;
        errorDetail.details = errorResult.data;

        const errorMessage = errorResult.data.message || '';
        const errorCode = errorResult.data.error || '';

        errorDetail.correctType =
          errorMessage.includes(errorType.type) || errorCode.includes(errorType.type);
        errorDetail.hasStackTrace =
          errorMessage.includes('at ') || errorResult.data.stack !== undefined;
        errorDetail.hasLineNumber =
          errorMessage.match(/line \d+/) !== null || errorResult.data.line !== undefined;
      }

      result.errorTypes.push(errorDetail);
    }

    result.success = result.errorTypes.every((err) => err.reported && err.correctType);
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function runTests() {
  console.log('Starting JavaScript Error Handling Tests...\n');

  const results = {
    testSuite: 'javascript-error-handling',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {},
    },
    tests: [],
    isolation: null,
    reporting: null,
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test each category of JavaScript errors
    for (const [category, tests] of Object.entries(JS_ERROR_TESTS)) {
      console.log(`\nTesting ${category}:`);
      console.log('='.repeat(50));

      results.summary.categories[category] = {
        total: tests.length,
        passed: 0,
        failed: 0,
      };

      for (const test of tests) {
        process.stdout.write(`Testing ${test.name}...`);

        let result;
        if (category === 'pageErrors') {
          result = await testPageWithErrors(sessionId, test);
        } else {
          result = await testJavaScriptError(sessionId, test, category);
        }

        results.tests.push(result);
        results.summary.total++;

        if (result.success) {
          results.summary.passed++;
          results.summary.categories[category].passed++;
          console.log(' ✓ ERROR CAUGHT');
          if (result.actualError) {
            console.log(`  └─ ${result.actualError}: ${result.errorMessage}`);
          }
          if (result.pageErrors?.length > 0) {
            console.log(`  └─ Page errors: ${result.pageErrors.length}`);
          }
        } else {
          results.summary.failed++;
          results.summary.categories[category].failed++;
          console.log(' ✗ ERROR NOT CAUGHT');
          console.log(`  └─ Expected: ${test.expectedError || test.expectedErrors?.join(', ')}`);
          console.log(`  └─ Actual: ${result.actualError || 'No error'}`);
        }

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Test error isolation
    console.log('\n\nTesting Error Isolation:');
    console.log('='.repeat(50));
    results.isolation = await testErrorIsolation(sessionId);

    if (results.isolation.success) {
      console.log('✓ Errors are properly isolated between contexts');
    } else {
      console.log('✗ Error isolation test failed');
    }
    results.isolation.contexts?.forEach((ctx, idx) => {
      console.log(
        `  - Context ${idx}: Error=${ctx.errorCaused ? '✓' : '✗'}, Functional=${ctx.functionalAfterError ? '✓' : '✗'}`,
      );
    });

    // Test error reporting
    console.log('\n\nTesting Error Reporting:');
    console.log('='.repeat(50));
    results.reporting = await testErrorReporting(sessionId);

    if (results.reporting.success) {
      console.log('✓ All error types properly reported');
    } else {
      console.log('✗ Some error types not properly reported');
    }
    results.reporting.errorTypes?.forEach((err) => {
      console.log(
        `  - ${err.type}: Reported=${err.reported ? '✓' : '✗'}, Type=${err.correctType ? '✓' : '✗'}, Stack=${err.hasStackTrace ? '✓' : '✗'}`,
      );
    });
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
  const resultsPath = path.join(__dirname, 'results', `javascript-errors-${Date.now()}.json`);
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
    const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} passed (${percentage}%)`);
  }

  // JavaScript error handling analysis
  console.log('\n\nJavaScript Error Handling Analysis:');
  console.log('='.repeat(50));

  const caughtErrors = results.tests.filter((t) => t.errorCaught);
  console.log(`✓ ${caughtErrors.length}/${results.tests.length} JavaScript errors properly caught`);

  const uncaughtErrors = results.tests.filter((t) => !t.errorCaught && !t.success);
  if (uncaughtErrors.length > 0) {
    console.log(`\n⚠️  ${uncaughtErrors.length} uncaught JavaScript errors:`);
    uncaughtErrors.forEach((e) => {
      console.log(`  - ${e.test}: Expected ${e.expectedError}`);
    });
  }

  // Error categorization
  console.log('\nError Types Distribution:');
  const errorCategories = {};
  results.tests.forEach((test) => {
    if (test.actualError) {
      const category = test.actualError.split(':')[0] || test.actualError;
      errorCategories[category] = (errorCategories[category] || 0) + 1;
    }
  });

  Object.entries(errorCategories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });

  return results;
}

// Run tests
runTests().catch(console.error);
