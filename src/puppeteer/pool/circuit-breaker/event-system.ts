/**
 * Event system for circuit breaker using Observer Pattern
 * @module puppeteer/pool/circuit-breaker/event-system
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import { CircuitBreakerEvent, CircuitBreakerState } from './types.js';
import { createLogger } from '../../../utils/logger.js';
import {
  LoggingEventHandler,
  MetricsEventHandler,
} from './event-handlers.js';

const logger = createLogger('circuit-breaker-events');

/**
 * Event handler interface
 */
export interface IEventHandler {
  handle(event: CircuitBreakerEvent): void | Promise<void>;
}

/**
 * Event filter interface
 */
export interface IEventFilter {
  shouldProcess(event: CircuitBreakerEvent): boolean;
}


/**
 * Event aggregator for circuit breaker
 * @nist au-3 "Content of audit records"
 */
export class EventAggregator extends EventEmitter {
  private handlers: Map<string, IEventHandler[]> = new Map();
  private filters: IEventFilter[] = [];
  private eventHistory: CircuitBreakerEvent[] = [];
  private readonly maxHistorySize = 1000;

  constructor(private name: string) {
    super();
    this.setupDefaultHandlers();
  }

  /**
   * Setup default event handlers
   */
  private setupDefaultHandlers(): void {
    this.registerHandler('*', new LoggingEventHandler());
    this.registerHandler('*', new MetricsEventHandler());
  }

  /**
   * Register event handler
   */
  registerHandler(eventType: string, handler: IEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    
    logger.debug({
      aggregator: this.name,
      eventType,
      handlerName: (handler as any).name || 'unknown',
    }, 'Event handler registered');
  }

  /**
   * Unregister event handler
   */
  unregisterHandler(eventType: string, handler: IEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Add event filter
   */
  addFilter(filter: IEventFilter): void {
    this.filters.push(filter);
  }

  /**
   * Remove event filter
   */
  removeFilter(filter: IEventFilter): void {
    const index = this.filters.indexOf(filter);
    if (index !== -1) {
      this.filters.splice(index, 1);
    }
  }

  /**
   * Process circuit breaker event
   */
  async processEvent(event: CircuitBreakerEvent): Promise<void> {
    // Apply filters
    for (const filter of this.filters) {
      if (!filter.shouldProcess(event)) {
        logger.debug({
          aggregator: this.name,
          eventType: event.type,
          filtered: true,
        }, 'Event filtered out');
        return;
      }
    }

    // Store in history
    this.addToHistory(event);

    // Get handlers for this event type
    const specificHandlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    const allHandlers = [...specificHandlers, ...wildcardHandlers];

    // Process event with all handlers
    const promises = allHandlers.map(handler => {
      try {
        return Promise.resolve(handler.handle(event));
      } catch (error) {
        logger.error({
          aggregator: this.name,
          handler: (handler as any).name || 'unknown',
          error,
        }, 'Event handler error');
        return Promise.resolve();
      }
    });

    await Promise.all(promises);

    // Emit for external listeners
    this.emit('circuit-breaker-event', event);
    this.emit(`circuit-breaker-${event.type}`, event);
  }

  /**
   * Add event to history
   */
  private addToHistory(event: CircuitBreakerEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getEventHistory(filter?: {
    type?: string;
    state?: CircuitBreakerState;
    since?: Date;
  }): CircuitBreakerEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.state) {
        events = events.filter(e => e.state === filter.state);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp > filter.since!);
      }
    }

    return events;
  }

  /**
   * Get event statistics
   */
  getEventStatistics(): {
    totalEvents: number;
    eventsByType: Map<string, number>;
    eventsByState: Map<CircuitBreakerState, number>;
    recentEvents: number;
  } {
    const eventsByType = new Map<string, number>();
    const eventsByState = new Map<CircuitBreakerState, number>();
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    let recentEvents = 0;

    for (const event of this.eventHistory) {
      // Count by type
      const typeCount = eventsByType.get(event.type) || 0;
      eventsByType.set(event.type, typeCount + 1);

      // Count by state
      const stateCount = eventsByState.get(event.state) || 0;
      eventsByState.set(event.state, stateCount + 1);

      // Count recent events
      if (event.timestamp > fiveMinutesAgo) {
        recentEvents++;
      }
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      eventsByState,
      recentEvents,
    };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Destroy event aggregator
   */
  destroy(): void {
    this.handlers.clear();
    this.filters = [];
    this.eventHistory = [];
    this.removeAllListeners();
  }
}

