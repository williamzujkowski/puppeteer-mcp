/**
 * Performance optimization module
 * @module puppeteer/actions/execution/coordinator/performance-optimizer
 * @nist sc-5 "Denial of service protection"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type { ConfigurationManager } from './configuration-manager.js';
import type { MetricsCollector } from './metrics-collector.js';
import type { OptimizationStrategy } from './performance/optimization-strategies.js';
import { OptimizationStrategyFactory, ResourceBlockingStrategy } from './performance/optimization-strategies.js';
import { PerformanceAnalyzer } from './performance/performance-analyzer.js';
import type { PerformanceHints } from './performance/performance-analyzer.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:performance-optimizer');

export type { OptimizationStrategy, PerformanceHints };

/**
 * Optimizes action execution performance
 * @nist sc-5 "Denial of service protection"
 */
export class PerformanceOptimizer {
  private readonly strategies: Map<string, OptimizationStrategy> = new Map();
  private readonly analyzer: PerformanceAnalyzer;
  private readonly resourceBlockingStrategy: ResourceBlockingStrategy;
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  constructor(
    private readonly _configManager: ConfigurationManager,
    private readonly metricsCollector: MetricsCollector,
  ) {
    this.analyzer = new PerformanceAnalyzer();
    this.resourceBlockingStrategy = OptimizationStrategyFactory.getResourceBlockingStrategy();
    this.initializeStrategies();
  }

  /**
   * Get performance hints for action
   * @param action - Browser action
   * @param context - Execution context
   * @returns Performance hints
   */
  getPerformanceHints(
    action: BrowserAction,
    context: ActionContext,
  ): PerformanceHints {
    const metrics = this.metricsCollector.getAggregatedMetrics(context, {
      actionTypes: [action.type],
    });

    return this.analyzer.analyzeAction(action, metrics);
  }

  /**
   * Apply optimizations to page
   * @param page - Page instance
   * @param action - Browser action
   * @param hints - Performance hints
   */
  async applyOptimizations(
    page: Page,
    action: BrowserAction,
    hints: PerformanceHints,
  ): Promise<void> {
    logger.debug('Applying performance optimizations', {
      actionType: action.type,
      hints,
    });

    // Apply resource blocking if needed
    if (hints.blockResources.length > 0) {
      await this.resourceBlockingStrategy.apply(page, action);
    }

    // Apply action-specific strategies
    const strategy = this.strategies.get(action.type);
    if (strategy?.enabled) {
      await strategy.apply(page, action);
    }

    // Apply cache settings
    if (hints.useCache) {
      await page.setCacheEnabled(true);
      this.recordCacheUsage(true);
    } else {
      this.recordCacheUsage(false);
    }

    // Apply JavaScript settings
    if (hints.disableJavaScript) {
      await page.setJavaScriptEnabled(false);
    }
  }

  /**
   * Remove optimizations from page
   * @param page - Page instance
   * @param action - Browser action
   */
  async removeOptimizations(
    page: Page,
    action: BrowserAction,
  ): Promise<void> {
    logger.debug('Removing performance optimizations', {
      actionType: action.type,
    });

    // Cleanup resource blocking
    await this.resourceBlockingStrategy.cleanup(page);

    // Cleanup action-specific strategies
    const strategy = this.strategies.get(action.type);
    if (strategy?.enabled) {
      await strategy.cleanup(page);
    }

    // Reset JavaScript (always re-enable)
    await page.setJavaScriptEnabled(true);
  }

  /**
   * Register optimization strategy
   * @param actionType - Action type
   * @param strategy - Optimization strategy
   */
  registerStrategy(actionType: string, strategy: OptimizationStrategy): void {
    this.strategies.set(actionType, strategy);
    logger.info('Registered optimization strategy', {
      actionType,
      strategyName: strategy.name,
    });
  }

  /**
   * Get optimization statistics
   * @returns Optimization stats
   */
  getOptimizationStats(): {
    strategiesCount: number;
    enabledStrategies: string[];
    resourceBlockPatterns: number;
    cacheHitRate: number;
  } {
    const enabledStrategies = Array.from(this.strategies.entries())
      .filter(([_key, strategy]) => strategy.enabled)
      .map(([key, _strategy]) => key);

    return {
      strategiesCount: this.strategies.size,
      enabledStrategies,
      resourceBlockPatterns: 10, // From ResourceBlockingStrategy
      cacheHitRate: this.calculateCacheHitRate(),
    };
  }

  /**
   * Get performance recommendations
   * @param action - Browser action
   * @param context - Execution context
   * @returns Performance recommendations
   */
  getPerformanceRecommendations(
    action: BrowserAction,
    context: ActionContext,
  ): string[] {
    const hints = this.getPerformanceHints(action, context);
    return this.analyzer.getRecommendations(hints);
  }

  /**
   * Calculate performance score
   * @param actualDuration - Actual execution duration
   * @param action - Browser action
   * @param context - Execution context
   * @returns Performance score (0-100)
   */
  calculatePerformanceScore(
    actualDuration: number,
    action: BrowserAction,
    context: ActionContext,
  ): number {
    const hints = this.getPerformanceHints(action, context);
    return this.analyzer.calculatePerformanceScore(actualDuration, hints.estimatedDuration);
  }

  /**
   * Initialize optimization strategies
   */
  private initializeStrategies(): void {
    // Load strategies from factory
    const actionTypes = ['navigate', 'screenshot', 'extractContent', 'extractText'];
    
    for (const actionType of actionTypes) {
      const strategy = OptimizationStrategyFactory.createStrategy(actionType);
      if (strategy) {
        this.strategies.set(actionType, strategy);
      }
    }
  }

  /**
   * Record cache usage
   * @param hit - Whether cache was used
   */
  private recordCacheUsage(hit: boolean): void {
    if (hit) {
      this.cacheHitCount++;
    } else {
      this.cacheMissCount++;
    }
  }

  /**
   * Calculate cache hit rate
   * @returns Cache hit rate percentage
   */
  private calculateCacheHitRate(): number {
    const total = this.cacheHitCount + this.cacheMissCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((this.cacheHitCount / total) * 100);
  }

  /**
   * Get internal components for testing
   * @internal
   */
  getInternalComponents(): {
    analyzer: PerformanceAnalyzer;
    strategies: Map<string, OptimizationStrategy>;
    resourceBlockingStrategy: ResourceBlockingStrategy;
  } {
    return {
      analyzer: this.analyzer,
      strategies: this.strategies,
      resourceBlockingStrategy: this.resourceBlockingStrategy,
    };
  }
}