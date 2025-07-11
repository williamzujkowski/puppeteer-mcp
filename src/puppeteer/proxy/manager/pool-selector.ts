/**
 * Proxy pool selection strategies
 * @module puppeteer/proxy/manager/pool-selector
 * @nist ac-4 "Information flow enforcement"
 */

import type { ProxyInstance, PoolSelectionOptions } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('proxy-pool-selector');

/**
 * Handles proxy selection from pool
 */
export class ProxyPoolSelector {
  private lastSelectedIndex = 0;

  constructor() {
    // No need for rotation strategy here
  }

  /**
   * Select a proxy from the pool
   */
  async selectProxy(
    proxies: ProxyInstance[],
    options: PoolSelectionOptions = {}
  ): Promise<string | null> {
    const {
      strategy = 'round-robin',
      excludeProxyIds = [],
      requireHealthy = true,
    } = options;

    // Filter proxies based on options
    let candidateProxies = proxies.filter(proxy => {
      if (excludeProxyIds.includes(proxy.id)) return false;
      if (requireHealthy && !proxy.health.healthy) return false;
      return true;
    });

    if (candidateProxies.length === 0) {
      if (requireHealthy) {
        // Try again without health requirement
        candidateProxies = proxies.filter(
          proxy => !excludeProxyIds.includes(proxy.id)
        );
      }
      
      if (candidateProxies.length === 0) {
        logger.warn('No available proxies in pool');
        return null;
      }
    }

    // Select based on strategy
    const selectedProxy = await this.selectByStrategy(candidateProxies, strategy);
    
    if (selectedProxy) {
      logger.debug({
        msg: 'Proxy selected from pool',
        proxyId: selectedProxy.id,
        strategy,
        poolSize: proxies.length,
        candidatesCount: candidateProxies.length,
      });
    }

    return selectedProxy?.id ?? null;
  }

  /**
   * Select proxy by strategy
   */
  private async selectByStrategy(
    proxies: ProxyInstance[],
    strategy: PoolSelectionOptions['strategy']
  ): Promise<ProxyInstance | null> {
    switch (strategy) {
      case 'round-robin':
        return this.selectRoundRobin(proxies);
      
      case 'least-used':
        return this.selectLeastUsed(proxies);
      
      case 'best-health':
      case 'health-based':
        return this.selectBestHealth(proxies);
      
      case 'random':
        return this.selectRandom(proxies);
      
      case 'priority':
        return this.selectByPriority(proxies);
      
      default:
        return this.selectRoundRobin(proxies);
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(proxies: ProxyInstance[]): ProxyInstance | null {
    if (proxies.length === 0) return null;
    
    this.lastSelectedIndex = (this.lastSelectedIndex + 1) % proxies.length;
    return proxies[this.lastSelectedIndex] ?? null;
  }

  /**
   * Select least used proxy
   */
  private selectLeastUsed(proxies: ProxyInstance[]): ProxyInstance | null {
    if (proxies.length === 0) return null;
    
    return proxies.reduce((least, current) => 
      current.metrics.requestCount < least.metrics.requestCount ? current : least
    );
  }

  /**
   * Select proxy with best health
   */
  private selectBestHealth(proxies: ProxyInstance[]): ProxyInstance | null {
    if (proxies.length === 0) return null;
    
    const healthyProxies = proxies.filter(p => p.health.healthy);
    if (healthyProxies.length === 0) return proxies[0] ?? null;
    
    return healthyProxies.reduce((best, current) => {
      const bestScore = this.calculateHealthScore(best);
      const currentScore = this.calculateHealthScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Random selection
   */
  private selectRandom(proxies: ProxyInstance[]): ProxyInstance | null {
    if (proxies.length === 0) return null;
    
    const index = Math.floor(Math.random() * proxies.length);
    return proxies[index] ?? null;
  }

  /**
   * Calculate health score for a proxy
   */
  private calculateHealthScore(proxy: ProxyInstance): number {
    const { metrics, health } = proxy;
    
    if (!health.healthy) return 0;
    
    const successRate = metrics.requestCount > 0
      ? metrics.successCount / metrics.requestCount
      : 1;
    
    const responseTimeScore = Math.max(0, 1 - metrics.averageResponseTime / 10000);
    
    return (successRate * 0.7 + responseTimeScore * 0.3);
  }

  /**
   * Select proxy by priority
   */
  private selectByPriority(proxies: ProxyInstance[]): ProxyInstance | null {
    if (proxies.length === 0) return null;
    
    // Sort by priority (higher priority first)
    const sortedByPriority = [...proxies].sort((a, b) => {
      const priorityA = a.config.priority ?? 50;
      const priorityB = b.config.priority ?? 50;
      return priorityB - priorityA;
    });
    
    return sortedByPriority[0] ?? null;
  }
}