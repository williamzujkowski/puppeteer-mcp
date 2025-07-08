/**
 * Connection Test Utilities
 * @module cli/connection-tests
 * @description Utilities for testing system connections
 */

import { config } from '../core/config.js';
import { initializeRedis, testRedisConnection } from '../utils/redis-client.js';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from '../puppeteer/config.js';
import { createMCPServer } from '../mcp/server.js';
import {
  showConnectionTest,
  showConnectionTestHeader,
  showConnectionTestFooter,
} from './output.js';

/**
 * Test Redis connection
 */
async function testRedis(): Promise<void> {
  try {
    if (config.REDIS_URL !== null && config.REDIS_URL !== undefined && config.REDIS_URL !== '') {
      await initializeRedis();
      const isConnected = await testRedisConnection();
      if (isConnected) {
        showConnectionTest('Redis connection', 'OK');
      } else {
        showConnectionTest('Redis connection', 'FAILED');
      }
    } else {
      showConnectionTest('Redis connection', 'NOT_CONFIGURED');
    }
  } catch (error) {
    showConnectionTest('Redis connection', 'ERROR', error);
  }
}

/**
 * Test browser pool initialization
 */
async function testBrowserPool(): Promise<void> {
  try {
    const browserPool = new BrowserPool({
      maxBrowsers: 1,
      maxPagesPerBrowser: 1,
      idleTimeout: 30000,
      healthCheckInterval: 60000,
      launchOptions: {
        headless: puppeteerConfig.headless,
        executablePath: puppeteerConfig.executablePath,
        args: puppeteerConfig.args,
      },
    });

    await browserPool.initialize();
    showConnectionTest('Browser pool', 'OK');
    await browserPool.shutdown();
  } catch (error) {
    showConnectionTest('Browser pool', 'ERROR', error);
  }
}

/**
 * Test MCP server creation
 */
async function testMCPServer(): Promise<void> {
  try {
    const mcpServer = createMCPServer();
    showConnectionTest('MCP server', 'OK');
    await mcpServer.stop();
  } catch (error) {
    showConnectionTest('MCP server', 'ERROR', error);
  }
}

/**
 * Run all connection tests
 */
export async function runConnectionTests(): Promise<void> {
  showConnectionTestHeader();
  await testRedis();
  await testBrowserPool();
  await testMCPServer();
  showConnectionTestFooter();
}
