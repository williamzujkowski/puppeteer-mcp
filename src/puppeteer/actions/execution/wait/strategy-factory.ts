/**
 * Wait strategy factory
 * @module puppeteer/actions/execution/wait/strategy-factory
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { WaitCondition } from '../types.js';
import type { WaitStrategy } from './types.js';
import { SelectorWaitStrategy } from './selector-strategy.js';
import { NavigationWaitStrategy, NetworkIdleWaitStrategy } from './navigation-strategy.js';
import { TimeoutWaitStrategy } from './timeout-strategy.js';
import { FunctionWaitStrategy } from './function-strategy.js';
import { LoadStateWaitStrategy } from './load-strategy.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:wait:factory');

/**
 * Wait strategy factory configuration
 */
export interface StrategyFactoryConfig {
  /** Enable security validation for function strategies */
  enableFunctionSecurity?: boolean;
  /** Custom strategies to register */
  customStrategies?: Map<WaitCondition, WaitStrategy>;
}

/**
 * Factory for creating wait strategies
 * @nist ac-3 "Access enforcement"
 */
export class WaitStrategyFactory {
  private readonly strategies: Map<WaitCondition, WaitStrategy>;

  constructor(config: StrategyFactoryConfig = {}) {
    this.strategies = new Map();
    this.initializeStrategies(config);

    // Register custom strategies if provided
    if (config.customStrategies) {
      config.customStrategies.forEach((strategy, type) => {
        this.registerStrategy(type, strategy);
      });
    }
  }

  /**
   * Initialize default strategies
   */
  private initializeStrategies(config: StrategyFactoryConfig): void {
    // Register default strategies
    this.strategies.set('selector', new SelectorWaitStrategy());
    this.strategies.set('navigation', new NavigationWaitStrategy());
    this.strategies.set('timeout', new TimeoutWaitStrategy());
    this.strategies.set(
      'function',
      new FunctionWaitStrategy(config.enableFunctionSecurity ?? true),
    );
    this.strategies.set('load', new LoadStateWaitStrategy());
    this.strategies.set('networkidle', new NetworkIdleWaitStrategy());

    logger.debug('Initialized wait strategies', {
      strategies: Array.from(this.strategies.keys()),
    });
  }

  /**
   * Get strategy for wait condition
   * @param type - Wait condition type
   * @returns Wait strategy
   * @throws Error if strategy not found
   */
  getStrategy(type: WaitCondition): WaitStrategy {
    const strategy = this.strategies.get(type);

    if (!strategy) {
      const available = Array.from(this.strategies.keys()).join(', ');
      throw new Error(`No strategy found for wait type: ${type}. Available: ${available}`);
    }

    return strategy;
  }

  /**
   * Register a custom strategy
   * @param type - Wait condition type
   * @param strategy - Wait strategy implementation
   */
  registerStrategy(type: WaitCondition, strategy: WaitStrategy): void {
    if (this.strategies.has(type)) {
      logger.warn('Overriding existing strategy', { type });
    }

    this.strategies.set(type, strategy);
    logger.info('Registered wait strategy', { type });
  }

  /**
   * Check if strategy exists
   * @param type - Wait condition type
   * @returns true if strategy exists
   */
  hasStrategy(type: WaitCondition): boolean {
    return this.strategies.has(type);
  }

  /**
   * Get all registered strategy types
   * @returns Array of wait condition types
   */
  getRegisteredTypes(): WaitCondition[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Create a new factory instance with default configuration
   * @returns Factory instance
   */
  static createDefault(): WaitStrategyFactory {
    return new WaitStrategyFactory({
      enableFunctionSecurity: true,
    });
  }

  /**
   * Create a new factory instance for testing (with security disabled)
   * @returns Factory instance
   */
  static createForTesting(): WaitStrategyFactory {
    return new WaitStrategyFactory({
      enableFunctionSecurity: false,
    });
  }
}
