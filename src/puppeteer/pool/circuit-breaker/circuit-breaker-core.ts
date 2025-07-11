/**
 * Core circuit breaker implementation
 * @module puppeteer/pool/circuit-breaker/circuit-breaker-core
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import { EventEmitter } from 'events';
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
  CircuitBreakerStatus,
  ExecutionResult,
  CircuitBreakerEvent,
  StateTransitionContext,
} from './types.js';
import { CircuitBreakerStateMachine } from './state-management.js';
import { FailureDetectionStrategyFactory } from './failure-detection.js';
import { MetricsCollector, PerformanceMonitor } from './metrics-monitor.js';
import { CacheManager } from './cache-manager.js';
import { EventAggregator } from './event-system.js';
import { ConfigManager } from './config.js';
import { TimeoutManager } from './timeout-manager.js';
import { ExecutionHandler } from './execution-handler.js';
import { createLogger } from '../../../utils/logger.js';
import { handleStateTransition } from './circuit-breaker-setup.js';

const logger = createLogger('circuit-breaker-core');

/**
 * Core circuit breaker implementation
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */
export class CircuitBreaker extends EventEmitter {
  private stateMachine: CircuitBreakerStateMachine;
  private metricsCollector: MetricsCollector;
  private performanceMonitor: PerformanceMonitor;
  private cacheManager: CacheManager;
  private eventAggregator: EventAggregator;
  private configManager: ConfigManager;
  private timeoutManager: TimeoutManager;
  private executionHandler: ExecutionHandler;
  private failureDetectionStrategy;
  private monitorInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    config: CircuitBreakerConfig,
  ) {
    super();

    // Initialize components
    this.configManager = new ConfigManager(name, config);
    this.stateMachine = new CircuitBreakerStateMachine(name);
    this.metricsCollector = new MetricsCollector(name, config.timeWindow);
    this.performanceMonitor = new PerformanceMonitor(name, this.metricsCollector);
    this.cacheManager = new CacheManager(name);
    this.eventAggregator = new EventAggregator(name);
    this.timeoutManager = new TimeoutManager(name, config, () => this.handleTimeout());
    this.failureDetectionStrategy = FailureDetectionStrategyFactory.getStrategy('threshold');
    this.executionHandler = new ExecutionHandler(
      name,
      this.stateMachine,
      this.metricsCollector,
      this.cacheManager,
      (event: CircuitBreakerEvent) => this.emitEvent(event),
    );

    logger.info(
      {
        circuitBreaker: name,
        config,
      },
      'Circuit breaker initialized',
    );
  }

  /**
   * Execute operation with circuit breaker protection
   * @nist au-5 "Response to audit processing failures"
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    cacheKey?: string,
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();

    // Record request
    this.metricsCollector.recordRequest();

    // Check if circuit allows execution
    if (!this.stateMachine.canExecute()) {
      return this.executionHandler.handleOpenCircuit(fallback, cacheKey, startTime);
    }

    try {
      const result = await operation();
      const executionResult = await this.executionHandler.handleSuccess(
        result,
        startTime,
        cacheKey,
        this.failureDetectionStrategy,
        this.configManager.getConfig(),
      );

      // Handle state transition if needed
      const { newState, context } = executionResult as any;
      if (newState) {
        handleStateTransition(
          newState,
          context,
          this.stateMachine,
          this.timeoutManager,
          (event: CircuitBreakerEvent) => this.emitEvent(event),
        );
      }

      return executionResult;
    } catch (error) {
      const executionResult = await this.executionHandler.handleFailure(
        error as Error,
        fallback,
        cacheKey,
        startTime,
        this.failureDetectionStrategy,
        this.configManager.getConfig(),
      );

      // Handle state transition if needed
      const { newState, context } = executionResult as any;
      if (newState) {
        handleStateTransition(
          newState,
          context,
          this.stateMachine,
          this.timeoutManager,
          (event: CircuitBreakerEvent) => this.emitEvent(event),
        );
      }

      return executionResult;
    }
  }

  /**
   * Get current circuit breaker metrics
   * @nist au-3 "Content of audit records"
   */
  getMetrics(): CircuitBreakerMetrics {
    const stateMetrics = this.stateMachine.getStateMetrics();
    const timeoutStatus = this.timeoutManager.getStatus();

    return this.metricsCollector.getMetrics(
      this.stateMachine.getState(),
      stateMetrics,
      timeoutStatus.currentTimeout,
    );
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): CircuitBreakerStatus {
    const metrics = this.getMetrics();
    const config = this.configManager.getConfig();
    const performanceSummary = this.performanceMonitor.getPerformanceSummary(metrics);

    return {
      name: this.name,
      state: this.stateMachine.getState(),
      enabled: config.enabled,
      healthy: performanceSummary.healthy,
      metrics,
    };
  }

  /**
   * Force circuit breaker state change
   * @nist au-5 "Response to audit processing failures"
   */
  forceState(newState: CircuitBreakerState, reason?: string): void {
    logger.info(
      {
        circuitBreaker: this.name,
        currentState: this.stateMachine.getState(),
        newState,
        reason,
      },
      'Forcing circuit breaker state change',
    );

    this.stateMachine.forceState(newState, reason);

    // Handle state-specific actions
    handleStateTransition(
      newState,
      { forced: true, reason },
      this.stateMachine,
      this.timeoutManager,
      (event: CircuitBreakerEvent) => this.emitEvent(event),
    );
  }

  /**
   * Reset circuit breaker
   * @nist au-5 "Response to audit processing failures"
   */
  reset(): void {
    this.stateMachine.reset();
    this.metricsCollector.reset();
    this.cacheManager.clear();
    this.timeoutManager.reset();
    this.eventAggregator.clearHistory();

    logger.info(
      {
        circuitBreaker: this.name,
      },
      'Circuit breaker reset',
    );

    this.emitEvent({
      type: 'state_change',
      state: CircuitBreakerState.CLOSED,
      timestamp: new Date(),
      context: { reset: true },
    });
  }

  /**
   * Update circuit breaker configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    const result = this.configManager.updateConfig(newConfig);

    if (result.success) {
      const updatedConfig = this.configManager.getConfig();
      this.timeoutManager.updateConfig(updatedConfig);

      this.emit('config-updated', {
        name: this.name,
        config: updatedConfig,
      });
    }
  }

  /**
   * Destroy circuit breaker
   */
  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.timeoutManager.destroy();
    this.metricsCollector.destroy();
    this.performanceMonitor.destroy();
    this.cacheManager.destroy();
    this.eventAggregator.destroy();
    this.removeAllListeners();

    logger.info(
      {
        circuitBreaker: this.name,
      },
      'Circuit breaker destroyed',
    );
  }

  /**
   * Handle timeout (transition to half-open)
   * @private
   */
  private handleTimeout(): void {
    if (this.stateMachine.getState() === CircuitBreakerState.OPEN) {
      const context: StateTransitionContext = { trigger: 'timeout' };
      handleStateTransition(
        CircuitBreakerState.HALF_OPEN,
        context,
        this.stateMachine,
        this.timeoutManager,
        (event: CircuitBreakerEvent) => this.emitEvent(event),
      );
    }
  }

  /**
   * Emit circuit breaker event
   * @private
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.eventAggregator.processEvent({
      ...event,
      name: this.name,
    } as CircuitBreakerEvent & { name: string });
  }
}
