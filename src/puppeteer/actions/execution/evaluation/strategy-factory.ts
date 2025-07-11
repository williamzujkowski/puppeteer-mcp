/**
 * Factory for creating evaluation execution strategies
 * @module puppeteer/actions/execution/evaluation/strategy-factory
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 */

import type { BaseEvaluationStrategy, EvaluationStrategyFactory } from './types.js';
import { createCodeExecutionStrategy } from './code-executor.js';
import { createHandleExecutionStrategy } from './handle-executor.js';
import { createInjectionExecutionStrategy } from './injection-executor.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:strategy-factory');

/**
 * Implementation of evaluation strategy factory
 * @nist ac-3 "Access enforcement"
 */
export class EvaluationStrategyFactoryImpl implements EvaluationStrategyFactory {
  private readonly strategies = new Map<string, () => BaseEvaluationStrategy>();
  private readonly instanceCache = new Map<string, BaseEvaluationStrategy>();

  constructor() {
    this.registerStrategies();
  }

  /**
   * Create appropriate strategy for evaluation type
   * @param type - Type of evaluation
   * @returns Evaluation strategy instance
   * @throws {Error} If strategy type is not supported
   */
  createStrategy(type: string): BaseEvaluationStrategy {
    logger.debug('Creating evaluation strategy', { type });

    // Check cache first for reusable strategies
    const cachedStrategy = this.instanceCache.get(type);
    if (cachedStrategy) {
      logger.debug('Using cached strategy instance', { type });
      return cachedStrategy;
    }

    // Create new strategy
    const strategyFactory = this.strategies.get(type);
    if (!strategyFactory) {
      const supportedTypes = this.getSupportedTypes();
      logger.error('Unsupported evaluation strategy type', {
        type,
        supportedTypes,
      });
      throw new Error(
        `Unsupported evaluation strategy type: ${type}. ` +
          `Supported types: ${supportedTypes.join(', ')}`,
      );
    }

    const strategy = strategyFactory();

    // Cache certain strategies that are stateless
    if (this.isStatelessStrategy(type)) {
      this.instanceCache.set(type, strategy);
    }

    logger.debug('Created new strategy instance', { type });
    return strategy;
  }

  /**
   * Get all supported evaluation types
   * @returns Array of supported types
   */
  getSupportedTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Register a custom strategy
   * @param type - Strategy type identifier
   * @param factory - Factory function for creating strategy instances
   */
  registerStrategy(type: string, factory: () => BaseEvaluationStrategy): void {
    logger.debug('Registering custom strategy', { type });
    this.strategies.set(type, factory);

    // Clear cache for this type
    this.instanceCache.delete(type);
  }

  /**
   * Unregister a strategy
   * @param type - Strategy type to unregister
   * @returns True if strategy was removed
   */
  unregisterStrategy(type: string): boolean {
    logger.debug('Unregistering strategy', { type });

    // Clear from cache
    this.instanceCache.delete(type);

    return this.strategies.delete(type);
  }

  /**
   * Check if a strategy type is supported
   * @param type - Strategy type to check
   * @returns True if supported
   */
  isSupported(type: string): boolean {
    return this.strategies.has(type);
  }

  /**
   * Clear all cached strategy instances
   */
  clearCache(): void {
    logger.debug('Clearing strategy cache', {
      cachedCount: this.instanceCache.size,
    });
    this.instanceCache.clear();
  }

  /**
   * Get strategy information for monitoring
   * @returns Strategy information object
   */
  getStrategyInfo(): {
    supportedTypes: string[];
    cachedInstances: string[];
    totalStrategies: number;
  } {
    return {
      supportedTypes: this.getSupportedTypes(),
      cachedInstances: Array.from(this.instanceCache.keys()),
      totalStrategies: this.strategies.size,
    };
  }

  /**
   * Register built-in strategies
   * @private
   */
  private registerStrategies(): void {
    logger.debug('Registering built-in evaluation strategies');

    // Code evaluation strategies
    this.strategies.set('evaluate', createCodeExecutionStrategy);
    this.strategies.set('code', createCodeExecutionStrategy);

    // Handle evaluation strategies
    this.strategies.set('evaluateHandle', createHandleExecutionStrategy);
    this.strategies.set('handle', createHandleExecutionStrategy);

    // Injection strategies
    this.strategies.set('injectScript', createInjectionExecutionStrategy);
    this.strategies.set('injectCSS', createInjectionExecutionStrategy);
    this.strategies.set('inject', createInjectionExecutionStrategy);

    logger.debug('Registered evaluation strategies', {
      count: this.strategies.size,
      types: Array.from(this.strategies.keys()),
    });
  }

  /**
   * Check if a strategy is stateless and can be cached
   * @param type - Strategy type
   * @returns True if strategy is stateless
   */
  private isStatelessStrategy(type: string): boolean {
    // Handle strategies maintain state (active handles), so they shouldn't be cached
    const statefulStrategies = ['evaluateHandle', 'handle'];
    return !statefulStrategies.includes(type);
  }
}

/**
 * Singleton pattern for strategy factory
 */
class StrategyFactorySingleton {
  private static instance: EvaluationStrategyFactoryImpl | undefined;

  static getInstance(): EvaluationStrategyFactoryImpl {
    this.instance ??= new EvaluationStrategyFactoryImpl();
    return this.instance;
  }

  static resetInstance(): void {
    this.instance = undefined;
  }
}

/**
 * Get the global strategy factory instance
 * @returns Global strategy factory instance
 */
export function getStrategyFactory(): EvaluationStrategyFactory {
  return StrategyFactorySingleton.getInstance();
}

/**
 * Create a new strategy factory instance (for testing or isolation)
 * @returns New strategy factory instance
 */
export function createStrategyFactory(): EvaluationStrategyFactory {
  return new EvaluationStrategyFactoryImpl();
}

/**
 * Create strategy based on action type with automatic type mapping
 * @param actionType - Action type from browser action
 * @returns Appropriate evaluation strategy
 */
export function createStrategyForAction(actionType: string): BaseEvaluationStrategy {
  const factory = getStrategyFactory();

  // Map action types to strategy types
  const typeMapping: Record<string, string> = {
    evaluate: 'evaluate',
    evaluateHandle: 'evaluateHandle',
    injectScript: 'injectScript',
    injectCSS: 'injectCSS',
    inject: 'inject',
  };

  const knownMappings = new Map(Object.entries(typeMapping));
  const strategyType = knownMappings.get(actionType) ?? actionType;
  return factory.createStrategy(strategyType);
}

/**
 * Reset the global strategy factory (useful for testing)
 */
export function resetStrategyFactory(): void {
  StrategyFactorySingleton.resetInstance();
}

/**
 * Get comprehensive strategy information
 * @returns Detailed information about all available strategies
 */
export function getStrategyMetrics(): {
  factory: ReturnType<EvaluationStrategyFactoryImpl['getStrategyInfo']>;
  supportedActionTypes: string[];
  mappings: Record<string, string>;
} {
  const factory = getStrategyFactory() as EvaluationStrategyFactoryImpl;

  return {
    factory: factory.getStrategyInfo(),
    supportedActionTypes: ['evaluate', 'evaluateHandle', 'injectScript', 'injectCSS', 'inject'],
    mappings: {
      evaluate: 'evaluate',
      evaluateHandle: 'evaluateHandle',
      injectScript: 'injectScript',
      injectCSS: 'injectCSS',
      inject: 'inject',
    },
  };
}
