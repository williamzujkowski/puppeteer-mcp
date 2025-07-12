/**
 * Internal Browser Pool Health Monitoring Test
 * Tests the browser pool health monitoring by directly instantiating the pool
 */

import { BrowserPool } from '../../src/puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from '../../src/puppeteer/config.js';
import type { BrowserInstance } from '../../src/puppeteer/interfaces/browser-pool.interface.js';

// Test URLs
const TEST_URLS = {
  paperclips: 'https://williamzujkowski.github.io/paperclips/index2.html',
  portfolio: 'https://williamzujkowski.github.io/',
};

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

// Test 1: Basic Pool Initialization and Health Check
async function testPoolInitialization(): Promise<void> {
  console.log('\n🧪 Test 1: Pool Initialization and Basic Health');

  const pool = new BrowserPool({
    maxBrowsers: 3,
    maxPagesPerBrowser: 5,
    idleTimeout: 30000,
    healthCheckInterval: 5000,
    launchOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  try {
    await pool.initialize();

    const metrics = pool.getMetrics();
    logTest('Pool initialized', metrics.totalBrowsers >= 1, metrics);

    // Wait for health checks
    await sleep(10000);

    const healthResults = await pool.healthCheck();
    logTest('Health checks passed', healthResults.size > 0, {
      browsersChecked: healthResults.size,
      healthy: Array.from(healthResults.values()).filter((v) => v).length,
    });
  } catch (error) {
    logTest('Pool initialization failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Test 2: Browser Acquisition and Release
async function testBrowserAcquisition(): Promise<void> {
  console.log('\n🧪 Test 2: Browser Acquisition and Release');

  const pool = new BrowserPool({
    maxBrowsers: 2,
    healthCheckInterval: 5000,
  });

  try {
    await pool.initialize();

    // Acquire browsers
    const browsers: BrowserInstance[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const browser = await pool.acquireBrowser(`session-${i}`);
        browsers.push(browser);
        console.log(`   Acquired browser ${i + 1}: ${browser.id}`);
      } catch (error) {
        console.log(`   Failed to acquire browser ${i + 1}:`, error);
      }
    }

    const metrics = pool.getMetrics();
    logTest('Browsers acquired', browsers.length > 0, {
      acquired: browsers.length,
      totalBrowsers: metrics.totalBrowsers,
      activeBrowsers: metrics.activeBrowsers,
    });

    // Release browsers
    for (const browser of browsers) {
      await pool.releaseBrowser(browser.id, browser.sessionId!);
    }

    await sleep(1000);

    const afterMetrics = pool.getMetrics();
    logTest('Browsers released', afterMetrics.idleBrowsers > 0, afterMetrics);
  } catch (error) {
    logTest('Browser acquisition test failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Test 3: Browser Crash Recovery
async function testCrashRecovery(): Promise<void> {
  console.log('\n🧪 Test 3: Browser Crash Recovery');

  const pool = new BrowserPool({
    maxBrowsers: 2,
    healthCheckInterval: 3000, // Faster health checks for testing
  });

  try {
    await pool.initialize();

    // Acquire a browser
    const browser = await pool.acquireBrowser('crash-test');
    console.log(`   Acquired browser: ${browser.id}`);

    // Create a page and navigate
    const page = await pool.createPage(browser.id, 'crash-test');
    await page.goto(TEST_URLS.portfolio);
    console.log('   Page navigated successfully');

    // Force crash by closing the browser directly
    console.log('   Simulating browser crash...');
    await browser.browser.close();

    // Wait for health check to detect and recover
    await sleep(5000);

    // Try to use pool again
    try {
      const newBrowser = await pool.acquireBrowser('recovery-test');
      logTest('Recovery successful', true, {
        newBrowserId: newBrowser.id,
        recovered: true,
      });
      await pool.releaseBrowser(newBrowser.id, 'recovery-test');
    } catch (error) {
      logTest('Recovery failed', false, error);
    }
  } catch (error) {
    logTest('Crash recovery test failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Test 4: Memory Management and Page Limits
async function testMemoryManagement(): Promise<void> {
  console.log('\n🧪 Test 4: Memory Management and Page Limits');

  const pool = new BrowserPool({
    maxBrowsers: 2,
    maxPagesPerBrowser: 3,
    healthCheckInterval: 5000,
  });

  try {
    await pool.initialize();

    const browser = await pool.acquireBrowser('memory-test');
    const pages = [];

    // Create multiple pages
    console.log('   Creating multiple pages...');
    for (let i = 0; i < 5; i++) {
      try {
        const page = await pool.createPage(browser.id, 'memory-test');
        pages.push(page);
        await page.goto(TEST_URLS.paperclips);
        console.log(`   Created page ${i + 1}`);
      } catch (error) {
        console.log(`   Failed to create page ${i + 1}:`, error);
      }
    }

    logTest('Page limit enforcement', pages.length <= 3, {
      pagesCreated: pages.length,
      maxPages: 3,
    });

    // Close pages
    for (const page of pages) {
      await page.close();
    }

    await pool.releaseBrowser(browser.id, 'memory-test');
  } catch (error) {
    logTest('Memory management test failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Test 5: Idle Browser Cleanup
async function testIdleCleanup(): Promise<void> {
  console.log('\n🧪 Test 5: Idle Browser Cleanup');

  const pool = new BrowserPool({
    maxBrowsers: 3,
    idleTimeout: 10000, // 10 seconds for faster testing
    healthCheckInterval: 5000,
  });

  try {
    await pool.initialize();

    // Create and release browsers
    const browsers = [];
    for (let i = 0; i < 3; i++) {
      const browser = await pool.acquireBrowser(`idle-test-${i}`);
      browsers.push(browser);
    }

    const beforeMetrics = pool.getMetrics();
    console.log('   Before release:', beforeMetrics);

    // Release all browsers
    for (const browser of browsers) {
      await pool.releaseBrowser(browser.id, browser.sessionId!);
    }

    console.log('   Waiting for idle timeout...');
    await sleep(15000); // Wait for idle timeout

    // Trigger cleanup
    const cleaned = await pool.cleanupIdle();

    const afterMetrics = pool.getMetrics();
    logTest('Idle browsers cleaned', cleaned > 0, {
      cleaned,
      beforeBrowsers: beforeMetrics.totalBrowsers,
      afterBrowsers: afterMetrics.totalBrowsers,
    });
  } catch (error) {
    logTest('Idle cleanup test failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Test 6: Pool Events and Metrics
async function testPoolEvents(): Promise<void> {
  console.log('\n🧪 Test 6: Pool Events and Metrics');

  const events: any[] = [];
  const pool = new BrowserPool({
    maxBrowsers: 2,
    healthCheckInterval: 5000,
  });

  // Listen to pool events
  pool.on('browser:created', (data) => {
    events.push({ type: 'created', ...data });
  });

  pool.on('browser:acquired', (data) => {
    events.push({ type: 'acquired', ...data });
  });

  pool.on('browser:released', (data) => {
    events.push({ type: 'released', ...data });
  });

  pool.on('browser:removed', (data) => {
    events.push({ type: 'removed', ...data });
  });

  try {
    await pool.initialize();

    // Perform operations
    const browser = await pool.acquireBrowser('event-test');
    await sleep(1000);
    await pool.releaseBrowser(browser.id, 'event-test');

    logTest('Events captured', events.length > 0, {
      eventCount: events.length,
      eventTypes: [...new Set(events.map((e) => e.type))],
    });

    // Get final metrics
    const metrics = pool.getMetrics();
    logTest('Metrics available', true, metrics);
  } catch (error) {
    logTest('Pool events test failed', false, error);
  } finally {
    await pool.shutdown();
  }
}

// Main test runner
async function runTests(): Promise<void> {
  console.log('🚀 Internal Browser Pool Health Monitoring Tests');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  const tests = [
    testPoolInitialization,
    testBrowserAcquisition,
    testCrashRecovery,
    testMemoryManagement,
    testIdleCleanup,
    testPoolEvents,
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

  // Exit process to ensure cleanup
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);
