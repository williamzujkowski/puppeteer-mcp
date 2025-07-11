/**
 * WebSocket event handling and subscription management
 * @module ws/websocket/event-handler
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { WSMessageType } from '../../types/websocket.js';
import type { WSMessage } from '../../types/websocket.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { WSComponentDependencies, EventHandlerOptions, MessageFilter } from './types.js';

/**
 * Subscription filter function
 */
type SubscriptionFilter = (data: unknown) => boolean;

/**
 * Topic subscription information
 */
interface TopicSubscription {
  connectionId: string;
  topic: string;
  filters?: Record<string, unknown>;
  filterFunction?: SubscriptionFilter;
  subscribedAt: Date;
}

/**
 * Event handling and subscription management
 * Manages topic subscriptions and event broadcasting
 * @nist ac-3 "Access enforcement"
 */
export class EventHandler {
  private logger: pino.Logger;
  private subscriptions: Map<string, TopicSubscription[]> = new Map(); // topic -> subscriptions
  private connectionSubscriptions: Map<string, Set<string>> = new Map(); // connectionId -> topics
  private options: EventHandlerOptions;

  constructor({ logger }: WSComponentDependencies, options: EventHandlerOptions = {}) {
    this.logger = logger.child({ module: 'ws-event-handler' });
    this.options = {
      maxSubscriptionsPerConnection: 50,
      broadcastBufferSize: 1000,
      ...options,
    };
  }

