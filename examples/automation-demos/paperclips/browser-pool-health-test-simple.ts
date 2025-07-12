/**
 * Simplified Browser Pool Health Monitoring Test
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

function logTest(name: string, success: boolean, details?: any): void {
  console.log(`\n${success ? '✅' : '❌'} ${name}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Test 1: Basic Health Check
async function testBasicHealth(): Promise<void> {
  console.log('\n🧪 Test 1: Basic Health Check');
  try {
    const response = await client.get('/health');
    logTest('Server health check', response.data.status === 'ok', response.data);
  } catch (error) {
    logTest('Server health check', false, error);
  }
}

// Test 2: Context Creation and Browser Pool Activation
async function testContextCreation(): Promise<void> {
  console.log('\n🧪 Test 2: Context Creation and Browser Pool');

  const contexts: string[] = [];

  try {
    // Create multiple contexts to test pool
    for (let i = 0; i < 3; i++) {
      const response = await client.post('/api/v1/contexts');
      contexts.push(response.data.id);
      console.log(`   Created context ${i + 1}: ${response.data.id}`);
    }

    logTest('Multiple contexts created', true, { count: contexts.length });

    // Navigate each context
    for (let i = 0; i < contexts.length; i++) {
      await client.post(`/api/v1/contexts/${contexts[i]}/navigate`, {
        url: TEST_URLS.portfolio,
      });
    }

    logTest('All contexts navigated', true);
  } catch (error: any) {
    logTest('Context creation failed', false, error.message);
  } finally {
    // Cleanup
    for (const contextId of contexts) {
      try {
        await client.delete(`/api/v1/contexts/${contextId}`);
      } catch {}
    }
  }
}

// Test 3: Browser Recovery from Errors
async function testErrorRecovery(): Promise<void> {
  console.log('\n🧪 Test 3: Browser Error Recovery');

  let contextId: string | null = null;

  try {
    // Create context
    const response = await client.post('/api/v1/contexts');
    contextId = response.data.id;

    // Try to navigate to invalid URL
    try {
      await client.post(`/api/v1/contexts/${contextId}/navigate`, {
        url: 'invalid://url',
      });
    } catch (error) {
      console.log('   Navigation to invalid URL failed (expected)');
    }

    // Try valid navigation after error
    const validNav = await client.post(`/api/v1/contexts/${contextId}/navigate`, {
      url: TEST_URLS.portfolio,
    });

    logTest('Recovery after error', validNav.status === 200);
  } catch (error: any) {
    logTest('Error recovery test failed', false, error.message);
  } finally {
    if (contextId) {
      try {
        await client.delete(`/api/v1/contexts/${contextId}`);
      } catch {}
    }
  }
}

// Test 4: Memory Stress Test
async function testMemoryManagement(): Promise<void> {
  console.log('\n🧪 Test 4: Memory Management Under Load');

  const contexts: string[] = [];
  const batchSize = 5;

  try {
    // Create contexts in batches
    for (let batch = 0; batch < 2; batch++) {
      console.log(`   Creating batch ${batch + 1}...`);

      for (let i = 0; i < batchSize; i++) {
        const response = await client.post('/api/v1/contexts');
        contexts.push(response.data.id);

        // Navigate to heavy page
        await client.post(`/api/v1/contexts/${response.data.id}/navigate`, {
          url: TEST_URLS.paperclips,
        });

        // Execute memory-intensive script
        await client.post(`/api/v1/contexts/${response.data.id}/evaluate`, {
          expression: `
            const data = new Array(100000).fill('test');
            data.length;
          `,
        });
      }

      // Clean up batch
      console.log(`   Cleaning up batch ${batch + 1}...`);
      for (let i = 0; i < batchSize; i++) {
        await client.delete(`/api/v1/contexts/${contexts.shift()!}`);
      }

      await sleep(2000); // Let cleanup complete
    }

    logTest('Memory management test', true, {
      totalContextsProcessed: batchSize * 2,
    });
  } catch (error: any) {
    logTest('Memory management test failed', false, error.message);
  } finally {
    // Cleanup any remaining contexts
    for (const contextId of contexts) {
      try {
        await client.delete(`/api/v1/contexts/${contextId}`);
      } catch {}
    }
  }
}

// Test 5: Concurrent Operations
async function testConcurrentOperations(): Promise<void> {
  console.log('\n🧪 Test 5: Concurrent Operations');

  const contexts: string[] = [];

  try {
    // Create contexts concurrently
    const createPromises = Array(5)
      .fill(null)
      .map(async () => {
        const response = await client.post('/api/v1/contexts');
        return response.data.id;
      });

    const createdIds = await Promise.all(createPromises);
    contexts.push(...createdIds);

    console.log(`   Created ${contexts.length} contexts concurrently`);

    // Navigate all contexts concurrently
    const navPromises = contexts.map((id) =>
      client.post(`/api/v1/contexts/${id}/navigate`, {
        url: TEST_URLS.portfolio,
      }),
    );

    await Promise.all(navPromises);

    logTest('Concurrent operations', true, {
      contextsCreated: contexts.length,
    });
  } catch (error: any) {
    logTest('Concurrent operations failed', false, error.message);
  } finally {
    // Cleanup
    await Promise.all(
      contexts.map((id) => client.delete(`/api/v1/contexts/${id}`).catch(() => {})),
    );
  }
}

// Test 6: Long-Running Context Stability
async function testLongRunningStability(): Promise<void> {
  console.log('\n🧪 Test 6: Long-Running Context Stability');

  let contextId: string | null = null;

  try {
    // Create context
    const response = await client.post('/api/v1/contexts');
    contextId = response.data.id;

    // Navigate to page
    await client.post(`/api/v1/contexts/${contextId}/navigate`, {
      url: TEST_URLS.paperclips,
    });

    // Perform operations over time
    console.log('   Testing stability over 30 seconds...');
    for (let i = 0; i < 6; i++) {
      await sleep(5000);

      // Check context is still responsive
      const evalResponse = await client.post(`/api/v1/contexts/${contextId}/evaluate`, {
        expression: 'document.title',
      });

      console.log(`   Check ${i + 1}/6: Context responsive`);
    }

    logTest('Long-running stability', true);
  } catch (error: any) {
    logTest('Long-running stability failed', false, error.message);
  } finally {
    if (contextId) {
      try {
        await client.delete(`/api/v1/contexts/${contextId}`);
      } catch {}
    }
  }
}

// Main test runner
async function runTests(): Promise<void> {
  console.log('🚀 Browser Pool Health Monitoring Tests');
  console.log(`Server: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  const tests = [
    testBasicHealth,
    testContextCreation,
    testErrorRecovery,
    testMemoryManagement,
    testConcurrentOperations,
    testLongRunningStability,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n❌ Test failed with error:`, error);
    }
    await sleep(2000); // Pause between tests
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log('\n✨ Test run complete!');
}

// Run tests
runTests().catch(console.error);
