/**
 * Circuit breaker module exports
 * @module puppeteer/pool/circuit-breaker
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

// Core exports
export { CircuitBreaker } from './circuit-breaker-core.js';
export { CircuitBreakerRegistry } from './registry.js';

// Type exports
export { CircuitBreakerState } from './types.js';

export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerStatus,
  ExecutionResult,
  StateTransitionContext,
  IFailureDetectionStrategy,
  IStateHandler,
  ICircuitBreakerEventEmitter,
} from './types.js';

// Configuration exports
export { ConfigValidator, ConfigManager } from './config.js';

export {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CONFIG_PRESETS,
  getPreset,
  mergeWithPreset,
  getPresetNames,
  isValidPreset,
} from './config-presets.js';

// State management exports
export {
  CircuitBreakerStateMachine,
  ClosedStateHandler,
  OpenStateHandler,
  HalfOpenStateHandler,
} from './state-management.js';

// Failure detection exports
export {
  BaseFailureDetectionStrategy,
  ThresholdFailureDetectionStrategy,
  FailureDetectionStrategyFactory,
} from './failure-detection.js';

export {
  PercentageFailureDetectionStrategy,
  ConsecutiveFailuresDetectionStrategy,
  AdaptiveFailureDetectionStrategy,
} from './failure-strategies.js';

// Metrics exports
export { MetricsCollector } from './metrics-monitor.js';

export { PerformanceMonitor, DEFAULT_PERFORMANCE_THRESHOLDS } from './performance-monitor.js';

export type { PerformanceThresholds } from './performance-monitor.js';

// Cache exports
export { CacheManager, DEFAULT_CACHE_CONFIG } from './cache-manager.js';

export type { CacheConfig } from './cache-manager.js';

export { CacheOperations } from './cache-operations.js';

export type { CacheStats } from './cache-operations.js';

// Event system exports
export { EventAggregator } from './event-system.js';

export type { IEventHandler, IEventFilter } from './event-system.js';

export {
  BaseEventHandler,
  LoggingEventHandler,
  MetricsEventHandler,
  AlertEventHandler,
  StateChangeEventFilter,
  TimeBasedEventFilter,
  EventTypeFilter,
  CompositeEventFilter,
} from './event-handlers.js';

// Timeout management exports
export { TimeoutManager, AdaptiveTimeoutManager } from './timeout-manager.js';

export type { ITimeoutStrategy } from './timeout-manager.js';

export {
  FixedTimeoutStrategy,
  ExponentialBackoffStrategy,
  LinearBackoffStrategy,
  JitteredBackoffStrategy,
  FibonacciBackoffStrategy,
  DecorrelatedJitterStrategy,
} from './timeout-strategies.js';

// Registry exports
export type { RegistryStatus, RegistryOptions } from './registry.js';

export {
  findByState,
  findUnhealthy,
  calculateAggregatedMetrics,
  exportRegistryState,
  applyConfigToAll,
  resetAll,
  evictCircuitBreaker,
} from './registry-utils.js';

export type { RegistryExportData } from './registry-utils.js';

// Execution handler exports
export { ExecutionHandler } from './execution-handler.js';

// Setup exports
export {
  setupEventHandling,
  startMonitoring,
  handleStateTransition,
  initializeComponents,
} from './circuit-breaker-setup.js';
