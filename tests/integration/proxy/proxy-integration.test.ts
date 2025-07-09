/**
 * Proxy Integration Tests
 * @module tests/integration/proxy/proxy-integration
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { BrowserPool } from '../../../src/puppeteer/pool/browser-pool.js';
import { contextStore } from '../../../src/store/context-store.js';
import { proxyManager } from '../../../src/puppeteer/proxy/proxy-manager.js';
import { proxyMonitor } from '../../../src/puppeteer/proxy/proxy-monitoring.js';
import { createProxyBrowserContext } from '../../../src/puppeteer/proxy/proxy-context-integration.js';
import type { ProxyConfig, ContextProxyConfig } from '../../../src/puppeteer/types/proxy.js';
import { Server } from 'http';
import { createServer } from 'http';
import { AddressInfo } from 'net';

// Mock HTTP proxy server for testing
class MockProxyServer {
  private server: Server;
  private port: number = 0;
  private requestCount = 0;
  private authRequired: boolean;
  private username?: string;
  private password?: string;

  constructor(authRequired = false, username?: string, password?: string) {
    this.authRequired = authRequired;
    this.username = username;
    this.password = password;
    this.server = createServer(this.handleRequest.bind(this));
  }

  private handleRequest(req: any, res: any): void {
    this.requestCount++;

    // Check authentication if required
    if (this.authRequired) {
      const authHeader = req.headers['proxy-authorization'];
      if (!authHeader) {
        res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
        res.end();
        return;
      }

      const [scheme, credentials] = authHeader.split(' ');
      if (scheme !== 'Basic') {
        res.writeHead(407);
        res.end();
        return;
      }

      const decoded = Buffer.from(credentials, 'base64').toString();
      const [user, pass] = decoded.split(':');
      
      if (user !== this.username || pass !== this.password) {
        res.writeHead(407);
        res.end();
        return;
      }
    }

    // Simple proxy response
    res.writeHead(200, { 'X-Proxy-Server': 'Mock' });
    res.end('Proxied response');
  }

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, () => {
        this.port = (this.server.address() as AddressInfo).port;
        resolve(this.port);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getPort(): number {
    return this.port;
  }
}

describe('Proxy Integration', () => {
  let browserPool: BrowserPool;
  let mockProxy: MockProxyServer;
  let mockProxyWithAuth: MockProxyServer;

  beforeAll(async () => {
    // Start mock proxy servers
    mockProxy = new MockProxyServer();
    mockProxyWithAuth = new MockProxyServer(true, 'testuser', 'testpass');
    
    const proxyPort = await mockProxy.start();
    const authProxyPort = await mockProxyWithAuth.start();

    // Initialize browser pool
    browserPool = new BrowserPool({
      maxBrowsers: 2,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });
    
    await browserPool.initialize();

    // Initialize proxy manager
    await proxyManager.initialize({
      proxies: [
        {
          protocol: 'http',
          host: 'localhost',
          port: proxyPort,
          bypass: [],
          connectionTimeout: 5000,
          requestTimeout: 10000,
          maxRetries: 1,
          healthCheckInterval: 300000,
          healthCheckUrl: 'http://localhost:' + proxyPort,
          rejectUnauthorized: false,
          priority: 50,
          tags: ['test'],
        },
        {
          protocol: 'http',
          host: 'localhost',
          port: authProxyPort,
          auth: {
            username: 'testuser',
            password: 'testpass',
          },
          bypass: [],
          connectionTimeout: 5000,
          requestTimeout: 10000,
          maxRetries: 1,
          healthCheckInterval: 300000,
          healthCheckUrl: 'http://localhost:' + authProxyPort,
          rejectUnauthorized: false,
          priority: 60,
          tags: ['test', 'auth'],
        },
      ],
      strategy: 'round-robin',
      healthCheckEnabled: false, // Disable for tests
      healthCheckInterval: 300000,
      failoverEnabled: true,
      failoverThreshold: 3,
      maxConcurrentChecks: 2,
    });
  }, 30000);

  afterAll(async () => {
    await proxyManager.shutdown();
    await browserPool.shutdown();
    await mockProxy.stop();
    await mockProxyWithAuth.stop();
  });

  describe('Browser Context with Proxy', () => {
    it('should create browser context with single proxy', async () => {
      const sessionId = 'test-session-1';
      const browser = await browserPool.acquireBrowser(sessionId);

      const proxyConfig: ContextProxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'http',
          host: 'localhost',
          port: mockProxy.getPort(),
          bypass: [],
          connectionTimeout: 5000,
          requestTimeout: 10000,
          maxRetries: 1,
          healthCheckInterval: 300000,
          healthCheckUrl: 'http://localhost:' + mockProxy.getPort(),
          rejectUnauthorized: false,
          priority: 50,
          tags: ['test'],
        },
        rotateOnError: false,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: false,
        allowInsecure: true,
      };

      const proxyContext = await createProxyBrowserContext(browser.browser, {
        proxyConfig,
        contextId: 'test-context-1',
      });

      expect(proxyContext.context).toBeDefined();
      expect(proxyContext.proxyId).toBeDefined();
      expect(proxyContext.proxyUrl).toContain('http://localhost:');

      // Clean up
      await proxyContext.context.close();
      await browserPool.releaseBrowser(browser.id, sessionId);
    });

    it('should create browser context with authenticated proxy', async () => {
      const sessionId = 'test-session-2';
      const browser = await browserPool.acquireBrowser(sessionId);

      const proxyConfig: ContextProxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'http',
          host: 'localhost',
          port: mockProxyWithAuth.getPort(),
          auth: {
            username: 'testuser',
            password: 'testpass',
          },
          bypass: [],
          connectionTimeout: 5000,
          requestTimeout: 10000,
          maxRetries: 1,
          healthCheckInterval: 300000,
          healthCheckUrl: 'http://localhost:' + mockProxyWithAuth.getPort(),
          rejectUnauthorized: false,
          priority: 50,
          tags: ['test', 'auth'],
        },
        rotateOnError: false,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: false,
        allowInsecure: true,
      };

      const proxyContext = await createProxyBrowserContext(browser.browser, {
        proxyConfig,
        contextId: 'test-context-2',
      });

      expect(proxyContext.context).toBeDefined();
      expect(proxyContext.proxyUrl).toContain('testuser:testpass@localhost:');

      // Clean up
      await proxyContext.context.close();
      await browserPool.releaseBrowser(browser.id, sessionId);
    });

    it('should use proxy from pool', async () => {
      const sessionId = 'test-session-3';
      const browser = await browserPool.acquireBrowser(sessionId);

      const proxyConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 2,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: false,
        allowInsecure: true,
      };

      const proxyContext = await createProxyBrowserContext(browser.browser, {
        proxyConfig,
        contextId: 'test-context-3',
      });

      expect(proxyContext.context).toBeDefined();
      expect(proxyContext.proxyId).toBeDefined();

      // Clean up
      await proxyContext.context.close();
      await browserPool.releaseBrowser(browser.id, sessionId);
    });
  });

  describe('Proxy Rotation', () => {
    it('should rotate proxies based on strategy', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 2,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: false,
        allowInsecure: true,
      };

      // Get first proxy
      const first = await proxyManager.getProxyForContext('rotation-test-1', contextConfig);
      expect(first).not.toBeNull();
      const firstProxyId = first?.proxyId;

      // Rotate manually
      await proxyManager.rotateProxy('rotation-test-1', 'manual');

      // Get proxy after rotation
      const second = await proxyManager.getProxyForContext('rotation-test-1', contextConfig);
      expect(second?.proxyId).not.toBe(firstProxyId);

      // Clean up
      await proxyManager.cleanupContext('rotation-test-1');
    });

    it('should handle error-based rotation', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 2,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: false,
        allowInsecure: true,
      };

      const result = await proxyManager.getProxyForContext('error-test-1', contextConfig);
      expect(result).not.toBeNull();
      const originalProxyId = result?.proxyId!;

      // Simulate errors to trigger rotation
      for (let i = 0; i < 3; i++) {
        await proxyManager.handleProxyError(
          'error-test-1',
          originalProxyId,
          new Error('Test error'),
          contextConfig,
        );
      }

      // Check that proxy is marked unhealthy
      const health = proxyManager.getHealthStatus();
      const proxyHealth = health.find(h => h.proxyId === originalProxyId);
      expect(proxyHealth?.healthy).toBe(false);

      // Clean up
      await proxyManager.cleanupContext('error-test-1');
    });
  });

  describe('Proxy Monitoring', () => {
    it('should collect proxy metrics', async () => {
      const metrics = proxyManager.getMetrics();
      expect(metrics.proxies.length).toBeGreaterThan(0);
      expect(metrics.contexts.size).toBeGreaterThanOrEqual(0);
    });

    it('should track health status', async () => {
      const healthStatuses = proxyManager.getHealthStatus();
      expect(healthStatuses.length).toBeGreaterThan(0);
      
      for (const status of healthStatuses) {
        expect(status.proxyId).toBeDefined();
        expect(typeof status.healthy).toBe('boolean');
        expect(status.lastChecked).toBeInstanceOf(Date);
      }
    });

    it('should start and stop monitoring', async () => {
      await proxyMonitor.start();
      
      const statusBefore = proxyMonitor.getStatus();
      expect(statusBefore.running).toBe(true);

      await proxyMonitor.stop();
      
      const statusAfter = proxyMonitor.getStatus();
      expect(statusAfter.running).toBe(false);
    });
  });

  describe('Context Store Integration', () => {
    it('should store proxy configuration in context', async () => {
      const proxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'http',
          host: 'proxy.test',
          port: 8080,
        },
      };

      const context = await contextStore.create({
        sessionId: 'test-session',
        name: 'proxy-context',
        type: 'puppeteer',
        config: {},
        metadata: {},
        status: 'active',
        userId: 'test-user',
        proxyConfig: proxyConfig as Record<string, unknown>,
      });

      expect(context.proxyConfig).toEqual(proxyConfig);

      // Clean up
      await contextStore.delete(context.id);
    });
  });
});