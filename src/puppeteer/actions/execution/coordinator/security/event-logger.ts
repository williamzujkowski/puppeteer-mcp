/**
 * Security event logging utilities
 * @module puppeteer/actions/execution/coordinator/security/event-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type {
  BrowserAction,
  ActionContext,
} from '../../../../interfaces/action-executor.interface.js';
import { logSecurityEvent, SecurityEventType, createLogger } from '../../../../../utils/logger.js';

const logger = createLogger('puppeteer:security-event-logger');

/**
 * Security event metadata
 */
export interface SecurityEventMetadata {
  sessionId: string;
  contextId: string;
  userId: string;
  actionType: string;
  actionId: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Event queue item
 */
export interface QueuedEvent {
  type: SecurityEventType;
  data: any;
  timestamp: number;
}

/**
 * Handles security event logging
 * @nist au-2 "Audit events"
 */
export class SecurityEventLogger {
  private readonly eventQueue: QueuedEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly flushInterval = 5000; // 5 seconds
  private readonly maxQueueSize = 1000;

  constructor(private readonly enableBatching = false) {
    if (enableBatching) {
      this.startBatchProcessor();
    }
  }

  /**
   * Create base metadata for security events
   * @param action - Browser action
   * @param context - Execution context
   * @returns Security event metadata
   */
  createBaseMetadata(action: BrowserAction, context: ActionContext): SecurityEventMetadata {
    return {
      sessionId: context.sessionId,
      contextId: context.contextId,
      userId: context.userId ?? 'unknown',
      actionType: action.type,
      actionId: `${action.type}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log security event
   * @param type - Event type
   * @param data - Event data
   */
  async logEvent(type: SecurityEventType, data: any): Promise<void> {
    if (this.enableBatching) {
      this.queueEvent(type, data);
    } else {
      await logSecurityEvent(type, data);
    }
  }

  /**
   * Queue event for batch processing
   * @param type - Event type
   * @param data - Event data
   */
  private queueEvent(type: SecurityEventType, data: any): void {
    this.eventQueue.push({
      type,
      data,
      timestamp: Date.now(),
    });

    // Flush if queue is full
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.flushEventQueue();
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      this.flushEventQueue();
    }, this.flushInterval);
  }

  /**
   * Flush event queue
   */
  async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue.length = 0;

    try {
      // Process events in parallel with error handling
      await Promise.allSettled(events.map((event) => logSecurityEvent(event.type, event.data)));
    } catch (error) {
      logger.error('Failed to flush security event queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventCount: events.length,
      });
    }
  }

  /**
   * Stop batch processor
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining events
    this.flushEventQueue();
  }

  /**
   * Get queue statistics
   * @returns Queue stats
   */
  getQueueStats(): {
    queueSize: number;
    batchingEnabled: boolean;
    flushInterval: number;
    maxQueueSize: number;
  } {
    return {
      queueSize: this.eventQueue.length,
      batchingEnabled: this.enableBatching,
      flushInterval: this.flushInterval,
      maxQueueSize: this.maxQueueSize,
    };
  }
}
