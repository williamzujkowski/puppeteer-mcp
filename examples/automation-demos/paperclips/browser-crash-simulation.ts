/**
 * Browser Crash Simulation and Recovery Test
 * Tests how the pool handles and recovers from browser crashes
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-api-key';

// Create axios client
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': API_KEY,
  },
  timeout: 30000,
});

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get browser process IDs from the pool
async function getBrowserProcessIds(): Promise<number[]> {
  try {
    // Get all Chrome/Chromium processes
    const { stdout } = await execAsync(
      "ps aux | grep -E 'chrome|chromium' | grep -v grep | awk '{print $2}'",
    );
    return stdout
      .trim()
      .split('\n')
      .map((pid) => parseInt(pid, 10))
      .filter((pid) => !isNaN(pid));
  } catch {
    return [];
  }
}

// Simulate different types of browser failures
class BrowserCrashSimulator {
  // Test 1: Force kill browser process
  async testProcessKill(): Promise<void> {
    console.log('\n🔨 Test: Force Kill Browser Process');
    console.log('='.repeat(50));

    // Create a context
    const contextResponse = await client.post('/api/contexts');
    const contextId = contextResponse.data.id;
    console.log(`Created context: ${contextId}`);

    // Get browser PIDs before
    const pidsBefore = await getBrowserProcessIds();
    console.log(`Browser processes before: ${pidsBefore.length}`);

    // Navigate to a page
    await client.post(`/api/contexts/${contextId}/navigate`, {
      url: 'https://williamzujkowski.github.io/',
    });

    // Get browser PIDs after navigation
    const pidsAfter = await getBrowserProcessIds();
    const newPids = pidsAfter.filter((pid) => !pidsBefore.includes(pid));
    console.log(`New browser processes: ${newPids.length}`);

    if (newPids.length > 0) {
      // Kill one of the browser processes
      const pidToKill = newPids[0];
      console.log(`Killing browser process: ${pidToKill}`);

      try {
        await execAsync(`kill -9 ${pidToKill}`);
        console.log('Browser process killed');
      } catch (error) {
        console.log('Failed to kill process:', error);
      }
    }

    // Wait for recovery
    await sleep(5000);

    // Check if pool recovered
    try {
      const metricsResponse = await client.get('/api/browser-pool/metrics');
      console.log('Pool metrics after crash:', metricsResponse.data);

      // Try to create a new context (should work if pool recovered)
      const newContextResponse = await client.post('/api/contexts');
      console.log(`Recovery successful, new context: ${newContextResponse.data.id}`);

      // Cleanup
      await client.delete(`/api/contexts/${newContextResponse.data.id}`);
    } catch (error) {
      console.error('Recovery failed:', error);
    }
  }

  // Test 2: Simulate unresponsive browser
  async testUnresponsiveBrowser(): Promise<void> {
    console.log('\n🔒 Test: Unresponsive Browser Simulation');
    console.log('='.repeat(50));

    // Create context
    const contextResponse = await client.post('/api/contexts');
    const contextId = contextResponse.data.id;
    console.log(`Created context: ${contextId}`);

    try {
      // Execute blocking JavaScript
      await client.post(
        `/api/contexts/${contextId}/evaluate`,
        {
          expression: `
          // Create infinite loop to make browser unresponsive
          const start = Date.now();
          while (Date.now() - start < 60000) {
            // Busy loop for 60 seconds
            Math.sqrt(Math.random());
          }
        `,
        },
        {
          timeout: 5000, // Short timeout to detect unresponsiveness
        },
      );
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        console.log('Browser became unresponsive (as expected)');
      }
    }

    // Wait for health check to detect and recover
    console.log('Waiting for health check to detect unresponsive browser...');
    await sleep(35000); // Wait for health check interval

    // Check recovery
    const metricsResponse = await client.get('/api/browser-pool/metrics');
    console.log('Pool metrics after recovery:', metricsResponse.data);
  }

  // Test 3: Memory exhaustion
  async testMemoryExhaustion(): Promise<void> {
    console.log('\n💾 Test: Memory Exhaustion');
    console.log('='.repeat(50));

    // Create context
    const contextResponse = await client.post('/api/contexts');
    const contextId = contextResponse.data.id;
    console.log(`Created context: ${contextId}`);

    try {
      // Try to exhaust memory
      await client.post(`/api/contexts/${contextId}/evaluate`, {
        expression: `
          // Allocate large amounts of memory
          const arrays = [];
          try {
            for (let i = 0; i < 1000; i++) {
              arrays.push(new Array(10000000).fill('memory test'));
            }
          } catch (e) {
            'Out of memory: ' + e.message;
          }
        `,
      });
    } catch (error) {
      console.log('Memory exhaustion triggered:', error);
    }

    // Monitor recovery
    await sleep(5000);

    const metricsResponse = await client.get('/api/browser-pool/metrics');
    console.log('Pool metrics after memory test:', metricsResponse.data);
  }

  // Test 4: Rapid context creation/deletion
  async testRapidContextChurn(): Promise<void> {
    console.log('\n🔄 Test: Rapid Context Churn');
    console.log('='.repeat(50));

    const contexts: string[] = [];
    const iterations = 20;

    console.log(`Creating and destroying ${iterations} contexts rapidly...`);

    for (let i = 0; i < iterations; i++) {
      try {
        // Create context
        const response = await client.post('/api/contexts');
        const contextId = response.data.id;

        // Immediately navigate
        await client.post(`/api/contexts/${contextId}/navigate`, {
          url: 'https://williamzujkowski.github.io/paperclips/index2.html',
        });

        // Random delay
        await sleep(Math.random() * 1000);

        // Delete context
        await client.delete(`/api/contexts/${contextId}`);

        if (i % 5 === 0) {
          console.log(`Completed ${i + 1}/${iterations} iterations`);
        }
      } catch (error) {
        console.error(`Error in iteration ${i}:`, error);
      }
    }

    // Check final pool state
    const metricsResponse = await client.get('/api/browser-pool/metrics');
    console.log('Final pool metrics:', metricsResponse.data);
  }

  // Test 5: Network disconnection simulation
  async testNetworkDisconnection(): Promise<void> {
    console.log('\n🌐 Test: Network Disconnection');
    console.log('='.repeat(50));

    // Create context
    const contextResponse = await client.post('/api/contexts');
    const contextId = contextResponse.data.id;
    console.log(`Created context: ${contextId}`);

    try {
      // Set browser offline
      await client.post(`/api/contexts/${contextId}/evaluate`, {
        expression: `
          // Simulate offline mode
          navigator.onLine = false;
          window.dispatchEvent(new Event('offline'));
          'Browser set to offline mode';
        `,
      });

      console.log('Browser set to offline mode');

      // Try to navigate while offline
      await client.post(`/api/contexts/${contextId}/navigate`, {
        url: 'https://williamzujkowski.github.io/',
      });
    } catch (error) {
      console.log('Navigation failed while offline (expected)');
    }

    // Cleanup
    await client.delete(`/api/contexts/${contextId}`);
  }
}

// Performance monitoring during crash tests
class PerformanceMonitor {
  private metrics: any[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  async startMonitoring(): Promise<void> {
    console.log('📊 Starting performance monitoring...');

    this.monitoringInterval = setInterval(async () => {
      try {
        const response = await client.get('/api/browser-pool/metrics');
        const metric = {
          timestamp: new Date(),
          ...response.data,
        };
        this.metrics.push(metric);
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    }, 2000); // Collect every 2 seconds
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('📊 Stopped performance monitoring');
    }
  }

  getReport(): void {
    console.log('\n📈 Performance Report');
    console.log('='.repeat(50));

    if (this.metrics.length === 0) {
      console.log('No metrics collected');
      return;
    }

    // Calculate statistics
    const totalBrowsers = this.metrics.map((m) => m.totalBrowsers);
    const activeBrowsers = this.metrics.map((m) => m.activeBrowsers);
    const queuedRequests = this.metrics.map((m) => m.queuedRequests || 0);

    console.log('Browser Statistics:');
    console.log(
      `  Total Browsers - Min: ${Math.min(...totalBrowsers)}, Max: ${Math.max(...totalBrowsers)}, Avg: ${(totalBrowsers.reduce((a, b) => a + b, 0) / totalBrowsers.length).toFixed(1)}`,
    );
    console.log(
      `  Active Browsers - Min: ${Math.min(...activeBrowsers)}, Max: ${Math.max(...activeBrowsers)}, Avg: ${(activeBrowsers.reduce((a, b) => a + b, 0) / activeBrowsers.length).toFixed(1)}`,
    );
    console.log(
      `  Queued Requests - Min: ${Math.min(...queuedRequests)}, Max: ${Math.max(...queuedRequests)}, Avg: ${(queuedRequests.reduce((a, b) => a + b, 0) / queuedRequests.length).toFixed(1)}`,
    );

    // Find recovery events (sudden changes in browser count)
    const recoveries = [];
    for (let i = 1; i < this.metrics.length; i++) {
      const prev = this.metrics[i - 1];
      const curr = this.metrics[i];

      if (curr.totalBrowsers > prev.totalBrowsers) {
        recoveries.push({
          time: curr.timestamp,
          browsersAdded: curr.totalBrowsers - prev.totalBrowsers,
        });
      }
    }

    console.log(`\nRecovery Events: ${recoveries.length}`);
    recoveries.forEach((r) => {
      console.log(`  ${r.time.toISOString()}: +${r.browsersAdded} browsers`);
    });
  }
}

// Main test runner
async function runCrashTests(): Promise<void> {
  console.log('🚨 Browser Pool Crash Simulation Tests');
  console.log(`Server: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const simulator = new BrowserCrashSimulator();
  const monitor = new PerformanceMonitor();

  // Start monitoring
  await monitor.startMonitoring();

  try {
    // Run crash tests
    await simulator.testProcessKill();
    await sleep(5000);

    await simulator.testUnresponsiveBrowser();
    await sleep(5000);

    await simulator.testMemoryExhaustion();
    await sleep(5000);

    await simulator.testRapidContextChurn();
    await sleep(5000);

    await simulator.testNetworkDisconnection();
    await sleep(5000);
  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    // Stop monitoring and get report
    monitor.stopMonitoring();
    monitor.getReport();
  }

  console.log('\n✅ Crash simulation tests completed');
}

// Run tests
runCrashTests().catch(console.error);
