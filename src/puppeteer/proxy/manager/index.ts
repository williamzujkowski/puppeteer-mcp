/**
 * Proxy Manager Implementation
 * @module puppeteer/proxy/manager
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import type {
  ProxyConfig,
  ProxyPoolConfig,
  ContextProxyConfig,
} from '../../types/proxy.js';
import { shouldBypassProxy } from '../../types/proxy.js';
import { createLogger } from '../../../utils/logger.js';
import { AppError } from '../../../core/errors/app-error.js';
import { ProxyHealthChecker } from '../proxy-health-checker.js';
import { ProxyInstanceManager } from './instance-manager.js';
import { ProxyMetricsTracker } from './metrics-tracker.js';
import { ProxyPoolSelector } from './pool-selector.js';
import { ProxyContextManager } from './context-manager.js';
import type { ProxyManagerEvents } from './types.js';

const logger = createLogger('proxy-manager');

/**
 * Proxy manager for handling proxy pools and rotation
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 */
export class ProxyManager extends EventEmitter {
  private instanceManager: ProxyInstanceManager;
  private metricsTracker: ProxyMetricsTracker;
  private poolSelector: ProxyPoolSelector;
  private contextManager: ProxyContextManager;
  private healthChecker?: ProxyHealthChecker;
  private poolConfig?: ProxyPoolConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.instanceManager = new ProxyInstanceManager();
    this.metricsTracker = new ProxyMetricsTracker();
    this.poolSelector = new ProxyPoolSelector();
    this.contextManager = new ProxyContextManager();

