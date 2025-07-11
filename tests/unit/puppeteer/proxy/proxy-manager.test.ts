/**
 * Proxy Manager Tests
 * @module tests/unit/puppeteer/proxy/proxy-manager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProxyManager } from '../../../../src/puppeteer/proxy/proxy-manager.js';
import type {
  ProxyConfig,
  ProxyPoolConfig,
  ContextProxyConfig,
} from '../../../../src/puppeteer/types/proxy.js';

describe('ProxyManager', () => {
  let proxyManager: ProxyManager;

  beforeEach(() => {
    proxyManager = new ProxyManager();
  });

  afterEach(async () => {
    await proxyManager.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with proxy pool configuration', async () => {
      const poolConfig: ProxyPoolConfig = {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
          {
            protocol: 'socks5',
            host: 'proxy2.test',
            port: 1080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 60,
            tags: [],
          },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: false, // Disable for unit tests
        healthCheckInterval: 300000,
        failoverEnabled: true,
        failoverThreshold: 3,
        maxConcurrentChecks: 3,
      };

      await proxyManager.initialize(poolConfig);

      const metrics = proxyManager.getMetrics();
      expect(metrics.proxies).toHaveLength(2);
    });
  });

  describe('proxy management', () => {
    it('should add a proxy to the pool', async () => {
      const proxyConfig: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.test',
        port: 8080,
        bypass: [],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        name: 'Test Proxy',
        priority: 50,
        tags: ['test'],
      };

      const proxyId = await proxyManager.addProxy(proxyConfig);
      expect(proxyId).toBeDefined();
      expect(typeof proxyId).toBe('string');

      const metrics = proxyManager.getMetrics();
      expect(metrics.proxies).toHaveLength(1);
      expect(metrics.proxies[0].proxyId).toBe(proxyId);
    });

    it('should reject invalid proxy configuration', async () => {
      const invalidConfig = {
        protocol: 'invalid',
        host: 'proxy.test',
        port: 99999, // Invalid port
      } as any;

      await expect(proxyManager.addProxy(invalidConfig)).rejects.toThrow();
    });

    it('should remove a proxy from the pool', async () => {
      const proxyConfig: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.test',
        port: 8080,
        bypass: [],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const proxyId = await proxyManager.addProxy(proxyConfig);
      await proxyManager.removeProxy(proxyId);

      const metrics = proxyManager.getMetrics();
      expect(metrics.proxies).toHaveLength(0);
    });

    it('should throw error when removing non-existent proxy', async () => {
      await expect(proxyManager.removeProxy('non-existent')).rejects.toThrow('Proxy not found');
    });
  });

  describe('context proxy assignment', () => {
    beforeEach(async () => {
      const poolConfig: ProxyPoolConfig = {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: false,
        healthCheckInterval: 300000,
        failoverEnabled: true,
        failoverThreshold: 3,
        maxConcurrentChecks: 3,
      };

      await proxyManager.initialize(poolConfig);
    });

    it('should assign proxy to context when enabled', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await proxyManager.getProxyForContext('context-1', contextConfig);
      expect(result).not.toBeNull();
      expect(result?.proxyId).toBeDefined();
      expect(result?.url).toMatch(/^http:\/\/proxy1\.test:8080$/);
    });

    it('should return null when proxy is disabled', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: false,
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await proxyManager.getProxyForContext('context-1', contextConfig);
      expect(result).toBeNull();
    });

    it('should use specific proxy configuration', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'socks5',
          host: 'specific.proxy',
          port: 1080,
          bypass: [],
          connectionTimeout: 30000,
          requestTimeout: 60000,
          maxRetries: 3,
          healthCheckInterval: 300000,
          healthCheckUrl: 'https://www.google.com',
          rejectUnauthorized: true,
          priority: 50,
          tags: [],
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await proxyManager.getProxyForContext('context-2', contextConfig);
      expect(result?.url).toMatch(/^socks5:\/\/specific\.proxy:1080$/);
    });
  });

  describe('proxy rotation', () => {
    beforeEach(async () => {
      const poolConfig: ProxyPoolConfig = {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
          {
            protocol: 'http',
            host: 'proxy2.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: false,
        healthCheckInterval: 300000,
        failoverEnabled: true,
        failoverThreshold: 3,
        maxConcurrentChecks: 3,
      };

      await proxyManager.initialize(poolConfig);
    });

    it('should rotate proxy for context', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const first = await proxyManager.getProxyForContext('context-1', contextConfig);
      const firstProxyId = first?.proxyId;

      const rotationPromise = new Promise<void>((resolve) => {
        proxyManager.once('proxy:rotated', (event) => {
          expect(event.contextId).toBe('context-1');
          expect(event.reason).toBe('manual');
          expect(event.oldProxyId).toBe(firstProxyId);
          expect(event.newProxyId).not.toBe(firstProxyId);
          resolve();
        });
      });

      await proxyManager.rotateProxy('context-1', 'manual');
      await rotationPromise;
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const poolConfig: ProxyPoolConfig = {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: false,
        healthCheckInterval: 300000,
        failoverEnabled: true,
        failoverThreshold: 3,
        maxConcurrentChecks: 3,
      };

      await proxyManager.initialize(poolConfig);
    });

    it('should handle proxy errors and update health status', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: false,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await proxyManager.getProxyForContext('context-1', contextConfig);
      if (!result?.proxyId) {
        throw new Error('ProxyId should be defined');
      }
      const proxyId = result.proxyId;

      // Simulate errors
      await proxyManager.handleProxyError(
        'context-1',
        proxyId,
        new Error('Connection failed'),
        contextConfig,
      );
      await proxyManager.handleProxyError(
        'context-1',
        proxyId,
        new Error('Connection failed'),
        contextConfig,
      );

      const health = proxyManager.getHealthStatus();
      const proxyHealth = health.find((h) => h.proxyId === proxyId);
      expect(proxyHealth?.consecutiveFailures).toBe(2);
      expect(proxyHealth?.errorCount).toBe(2);
    });

    it('should mark proxy as unhealthy after threshold failures', async () => {
      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: false,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await proxyManager.getProxyForContext('context-1', contextConfig);
      if (!result?.proxyId) {
        throw new Error('ProxyId should be defined');
      }
      const proxyId = result.proxyId;

      const unhealthyPromise = new Promise<void>((resolve) => {
        proxyManager.once('proxy:unhealthy', (event) => {
          expect(event.proxyId).toBe(proxyId);
          resolve();
        });
      });

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        await proxyManager.handleProxyError(
          'context-1',
          proxyId,
          new Error('Connection failed'),
          contextConfig,
        );
      }

      await unhealthyPromise;

      const health = proxyManager.getHealthStatus();
      const proxyHealth = health.find((h) => h.proxyId === proxyId);
      expect(proxyHealth?.healthy).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up context proxy assignments', async () => {
      const poolConfig: ProxyPoolConfig = {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.test',
            port: 8080,
            bypass: [],
            connectionTimeout: 30000,
            requestTimeout: 60000,
            maxRetries: 3,
            healthCheckInterval: 300000,
            healthCheckUrl: 'https://www.google.com',
            rejectUnauthorized: true,
            priority: 50,
            tags: [],
          },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: false,
        healthCheckInterval: 300000,
        failoverEnabled: true,
        failoverThreshold: 3,
        maxConcurrentChecks: 3,
      };

      await proxyManager.initialize(poolConfig);

      const contextConfig: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [],
          strategy: 'round-robin',
          healthCheckEnabled: false,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      await proxyManager.getProxyForContext('context-1', contextConfig);
      const metricsBefore = proxyManager.getMetrics();
      expect(metricsBefore.contexts.size).toBe(1);

      await proxyManager.cleanupContext('context-1');
      const metricsAfter = proxyManager.getMetrics();
      expect(metricsAfter.contexts.size).toBe(0);
    });
  });
});
