/**
 * Evaluation execution module exports
 * @module puppeteer/actions/execution/evaluation
 * @nist ac-3 "Access enforcement"
 */

// Type exports
export type {
  BaseEvaluationConfig,
  CodeEvaluationConfig,
  InjectionConfig,
  SecurityValidationResult,
  SecurityIssue,
  EvaluationMetrics,
  SecurityValidator,
  EvaluationStrategyFactory,
  ResultConfig,
} from './types.js';

export {
  BaseEvaluationStrategy,
  EVALUATION_TIMEOUTS,
  SIZE_LIMITS,
  DANGEROUS_JS_PATTERNS,
  DANGEROUS_CSS_PATTERNS,
} from './types.js';

// Security validator exports
export {
  CodeSecurityValidator,
  createSecurityValidator,
} from './security-validator.js';

// Strategy exports
export {
  CodeExecutionStrategy,
  createCodeExecutionStrategy,
} from './code-executor.js';

export {
  HandleExecutionStrategy,
  createHandleExecutionStrategy,
} from './handle-executor.js';

export {
  InjectionExecutionStrategy,
  createInjectionExecutionStrategy,
} from './injection-executor.js';

// Factory exports
export {
  EvaluationStrategyFactoryImpl,
  getStrategyFactory,
  createStrategyFactory,
  createStrategyForAction,
  resetStrategyFactory,
  getStrategyMetrics,
} from './strategy-factory.js';

// Convenience re-exports for common use cases
export {
  getStrategyFactory as getFactory,
  createStrategyForAction as createStrategy,
} from './strategy-factory.js';

export {
  createSecurityValidator as createValidator,
} from './security-validator.js';