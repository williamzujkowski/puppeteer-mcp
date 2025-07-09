/**
 * Event handler implementations for circuit breaker
 * @module puppeteer/pool/circuit-breaker/event-handlers
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { CircuitBreakerEvent, CircuitBreakerState } from './types.js';
import { IEventHandler, IEventFilter } from './event-system.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-event-handlers');

/**
 * Base event handler
 */
export abstract class BaseEventHandler implements IEventHandler {
  constructor(protected name: string) {}
  
  abstract handle(event: CircuitBreakerEvent): void | Promise<void>;
}

/**
 * Logging event handler
 * @nist au-3 "Content of audit records"
 */
export class LoggingEventHandler extends BaseEventHandler {
  constructor() {
    super('logging');
  }

  handle(event: CircuitBreakerEvent): void {
    const logData = {
      type: event.type,
      state: event.state,
      previousState: event.previousState,
      timestamp: event.timestamp,
      context: event.context,
      error: event.error?.message,
    };

    switch (event.type) {
      case 'state_change':
        logger.info(logData, 'Circuit breaker state changed');
        break;
      case 'failure':
        logger.warn(logData, 'Circuit breaker operation failed');
        break;
      case 'rejection':
        logger.debug(logData, 'Circuit breaker rejected operation');
        break;
      case 'success':
        logger.debug(logData, 'Circuit breaker operation succeeded');
        break;
      case 'timeout':
        logger.info(logData, 'Circuit breaker timeout occurred');
        break;
      default:
        logger.debug(logData, 'Circuit breaker event');
    }
  }
}

/**
 * Metrics event handler
 * @nist si-4 "Information system monitoring"
 */
export class MetricsEventHandler extends BaseEventHandler {
  private eventCounts: Map<string, number> = new Map();

  constructor() {
    super('metrics');
  }

  handle(event: CircuitBreakerEvent): void {
    const key = `${event.type}_${event.state}`;
    const currentCount = this.eventCounts.get(key) || 0;
    this.eventCounts.set(key, currentCount + 1);
  }

  getEventCounts(): Map<string, number> {
    return new Map(this.eventCounts);
  }

  reset(): void {
    this.eventCounts.clear();
  }
}

/**
 * Alert event handler
 */
export class AlertEventHandler extends BaseEventHandler {
  private recentRejections: Date[] = [];
  private lastOpenTime?: Date;

  constructor(
    private alertThresholds = {
      consecutiveFailures: 10,
      openStateDuration: 300000, // 5 minutes
      rejectionRate: 0.8, // 80%
    }
  ) {
    super('alert');
  }

  handle(event: CircuitBreakerEvent): void {
    switch (event.type) {
      case 'state_change':
        if (event.state === CircuitBreakerState.OPEN) {
          this.lastOpenTime = event.timestamp;
          this.emitAlert('circuit_opened', {
            previousState: event.previousState,
            reason: event.context?.trigger,
          });
        }
        break;

      case 'rejection':
        this.recentRejections.push(event.timestamp);
        this.checkRejectionRate();
        break;

      case 'timeout':
        if (this.lastOpenTime) {
          const openDuration = event.timestamp.getTime() - this.lastOpenTime.getTime();
          if (openDuration > this.alertThresholds.openStateDuration) {
            this.emitAlert('prolonged_open_state', {
              duration: openDuration,
              threshold: this.alertThresholds.openStateDuration,
            });
          }
        }
        break;
    }
  }

  private checkRejectionRate(): void {
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    this.recentRejections = this.recentRejections.filter(r => r > fiveMinutesAgo);
    
    // Check rejection rate in last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCount = this.recentRejections.filter(r => r > oneMinuteAgo).length;
    
    if (recentCount > 10) { // More than 10 rejections per minute
      this.emitAlert('high_rejection_rate', {
        rejections: recentCount,
        timeWindow: '1 minute',
      });
    }
  }

  private emitAlert(alertType: string, details: any): void {
    logger.error({
      handler: this.name,
      alertType,
      details,
    }, 'Circuit breaker alert');
  }
}

/**
 * State change event filter
 */
export class StateChangeEventFilter implements IEventFilter {
  constructor(private allowedStates: CircuitBreakerState[]) {}

  shouldProcess(event: CircuitBreakerEvent): boolean {
    if (event.type !== 'state_change') return true;
    return this.allowedStates.includes(event.state);
  }
}

/**
 * Time-based event filter
 */
export class TimeBasedEventFilter implements IEventFilter {
  constructor(
    private startTime: Date,
    private endTime: Date
  ) {}

  shouldProcess(event: CircuitBreakerEvent): boolean {
    return event.timestamp >= this.startTime && event.timestamp <= this.endTime;
  }
}

/**
 * Event type filter
 */
export class EventTypeFilter implements IEventFilter {
  constructor(private allowedTypes: string[]) {}

  shouldProcess(event: CircuitBreakerEvent): boolean {
    return this.allowedTypes.includes(event.type);
  }
}

/**
 * Composite event filter
 */
export class CompositeEventFilter implements IEventFilter {
  constructor(private filters: IEventFilter[]) {}

  shouldProcess(event: CircuitBreakerEvent): boolean {
    return this.filters.every(filter => filter.shouldProcess(event));
  }
}