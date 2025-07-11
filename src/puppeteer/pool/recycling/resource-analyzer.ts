/**
 * Analysis of browser resource usage and health
 * @module puppeteer/pool/recycling/resource-analyzer
 * @nist si-4 "Information system monitoring"
 */

import { createLogger } from '../../../utils/logger.js';
import type { BrowserResourceUsage } from '../browser-pool-resource-manager.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';
import type { CandidateMetrics } from './types.js';

const logger = createLogger('resource-analyzer');

/**
 * Resource analysis result
 */
export interface ResourceAnalysis {
  memoryPressure: boolean;
  cpuPressure: boolean;
  connectionOverload: boolean;
  resourceScore: number;
  recommendations: string[];
}

/**
 * Browser resource analyzer
 * @nist si-4 "Information system monitoring"
 */
export class ResourceAnalyzer {
  /**
   * Analyze browser resource usage
   */
  analyzeResources(
    instance: InternalBrowserInstance,
    limits: { maxMemoryMB: number; maxCpuPercent: number; maxConnections: number },
    resourceUsage?: BrowserResourceUsage,
  ): ResourceAnalysis {
    const analysis: ResourceAnalysis = {
      memoryPressure: false,
      cpuPressure: false,
      connectionOverload: false,
      resourceScore: 0,
      recommendations: [],
    };

    if (!resourceUsage) {
      return analysis;
    }

    // Analyze memory usage
    const memoryUsageMB = resourceUsage.memoryUsage.rss / 1024 / 1024;
    if (memoryUsageMB > limits.maxMemoryMB) {
      analysis.memoryPressure = true;
      analysis.recommendations.push(
        `Memory usage (${memoryUsageMB.toFixed(1)}MB) exceeds limit (${limits.maxMemoryMB}MB)`,
      );
    }

    // Analyze CPU usage
    if (resourceUsage.cpuUsage.percent > limits.maxCpuPercent) {
      analysis.cpuPressure = true;
      analysis.recommendations.push(
        `CPU usage (${resourceUsage.cpuUsage.percent.toFixed(1)}%) exceeds limit (${limits.maxCpuPercent}%)`,
      );
    }

    // Analyze connections (assuming network connections is part of resource usage)
    const connectionCount = 0; // TODO: Get from actual resource usage when available
    if (connectionCount > limits.maxConnections) {
      analysis.connectionOverload = true;
      analysis.recommendations.push(
        `Connection count (${connectionCount}) exceeds limit (${limits.maxConnections})`,
      );
    }

    // Calculate resource score (0-100, higher means more pressure)
    analysis.resourceScore = this.calculateResourceScore({
      memoryUsageMB,
      maxMemoryMB: limits.maxMemoryMB,
      cpuPercent: resourceUsage.cpuUsage.percent,
      maxCpuPercent: limits.maxCpuPercent,
      connectionCount,
      maxConnections: limits.maxConnections,
    });

    logger.debug(
      {
        browserId: instance.id,
        memoryUsageMB,
        cpuPercent: resourceUsage.cpuUsage.percent,
        connectionCount,
        resourceScore: analysis.resourceScore,
      },
      'Resource analysis completed',
    );

    return analysis;
  }

  /**
   * Extract metrics for a candidate
   */
  extractCandidateMetrics(
    instance: InternalBrowserInstance,
    resourceUsage?: BrowserResourceUsage,
    healthScore: number = 100,
    errorRate: number = 0,
  ): CandidateMetrics {
    const now = new Date();
    const ageMs = now.getTime() - instance.createdAt.getTime();

    return {
      ageMs,
      useCount: instance.useCount,
      pageCount: instance.pageCount,
      memoryUsageMB: resourceUsage ? resourceUsage.memoryUsage.rss / 1024 / 1024 : 0,
      cpuUsagePercent: resourceUsage ? resourceUsage.cpuUsage.percent : 0,
      healthScore,
      errorRate,
    };
  }

  /**
   * Calculate idle time for a browser
   */
  calculateIdleTime(instance: InternalBrowserInstance): number {
    const now = new Date();
    return now.getTime() - instance.lastUsedAt.getTime();
  }

  /**
   * Check if browser exceeds resource limits
   */
  exceedsResourceLimits(
    resourceUsage: BrowserResourceUsage,
    maxMemoryMB: number,
    maxCpuPercent: number,
    maxHandles: number,
  ): boolean {
    const memoryUsageMB = resourceUsage.memoryUsage.rss / 1024 / 1024;

    return (
      memoryUsageMB > maxMemoryMB ||
      resourceUsage.cpuUsage.percent > maxCpuPercent ||
      resourceUsage.openHandles > maxHandles
    );
  }

  /**
   * Calculate resource score
   * @private
   */
  private calculateResourceScore(params: {
    memoryUsageMB: number;
    maxMemoryMB: number;
    cpuPercent: number;
    maxCpuPercent: number;
    connectionCount: number;
    maxConnections: number;
  }): number {
    // Memory component (40% weight)
    const memoryScore = Math.min(100, (params.memoryUsageMB / params.maxMemoryMB) * 100) * 0.4;

    // CPU component (40% weight)
    const cpuScore = Math.min(100, (params.cpuPercent / params.maxCpuPercent) * 100) * 0.4;

    // Connection component (20% weight)
    const connectionScore =
      Math.min(100, (params.connectionCount / params.maxConnections) * 100) * 0.2;

    return memoryScore + cpuScore + connectionScore;
  }
}
