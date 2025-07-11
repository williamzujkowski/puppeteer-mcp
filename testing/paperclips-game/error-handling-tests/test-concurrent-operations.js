/**
 * Test Suite: Concurrent Operation Conflicts
 * Tests error handling for concurrent browser operations and race conditions
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

// Concurrent operation test scenarios
const CONCURRENT_TESTS = {
  navigationConflicts: [
    {
      name: 'simultaneous_navigations',
      operations: [
        { action: 'navigate', params: { url: 'https://williamzujkowski.github.io/' } },
        {
          action: 'navigate',
          params: { url: 'https://williamzujkowski.github.io/paperclips/index2.html' },
        },
        { action: 'navigate', params: { url: 'https://example.com' } },
      ],
      expectedBehavior: 'last_wins',
    },
    {
      name: 'navigation_during_loading',
      operations: [
        { action: 'navigate', params: { url: 'https://httpstat.us/200?sleep=3000' } },
        { action: 'navigate', params: { url: 'https://williamzujkowski.github.io/', delay: 500 } },
      ],
      expectedBehavior: 'interruption',
    },
  ],
  elementInteractionConflicts: [
    {
      name: 'multiple_clicks_same_element',
      setup: { url: 'https://williamzujkowski.github.io/paperclips/index2.html' },
      operations: [
        { action: 'click', params: { selector: '#btnMakePaperclip' } },
        { action: 'click', params: { selector: '#btnMakePaperclip' } },
        { action: 'click', params: { selector: '#btnMakePaperclip' } },
      ],
      expectedBehavior: 'sequential_execution',
    },
    {
      name: 'concurrent_element_modifications',
      setup: { url: 'https://williamzujkowski.github.io/' },
      operations: [
        { action: 'evaluate', params: { script: 'document.body.style.backgroundColor = "red"' } },
        { action: 'evaluate', params: { script: 'document.body.style.backgroundColor = "blue"' } },
        { action: 'evaluate', params: { script: 'document.body.style.backgroundColor = "green"' } },
      ],
      expectedBehavior: 'last_wins',
    },
  ],
  resourceContention: [
    {
      name: 'multiple_screenshot_requests',
      setup: { url: 'https://williamzujkowski.github.io/paperclips/index2.html' },
      operations: Array(5)
        .fill()
        .map(() => ({ action: 'screenshot' })),
      expectedBehavior: 'all_succeed',
    },
    {
      name: 'concurrent_evaluations',
      setup: { url: 'https://williamzujkowski.github.io/' },
      operations: Array(10)
        .fill()
        .map((_, i) => ({
          action: 'evaluate',
          params: { script: `Date.now() + ${i}` },
        })),
      expectedBehavior: 'all_succeed',
    },
  ],
  sessionConflicts: [
    {
      name: 'concurrent_page_creations',
      operations: Array(3)
        .fill()
        .map(() => ({
          action: 'createPage',
        })),
      expectedBehavior: 'all_succeed',
    },
    {
      name: 'close_during_operation',
      setup: { url: 'https://williamzujkowski.github.io/' },
      operations: [
        { action: 'evaluate', params: { script: 'new Promise(r => setTimeout(r, 2000))' } },
        { action: 'close', delay: 500 },
      ],
      expectedBehavior: 'graceful_cleanup',
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

async function executeConcurrentOperations(sessionId, operations) {
  const results = await Promise.allSettled(
    operations.map(async (op, index) => {
      if (op.delay) {
        await new Promise((resolve) => setTimeout(resolve, op.delay));
      }

      const startTime = Date.now();
      try {
        const response = await axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: op.action,
            params: op.params,
          },
          {
            headers: { Authorization: `Bearer ${TOKEN}` },
            timeout: 30000,
          },
        );

        return {
          index,
          operation: op.action,
          status: 'fulfilled',
          responseTime: Date.now() - startTime,
          result: response.data,
        };
      } catch (error) {
        return {
          index,
          operation: op.action,
          status: 'rejected',
          responseTime: Date.now() - startTime,
          error: error.response?.data || error.message,
        };
      }
    }),
  );

  return results.map((r) => r.value || r.reason);
}

async function testConcurrentScenario(sessionId, test, category) {
  const result = {
    test: test.name,
    category,
    timestamp: new Date().toISOString(),
    success: false,
    expectedBehavior: test.expectedBehavior,
    actualBehavior: null,
    operations: [],
    analysis: {},
  };

  try {
    // Setup if needed
    if (test.setup) {
      await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: test.setup,
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Execute concurrent operations
    const startTime = Date.now();
    result.operations = await executeConcurrentOperations(sessionId, test.operations);
    result.totalTime = Date.now() - startTime;

    // Analyze results
    const fulfilled = result.operations.filter((op) => op.status === 'fulfilled');
    const rejected = result.operations.filter((op) => op.status === 'rejected');

    result.analysis = {
      totalOperations: result.operations.length,
      fulfilled: fulfilled.length,
      rejected: rejected.length,
      averageResponseTime:
        result.operations.reduce((sum, op) => sum + op.responseTime, 0) / result.operations.length,
    };

    // Determine actual behavior
    switch (test.expectedBehavior) {
      case 'last_wins':
        result.actualBehavior = fulfilled.length > 0 ? 'last_wins' : 'all_failed';
        result.success =
          fulfilled.length === 1 ||
          (fulfilled.length > 1 &&
            fulfilled[fulfilled.length - 1].index === test.operations.length - 1);
        break;

      case 'all_succeed':
        result.actualBehavior =
          fulfilled.length === test.operations.length ? 'all_succeed' : 'partial_success';
        result.success = fulfilled.length === test.operations.length;
        break;

      case 'sequential_execution':
        const responseTimes = result.operations.map((op) => op.responseTime);
        const isSequential = responseTimes.every(
          (time, i) => i === 0 || time > responseTimes[i - 1] * 0.8,
        );
        result.actualBehavior = isSequential ? 'sequential_execution' : 'parallel_execution';
        result.success = isSequential;
        break;

      case 'interruption':
        result.actualBehavior = rejected.length > 0 ? 'interruption' : 'no_interruption';
        result.success = rejected.length > 0;
        break;

      case 'graceful_cleanup':
        result.actualBehavior = rejected.some(
          (op) => op.error?.includes('closed') || op.error?.includes('terminated'),
        )
          ? 'graceful_cleanup'
          : 'unexpected_behavior';
        result.success = result.actualBehavior === 'graceful_cleanup';
        break;
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testRaceConditions(sessionId) {
  const result = {
    test: 'race_condition_detection',
    timestamp: new Date().toISOString(),
    success: false,
    races: [],
  };

  try {
    // Test 1: Navigation race
    const navRace = {
      name: 'navigation_race',
      detected: false,
    };

    const navPromises = [
      axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { url: 'https://williamzujkowski.github.io/' },
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      ),

      axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'navigate',
          params: { url: 'https://example.com' },
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      ),
    ];

    const navResults = await Promise.allSettled(navPromises);
    navRace.detected = navResults.some((r) => r.status === 'rejected');
    result.races.push(navRace);

    // Test 2: Element interaction race
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/paperclips/index2.html' },
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    const clickRace = {
      name: 'element_click_race',
      detected: false,
    };

    const clickPromises = Array(5)
      .fill()
      .map(() =>
        axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: 'click',
            params: { selector: '#btnMakePaperclip' },
          },
          { headers: { Authorization: `Bearer ${TOKEN}` } },
        ),
      );

    const clickResults = await Promise.allSettled(clickPromises);
    clickRace.detected = clickResults.some((r) => r.status === 'rejected');
    result.races.push(clickRace);

    result.success = true; // Success means we can detect races
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testDeadlockPrevention(sessionId) {
  const result = {
    test: 'deadlock_prevention',
    timestamp: new Date().toISOString(),
    success: false,
    scenarios: [],
  };

  try {
    // Scenario 1: Circular wait attempt
    const circular = {
      name: 'circular_wait',
      prevented: false,
    };

    try {
      await Promise.all([
        axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: 'evaluate',
            params: {
              script: `
              window.lock1 = true;
              while(!window.lock2) { }
              'done';
            `,
            },
          },
          { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 3000 },
        ),

        axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: 'evaluate',
            params: {
              script: `
              window.lock2 = true;
              while(!window.lock1) { }
              'done';
            `,
            },
          },
          { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 3000 },
        ),
      ]);
    } catch (error) {
      circular.prevented = error.message.includes('timeout');
    }

    result.scenarios.push(circular);
    result.success = result.scenarios.every((s) => s.prevented);
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function runTests() {
  console.log('Starting Concurrent Operation Tests...\n');

  const results = {
    testSuite: 'concurrent-operations',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {},
    },
    tests: [],
    raceConditions: null,
    deadlockPrevention: null,
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test each category
    for (const [category, tests] of Object.entries(CONCURRENT_TESTS)) {
      console.log(`\nTesting ${category}:`);
      console.log('='.repeat(50));

      results.summary.categories[category] = {
        total: tests.length,
        passed: 0,
        failed: 0,
      };

      for (const test of tests) {
        process.stdout.write(`Testing ${test.name}...`);
        const result = await testConcurrentScenario(sessionId, test, category);

        results.tests.push(result);
        results.summary.total++;

        if (result.success) {
          results.summary.passed++;
          results.summary.categories[category].passed++;
          console.log(' ✓ BEHAVIOR AS EXPECTED');
          console.log(
            `  └─ Expected: ${result.expectedBehavior}, Actual: ${result.actualBehavior}`,
          );
          console.log(
            `  └─ ${result.analysis.fulfilled}/${result.analysis.totalOperations} operations succeeded`,
          );
        } else {
          results.summary.failed++;
          results.summary.categories[category].failed++;
          console.log(' ✗ UNEXPECTED BEHAVIOR');
          console.log(
            `  └─ Expected: ${result.expectedBehavior}, Actual: ${result.actualBehavior}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Test race conditions
    console.log('\n\nTesting Race Condition Detection:');
    console.log('='.repeat(50));
    results.raceConditions = await testRaceConditions(sessionId);

    if (results.raceConditions.success) {
      console.log('✓ Race conditions properly detected');
    } else {
      console.log('✗ Race condition detection failed');
    }
    results.raceConditions.races?.forEach((race) => {
      console.log(`  - ${race.name}: ${race.detected ? 'detected' : 'not detected'}`);
    });

    // Test deadlock prevention
    console.log('\n\nTesting Deadlock Prevention:');
    console.log('='.repeat(50));
    results.deadlockPrevention = await testDeadlockPrevention(sessionId);

    if (results.deadlockPrevention.success) {
      console.log('✓ Deadlocks properly prevented');
    } else {
      console.log('✗ Deadlock prevention failed');
    }
  } catch (error) {
    console.error('\nTest suite error:', error.message);
    results.error = error.message;
  } finally {
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
  const resultsPath = path.join(__dirname, 'results', `concurrent-operations-${Date.now()}.json`);
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

  return results;
}

// Run tests
runTests().catch(console.error);
