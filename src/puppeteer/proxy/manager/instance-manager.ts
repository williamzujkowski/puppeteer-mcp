/**
 * Proxy instance management
 * @module puppeteer/proxy/manager/instance-manager
 * @nist ac-4 "Information flow enforcement"
 */

import { v4 as uuidv4 } from 'uuid';
import type { ProxyConfig } from '../../types/proxy.js';
import { formatProxyUrl } from '../../types/proxy.js';
import type { ProxyInstance } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('proxy-instance-manager');

/**
 * Manages proxy instances
 */
export class ProxyInstanceManager {
  private proxies = new Map<string, ProxyInstance>();

  /**
   * Add a proxy to the pool
   */
  addProxy(config: ProxyConfig): string {
    const id = uuidv4();
    const instance: ProxyInstance = {
      id,
      config,
      health: {
        proxyId: id,
        healthy: true,
        lastChecked: new Date(),
        errorCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
      },
      metrics: {
        proxyId: id,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        totalBandwidth: 0,
        lastUsed: new Date(),
      },
      url: formatProxyUrl(config),
    };

    this.proxies.set(id, instance);
    
    logger.info({
      msg: 'Proxy added to pool',
      proxyId: id,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
    });

    return id;
  }

  /**
   * Remove a proxy from the pool
   */
  removeProxy(proxyId: string): boolean {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      return false;
    }

    this.proxies.delete(proxyId);
    
    logger.info({
      msg: 'Proxy removed from pool',
      proxyId,
    });

    return true;
  }

  /**
   * Get a proxy by ID
   */
  getProxy(proxyId: string): ProxyInstance | undefined {
    return this.proxies.get(proxyId);
  }

  /**
   * Get all proxies
   */
  getAllProxies(): ProxyInstance[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Get all proxy IDs
   */
  getProxyIds(): string[] {
    return Array.from(this.proxies.keys());
  }

  /**
   * Get healthy proxies
   */
  getHealthyProxies(): ProxyInstance[] {
    return this.getAllProxies().filter(proxy => proxy.health.healthy);
  }

  /**
   * Update proxy instance
   */
  updateProxy(proxyId: string, updates: Partial<ProxyInstance>): void {
    const proxy = this.proxies.get(proxyId);
    if (proxy) {
      Object.assign(proxy, updates);
    }
  }

  /**
   * Clear all proxies
   */
  clear(): void {
    this.proxies.clear();
  }

  /**
   * Get pool size
   */
  getPoolSize(): number {
    return this.proxies.size;
  }
}