  /**
   * Subscribe connection to a topic
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async subscribe(
    connectionId: string,
    topic: string,
    filters?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      // Check subscription limits
      const connectionTopics = this.connectionSubscriptions.get(connectionId) ?? new Set();
      if (connectionTopics.size >= this.options.maxSubscriptionsPerConnection!) {
        this.logger.warn('Maximum subscriptions exceeded', {
          connectionId,
          currentCount: connectionTopics.size,
          maxAllowed: this.options.maxSubscriptionsPerConnection,
        });
        return false;
      }

      // Check if already subscribed
      if (connectionTopics.has(topic)) {
        this.logger.debug('Already subscribed to topic', { connectionId, topic });
        return true;
      }

      // Create subscription
      const subscription: TopicSubscription = {
        connectionId,
        topic,
        filters,
        filterFunction: this.createFilterFunction(filters),
        subscribedAt: new Date(),
      };

      // Add to topic subscriptions
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, []);
      }
      this.subscriptions.get(topic)!.push(subscription);

      // Add to connection subscriptions
      connectionTopics.add(topic);
      this.connectionSubscriptions.set(connectionId, connectionTopics);

      this.logger.info('Subscription added', {
        connectionId,
        topic,
        totalSubscriptions: connectionTopics.size,
      });

      // Log subscription event
      await logSecurityEvent(SecurityEventType.WS_SUBSCRIPTION_CHANGED, {
        resource: 'websocket',
        action: 'subscribe',
        result: 'success',
        metadata: {
          connectionId,
          topic,
          filters: filters ?? {},
          totalSubscriptions: connectionTopics.size,
        },
      });

      return true;
    } catch (error) {
      this.logger.error('Subscription error', {
        connectionId,
        topic,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Unsubscribe connection from a topic
   * @nist au-3 "Content of audit records"
   */
  unsubscribe(connectionId: string, topic: string): boolean {
    try {
      // Remove from topic subscriptions
      const topicSubscriptions = this.subscriptions.get(topic);
      if (topicSubscriptions) {
        const filteredSubscriptions = topicSubscriptions.filter(
          (sub) => sub.connectionId !== connectionId,
        );

        if (filteredSubscriptions.length === 0) {
          this.subscriptions.delete(topic);
        } else {
          this.subscriptions.set(topic, filteredSubscriptions);
        }
      }

      // Remove from connection subscriptions
      const connectionTopics = this.connectionSubscriptions.get(connectionId);
      if (connectionTopics) {
        connectionTopics.delete(topic);

        if (connectionTopics.size === 0) {
          this.connectionSubscriptions.delete(connectionId);
        }
      }

      this.logger.info('Subscription removed', {
        connectionId,
        topic,
        remainingSubscriptions: connectionTopics?.size ?? 0,
      });

      // Log unsubscription event
      void logSecurityEvent(SecurityEventType.WS_SUBSCRIPTION_CHANGED, {
        resource: 'websocket',
        action: 'unsubscribe',
        result: 'success',
        metadata: {
          connectionId,
          topic,
          remainingSubscriptions: connectionTopics?.size ?? 0,
        },
      });

      return true;
    } catch (error) {
      this.logger.error('Unsubscription error', {
        connectionId,
        topic,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Remove all subscriptions for a connection
   */
  removeAllSubscriptions(connectionId: string): void {
    const connectionTopics = this.connectionSubscriptions.get(connectionId);
    if (!connectionTopics) return;

    // Remove from each topic
    connectionTopics.forEach((topic) => {
      this.unsubscribe(connectionId, topic);
    });

    this.logger.debug('All subscriptions removed for connection', {
      connectionId,
      topicCount: connectionTopics.size,
    });
  }

  /**
   * Broadcast event to subscribers
   * @nist ac-3 "Access enforcement"
   */
  async broadcastToTopic(
    topic: string,
    data: unknown,
    connectionManager: ConnectionManager,
    filter?: MessageFilter,
  ): Promise<number> {
    const subscriptions = this.subscriptions.get(topic);
    if (!subscriptions || subscriptions.length === 0) {
      return 0;
    }

    let broadcastCount = 0;
    const message: WSMessage = {
      type: WSMessageType.SUBSCRIPTION_UPDATE,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      topic,
      data,
    };

    for (const subscription of subscriptions) {
      try {
        // Get connection state
        const state = connectionManager.getConnectionState(subscription.connectionId);
        if (!state?.authenticated) {
          continue;
        }

        // Apply connection filter if provided
        if (filter && !filter(state)) {
          continue;
        }

        // Apply subscription filter if configured
        if (subscription.filterFunction && !subscription.filterFunction(data)) {
          continue;
        }

        // Get WebSocket and send message
        const ws = connectionManager.getWebSocket(subscription.connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          broadcastCount++;
        }
      } catch (error) {
        this.logger.error('Error broadcasting to subscription', {
          connectionId: subscription.connectionId,
          topic,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.debug('Event broadcasted', {
      topic,
      subscriberCount: subscriptions.length,
      successfulBroadcasts: broadcastCount,
    });

    return broadcastCount;
  }

  /**
   * Broadcast event to specific user
   * @nist ac-3 "Access enforcement"
   */
  async broadcastToUser(
    userId: string,
    topic: string,
    data: unknown,
    connectionManager: ConnectionManager,
  ): Promise<number> {
    return this.broadcastToTopic(
      topic,
      data,
      connectionManager,
      (state) => state.userId === userId,
    );
  }

  /**
   * Broadcast event to specific session
   * @nist ac-3 "Access enforcement"
   */
  async broadcastToSession(
    sessionId: string,
    topic: string,
    data: unknown,
    connectionManager: ConnectionManager,
  ): Promise<number> {
    return this.broadcastToTopic(
      topic,
      data,
      connectionManager,
      (state) => state.sessionId === sessionId,
    );
  }

  /**
   * Get subscriptions for a connection
   */
  getConnectionSubscriptions(connectionId: string): string[] {
    const topics = this.connectionSubscriptions.get(connectionId);
    return topics ? Array.from(topics) : [];
  }

  /**
   * Get subscribers for a topic
   */
  getTopicSubscribers(topic: string): string[] {
    const subscriptions = this.subscriptions.get(topic);
    return subscriptions ? subscriptions.map((sub) => sub.connectionId) : [];
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalTopics: number;
    totalSubscriptions: number;
    connectionsWithSubscriptions: number;
    topicsBySubscriberCount: Array<{ topic: string; subscriberCount: number }>;
  } {
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (sum, subs) => sum + subs.length,
      0,
    );

    const topicsBySubscriberCount = Array.from(this.subscriptions.entries())
      .map(([topic, subscriptions]) => ({
        topic,
        subscriberCount: subscriptions.length,
      }))
      .sort((a, b) => b.subscriberCount - a.subscriberCount);

    return {
      totalTopics: this.subscriptions.size,
      totalSubscriptions,
      connectionsWithSubscriptions: this.connectionSubscriptions.size,
      topicsBySubscriberCount,
    };
  }

  /**
   * Create filter function from filter object
   */
  private createFilterFunction(filters?: Record<string, unknown>): SubscriptionFilter | undefined {
    if (!filters || Object.keys(filters).length === 0) {
      return undefined;
    }

    return (data: unknown): boolean => {
      if (typeof data !== 'object' || data === null) {
        return false;
      }

      const dataObj = data as Record<string, unknown>;

      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(dataObj[key]);
        }
        return dataObj[key] === value;
      });
    };
  }

  /**
   * Clean up subscriptions for closed connections
   */
  cleanup(): void {
    // This would typically be called during connection cleanup
    // to ensure no stale subscriptions remain
    this.logger.debug('Subscription cleanup completed');
  }
}