    // Forward context manager events
    this.contextManager.on('proxy:rotated', (event) => {
      this.emit('proxy:rotated', event);
    });
  }

  /**
   * Initialize proxy pool
   * @nist ac-4 "Information flow enforcement"
   */
  async initializePool(config: ProxyPoolConfig): Promise<void> {
    this.poolConfig = config;

    // Add proxies to pool
    for (const proxyConfig of config.proxies) {
      this.instanceManager.addProxy(proxyConfig);
    }

    // Initialize health checker
    this.healthChecker = new ProxyHealthChecker();

    // Start health monitoring
    if (config.healthCheckInterval > 0) {
      await this.startHealthMonitoring();
    }

    logger.info({
      msg: 'Proxy pool initialized',
      poolSize: config.proxies.length,
      strategy: config.strategy,
      healthCheckInterval: config.healthCheckInterval,
    });
  }

  /**
   * Get proxy for URL
   */
  async getProxyForUrl(url: string, contextId?: string): Promise<ProxyConfig | null> {
    // Check if URL should bypass proxy
    if (this.shouldBypassUrl(url)) {
      return null;
    }

    // Try to get proxy for context first
    const contextProxy = await this.getContextProxy(contextId);
    if (contextProxy) {
      return contextProxy;
    }

    // Select proxy from pool
    return this.selectProxyFromPool();
  }

  /**
   * Check if URL should bypass proxy
   */
  private shouldBypassUrl(url: string): boolean {
    const firstProxy = this.poolConfig?.proxies[0];
    if (!firstProxy) {
      return false;
    }
    return shouldBypassProxy(url, firstProxy.bypass);
  }

  /**
   * Get proxy for context
   */
  private async getContextProxy(contextId?: string): Promise<ProxyConfig | null> {
    if (!contextId) {
      return null;
    }

    const proxyId = this.contextManager.getContextProxy(contextId);
    if (!proxyId) {
      return null;
    }

    const proxy = this.instanceManager.getProxy(proxyId);
    return proxy?.config ?? null;
  }

  /**
   * Select proxy from pool
   */
  private async selectProxyFromPool(): Promise<ProxyConfig> {
    const proxyId = await this.poolSelector.selectProxy(
      this.instanceManager.getAllProxies(),
      { strategy: this.poolConfig?.strategy }
    );

    if (!proxyId) {
      throw new AppError('No available proxies in pool', 'PROXY_POOL_EMPTY');
    }

    const proxy = this.instanceManager.getProxy(proxyId);
    if (!proxy) {
      throw new AppError('Selected proxy not found', 'PROXY_NOT_FOUND');
    }

    return proxy.config;
  }

  /**
   * Configure context proxy
   */
  async configureContextProxy(
    contextId: string,
    config: ContextProxyConfig
  ): Promise<void> {
    if (!config.enabled) {
      this.contextManager.removeContext(contextId);
      return;
    }

    // Select initial proxy
    const proxyId = await this.poolSelector.selectProxy(
      this.instanceManager.getAllProxies(),
      { strategy: this.poolConfig?.strategy }
    );

    if (!proxyId) {
      throw new AppError('No available proxies for context', 'PROXY_POOL_EMPTY');
    }

    this.contextManager.assignProxy(contextId, proxyId);

    // Schedule rotation if enabled
    if (config.rotateOnInterval && config.rotationInterval > 0) {
      this.contextManager.scheduleRotation(
        contextId,
        config.rotationInterval,
        async () => {
          await this.rotateContextProxy(contextId, 'scheduled');
        }
      );
    }
  }

  /**
   * Record proxy success
   */
  recordProxySuccess(proxyId: string, responseTime: number): void {
    const proxy = this.instanceManager.getProxy(proxyId);
    if (proxy) {
      this.metricsTracker.recordSuccess(proxy, responseTime);
      this.emit('proxy:healthy', { proxyId, responseTime });
    }
  }

  /**
   * Record proxy failure
   */
  recordProxyFailure(proxyId: string, error: string): void {
    const proxy = this.instanceManager.getProxy(proxyId);
    if (proxy) {
      this.metricsTracker.recordFailure(proxy, error);
      this.emit('proxy:unhealthy', { proxyId, error });
    }
  }

  /**
   * Rotate context proxy
   */
  private async rotateContextProxy(
    contextId: string,
    reason: 'scheduled' | 'error' | 'health' | 'manual'
  ): Promise<void> {
    const currentProxyId = this.contextManager.getContextProxy(contextId);
    
    const newProxyId = await this.poolSelector.selectProxy(
      this.instanceManager.getAllProxies(),
      {
        strategy: this.poolConfig?.strategy,
        excludeProxyIds: currentProxyId ? [currentProxyId] : [],
      }
    );

    if (!newProxyId) {
      logger.warn({
        msg: 'No alternative proxy available for rotation',
        contextId,
      });
      return;
    }

    await this.contextManager.rotateProxy(contextId, newProxyId, reason);
  }

  /**
   * Start health monitoring
   */
  private async startHealthMonitoring(): Promise<void> {
    const checkHealth = async (): Promise<void> => {
      if (!this.healthChecker) return;

      const proxies = this.instanceManager.getAllProxies();
      for (const proxy of proxies) {
        try {
          await this.healthChecker.checkProxy(proxy.id, proxy.config);
          this.recordProxySuccess(proxy.id, 0);
        } catch (error) {
          this.recordProxyFailure(
            proxy.id,
            error instanceof Error ? error.message : 'Health check failed'
          );
        }
      }

      const stats = this.metricsTracker.getPoolStats(proxies);
      this.emit('health:check:complete', stats);
    };

    // Initial health check
    await checkHealth();

    // Schedule periodic checks
    this.healthCheckInterval = setInterval(
      () => {
        void checkHealth();
      },
      this.poolConfig?.healthCheckInterval ?? 300000
    );
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    total: number;
    healthy: number;
    unhealthy: number;
    averageResponseTime: number;
    totalRequests: number;
    successRate: number;
  } {
    return this.metricsTracker.getPoolStats(
      this.instanceManager.getAllProxies()
    );
  }

  /**
   * Destroy the proxy manager
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.contextManager.clear();
    this.instanceManager.clear();
    this.removeAllListeners();
  }
}

// Type assertion for events
export interface ProxyManager {
  on<K extends keyof ProxyManagerEvents>(
    event: K,
    listener: (data: ProxyManagerEvents[K]) => void,
  ): this;
  emit<K extends keyof ProxyManagerEvents>(
    event: K,
    data: ProxyManagerEvents[K],
  ): boolean;
}