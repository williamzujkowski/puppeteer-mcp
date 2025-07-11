/**
 * Health event manager using Observer pattern
 * @module ws/websocket/health/health-event-manager
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import type { pino } from 'pino';
import { EventEmitter } from 'events';
import type { HealthEvent, HealthObserver } from './types.js';
import { HealthEventType } from './types.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';

/**
 * Manages health event observers and notifications
 * @nist au-3 "Content of audit records"
 */
export class HealthEventManager extends EventEmitter {
  private observers: Set<HealthObserver> = new Set();
  private logger: pino.Logger;
  private eventHistory: HealthEvent[] = [];
  private maxHistorySize: number;

  constructor(logger: pino.Logger, maxHistorySize = 100) {
    super();
    this.logger = logger.child({ module: 'health-event-manager' });
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Register a health observer
   */
  registerObserver(observer: HealthObserver): void {
    this.observers.add(observer);
    this.logger.debug('Health observer registered', {
      observerCount: this.observers.size,
    });
  }

  /**
   * Unregister a health observer
   */
  unregisterObserver(observer: HealthObserver): boolean {
    const removed = this.observers.delete(observer);
    if (removed) {
      this.logger.debug('Health observer unregistered', {
        observerCount: this.observers.size,
      });
    }
    return removed;
  }

  /**
   * Emit a health event
   * @nist au-3 "Content of audit records"
   */
  emitHealthEvent(event: HealthEvent): void {
    // Add to history
    this.addToHistory(event);

    // Notify all observers
    for (const observer of this.observers) {
      try {
        observer.onHealthEvent(event);
      } catch (error) {
        this.logger.error('Health observer error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          eventType: event.type,
        });
      }
    }

    // Emit as Node.js event
    this.emit(event.type, event);

    // Log security event for critical health events
    if (this.shouldLogSecurityEvent(event)) {
      void this.logHealthSecurityEvent(event);
    }

    this.logger.debug('Health event emitted', {
      type: event.type,
      observerCount: this.observers.size,
    });
  }

  /**
   * Get event history
   */
  getEventHistory(
    type?: (typeof HealthEventType)[keyof typeof HealthEventType],
    limit?: number,
  ): HealthEvent[] {
    let events = this.eventHistory;

    if (type) {
      events = events.filter((e) => e.type === type);
    }

    if (limit && limit > 0) {
      events = events.slice(-limit);
    }

    return [...events];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.logger.debug('Health event history cleared');
  }

  /**
   * Get observer count
   */
  getObserverCount(): number {
    return this.observers.size;
  }

  /**
   * Add event to history
   */
  private addToHistory(event: HealthEvent): void {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Check if event should trigger security logging
   */
  private shouldLogSecurityEvent(event: HealthEvent): boolean {
    return (
      (event.type === HealthEventType.HEALTH_CHECK_FAILED ||
        event.type === HealthEventType.RECOVERY_ACTION_TRIGGERED ||
        (event.type === HealthEventType.STATUS_CHANGED &&
          event.status !== undefined &&
          ['critical', 'warning'].includes(event.status))) ??
      false
    );
  }

  /**
   * Log health-related security event
   * @nist au-3 "Content of audit records"
   */
  private async logHealthSecurityEvent(event: HealthEvent): Promise<void> {
    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'websocket',
      action: 'health_event',
      result: event.type === HealthEventType.HEALTH_CHECK_FAILED ? 'failure' : 'success',
      metadata: {
        eventType: event.type,
        status: event.status,
        timestamp: event.timestamp,
        details: event.details,
      },
    });
  }
}
