/**
 * Resource history manager
 * @module puppeteer/pool/resource-management/resource-history-manager
 * @nist si-4 "Information system monitoring"
 */

import { createLogger } from '../../../utils/logger.js';
import type { BrowserResourceUsage } from './resource-types.js';

const logger = createLogger('resource-history-manager');

/**
 * Resource usage statistics
 */
export interface ResourceUsageStats {
  browserId: string;
  averageMemory: number;
  peakMemory: number;
  averageCpu: number;
  peakCpu: number;
  averageConnections: number;
  peakConnections: number;
  totalSamples: number;
  duration: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Resource history manager
 * @nist si-4 "Information system monitoring"
 */
export class ResourceHistoryManager {
  private resourceHistory: Map<string, BrowserResourceUsage[]> = new Map();
  private readonly maxHistorySize: number;

  constructor(maxHistorySize = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add resource usage to history
   */
  addUsage(browserId: string, usage: BrowserResourceUsage): void {
    let history = this.resourceHistory.get(browserId) || [];
    history.push(usage);

    // Maintain maximum history size
    if (history.length > this.maxHistorySize) {
      history = history.slice(-this.maxHistorySize);
    }

    this.resourceHistory.set(browserId, history);

    logger.debug(
      {
        browserId,
        historySize: history.length,
        latestUsage: {
          memory: Math.round(usage.memoryUsage.rss / 1024 / 1024),
          cpu: usage.cpuUsage.percent,
        },
      },
      'Resource usage added to history'
    );
  }

  /**
   * Get resource history for a browser
   */
  getHistory(browserId: string): BrowserResourceUsage[] {
    return this.resourceHistory.get(browserId) || [];
  }

  /**
   * Get all histories
   */
  getAllHistories(): Map<string, BrowserResourceUsage[]> {
    return new Map(this.resourceHistory);
  }

  /**
   * Clear history for a browser
   */
  clearHistory(browserId: string): void {
    this.resourceHistory.delete(browserId);
    logger.debug({ browserId }, 'Resource history cleared');
  }

  /**
   * Clear all histories
   */
  clearAllHistories(): void {
    const count = this.resourceHistory.size;
    this.resourceHistory.clear();
    logger.info({ count }, 'All resource histories cleared');
  }

  /**
   * Get resource usage statistics
   */
  getStatistics(browserId: string): ResourceUsageStats | null {
    const history = this.resourceHistory.get(browserId);
    if (!history || history.length === 0) {
      return null;
    }

    // Calculate statistics
    let totalMemory = 0;
    let totalCpu = 0;
    let totalConnections = 0;
    let peakMemory = 0;
    let peakCpu = 0;
    let peakConnections = 0;

    for (const usage of history) {
      totalMemory += usage.memoryUsage.rss;
      totalCpu += usage.cpuUsage.percent;
      totalConnections += usage.connectionCount;

      peakMemory = Math.max(peakMemory, usage.memoryUsage.rss);
      peakCpu = Math.max(peakCpu, usage.cpuUsage.percent);
      peakConnections = Math.max(peakConnections, usage.connectionCount);
    }

    const averageMemory = totalMemory / history.length;
    const averageCpu = totalCpu / history.length;
    const averageConnections = totalConnections / history.length;

    // Calculate trend
    const trend = this.calculateTrend(history);

    // Calculate duration
    const firstTimestamp = history[0]?.timestamp.getTime() ?? 0;
    const lastTimestamp = history[history.length - 1]?.timestamp.getTime() ?? 0;
    const duration = lastTimestamp - firstTimestamp;

    return {
      browserId,
      averageMemory,
      peakMemory,
      averageCpu,
      peakCpu,
      averageConnections,
      peakConnections,
      totalSamples: history.length,
      duration,
      trend,
    };
  }

  /**
   * Check if browser is leaking resources
   */
  isResourceLeak(browserId: string, threshold = 0.5): boolean {
    const stats = this.getStatistics(browserId);
    if (!stats || stats.totalSamples < 10) {
      return false;
    }

    const history = this.resourceHistory.get(browserId)!;
    const recentHistory = history.slice(-10);
    const olderHistory = history.slice(0, 10);

    // Calculate average memory for recent vs older samples
    const recentAvgMemory = recentHistory.reduce((sum, u) => sum + u.memoryUsage.rss, 0) / recentHistory.length;
    const olderAvgMemory = olderHistory.reduce((sum, u) => sum + u.memoryUsage.rss, 0) / olderHistory.length;

    // Check if memory has increased by threshold percentage
    const increaseRatio = (recentAvgMemory - olderAvgMemory) / olderAvgMemory;
    
    if (increaseRatio > threshold) {
      logger.warn(
        {
          browserId,
          increaseRatio: (increaseRatio * 100).toFixed(1) + '%',
          recentAvgMemoryMB: Math.round(recentAvgMemory / 1024 / 1024),
          olderAvgMemoryMB: Math.round(olderAvgMemory / 1024 / 1024),
        },
        'Potential resource leak detected'
      );
      return true;
    }

    return false;
  }

  /**
   * Calculate resource usage trend
   * @private
   */
  private calculateTrend(history: BrowserResourceUsage[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 3) {
      return 'stable';
    }

    // Simple linear regression on memory usage
    const n = Math.min(history.length, 20); // Use last 20 samples
    const recentHistory = history.slice(-n);
    
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    recentHistory.forEach((usage, index) => {
      const x = index;
      const y = usage.memoryUsage.rss / 1024 / 1024; // Convert to MB
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    // Calculate slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Determine trend based on slope
    if (slope > 1) { // More than 1MB increase per sample
      return 'increasing';
    } else if (slope < -1) { // More than 1MB decrease per sample
      return 'decreasing';
    } else {
      return 'stable';
    }
  }
}