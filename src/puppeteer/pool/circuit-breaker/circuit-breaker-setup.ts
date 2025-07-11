/**
 * Circuit breaker setup and monitoring utilities
 * @module puppeteer/pool/circuit-breaker/circuit-breaker-setup
 * @nist si-4 "Information system monitoring"
 */

import { CircuitBreakerConfig, CircuitBreakerState } from './types.js';
import { CircuitBreakerStateMachine } from './state-management.js';
import { EventAggregator } from './event-system.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { TimeoutManager } from './timeout-manager.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-setup');

/**
 * Setup event handling for circuit breaker
 */
export function setupEventHandling(
  eventAggregator: EventAggregator,
  performanceMonitor: PerformanceMonitor,
  emitter: { emit: (event: string, data: any) => boolean },
): void {
  // Forward events from components
  eventAggregator.on('circuit-breaker-event', (event) => {
    emitter.emit('circuit-breaker-event', event);
  });

  performanceMonitor.on('high-response-time', (data) => {
    emitter.emit('performance-warning', data);
  });

  performanceMonitor.on('high-failure-rate', (data) => {
    emitter.emit('performance-warning', data);
  });

  performanceMonitor.on('low-throughput', (data) => {
    emitter.emit('performance-warning', data);
  });
}

/**
 * Start monitoring for circuit breaker
 */
export function startMonitoring(
  config: CircuitBreakerConfig,
  stateMachine: CircuitBreakerStateMachine,
  timeoutManager: TimeoutManager,
  failureDetectionStrategy: any,
  onMonitorCheck: () => void,
): NodeJS.Timeout | undefined {
  if (!config.enabled) {
    return undefined;
  }

  return setInterval(() => {
    // Check for half-open transition
    if (stateMachine.getState() === CircuitBreakerState.OPEN) {
      const shouldTransition = failureDetectionStrategy.shouldTransitionToHalfOpen(
        stateMachine.getState(),
        stateMachine.getStateMetrics().stateChangeTime,
        config,
      );

      if (shouldTransition && !timeoutManager.getStatus().hasActiveTimeout) {
        // Timeout might have been missed, schedule it
        timeoutManager.scheduleTimeout(CircuitBreakerState.OPEN);
      }
    }

    // Call additional monitor check if provided
    if (onMonitorCheck) {
      onMonitorCheck();
    }
  }, config.monitorInterval);
}

/**
 * Handle state transition
 */
export function handleStateTransition(
  newState: CircuitBreakerState,
  context: any,
  stateMachine: CircuitBreakerStateMachine,
  timeoutManager: TimeoutManager,
  emitEvent: (event: any) => void,
): void {
  const previousState = stateMachine.getState();
  const transitioned = stateMachine.transition(newState, context);

  if (transitioned) {
    // Handle state-specific actions
    if (newState === CircuitBreakerState.OPEN) {
      timeoutManager.scheduleTimeout(newState);
    } else if (newState === CircuitBreakerState.CLOSED) {
      timeoutManager.reset();
    }

    emitEvent({
      type: 'state_change',
      state: newState,
      previousState,
      timestamp: new Date(),
      context,
    });
  }
}

/**
 * Initialize circuit breaker components
 */
export function initializeComponents(
  name: string,
  config: CircuitBreakerConfig,
): {
  onTimeout: () => void;
  onMonitorCheck: () => void;
} {
  logger.info(
    {
      circuitBreaker: name,
      config,
    },
    'Initializing circuit breaker components',
  );

  return {
    onTimeout: () => {
      logger.debug(
        {
          circuitBreaker: name,
        },
        'Timeout callback triggered',
      );
    },
    onMonitorCheck: () => {
      // Additional monitoring logic can be added here
    },
  };
}
