/**
 * Session event management using Observer pattern
 * @module ws/websocket/session/event-emitter
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import type { SessionInfo, SessionState } from './types.js';
import type { pino } from 'pino';

/**
 * Session event types
 */
export interface SessionEvents {
  'session:created': (session: SessionInfo) => void;
  'session:updated': (session: SessionInfo, changes: Partial<SessionInfo>) => void;
  'session:terminated': (session: SessionInfo) => void;
  'session:state-changed': (sessionId: string, from: SessionState, to: SessionState) => void;
  'connection:added': (sessionId: string, connectionId: string) => void;
  'connection:removed': (sessionId: string, connectionId: string) => void;
  'cleanup:completed': (data: { count: number }) => void;
  'lifecycle:start': (data: { sessionTimeout: number; maxSessionsPerUser: number }) => void;
  'lifecycle:stop': (data: object) => void;
  'limit:exceeded': (userId: string, limit: number) => void;
  'validation:failed': (sessionId: string, reason: string) => void;
  'persistence:error': (sessionId: string, error: Error) => void;
}

/**
 * Type-safe event emitter for session events
 * @nist au-3 "Content of audit records"
 */
export class SessionEventEmitter extends EventEmitter {
  constructor(private readonly logger: pino.Logger) {
    super();
    this.setMaxListeners(50); // Support multiple listeners
  }

  /**
   * Emit typed event
   */
  override emit<K extends keyof SessionEvents>(
    event: K,
    ...args: Parameters<SessionEvents[K]>
  ): boolean {
    this.logger.debug('Emitting session event', {
      event,
      hasListeners: this.listenerCount(event) > 0,
    });
    return super.emit(event, ...args);
  }

  /**
   * Add typed event listener
   */
  override on<K extends keyof SessionEvents>(event: K, listener: SessionEvents[K]): this {
    this.logger.debug('Adding session event listener', { event });
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Add one-time typed event listener
   */
  override once<K extends keyof SessionEvents>(event: K, listener: SessionEvents[K]): this {
    this.logger.debug('Adding one-time session event listener', { event });
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove typed event listener
   */
  override off<K extends keyof SessionEvents>(event: K, listener: SessionEvents[K]): this {
    this.logger.debug('Removing session event listener', { event });
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove all listeners for an event
   */
  override removeAllListeners<K extends keyof SessionEvents>(event?: K): this {
    if (event) {
      this.logger.debug('Removing all listeners for event', { event });
    } else {
      this.logger.debug('Removing all event listeners');
    }
    return super.removeAllListeners(event);
  }

  /**
   * Get listener count for an event
   */
  override listenerCount<K extends keyof SessionEvents>(event: K): number {
    return super.listenerCount(event);
  }

  /**
   * Get all event names with listeners
   */
  getActiveEvents(): (keyof SessionEvents)[] {
    return this.eventNames() as (keyof SessionEvents)[];
  }
}
