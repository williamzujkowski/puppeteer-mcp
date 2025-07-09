/**
 * Circuit breaker patterns for failure handling in browser pool
 * @module puppeteer/pool/browser-pool-circuit-breaker
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 * @nist au-5 "Response to audit processing failures"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('browser-pool-circuit-breaker');

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
 * Circuit breaker for browser pool operations
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: Date[] = [];
  private successes: Date[] = [];
  private requests: Date[] = [];
  private stateChangeTime: Date = new Date();
  private totalStateChanges = 0;
  private circuitOpenCount = 0;
  private circuitHalfOpenCount = 0;
  private circuitCloseCount = 0;
  private currentTimeout: number;
  private timeoutId?: NodeJS.Timeout;
  private monitorInterval?: NodeJS.Timeout;
  private responseTimes: number[] = [];
  private fallbackCache: Map<string, { result: any; timestamp: Date }> = new Map();
  private readonly maxCacheSize = 100;
  private readonly maxResponseTimeHistory = 50;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {
    super();
    this.currentTimeout = config.timeout;
    this.startMonitoring();
  }

  /**
   * Execute operation with circuit breaker protection
   * @nist au-5 "Response to audit processing failures"
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    cacheKey?: string
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const requestTime = new Date();
    
    this.requests.push(requestTime);
    this.cleanupOldRequests();

    // Check circuit state
    if (this.state === CircuitBreakerState.OPEN) {
      return this.handleOpenCircuit(fallback, cacheKey, startTime);
    }

    try {
      const result = await operation();
      return await this.handleSuccess(result, startTime, cacheKey);
    } catch (error) {
      return this.handleFailure(error as Error, fallback, cacheKey, startTime);
    }
  }

  /**
   * Get current circuit breaker metrics
   * @nist au-3 "Content of audit records"
   */
  getMetrics(): CircuitBreakerMetrics {
    const now = new Date();
    const timeWindowStart = new Date(now.getTime() - this.config.timeWindow);
    
    const recentFailures = this.failures.filter(f => f > timeWindowStart);
    const recentSuccesses = this.successes.filter(s => s > timeWindowStart);
    const recentRequests = this.requests.filter(r => r > timeWindowStart);

    const totalRequests = recentRequests.length;
    const failureRate = totalRequests > 0 ? (recentFailures.length / totalRequests) * 100 : 0;
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    return {
      state: this.state,
      failureCount: recentFailures.length,
      successCount: recentSuccesses.length,
      requestCount: totalRequests,
      lastFailureTime: this.failures.length > 0 ? this.failures[this.failures.length - 1] ?? null : null,
      lastSuccessTime: this.successes.length > 0 ? this.successes[this.successes.length - 1] ?? null : null,
      stateChangeTime: this.stateChangeTime,
      totalStateChanges: this.totalStateChanges,
      failureRate,
      averageResponseTime,
      circuitOpenCount: this.circuitOpenCount,
      circuitHalfOpenCount: this.circuitHalfOpenCount,
      circuitCloseCount: this.circuitCloseCount,
      currentTimeout: this.currentTimeout,
    };
  }

  /**
   * Force circuit breaker state change
   * @nist au-5 "Response to audit processing failures"
   */
  forceState(newState: CircuitBreakerState, reason?: string): void {
    logger.info(
      {
        name: this.name,
        currentState: this.state,
        newState,
        reason,
      },
      'Circuit breaker state forced'
    );

    this.changeState(newState, { forced: true, reason });
  }

  /**
   * Reset circuit breaker metrics
   * @nist au-5 "Response to audit processing failures"
   */
  reset(): void {
    this.failures = [];
    this.successes = [];
    this.requests = [];
    this.responseTimes = [];
    this.fallbackCache.clear();
    this.currentTimeout = this.config.timeout;
    
    if (this.state !== CircuitBreakerState.CLOSED) {
      this.changeState(CircuitBreakerState.CLOSED, { reset: true });
    }

    logger.info(
      {
        name: this.name,
      },
      'Circuit breaker reset'
    );
  }

  /**
   * Update circuit breaker configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info(
      {
        name: this.name,
        oldConfig,
        newConfig: this.config,
        changes: Object.keys(newConfig),
      },
      'Circuit breaker configuration updated'
    );

    this.emit('config-updated', {
      name: this.name,
      oldConfig,
      newConfig: this.config,
    });
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitBreakerState;
    enabled: boolean;
    healthy: boolean;
    lastError?: Error;
    metrics: CircuitBreakerMetrics;
  } {
    const metrics = this.getMetrics();
    
    return {
      name: this.name,
      state: this.state,
      enabled: this.config.enabled,
      healthy: this.state === CircuitBreakerState.CLOSED && metrics.failureRate < 50,
      metrics,
    };
  }

  /**
   * Destroy circuit breaker
   */
  destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.removeAllListeners();
    this.fallbackCache.clear();
    
    logger.info(
      {
        name: this.name,
      },
      'Circuit breaker destroyed'
    );
  }

  /**
   * Handle successful execution
   * @private
   */
  private async handleSuccess<T>(
    result: T,
    startTime: number,
    cacheKey?: string
  ): Promise<ExecutionResult<T>> {
    const executionTime = Date.now() - startTime;
    const successTime = new Date();
    
    this.successes.push(successTime);
    this.responseTimes.push(executionTime);
    this.maintainResponseTimeHistory();

    // Cache successful result if key provided
    if (cacheKey) {
      this.cacheResult(cacheKey, result);
    }

    // Handle state transitions
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      const recentSuccesses = this.getRecentSuccesses();
      if (recentSuccesses.length >= this.config.successThreshold) {
        this.changeState(CircuitBreakerState.CLOSED, { 
          trigger: 'success_threshold_reached',
          successCount: recentSuccesses.length 
        });
      }
    }

    this.emitEvent({
      type: 'success',
      state: this.state,
      timestamp: successTime,
      context: { executionTime, cacheKey },
    });

    return {
      success: true,
      result,
      executionTime,
      fromCache: false,
      circuitState: this.state,
    };
  }

  /**
   * Handle failed execution
   * @private
   */
  private async handleFailure<T>(
    error: Error,
    fallback?: () => Promise<T>,
    cacheKey?: string,
    startTime?: number
  ): Promise<ExecutionResult<T>> {
    const executionTime = startTime ? Date.now() - startTime : 0;
    const failureTime = new Date();
    
    this.failures.push(failureTime);

    // Check if circuit should open
    if (this.state === CircuitBreakerState.CLOSED) {
      const recentFailures = this.getRecentFailures();
      const recentRequests = this.getRecentRequests();
      
      if (recentRequests.length >= this.config.minimumThroughput &&
          recentFailures.length >= this.config.failureThreshold) {
        this.openCircuit('failure_threshold_reached');
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state should open the circuit
      this.openCircuit('failure_in_half_open');
    }

    this.emitEvent({
      type: 'failure',
      state: this.state,
      timestamp: failureTime,
      error,
      context: { executionTime, cacheKey },
    });

    // Try fallback or cache
    if (fallback) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          result: fallbackResult,
          executionTime,
          fromCache: false,
          circuitState: this.state,
        };
      } catch (fallbackError) {
        logger.error(
          {
            name: this.name,
            originalError: error,
            fallbackError,
          },
          'Fallback execution failed'
        );
      }
    }

    // Try cache
    if (cacheKey) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          success: true,
          result: cachedResult,
          executionTime,
          fromCache: true,
          circuitState: this.state,
        };
      }
    }

    return {
      success: false,
      error,
      executionTime,
      fromCache: false,
      circuitState: this.state,
    };
  }

  /**
   * Handle open circuit
   * @private
   */
  private async handleOpenCircuit<T>(
    fallback?: () => Promise<T>,
    cacheKey?: string,
    startTime?: number
  ): Promise<ExecutionResult<T>> {
    const executionTime = startTime ? Date.now() - startTime : 0;
    
    this.emitEvent({
      type: 'rejection',
      state: this.state,
      timestamp: new Date(),
      context: { reason: 'circuit_open', cacheKey },
    });

    // Try fallback
    if (fallback) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          result: fallbackResult,
          executionTime,
          fromCache: false,
          circuitState: this.state,
        };
      } catch (fallbackError) {
        logger.debug(
          {
            name: this.name,
            fallbackError,
          },
          'Fallback execution failed in open circuit'
        );
      }
    }

    // Try cache
    if (cacheKey) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          success: true,
          result: cachedResult,
          executionTime,
          fromCache: true,
          circuitState: this.state,
        };
      }
    }

    return {
      success: false,
      error: new Error('Circuit breaker is open'),
      executionTime,
      fromCache: false,
      circuitState: this.state,
    };
  }

  /**
   * Open the circuit
   * @private
   */
  private openCircuit(reason: string): void {
    this.changeState(CircuitBreakerState.OPEN, { trigger: reason });
    this.scheduleHalfOpen();
  }

  /**
   * Change circuit state
   * @private
   */
  private changeState(newState: CircuitBreakerState, context?: Record<string, any>): void {
    if (this.state === newState) {
      return;
    }

    const previousState = this.state;
    this.state = newState;
    this.stateChangeTime = new Date();
    this.totalStateChanges++;

    // Update state counters
    switch (newState) {
      case CircuitBreakerState.OPEN:
        this.circuitOpenCount++;
        break;
      case CircuitBreakerState.HALF_OPEN:
        this.circuitHalfOpenCount++;
        break;
      case CircuitBreakerState.CLOSED:
        this.circuitCloseCount++;
        this.currentTimeout = this.config.timeout; // Reset timeout on close
        break;
    }

    logger.info(
      {
        name: this.name,
        previousState,
        newState,
        context,
      },
      'Circuit breaker state changed'
    );

    this.emitEvent({
      type: 'state_change',
      state: newState,
      previousState,
      timestamp: this.stateChangeTime,
      context,
    });
  }

  /**
   * Schedule transition to half-open state
   * @private
   */
  private scheduleHalfOpen(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        this.changeState(CircuitBreakerState.HALF_OPEN, { trigger: 'timeout' });
      }
    }, this.currentTimeout);

    // Apply exponential backoff
    if (this.config.exponentialBackoff) {
      this.currentTimeout = Math.min(
        this.currentTimeout * this.config.backoffMultiplier,
        this.config.maxTimeout
      );
    }

    this.emitEvent({
      type: 'timeout',
      state: this.state,
      timestamp: new Date(),
      context: { timeout: this.currentTimeout },
    });
  }

  /**
   * Start monitoring
   * @private
   */
  private startMonitoring(): void {
    if (!this.config.enabled) {
      return;
    }

    this.monitorInterval = setInterval(() => {
      this.cleanupOldRequests();
      this.cleanupOldFailures();
      this.cleanupOldSuccesses();
      this.cleanupCache();
    }, this.config.monitorInterval);
  }

  /**
   * Get recent failures
   * @private
   */
  private getRecentFailures(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.config.timeWindow);
    return this.failures.filter(f => f > timeWindowStart);
  }

  /**
   * Get recent successes
   * @private
   */
  private getRecentSuccesses(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.config.timeWindow);
    return this.successes.filter(s => s > timeWindowStart);
  }

  /**
   * Get recent requests
   * @private
   */
  private getRecentRequests(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.config.timeWindow);
    return this.requests.filter(r => r > timeWindowStart);
  }

  /**
   * Clean up old requests
   * @private
   */
  private cleanupOldRequests(): void {
    const cutoff = new Date(Date.now() - this.config.timeWindow);
    this.requests = this.requests.filter(r => r > cutoff);
  }

  /**
   * Clean up old failures
   * @private
   */
  private cleanupOldFailures(): void {
    const cutoff = new Date(Date.now() - this.config.timeWindow);
    this.failures = this.failures.filter(f => f > cutoff);
  }

  /**
   * Clean up old successes
   * @private
   */
  private cleanupOldSuccesses(): void {
    const cutoff = new Date(Date.now() - this.config.timeWindow);
    this.successes = this.successes.filter(s => s > cutoff);
  }

  /**
   * Maintain response time history
   * @private
   */
  private maintainResponseTimeHistory(): void {
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimeHistory);
    }
  }

  /**
   * Cache result
   * @private
   */
  private cacheResult(key: string, result: any): void {
    this.fallbackCache.set(key, {
      result,
      timestamp: new Date(),
    });

    // Maintain cache size
    if (this.fallbackCache.size > this.maxCacheSize) {
      const oldestKey = this.fallbackCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.fallbackCache.delete(oldestKey);
      }
    }
  }

  /**
   * Get cached result
   * @private
   */
  private getCachedResult(key: string): any | null {
    const cached = this.fallbackCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid (1 hour TTL)
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - cached.timestamp.getTime() > maxAge) {
      this.fallbackCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Clean up cache
   * @private
   */
  private cleanupCache(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [key, value] of this.fallbackCache.entries()) {
      if (value.timestamp < cutoff) {
        this.fallbackCache.delete(key);
      }
    }
  }

  /**
   * Emit circuit breaker event
   * @private
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.emit('circuit-breaker-event', {
      name: this.name,
      ...event,
    });
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 * @nist au-3 "Content of audit records"
 */
