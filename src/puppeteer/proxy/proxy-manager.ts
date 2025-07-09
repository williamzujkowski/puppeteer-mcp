/**
 * Proxy Manager Implementation
 * @module puppeteer/proxy/proxy-manager
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  ProxyConfig,
  ProxyPoolConfig,
  ProxyHealthStatus,
  ProxyMetrics,
  ProxyRotationEvent,
  ContextProxyConfig,
} from '../types/proxy.js';
import { formatProxyUrl, shouldBypassProxy, validateProxyUrl } from '../types/proxy.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { AppError } from '../../core/errors/app-error.js';
import { ProxyHealthChecker } from './proxy-health-checker.js';
import { ProxyRotationStrategy } from './proxy-rotation-strategy.js';

const logger = createLogger('proxy-manager');

/**
 * Proxy instance with metadata
 * @nist ac-4 "Information flow enforcement"
 */
interface ProxyInstance {
  id: string;
  config: ProxyConfig;
  health: ProxyHealthStatus;
  metrics: ProxyMetrics;
  url: string;
  lastRotation?: Date;
}

/**
 * Proxy manager events
 * @nist au-3 "Content of audit records"
 */
export interface ProxyManagerEvents {
  'proxy:healthy': { proxyId: string; responseTime: number };
  'proxy:unhealthy': { proxyId: string; error: string };
  'proxy:rotated': ProxyRotationEvent;
  'proxy:failover': { contextId: string; failedProxyId: string; newProxyId: string };
  'health:check:complete': { healthy: number; unhealthy: number; total: number };
}

