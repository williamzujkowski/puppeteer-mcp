/**
 * Performance analysis utilities
 * @module puppeteer/actions/execution/coordinator/performance/performance-analyzer
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { BrowserAction } from '../../../../interfaces/action-executor.interface.js';
import type { AggregatedMetrics } from '../metrics-collector.js';

/**
 * Performance hints for action execution
 */
export interface PerformanceHints {
  disableImages: boolean;
  disableJavaScript: boolean;
  blockResources: string[];
  useCache: boolean;
  parallelizable: boolean;
  estimatedDuration: number;
}

/**
 * Analyzes action performance characteristics
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class PerformanceAnalyzer {
  private readonly resourceIntensiveActions = ['screenshot', 'pdf', 'extractContent'];
  private readonly noImageActions = ['extractText', 'evaluate'];
  private readonly nonParallelizableActions = [
    'navigate',
    'reload',
    'goBack',
    'goForward',
    'setCookie',
    'deleteCookie',
  ];

  private readonly defaultDurations: Record<string, number> = {
    navigate: 5000,
    click: 1000,
    type: 2000,
    screenshot: 3000,
    pdf: 5000,
    extractContent: 3000,
    evaluate: 1000,
    hover: 500,
    select: 1000,
    wait: 2000,
    scroll: 500,
    reload: 3000,
    goBack: 2000,
    goForward: 2000,
  };

  /**
   * Analyze action and generate performance hints
   * @param action - Browser action
   * @param metrics - Historical metrics
   * @returns Performance hints
   */
  analyzeAction(action: BrowserAction, metrics: AggregatedMetrics): PerformanceHints {
    const estimatedDuration = this.estimateDuration(action, metrics);

    return {
      disableImages: this.shouldDisableImages(action),
      disableJavaScript: this.shouldDisableJavaScript(action),
      blockResources: this.getResourceBlockList(action),
      useCache: this.shouldUseCache(action),
      parallelizable: this.isParallelizable(action),
      estimatedDuration,
    };
  }

  /**
   * Check if action is resource intensive
   * @param action - Browser action
   * @returns True if resource intensive
   */
  isResourceIntensive(action: BrowserAction): boolean {
    return this.resourceIntensiveActions.includes(action.type);
  }

  /**
   * Check if images should be disabled
   * @param action - Browser action
   * @returns True if images should be disabled
   */
  private shouldDisableImages(action: BrowserAction): boolean {
    return this.noImageActions.includes(action.type);
  }

  /**
   * Check if JavaScript should be disabled
   * @param action - Browser action
   * @returns True if JavaScript should be disabled
   */
  private shouldDisableJavaScript(_action: BrowserAction): boolean {
    // Most actions require JavaScript
    return false;
  }

  /**
   * Get resource block list for action
   * @param action - Browser action
   * @returns Resource types to block
   */
  private getResourceBlockList(action: BrowserAction): string[] {
    const baseBlockList = ['media', 'font'];

    if (action.type === 'getText' || action.type === 'content') {
      return [...baseBlockList, 'image', 'stylesheet'];
    }

    if (
      action.type === 'navigate' &&
      'waitFor' in action &&
      action.waitFor === 'domcontentloaded'
    ) {
      return [...baseBlockList, 'image'];
    }

    return baseBlockList;
  }

  /**
   * Check if cache should be used
   * @param action - Browser action
   * @returns True if cache should be used
   */
  private shouldUseCache(action: BrowserAction): boolean {
    // Use cache for most actions except navigation (which may be refreshing)
    return action.type !== 'navigate';
  }

  /**
   * Check if action is parallelizable
   * @param action - Browser action
   * @returns True if parallelizable
   */
  private isParallelizable(action: BrowserAction): boolean {
    return !this.nonParallelizableActions.includes(action.type);
  }

  /**
   * Estimate action duration
   * @param action - Browser action
   * @param metrics - Historical metrics
   * @returns Estimated duration in ms
   */
  private estimateDuration(action: BrowserAction, metrics: AggregatedMetrics): number {
    // Use P90 duration if available
    if (metrics.performanceMetrics.p90Duration > 0) {
      return Math.ceil(metrics.performanceMetrics.p90Duration * 1.1);
    }

    // Fall back to action-specific defaults
    return this.defaultDurations[action.type] ?? 2000;
  }

  /**
   * Get performance recommendations
   * @param hints - Performance hints
   * @returns Human-readable recommendations
   */
  getRecommendations(hints: PerformanceHints): string[] {
    const recommendations: string[] = [];

    if (hints.estimatedDuration > 5000) {
      recommendations.push('Consider breaking down long-running actions');
    }

    if (hints.blockResources.includes('image')) {
      recommendations.push('Images will be blocked to improve performance');
    }

    if (!hints.parallelizable) {
      recommendations.push('This action cannot be run in parallel with others');
    }

    if (hints.disableJavaScript) {
      recommendations.push('JavaScript will be disabled for this action');
    }

    return recommendations;
  }

  /**
   * Calculate performance score
   * @param duration - Actual duration
   * @param estimatedDuration - Estimated duration
   * @returns Performance score (0-100)
   */
  calculatePerformanceScore(duration: number, estimatedDuration: number): number {
    if (estimatedDuration === 0) {
      return 100;
    }

    const ratio = duration / estimatedDuration;

    if (ratio <= 0.8) return 100; // Excellent
    if (ratio <= 1.0) return 90; // Good
    if (ratio <= 1.2) return 70; // Acceptable
    if (ratio <= 1.5) return 50; // Needs improvement

    return Math.max(0, 100 - Math.floor((ratio - 1) * 50));
  }
}
