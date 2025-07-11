/**
 * Proxy Rotation Strategy Implementation
 * @module puppeteer/proxy/proxy-rotation-strategy
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('proxy-rotation-strategy');

/**
 * Proxy instance for rotation
 */
interface ProxyForRotation {
  id: string;
  config: {
    priority: number;
    name?: string;
  };
  health: {
    healthy: boolean;
    responseTime?: number;
  };
  metrics: {
    requestCount: number;
    successCount: number;
    failureCount: number;
    averageResponseTime: number;
    lastUsed: Date;
  };
}

/**
 * Rotation strategy type
 */
export type RotationStrategy =
  | 'round-robin'
  | 'random'
  | 'least-used'
  | 'priority'
  | 'health-based';

/**
 * Proxy rotation strategy implementation
 * @nist ac-4 "Information flow enforcement"
 */
export class ProxyRotationStrategy {
  private strategy: RotationStrategy = 'round-robin';
  private lastSelectedIndex = 0;

  /**
   * Set the rotation strategy
   * @nist cm-6 "Configuration settings"
   */
  setStrategy(strategy: RotationStrategy): void {
    this.strategy = strategy;
    this.lastSelectedIndex = 0;

    logger.info({
      msg: 'Proxy rotation strategy updated',
      strategy,
    });
  }

  /**
   * Get current strategy
   */
  getStrategy(): RotationStrategy {
    return this.strategy;
  }

  /**
   * Select a proxy based on the current strategy
   * @nist ac-4 "Information flow enforcement"
   */
  selectProxy(proxies: ProxyForRotation[]): ProxyForRotation {
    if (proxies.length === 0) {
      throw new Error('No proxies available for selection');
    }

    if (proxies.length === 1) {
      return proxies[0] as ProxyForRotation;
    }

    let selected: ProxyForRotation;

    switch (this.strategy) {
      case 'round-robin':
        selected = this.selectRoundRobin(proxies);
        break;

      case 'random':
        selected = this.selectRandom(proxies);
        break;

      case 'least-used':
        selected = this.selectLeastUsed(proxies);
        break;

      case 'priority':
        selected = this.selectByPriority(proxies);
        break;

      case 'health-based':
        selected = this.selectHealthBased(proxies);
        break;

      default:
        selected = this.selectRoundRobin(proxies);
    }

    logger.debug({
      msg: 'Proxy selected',
      strategy: this.strategy,
      proxyId: selected.id,
      proxyName: selected.config.name,
    });

    return selected;
  }

  /**
   * Round-robin selection
   * @private
   */
  private selectRoundRobin(proxies: ProxyForRotation[]): ProxyForRotation {
    this.lastSelectedIndex = (this.lastSelectedIndex + 1) % proxies.length;
    return proxies[this.lastSelectedIndex] as ProxyForRotation;
  }

