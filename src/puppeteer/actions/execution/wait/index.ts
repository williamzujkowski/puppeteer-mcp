/**
 * Wait executor module exports
 * @module puppeteer/actions/execution/wait
 * @nist ac-3 "Access enforcement"
 */

// Export main executor
export { ModularWaitExecutor } from './wait-executor.js';

// Export types
export type {
  WaitStrategy,
  WaitResult,
  WaitExecutorConfig,
  FunctionValidationResult,
} from './types.js';

// Export strategies
export { BaseWaitStrategy } from './base-strategy.js';
export { SelectorWaitStrategy, ExtendedSelectorWaitStrategy } from './selector-strategy.js';
export { NavigationWaitStrategy, NetworkIdleWaitStrategy, type NavigationWaitUntil } from './navigation-strategy.js';
export { TimeoutWaitStrategy } from './timeout-strategy.js';
export { FunctionWaitStrategy } from './function-strategy.js';
export { LoadStateWaitStrategy } from './load-strategy.js';

// Export factory
export { WaitStrategyFactory, type StrategyFactoryConfig } from './strategy-factory.js';

// Re-export as default for backward compatibility
export { ModularWaitExecutor as default } from './wait-executor.js';