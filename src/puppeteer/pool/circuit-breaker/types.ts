/**
 * Circuit breaker types and interfaces
 * @module puppeteer/pool/circuit-breaker/types
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit when half-open */
  successThreshold: number;
  /** Time window for failure counting (ms) */
  timeWindow: number;
  /** Timeout before trying half-open state (ms) */
  timeout: number;
  /** Monitor interval for state transitions (ms) */
  monitorInterval: number;
  /** Enable exponential backoff for timeout */
  exponentialBackoff: boolean;
  /** Maximum timeout for exponential backoff (ms) */
  maxTimeout: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Minimum requests before circuit can open */
  minimumThroughput: number;
  /** Enable circuit breaker */
  enabled: boolean;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  requestCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  stateChangeTime: Date;
  totalStateChanges: number;
  failureRate: number;
  averageResponseTime: number;
  circuitOpenCount: number;
  circuitHalfOpenCount: number;
  circuitCloseCount: number;
  currentTimeout: number;
}

/**
 * Circuit breaker event
 */
export interface CircuitBreakerEvent {
  type: 'state_change' | 'failure' | 'success' | 'timeout' | 'rejection';
  state: CircuitBreakerState;
  previousState?: CircuitBreakerState;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Execution result
 */
export interface ExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
  fromCache: boolean;
  circuitState: CircuitBreakerState;
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  name: string;
  state: CircuitBreakerState;
  enabled: boolean;
  healthy: boolean;
  lastError?: Error;
  metrics: CircuitBreakerMetrics;
}

/**
 * State transition context
 */
export interface StateTransitionContext {
  trigger?: string;
  forced?: boolean;
  reason?: string;
  reset?: boolean;
  successCount?: number;
  [key: string]: any;
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  result: T;
  timestamp: Date;
}

/**
 * Failure detection strategy interface
 */
export interface IFailureDetectionStrategy {
  shouldOpen(failures: Date[], requests: Date[], config: CircuitBreakerConfig): boolean;
  shouldTransitionToHalfOpen(
    state: CircuitBreakerState,
    lastStateChange: Date,
    config: CircuitBreakerConfig,
  ): boolean;
  shouldClose(successes: Date[], config: CircuitBreakerConfig): boolean;
}

/**
 * State handler interface
 */
export interface IStateHandler {
  canExecute(): boolean;
  handleSuccess(context: StateTransitionContext): CircuitBreakerState | null;
  handleFailure(context: StateTransitionContext): CircuitBreakerState | null;
  enter(context?: StateTransitionContext): void;
  exit(context?: StateTransitionContext): void;
}

/**
 * Event emitter interface for circuit breaker
 */
export interface ICircuitBreakerEventEmitter {
  emit(event: string, data: any): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
}
