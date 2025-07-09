/**
 * Browser recycling decision service
 * @module puppeteer/pool/resource-management/recycling-decision-service
 * @nist sc-2 "Application partitioning"
 */

import { createLogger } from '../../../utils/logger.js';
import type { BrowserResourceUsage, ResourceThresholds } from './resource-types.js';
import type { ResourceHistoryManager } from './resource-history-manager.js';

const logger = createLogger('recycling-decision-service');

/**
 * Recycling decision result
 */
export interface RecyclingDecision {
  shouldRecycle: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Service for making browser recycling decisions
 * @nist sc-2 "Application partitioning"
 */
export class RecyclingDecisionService {
  private thresholds: ResourceThresholds;
  private historyManager: ResourceHistoryManager;

  constructor(thresholds: ResourceThresholds, historyManager: ResourceHistoryManager) {
    this.thresholds = thresholds;
    this.historyManager = historyManager;
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Check if browser should be recycled
   */
  shouldRecycleBrowser(browserId: string, usage?: BrowserResourceUsage): RecyclingDecision {
    if (!usage) {
      return { 
        shouldRecycle: false, 
        reason: 'No resource data available', 
        priority: 'low' 
      };
    }

    const { memoryUsage, cpuUsage, openHandles, connectionCount } = usage;

    // Check critical thresholds first
    const criticalDecision = this.checkCriticalThresholds(
      memoryUsage.rss,
      cpuUsage.percent,
      openHandles,
      connectionCount
    );
    if (criticalDecision) {
      return criticalDecision;
    }

    // Check warning thresholds
    const warningDecision = this.checkWarningThresholds(memoryUsage.rss);
    if (warningDecision) {
      return warningDecision;
    }

    // Check for resource leaks
    const leakDecision = this.checkResourceLeak(browserId);
    if (leakDecision) {
      return leakDecision;
    }

    return { 
      shouldRecycle: false, 
      reason: 'Resource usage within acceptable limits', 
      priority: 'low' 
    };
  }

  /**
   * Check critical resource thresholds
   * @private
   */
  private checkCriticalThresholds(
    memoryRss: number,
    cpuPercent: number,
    openHandles: number,
    connectionCount: number
  ): RecyclingDecision | null {
    // Memory critical
    if (memoryRss > this.thresholds.memoryCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical memory usage: ${Math.round(memoryRss / 1024 / 1024)}MB`,
        priority: 'high',
      };
    }

    // CPU critical
    if (cpuPercent > this.thresholds.cpuCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical CPU usage: ${cpuPercent}%`,
        priority: 'high',
      };
    }

    // Handle critical
    if (openHandles > this.thresholds.handleCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical handle count: ${openHandles}`,
        priority: 'medium',
      };
    }

    // Connection critical
    if (connectionCount > this.thresholds.connectionCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical connection count: ${connectionCount}`,
        priority: 'medium',
      };
    }

    return null;
  }

  /**
   * Check warning resource thresholds
   * @private
   */
  private checkWarningThresholds(memoryRss: number): RecyclingDecision | null {
    if (memoryRss > this.thresholds.memoryWarning) {
      return {
        shouldRecycle: true,
        reason: `High memory usage: ${Math.round(memoryRss / 1024 / 1024)}MB`,
        priority: 'low',
      };
    }
    return null;
  }

  /**
   * Check for resource leaks
   * @private
   */
  private checkResourceLeak(browserId: string): RecyclingDecision | null {
    if (this.historyManager.isResourceLeak(browserId)) {
      logger.info({ browserId }, 'Resource leak detected');
      return {
        shouldRecycle: true,
        reason: 'Potential memory leak detected',
        priority: 'medium',
      };
    }
    return null;
  }
}