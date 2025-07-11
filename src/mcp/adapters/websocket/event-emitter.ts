/**
 * WebSocket Event Emitter
 * @module mcp/adapters/websocket/event-emitter
 * @description Event management and broadcasting for WebSocket connections
 * @nist ac-3 "Access enforcement"
 */

import { EventEmitter } from 'events';
import type { Logger } from 'pino';

/**
 * Event types for WebSocket adapter
 */
export enum WebSocketEventType {
  CONNECTION_OPEN = 'connection:open',
  CONNECTION_CLOSE = 'connection:close',
  CONNECTION_ERROR = 'connection:error',
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_SENT = 'message:sent',
  SUBSCRIPTION_CREATED = 'subscription:created',
  SUBSCRIPTION_REMOVED = 'subscription:removed',
  SUBSCRIPTION_UPDATE = 'subscription:update',
  AUTH_SUCCESS = 'auth:success',
  AUTH_FAILURE = 'auth:failure',
}

/**
 * WebSocket event data interfaces
 */
export interface ConnectionEvent {
  connectionId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MessageEvent {
  connectionId: string;
  messageId: string;
  type: string;
  timestamp: string;
  data?: unknown;
}

export interface SubscriptionEvent {
  connectionId: string;
  subscriptionId: string;
  topic: string;
  timestamp: string;
  data?: unknown;
}

export interface AuthEvent {
  connectionId: string;
  authType: string;
  timestamp: string;
  success: boolean;
  reason?: string;
}

/**
 * Enhanced WebSocket event emitter
 * @nist ac-3 "Access enforcement"
 */
export class WebSocketEventEmitter extends EventEmitter {
  private readonly logger: Logger;
  private readonly maxListeners: number = 100;

  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ module: 'ws-event-emitter' });
    this.setMaxListeners(this.maxListeners);
  }

  /**
   * Emit connection event
   */
  emitConnectionEvent(type: WebSocketEventType, event: ConnectionEvent): void {
    this.logger.debug('Emitting connection event', { type, event });
    this.emit(type, event);
  }

  /**
   * Emit message event
   */
  emitMessageEvent(type: WebSocketEventType, event: MessageEvent): void {
    this.logger.debug('Emitting message event', { type, messageId: event.messageId });
    this.emit(type, event);
  }

  /**
   * Emit subscription event
   */
  emitSubscriptionEvent(type: WebSocketEventType, event: SubscriptionEvent): void {
    this.logger.debug('Emitting subscription event', {
      type,
      subscriptionId: event.subscriptionId,
      topic: event.topic,
    });
    this.emit(type, event);
    this.emit(`subscription:${event.subscriptionId}`, event.data);
  }

  /**
   * Emit auth event
   */
  emitAuthEvent(type: WebSocketEventType, event: AuthEvent): void {
    this.logger.debug('Emitting auth event', {
      type,
      connectionId: event.connectionId,
      success: event.success,
    });
    this.emit(type, event);
  }

  /**
   * Create subscription-specific event emitter
   */
  createSubscriptionEmitter(subscriptionId: string): {
    emit: (data: unknown) => void;
    removeAllListeners: () => void;
  } {
    return {
      emit: (data: unknown): void => {
        this.emit(`subscription:${subscriptionId}`, data);
      },
      removeAllListeners: (): void => {
        this.removeAllListeners(`subscription:${subscriptionId}`);
      },
    };
  }

  /**
   * Wait for event with timeout
   */
  async waitForEvent(
    eventType: string,
    timeout: number = 30000,
    filter?: (event: unknown) => boolean,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(eventType, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (event: unknown): void => {
        if (!filter || filter(event)) {
          clearTimeout(timer);
          this.removeListener(eventType, handler);
          resolve(event);
        }
      };

      this.on(eventType, handler);
    });
  }

  /**
   * Get event listener count
   */
  getListenerCount(eventType?: string): number {
    if (eventType !== undefined && eventType !== null && eventType !== '') {
      return this.listenerCount(eventType);
    }
    return this.eventNames().reduce((total, event) => total + this.listenerCount(event), 0);
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    const eventNames = this.eventNames();
    this.logger.info('Cleaning up event listeners', { count: eventNames.length });
    this.removeAllListeners();
  }
}
