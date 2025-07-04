/**
 * WebSocket connection manager
 * @module ws/connection-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { WSConnectionState } from '../types/websocket.js';

/**
 * Connection entry
 */
interface ConnectionEntry {
  connectionId: string;
  ws: WebSocket;
  state: WSConnectionState;
}

/**
 * Authentication parameters
 */
interface AuthenticationParams {
  connectionId: string;
  userId: string;
  sessionId: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
}

/**
 * WebSocket connection manager
 * @nist ac-3 "Access enforcement"
 */
export class WSConnectionManager {
  private connections: Map<string, ConnectionEntry> = new Map();
  private sessionConnections: Map<string, Set<string>> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ module: 'ws-connection-manager' });
  }

  /**
   * Add a new connection
   */
  addConnection(connectionId: string, ws: WebSocket, state: WSConnectionState): void {
    this.connections.set(connectionId, { connectionId, ws, state });
    this.logger.debug('Connection added', { connectionId });
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Clean up session mapping
      if (connection.state.userId !== null && connection.state.userId !== undefined && connection.state.userId.length > 0) {
        const userConnections = this.userConnections.get(connection.state.userId);
        if (userConnections) {
          userConnections.delete(connectionId);
          if (userConnections.size === 0) {
            this.userConnections.delete(connection.state.userId);
          }
        }
      }

      // Clean up user mapping
      const sessionId = connection.state.metadata?.sessionId as string;
      if (sessionId) {
        const sessionConnections = this.sessionConnections.get(sessionId);
        if (sessionConnections) {
          sessionConnections.delete(connectionId);
          if (sessionConnections.size === 0) {
            this.sessionConnections.delete(sessionId);
          }
        }
      }

      this.connections.delete(connectionId);
      this.logger.debug('Connection removed', { connectionId });
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ConnectionEntry | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): WSConnectionState | undefined {
    return this.connections.get(connectionId)?.state;
  }

  /**
   * Get WebSocket by connection ID
   */
  getWebSocket(connectionId: string): WebSocket | undefined {
    return this.connections.get(connectionId)?.ws;
  }

  /**
   * Update connection authentication
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  authenticateConnection({
    connectionId,
    userId,
    sessionId,
    roles,
    permissions,
    scopes
  }: AuthenticationParams): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Update connection state
      connection.state.authenticated = true;
      connection.state.userId = userId;
      connection.state.sessionId = sessionId;
      connection.state.roles = roles;
      connection.state.permissions = permissions;
      connection.state.scopes = scopes;
      connection.state.metadata = {
        ...connection.state.metadata,
        authenticatedAt: new Date().toISOString(),
      };

      // Update user mapping
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      const userConnectionSet = this.userConnections.get(userId);
      if (userConnectionSet !== undefined) {
        userConnectionSet.add(connectionId);
      }

      // Update session mapping
      if (!this.sessionConnections.has(sessionId)) {
        this.sessionConnections.set(sessionId, new Set());
      }
      const sessionConnectionSet = this.sessionConnections.get(sessionId);
      if (sessionConnectionSet !== undefined) {
        sessionConnectionSet.add(connectionId);
      }

      this.logger.info('Connection authenticated', {
        connectionId,
        userId,
        sessionId,
      });
    }
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionEntry[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by user ID
   * @nist ac-3 "Access enforcement"
   */
  getConnectionsByUser(userId: string): ConnectionEntry[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {return [];}

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ConnectionEntry => conn !== undefined);
  }

  /**
   * Get connections by session ID
   * @nist ac-3 "Access enforcement"
   */
  getConnectionsBySession(sessionId: string): ConnectionEntry[] {
    const connectionIds = this.sessionConnections.get(sessionId);
    if (!connectionIds) {return [];}

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ConnectionEntry => conn !== undefined);
  }

  /**
   * Add subscription to connection
   */
  addSubscription(connectionId: string, topic: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection?.state.authenticated) {
      connection.state.subscriptions.add(topic);
      this.logger.debug('Subscription added', { connectionId, topic });
      return true;
    }
    return false;
  }

  /**
   * Remove subscription from connection
   */
  removeSubscription(connectionId: string, topic: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.state.subscriptions.delete(topic);
      this.logger.debug('Subscription removed', { connectionId, topic });
      return true;
    }
    return false;
  }

  /**
   * Get connections subscribed to a topic
   */
  getConnectionsByTopic(topic: string): ConnectionEntry[] {
    return this.getAllConnections().filter(
      conn => conn.state.subscriptions.has(topic)
    );
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    total: number;
    authenticated: number;
    unauthenticated: number;
    uniqueUsers: number;
    uniqueSessions: number;
    connectionsByUser: Array<{ userId: string; count: number }>;
  } {
    const connections = this.getAllConnections();
    const authenticated = connections.filter(c => c.state.authenticated);
    
    return {
      total: connections.length,
      authenticated: authenticated.length,
      unauthenticated: connections.length - authenticated.length,
      uniqueUsers: this.userConnections.size,
      uniqueSessions: this.sessionConnections.size,
      connectionsByUser: Array.from(this.userConnections.entries()).map(
        ([userId, conns]) => ({ userId, count: conns.size })
      ),
    };
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(maxAge: number): number {
    const now = Date.now();
    let cleaned = 0;

    this.connections.forEach((connection, connectionId) => {
      const age = now - connection.state.lastActivity.getTime();
      if (age > maxAge) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1001, 'Connection timeout');
        }
        this.removeConnection(connectionId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} stale connections`);
    }

    return cleaned;
  }
}