/**
 * Proxy manager for handling proxy rotation, health checks, and failover
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 */
export class ProxyManager extends EventEmitter {
  private proxies: Map<string, ProxyInstance> = new Map();
  private contextProxies: Map<string, string> = new Map(); // contextId -> proxyId
  private healthChecker: ProxyHealthChecker;
  private rotationStrategy: ProxyRotationStrategy;
  private healthCheckInterval?: NodeJS.Timeout;
  private rotationIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.healthChecker = new ProxyHealthChecker();
    this.rotationStrategy = new ProxyRotationStrategy();
  }

  /**
   * Initialize proxy manager with configuration
   * @nist cm-6 "Configuration settings"
   */
  async initialize(config?: ProxyPoolConfig): Promise<void> {
    if (!config) return;

    // Add proxies to the pool
    for (const proxyConfig of config.proxies) {
      await this.addProxy(proxyConfig);
    }

    // Set rotation strategy
    this.rotationStrategy.setStrategy(config.strategy);

    // Start health checks if enabled
    if (config.healthCheckEnabled) {
      await this.startHealthChecks(config.healthCheckInterval);
    }

    logger.info({
      msg: 'Proxy manager initialized',
      proxyCount: this.proxies.size,
      strategy: config.strategy,
      healthCheckEnabled: config.healthCheckEnabled,
    });

    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'proxy_manager',
      action: 'initialize',
      result: 'success',
      metadata: {
        proxyCount: this.proxies.size,
        strategy: config.strategy,
      },
    });
  }

  /**
   * Add a proxy to the pool
   * @nist ac-4 "Information flow enforcement"
   */
  async addProxy(config: ProxyConfig): Promise<string> {
    const proxyId = uuidv4();
    const url = formatProxyUrl(config);

    // Validate proxy URL
    const validation = validateProxyUrl(url);
    if (!validation.valid) {
      throw new AppError(`Invalid proxy configuration: ${validation.error}`, 400);
    }

    const proxyInstance: ProxyInstance = {
      id: proxyId,
      config,
      url,
      health: {
        proxyId,
        healthy: true,
        lastChecked: new Date(),
        errorCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
      },
      metrics: {
        proxyId,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        totalBandwidth: 0,
        lastUsed: new Date(),
      },
    };

    this.proxies.set(proxyId, proxyInstance);

    logger.info({
      msg: 'Proxy added to pool',
      proxyId,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      name: config.name,
    });

    return proxyId;
  }

  /**
   * Remove a proxy from the pool
   * @nist ac-4 "Information flow enforcement"
   */
  async removeProxy(proxyId: string): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      throw new AppError('Proxy not found', 404);
    }

    // Remove from active contexts
    for (const [contextId, activeProxyId] of this.contextProxies.entries()) {
      if (activeProxyId === proxyId) {
        // Trigger failover for affected contexts
        await this.failoverProxy(contextId, proxyId);
      }
    }

    this.proxies.delete(proxyId);

    logger.info({
      msg: 'Proxy removed from pool',
      proxyId,
      name: proxy.config.name,
    });

    await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGE, {
      resource: `proxy:${proxyId}`,
      action: 'remove',
      result: 'success',
    });
  }

  /**
   * Get proxy configuration for a context
   * @nist ac-4 "Information flow enforcement"
   */
  async getProxyForContext(
    contextId: string,
    config: ContextProxyConfig,
  ): Promise<{ url: string; proxyId: string } | null> {
    if (!config.enabled) {
      return null;
    }

    // Check if context already has a proxy assigned
    let proxyId = this.contextProxies.get(contextId);

    if (!proxyId) {
      // Select a new proxy based on configuration
      if (config.proxy) {
        // Use specific proxy configuration
        proxyId = await this.addProxy(config.proxy);
      } else if (config.pool) {
        // Use proxy from pool
        proxyId = await this.selectProxyFromPool();
      } else {
        return null;
      }

      this.contextProxies.set(contextId, proxyId);

      // Set up rotation if configured
      if (config.rotateOnInterval && config.rotationInterval > 0) {
        this.setupRotationInterval(contextId, config.rotationInterval);
      }
    }

    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      throw new AppError('Proxy not found', 404);
    }

    // Update metrics
    proxy.metrics.lastUsed = new Date();
    proxy.metrics.requestCount++;

    return { url: proxy.url, proxyId };
  }

  /**
   * Select a proxy from the pool based on strategy
   * @nist ac-4 "Information flow enforcement"
   */
  private async selectProxyFromPool(): Promise<string> {
    const healthyProxies = Array.from(this.proxies.values()).filter(
      (proxy) => proxy.health.healthy,
    );

    if (healthyProxies.length === 0) {
      throw new AppError('No healthy proxies available', 503);
    }

    const selected = this.rotationStrategy.selectProxy(healthyProxies);

    logger.debug({
      msg: 'Proxy selected from pool',
      proxyId: selected.id,
      strategy: this.rotationStrategy.getStrategy(),
    });

    return selected.id;
  }

  /**
   * Check if a URL should use proxy
   * @nist ac-4 "Information flow enforcement"
   */
  shouldUseProxy(url: string, contextId: string): boolean {
    const proxyId = this.contextProxies.get(contextId);
    if (!proxyId) return false;

    const proxy = this.proxies.get(proxyId);
    if (!proxy) return false;

    return !shouldBypassProxy(url, proxy.config.bypass);
  }

  /**
   * Handle proxy error and potentially trigger failover
   * @nist si-4 "Information system monitoring"
   */
  async handleProxyError(
    contextId: string,
    proxyId: string,
    error: Error,
    config: ContextProxyConfig,
  ): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return;

    // Update health status
    proxy.health.errorCount++;
    proxy.health.consecutiveFailures++;
    proxy.health.lastError = error.message;
    proxy.metrics.failureCount++;

    logger.warn({
      msg: 'Proxy error occurred',
      proxyId,
      contextId,
      error: error.message,
      consecutiveFailures: proxy.health.consecutiveFailures,
    });

    // Check if failover is needed
    if (
      proxy.health.consecutiveFailures >= (config.pool?.failoverThreshold ?? 3) &&
      config.pool?.failoverEnabled
    ) {
      proxy.health.healthy = false;
      this.emit('proxy:unhealthy', { proxyId, error: error.message });
      
      if (config.rotateOnError) {
        await this.rotateProxy(contextId, 'error');
      }
    }

    await logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, {
      resource: `proxy:${proxyId}`,
      action: 'error',
      result: 'failure',
      reason: error.message,
      metadata: {
        contextId,
        consecutiveFailures: proxy.health.consecutiveFailures,
      },
    });
  }

  /**
   * Handle proxy success
   * @nist si-4 "Information system monitoring"
   */
  async handleProxySuccess(
    contextId: string,
    proxyId: string,
    responseTime: number,
  ): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return;

    // Update health status
    proxy.health.successCount++;
    proxy.health.consecutiveFailures = 0;
    proxy.metrics.successCount++;

    // Update average response time
    const totalRequests = proxy.metrics.successCount;
    proxy.metrics.averageResponseTime =
      (proxy.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Mark as healthy if it was unhealthy
    if (!proxy.health.healthy) {
      proxy.health.healthy = true;
      this.emit('proxy:healthy', { proxyId, responseTime });
    }
  }

  /**
   * Rotate proxy for a context
   * @nist ac-4 "Information flow enforcement"
   */
  async rotateProxy(
    contextId: string,
    reason: 'scheduled' | 'error' | 'health' | 'manual',
  ): Promise<void> {
    const oldProxyId = this.contextProxies.get(contextId);
    const newProxyId = await this.selectProxyFromPool();

    if (newProxyId === oldProxyId) {
      // Try to get a different proxy
      const alternativeProxyId = await this.selectProxyFromPool();
      if (alternativeProxyId !== oldProxyId) {
        this.contextProxies.set(contextId, alternativeProxyId);
      }
    } else {
      this.contextProxies.set(contextId, newProxyId);
    }

    const rotationEvent: ProxyRotationEvent = {
      contextId,
      oldProxyId,
      newProxyId: this.contextProxies.get(contextId)!,
      reason,
      timestamp: new Date(),
    };

    this.emit('proxy:rotated', rotationEvent);

    logger.info({
      msg: 'Proxy rotated for context',
      contextId,
      oldProxyId,
      newProxyId: rotationEvent.newProxyId,
      reason,
    });

    await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGE, {
      resource: `context:${contextId}`,
      action: 'proxy_rotation',
      result: 'success',
      metadata: {
        oldProxyId,
        newProxyId: rotationEvent.newProxyId,
        reason,
      },
    });
  }

  /**
   * Failover to a new proxy
   * @nist ac-4 "Information flow enforcement"
   */
  private async failoverProxy(contextId: string, failedProxyId: string): Promise<void> {
    try {
      const newProxyId = await this.selectProxyFromPool();
      this.contextProxies.set(contextId, newProxyId);

      this.emit('proxy:failover', { contextId, failedProxyId, newProxyId });

      logger.info({
        msg: 'Proxy failover completed',
        contextId,
        failedProxyId,
        newProxyId,
      });
    } catch (error) {
      logger.error({
        msg: 'Proxy failover failed',
        contextId,
        failedProxyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Set up rotation interval for a context
   * @nist ac-4 "Information flow enforcement"
   */
  private setupRotationInterval(contextId: string, interval: number): void {
    // Clear existing interval if any
    const existingInterval = this.rotationIntervals.get(contextId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const rotationInterval = setInterval(async () => {
      try {
        await this.rotateProxy(contextId, 'scheduled');
      } catch (error) {
        logger.error({
          msg: 'Scheduled proxy rotation failed',
          contextId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, interval);

    this.rotationIntervals.set(contextId, rotationInterval);
  }

  /**
   * Start health checks for all proxies
   * @nist si-4 "Information system monitoring"
   */
  private async startHealthChecks(interval: number): Promise<void> {
    // Initial health check
    await this.performHealthChecks();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    logger.info({
      msg: 'Proxy health checks started',
      interval,
    });
  }

  /**
   * Perform health checks on all proxies
   * @nist si-4 "Information system monitoring"
   */
  private async performHealthChecks(): Promise<void> {
    const proxiesToCheck = Array.from(this.proxies.values());
    const results = await this.healthChecker.checkMultiple(
      proxiesToCheck.map((p) => ({ id: p.id, config: p.config })),
    );

    let healthy = 0;
    let unhealthy = 0;

    for (const result of results) {
      const proxy = this.proxies.get(result.proxyId);
      if (!proxy) continue;

      proxy.health = result;

      if (result.healthy) {
        healthy++;
        this.emit('proxy:healthy', { proxyId: result.proxyId, responseTime: result.responseTime! });
      } else {
        unhealthy++;
        this.emit('proxy:unhealthy', { proxyId: result.proxyId, error: result.lastError! });
      }
    }

    this.emit('health:check:complete', { healthy, unhealthy, total: proxiesToCheck.length });

    logger.info({
      msg: 'Proxy health check completed',
      healthy,
      unhealthy,
      total: proxiesToCheck.length,
    });
  }

  /**
   * Get proxy metrics
   * @nist au-3 "Content of audit records"
   */
  getMetrics(): { proxies: ProxyMetrics[]; contexts: Map<string, string> } {
    const proxies = Array.from(this.proxies.values()).map((p) => p.metrics);
    return { proxies, contexts: new Map(this.contextProxies) };
  }

  /**
   * Get proxy health status
   * @nist si-4 "Information system monitoring"
   */
  getHealthStatus(): ProxyHealthStatus[] {
    return Array.from(this.proxies.values()).map((p) => p.health);
  }

  /**
   * Clean up context proxy assignment
   * @nist ac-12 "Session termination"
   */
  async cleanupContext(contextId: string): Promise<void> {
    const rotationInterval = this.rotationIntervals.get(contextId);
    if (rotationInterval) {
      clearInterval(rotationInterval);
      this.rotationIntervals.delete(contextId);
    }

    this.contextProxies.delete(contextId);

    logger.info({
      msg: 'Context proxy cleanup completed',
      contextId,
    });
  }

  /**
   * Shutdown proxy manager
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Clear all rotation intervals
    for (const interval of this.rotationIntervals.values()) {
      clearInterval(interval);
    }

    this.proxies.clear();
    this.contextProxies.clear();
    this.rotationIntervals.clear();

    logger.info('Proxy manager shutdown complete');

    await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
      resource: 'proxy_manager',
      action: 'shutdown',
      result: 'success',
    });
  }
}

/**
 * Singleton proxy manager instance
 */
export const proxyManager = new ProxyManager();