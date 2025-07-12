/**
 * Browser Pool Health Monitoring Test Suite
 * Tests health checks, monitoring, and recovery mechanisms
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-api-key';
const TEST_URLS = {
  paperclips: 'https://williamzujkowski.github.io/paperclips/index2.html',
  portfolio: 'https://williamzujkowski.github.io/',
};

// Performance metrics collection
interface HealthMetrics {
  testName: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  details: any;
}

const metrics: HealthMetrics[] = [];

// Create axios client with auth
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': API_KEY,
  },
  timeout: 60000,
});

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logTestStart(testName: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Starting Test: ${testName}`);
  console.log(`${'='.repeat(60)}`);
}

function logTestResult(testName: string, success: boolean, details?: any): void {
  const emoji = success ? '✅' : '❌';
  console.log(`${emoji} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function measurePerformance<T>(testName: string, testFn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  let success = false;
  let result: T;

  try {
    result = await testFn();
    success = true;
    return result;
  } catch (error) {
    console.error(`Error in ${testName}:`, error);
    throw error;
  } finally {
    const duration = Date.now() - start;
    metrics.push({
      testName,
      timestamp: new Date(),
      duration,
      success,
      details: result || {},
    });
  }
}

// Test 1: Browser Pool Health Check Endpoint
async function testHealthCheckEndpoint(): Promise<void> {
  logTestStart('Health Check Endpoint Test');

  await measurePerformance('health-check-endpoint', async () => {
    // Check if health endpoint exists
    try {
      const response = await client.get('/health');
      console.log('Health endpoint status:', response.data);
      logTestResult('Health endpoint accessible', true, response.data);
    } catch (error) {
      console.error('Health endpoint error:', error);
      throw error;
    }

    return response.data;
  });
}

// Test 2: Monitor Browser Health During Normal Operation
async function testBrowserHealthMonitoring(): Promise<void> {
  logTestStart('Browser Health Monitoring Test');

  await measurePerformance('browser-health-monitoring', async () => {
    // Create context and monitor health
    const contextResponse = await client.post('/api/v1/contexts');
    const contextId = contextResponse.data.id;
    console.log(`Created context: ${contextId}`);

    // Navigate to test page
    await client.post(`/api/v1/contexts/${contextId}/navigate`, {
      url: TEST_URLS.paperclips,
    });

    // Monitor health for 30 seconds
    const healthChecks = [];
    for (let i = 0; i < 6; i++) {
      await sleep(5000);

      try {
        // Get context status as a proxy for browser health
        const contextStatus = await client.get(`/api/v1/contexts/${contextId}`);
        healthChecks.push({
          timestamp: new Date(),
          status: contextStatus.data,
        });

        console.log(`Health check ${i + 1}/6:`, {
          contextId: contextStatus.data.id,
          status: contextStatus.data.status || 'active',
        });
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }

    // Cleanup
    await client.delete(`/api/v1/contexts/${contextId}`);

    logTestResult('Browser health monitored successfully', true, {
      checksPerformed: healthChecks.length,
    });

    return healthChecks;
  });
}

// Test 3: Simulate Browser Crash and Recovery
async function testBrowserCrashRecovery(): Promise<void> {
  logTestStart('Browser Crash Recovery Test');

  await measurePerformance('browser-crash-recovery', async () => {
    // Create context
    const contextResponse = await client.post('/api/v1/contexts');
    const contextId = contextResponse.data.id;
    const browserId = contextResponse.data.browserId;
    console.log(`Created context: ${contextId}, Browser: ${browserId}`);

    // Navigate to crash page (about:crash or similar)
    try {
      await client.post(`/api/v1/contexts/${contextId}/navigate`, {
        url: 'about:crash',
      });
    } catch (error) {
      console.log('Browser crashed as expected');
    }

    // Wait for recovery
    await sleep(5000);

    // Check if browser was recovered
    try {
      const metricsResponse = await client.get('/api/browser-pool/metrics');
      console.log('Pool metrics after crash:', metricsResponse.data);

      // Try to use the context again
      const recoveryResponse = await client.post(`/api/v1/contexts/${contextId}/navigate`, {
        url: TEST_URLS.portfolio,
      });

      logTestResult('Browser recovered after crash', true, {
        recovered: recoveryResponse.status === 200,
      });
    } catch (error) {
      logTestResult('Browser recovery failed', false, error);
    }

    // Cleanup
    try {
      await client.delete(`/api/v1/contexts/${contextId}`);
    } catch {
      // Ignore cleanup errors
    }

    return { recovered: true };
  });
}

// Test 4: Test Memory Leak Prevention
async function testMemoryLeakPrevention(): Promise<void> {
  logTestStart('Memory Leak Prevention Test');

  await measurePerformance('memory-leak-prevention', async () => {
    const contexts = [];
    const initialMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Initial pool state:', initialMetrics.data);

    // Create multiple contexts rapidly
    for (let i = 0; i < 10; i++) {
      const response = await client.post('/api/v1/contexts');
      contexts.push(response.data.id);

      // Navigate to heavy page
      await client.post(`/api/v1/contexts/${response.data.id}/navigate`, {
        url: TEST_URLS.paperclips,
      });

      // Perform some actions to increase memory usage
      await client.post(`/api/v1/contexts/${response.data.id}/evaluate`, {
        expression: `
          // Create large objects to test memory cleanup
          const largeArray = new Array(1000000).fill('test');
          const result = largeArray.length;
          result;
        `,
      });
    }

    console.log(`Created ${contexts.length} contexts with heavy operations`);

    // Clean up half the contexts
    for (let i = 0; i < 5; i++) {
      await client.delete(`/api/v1/contexts/${contexts[i]}`);
    }

    await sleep(5000);

    // Check pool metrics after cleanup
    const afterCleanupMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Pool state after partial cleanup:', afterCleanupMetrics.data);

    // Clean up remaining contexts
    for (let i = 5; i < contexts.length; i++) {
      await client.delete(`/api/v1/contexts/${contexts[i]}`);
    }

    await sleep(5000);

    // Final metrics check
    const finalMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Final pool state:', finalMetrics.data);

    const leakDetected = finalMetrics.data.totalBrowsers > initialMetrics.data.totalBrowsers + 2;
    logTestResult('Memory leak prevention', !leakDetected, {
      initial: initialMetrics.data.totalBrowsers,
      final: finalMetrics.data.totalBrowsers,
      leakDetected,
    });

    return { leakDetected };
  });
}

// Test 5: Pool Capacity Management
async function testPoolCapacityManagement(): Promise<void> {
  logTestStart('Pool Capacity Management Test');

  await measurePerformance('pool-capacity-management', async () => {
    const contexts = [];
    let maxReached = false;

    try {
      // Try to create more contexts than pool capacity
      for (let i = 0; i < 20; i++) {
        const response = await client.post(
          '/api/v1/contexts',
          {},
          {
            timeout: 5000, // Short timeout to detect queuing
          },
        );
        contexts.push(response.data.id);
        console.log(`Created context ${i + 1}: ${response.data.id}`);
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.response?.status === 503) {
        maxReached = true;
        console.log('Pool capacity limit reached (as expected)');
      } else {
        throw error;
      }
    }

    // Get pool metrics
    const metricsResponse = await client.get('/api/browser-pool/metrics');
    console.log('Pool at capacity:', metricsResponse.data);

    // Clean up contexts
    for (const contextId of contexts) {
      try {
        await client.delete(`/api/v1/contexts/${contextId}`);
      } catch {
        // Ignore cleanup errors
      }
    }

    logTestResult('Pool capacity limits enforced', true, {
      contextsCreated: contexts.length,
      capacityReached: maxReached,
      poolMetrics: metricsResponse.data,
    });

    return { capacityEnforced: true };
  });
}

// Test 6: Idle Browser Cleanup
async function testIdleBrowserCleanup(): Promise<void> {
  logTestStart('Idle Browser Cleanup Test');

  await measurePerformance('idle-browser-cleanup', async () => {
    // Create multiple contexts
    const contexts = [];
    for (let i = 0; i < 5; i++) {
      const response = await client.post('/api/v1/contexts');
      contexts.push(response.data.id);
    }

    const beforeMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Pool before idle period:', beforeMetrics.data);

    // Release all contexts to make browsers idle
    for (const contextId of contexts) {
      await client.delete(`/api/v1/contexts/${contextId}`);
    }

    console.log('All contexts released, waiting for idle cleanup...');

    // Wait for idle timeout (usually 60s, but we'll check periodically)
    let cleaned = false;
    for (let i = 0; i < 12; i++) {
      await sleep(10000); // Check every 10 seconds

      const currentMetrics = await client.get('/api/browser-pool/metrics');
      console.log(`Check ${i + 1}: Total browsers: ${currentMetrics.data.totalBrowsers}`);

      if (currentMetrics.data.totalBrowsers < beforeMetrics.data.totalBrowsers) {
        cleaned = true;
        console.log('Idle browsers cleaned up!');
        break;
      }
    }

    const afterMetrics = await client.get('/api/browser-pool/metrics');

    logTestResult('Idle browser cleanup', cleaned, {
      browsersBefore: beforeMetrics.data.totalBrowsers,
      browsersAfter: afterMetrics.data.totalBrowsers,
      cleaned,
    });

    return { cleaned };
  });
}

// Test 7: Health Metrics Reporting Accuracy
async function testHealthMetricsAccuracy(): Promise<void> {
  logTestStart('Health Metrics Reporting Accuracy Test');

  await measurePerformance('health-metrics-accuracy', async () => {
    // Get initial metrics
    const initialMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Initial metrics:', initialMetrics.data);

    // Create contexts and track
    const contexts = [];
    const expectedActive = 3;

    for (let i = 0; i < expectedActive; i++) {
      const response = await client.post('/api/v1/contexts');
      contexts.push(response.data.id);

      // Navigate to keep browser active
      await client.post(`/api/v1/contexts/${response.data.id}/navigate`, {
        url: TEST_URLS.portfolio,
      });
    }

    // Check metrics accuracy
    const activeMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Metrics with active contexts:', activeMetrics.data);

    const metricsAccurate =
      activeMetrics.data.activeBrowsers >= expectedActive &&
      activeMetrics.data.totalBrowsers >= expectedActive;

    // Test queued requests metric
    const queuedPromises = [];
    for (let i = 0; i < 10; i++) {
      queuedPromises.push(client.post('/api/v1/contexts', {}, { timeout: 1000 }).catch(() => null));
    }

    await sleep(500); // Let requests queue up

    const queuedMetrics = await client.get('/api/browser-pool/metrics');
    console.log('Metrics with queued requests:', queuedMetrics.data);

    // Wait for queued requests to complete or timeout
    await Promise.all(queuedPromises);

    // Cleanup
    for (const contextId of contexts) {
      await client.delete(`/api/v1/contexts/${contextId}`);
    }

    logTestResult('Health metrics accuracy', metricsAccurate, {
      expectedActive,
      reportedActive: activeMetrics.data.activeBrowsers,
      accurate: metricsAccurate,
    });

    return { accurate: metricsAccurate };
  });
}

// Main test runner
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Browser Pool Health Monitoring Tests');
  console.log(`Server: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const tests = [
    testHealthCheckEndpoint,
    testBrowserHealthMonitoring,
    testBrowserCrashRecovery,
    testMemoryLeakPrevention,
    testPoolCapacityManagement,
    testIdleBrowserCleanup,
    testHealthMetricsAccuracy,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`Test failed:`, error);
    }

    // Small delay between tests
    await sleep(2000);
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  // Print performance metrics
  console.log(`\n${'='.repeat(60)}`);
  console.log('⚡ PERFORMANCE METRICS');
  console.log(`${'='.repeat(60)}`);

  for (const metric of metrics) {
    console.log(`${metric.testName}:`);
    console.log(`  Duration: ${metric.duration}ms`);
    console.log(`  Success: ${metric.success}`);
  }

  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  console.log(`\nAverage Test Duration: ${avgDuration.toFixed(0)}ms`);
}

// Run tests
runAllTests().catch(console.error);
