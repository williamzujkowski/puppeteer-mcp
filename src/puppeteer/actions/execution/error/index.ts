/**
 * Error handling module exports
 * @module puppeteer/actions/execution/error
 * @nist si-11 "Error handling"
 */

export { ErrorClassifier } from './error-classifier.js';
export { 
  type RetryStrategy,
  BaseRetryStrategy,
  ExponentialBackoffStrategy,
  LinearRetryStrategy,
  FibonacciRetryStrategy,
  AdaptiveRetryStrategy,
  RetryStrategyFactory,
} from './retry-strategy.js';
export { SecurityEventHandler } from './security-event-handler.js';
export {
  type RecoveryStrategy,
  BaseRecoveryStrategy,
  ElementNotFoundRecovery,
  NavigationFailureRecovery,
  TimeoutRecovery,
  ErrorRecoveryChain,
  RecoveryChainFactory,
} from './error-recovery.js';
export { 
  RetryExecutor,
  type RetryExecutionOptions,
  type ExecuteParams,
} from './retry-executor.js';
export { ErrorResultFactory } from './error-result-factory.js';