  /**
   * Random selection
   * @private
   */
  private selectRandom(proxies: ProxyForRotation[]): ProxyForRotation {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex] as ProxyForRotation;
  }

  /**
   * Select least used proxy
   * @private
   */
  private selectLeastUsed(proxies: ProxyForRotation[]): ProxyForRotation {
    return proxies.reduce((least, current) => {
      if (current.metrics.requestCount < least.metrics.requestCount) {
        return current;
      }
      // If equal request count, prefer the one used longest ago
      if (
        current.metrics.requestCount === least.metrics.requestCount &&
        current.metrics.lastUsed < least.metrics.lastUsed
      ) {
        return current;
      }
      return least;
    });
  }

  /**
   * Select by priority (higher priority = higher number)
   * @private
   */
  private selectByPriority(proxies: ProxyForRotation[]): ProxyForRotation {
    // Sort by priority (descending) and then by least used
    const sorted = [...proxies].sort((a, b) => {
      // First, sort by priority
      if (a.config.priority !== b.config.priority) {
        return b.config.priority - a.config.priority;
      }
      // If same priority, sort by request count
      return a.metrics.requestCount - b.metrics.requestCount;
    });

    return sorted[0]!;
  }

  /**
   * Select based on health metrics
   * @private
   */
  private selectHealthBased(proxies: ProxyForRotation[]): ProxyForRotation {
    // Filter healthy proxies
    const healthyProxies = proxies.filter((p) => p.health.healthy);

    if (healthyProxies.length === 0) {
      // If no healthy proxies, fall back to least failed
      return proxies.reduce((best, current) => {
        const currentFailureRate =
          current.metrics.failureCount / Math.max(1, current.metrics.requestCount);
        const bestFailureRate = best.metrics.failureCount / Math.max(1, best.metrics.requestCount);
        return currentFailureRate < bestFailureRate ? current : best;
      });
    }

    // Among healthy proxies, select based on performance
    return healthyProxies.reduce((best, current) => {
      // Calculate composite score based on multiple factors
      const currentScore = this.calculateHealthScore(current);
      const bestScore = this.calculateHealthScore(best);

      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate health score for a proxy
   * @private
   */
  private calculateHealthScore(proxy: ProxyForRotation): number {
    let score = 100;

    // Factor 1: Success rate (40% weight)
    const successRate = proxy.metrics.successCount / Math.max(1, proxy.metrics.requestCount);
    score += successRate * 40;

    // Factor 2: Response time (30% weight) - lower is better
    if (proxy.health.responseTime) {
      const responseScore = Math.max(0, 30 - proxy.health.responseTime / 1000); // Penalty for each second
      score += responseScore;
    }

    // Factor 3: Recent usage (20% weight) - prefer less recently used
    const minutesSinceLastUse = (Date.now() - proxy.metrics.lastUsed.getTime()) / 60000;
    score += Math.min(20, minutesSinceLastUse / 5); // Max 20 points after 100 minutes

    // Factor 4: Priority (10% weight)
    score += (proxy.config.priority / 100) * 10;

    return score;
  }

  /**
   * Get strategy statistics
   * @nist au-3 "Content of audit records"
   */
  getStrategyStats(proxies: ProxyForRotation[]): Record<string, any> {
    const stats: Record<string, any> = {
      strategy: this.strategy,
      totalProxies: proxies.length,
      healthyProxies: proxies.filter((p) => p.health.healthy).length,
    };

    switch (this.strategy) {
      case 'round-robin':
        stats.nextIndex = (this.lastSelectedIndex + 1) % proxies.length;
        break;

      case 'least-used': {
        const leastUsed = proxies.reduce(
          (min, p) => (p.metrics.requestCount < min ? p.metrics.requestCount : min),
          Infinity,
        );
        stats.minimumUsageCount = leastUsed;
        break;
      }

      case 'priority': {
        const priorities = proxies.map((p) => p.config.priority);
        stats.priorityRange = {
          min: Math.min(...priorities),
          max: Math.max(...priorities),
        };
        break;
      }

      case 'health-based': {
        const scores = proxies.map((p) => ({
          id: p.id,
          name: p.config.name,
          score: this.calculateHealthScore(p),
        }));
        stats.healthScores = scores.sort((a, b) => b.score - a.score).slice(0, 5); // Top 5
        break;
      }
    }

    return stats;
  }

  /**
   * Recommend best strategy based on proxy pool characteristics
   * @nist cm-6 "Configuration settings"
   */
  recommendStrategy(proxies: ProxyForRotation[]): RotationStrategy {
    if (proxies.length === 0) {
      return 'round-robin';
    }

    // Check health variability
    const healthyCount = proxies.filter((p) => p.health.healthy).length;
    const healthRatio = healthyCount / proxies.length;

    // Check performance variability
    const responseTimes = proxies
      .filter((p) => p.health.responseTime)
      .map((p) => p.health.responseTime!);

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
    const responseTimeStdDev = Math.sqrt(
      responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) /
        responseTimes.length || 1,
    );

    // Check priority distribution
    const priorities = [...new Set(proxies.map((p) => p.config.priority))];
    const hasPriorityDifferences = priorities.length > 1;

    // Make recommendation
    if (healthRatio < 0.8 || responseTimeStdDev > avgResponseTime * 0.5) {
      // High variability in health or performance
      return 'health-based';
    } else if (hasPriorityDifferences) {
      // Different priorities assigned
      return 'priority';
    } else if (proxies.length > 10) {
      // Large pool, distribute load
      return 'least-used';
    } else {
      // Default for small, stable pools
      return 'round-robin';
    }
  }
}