export class CircuitBreakerRegistry {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private globalConfig: CircuitBreakerConfig;

  constructor(globalConfig: Partial<CircuitBreakerConfig> = {}) {
    this.globalConfig = {
      failureThreshold: 5,
      successThreshold: 3,
      timeWindow: 60000, // 1 minute
      timeout: 30000, // 30 seconds
      monitorInterval: 5000, // 5 seconds
      exponentialBackoff: true,
      maxTimeout: 300000, // 5 minutes
      backoffMultiplier: 2,
      minimumThroughput: 3,
      enabled: true,
      ...globalConfig,
    };
  }

  /**
   * Get or create circuit breaker
   * @nist au-3 "Content of audit records"
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(name);
    
    if (!circuitBreaker) {
      const mergedConfig = { ...this.globalConfig, ...config };
      circuitBreaker = new CircuitBreaker(name, mergedConfig);
      this.circuitBreakers.set(name, circuitBreaker);
      
      logger.info(
        {
          name,
          config: mergedConfig,
        },
        'Circuit breaker created'
      );
    }

    return circuitBreaker;
  }

  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      this.circuitBreakers.delete(name);
      logger.info({ name }, 'Circuit breaker removed');
      return true;
    }
    return false;
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get registry status
   */
  getStatus(): {
    totalCircuitBreakers: number;
    healthyCircuitBreakers: number;
    openCircuitBreakers: number;
    circuitBreakers: Array<{ name: string; state: CircuitBreakerState; healthy: boolean }>;
  } {
    const circuitBreakers = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => {
      const status = cb.getStatus();
      return {
        name,
        state: status.state,
        healthy: status.healthy,
      };
    });

    return {
      totalCircuitBreakers: this.circuitBreakers.size,
      healthyCircuitBreakers: circuitBreakers.filter(cb => cb.healthy).length,
      openCircuitBreakers: circuitBreakers.filter(cb => cb.state === CircuitBreakerState.OPEN).length,
      circuitBreakers,
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Update global configuration
   */
  updateGlobalConfig(config: Partial<CircuitBreakerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    logger.info(
      {
        config: this.globalConfig,
      },
      'Global circuit breaker configuration updated'
    );
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
    logger.info('Circuit breaker registry destroyed');
  }
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeWindow: 60000,
  timeout: 30000,
  monitorInterval: 5000,
  exponentialBackoff: true,
  maxTimeout: 300000,
  backoffMultiplier: 2,
  minimumThroughput: 3,
  enabled: true,
};