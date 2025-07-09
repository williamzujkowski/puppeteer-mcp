/**
 * WebSocket Session Manager
 * @module mcp/adapters/websocket/session-manager
 * @description Session state management for WebSocket connections
 * @nist ac-3 "Access enforcement"
 * @nist ac-2 "Account management"
 */

import type { Logger } from 'pino';
import type { SubscriptionInfo, SessionManagerInterface } from './types.js';
import { WebSocketEventEmitter, WebSocketEventType } from './event-emitter.js';

/**
 * Session data structure
 */
interface SessionData {
  connectionId: string;
  createdAt: Date;
  lastActivity: Date;
  subscriptions: Map<string, SubscriptionInfo>;
  metadata: Map<string, unknown>;
}

/**
 * WebSocket session manager
 * @nist ac-3 "Access enforcement"
 * @nist ac-2 "Account management"
 */
export class WebSocketSessionManager implements SessionManagerInterface {
  private readonly logger: Logger;
  private readonly sessions: Map<string, SessionData> = new Map();
  private readonly eventEmitter: WebSocketEventEmitter;
  private readonly sessionTimeout: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    logger: Logger,
    eventEmitter: WebSocketEventEmitter,
    sessionTimeout: number = 3600000, // 1 hour default
  ) {
    this.logger = logger.child({ module: 'ws-session-manager' });
    this.eventEmitter = eventEmitter;
    this.sessionTimeout = sessionTimeout;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create new session
   */
  createSession(connectionId: string): void {
    const session: SessionData = {
      connectionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Map(),
      metadata: new Map(),
    };

    this.sessions.set(connectionId, session);

    this.logger.info('Session created', {
      connectionId,
      totalSessions: this.sessions.size,
    });
  }

  /**
   * Remove session
   */
  removeSession(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return;
    }

    // Clean up subscriptions
    for (const [subscriptionId] of session.subscriptions) {
      this.removeSubscription(connectionId, subscriptionId);
    }

    this.sessions.delete(connectionId);

    this.logger.info('Session removed', {
      connectionId,
      duration: Date.now() - session.createdAt.getTime(),
      totalSessions: this.sessions.size,
    });
  }

  /**
   * Add subscription to session
   */
  addSubscription(connectionId: string, subscriptionId: string, info: SubscriptionInfo): void {
    const session = this.sessions.get(connectionId);
    if (!session) {
      this.logger.warn('Session not found for subscription', {
        connectionId,
        subscriptionId,
      });
      return;
    }

    session.subscriptions.set(subscriptionId, info);
    session.lastActivity = new Date();

    this.eventEmitter.emitSubscriptionEvent(WebSocketEventType.SUBSCRIPTION_CREATED, {
      connectionId,
      subscriptionId,
      topic: info.topic,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug('Subscription added to session', {
      connectionId,
      subscriptionId,
      topic: info.topic,
      totalSubscriptions: session.subscriptions.size,
    });
  }

  /**
   * Remove subscription from session
   */
  removeSubscription(connectionId: string, subscriptionId: string): void {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return;
    }

    const subscription = session.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    session.subscriptions.delete(subscriptionId);
    session.lastActivity = new Date();

    this.eventEmitter.emitSubscriptionEvent(WebSocketEventType.SUBSCRIPTION_REMOVED, {
      connectionId,
      subscriptionId,
      topic: subscription.topic,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug('Subscription removed from session', {
      connectionId,
      subscriptionId,
      topic: subscription.topic,
      remainingSubscriptions: session.subscriptions.size,
    });
  }

  /**
   * Get subscriptions for connection
   */
  getSubscriptions(connectionId: string): Map<string, SubscriptionInfo> | undefined {
    const session = this.sessions.get(connectionId);
    return session?.subscriptions;
  }

  /**
   * Update session activity
   */
  updateActivity(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Get session metadata
   */
  getMetadata(connectionId: string, key: string): unknown {
    const session = this.sessions.get(connectionId);
    return session?.metadata.get(key);
  }

  /**
   * Set session metadata
   */
  setMetadata(connectionId: string, key: string, value: unknown): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.metadata.set(key, value);
      session.lastActivity = new Date();
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session info
   */
  getSessionInfo(connectionId: string): {
    createdAt: Date;
    lastActivity: Date;
    subscriptionCount: number;
  } | null {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return null;
    }

    return {
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      subscriptionCount: session.subscriptions.size,
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Run every minute
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [connectionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity.getTime();
      if (inactiveTime > this.sessionTimeout) {
        expiredSessions.push(connectionId);
      }
    }

    if (expiredSessions.length > 0) {
      this.logger.info('Cleaning up inactive sessions', {
        count: expiredSessions.length,
      });

      for (const connectionId of expiredSessions) {
        this.removeSession(connectionId);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Clean up all sessions
   */
  cleanup(): void {
    this.stopCleanupInterval();

    this.logger.info('Cleaning up all sessions', {
      count: this.sessions.size,
    });

    for (const [connectionId] of this.sessions) {
      this.removeSession(connectionId);
    }
  }
}