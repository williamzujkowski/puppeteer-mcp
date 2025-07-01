/**
 * WebSocket session request handler
 * @module ws/session-handler
 * @nist ac-3 "Access enforcement"
 */

import type { SessionStore } from '../store/session-store.interface.js';
import type { WSConnectionState } from '../types/websocket.js';
import type { Session } from '../types/session.js';
import { WSAuthHandler } from './auth-handler.js';
import { WSConnectionManager } from './connection-manager.js';

/**
 * Session request parameters
 */
interface SessionRequestParams {
  connectionState: WSConnectionState;
  method: string;
  sessionId?: string;
  data?: unknown;
  action?: string;
}

export class WSSessionHandler {
  constructor(
    private sessionStore: SessionStore,
    private authHandler: WSAuthHandler,
    private connectionManager: WSConnectionManager
  ) {}

  /**
   * Handle session-related requests
   * @nist ac-3 "Access enforcement"
   */
  handleSessionRequest(params: SessionRequestParams): Promise<unknown> {
    const { connectionState, method, sessionId, data, action } = params;
    this.validateAuthentication(connectionState);

    switch (method) {
      case 'GET':
        return this.handleGetRequest(connectionState, sessionId);
      case 'POST':
        return this.handlePostRequest(connectionState, data);
      case 'PUT':
        return this.handlePutRequest(connectionState, sessionId, data, action);
      case 'DELETE':
        return this.handleDeleteRequest(connectionState, sessionId);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * Validate user authentication
   */
  private validateAuthentication(connectionState: WSConnectionState): void {
    if (connectionState.authenticated !== true || 
        connectionState.userId === null || 
        connectionState.userId === undefined || 
        connectionState.userId.length === 0) {
      throw new Error('Authentication required');
    }
  }

  /**
   * Handle GET session requests
   */
  private handleGetRequest(connectionState: WSConnectionState, sessionId?: string): Promise<unknown> {
    if (this.isEmptySessionId(sessionId)) {
      return this.sessionStore.getByUserId(connectionState.userId ?? '');
    }
    
    return this.getSessionForUser(connectionState.userId ?? '', sessionId ?? '');
  }

  /**
   * Handle POST session requests
   */
  private handlePostRequest(connectionState: WSConnectionState, data?: unknown): Promise<unknown> {
    interface SessionData {
      username?: string;
      roles?: string[];
    }
    
    const sessionData = data as SessionData;
    const newSessionId = await this.sessionStore.create({
      userId: connectionState.userId ?? '',
      username: sessionData?.username ?? 'unknown',
      roles: sessionData?.roles ?? ['user'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    });
    
    return { sessionId: newSessionId };
  }

  /**
   * Handle PUT session requests
   */
  private handlePutRequest(
    connectionState: WSConnectionState, 
    sessionId?: string, 
    data?: unknown, 
    action?: string
  ): Promise<unknown> {
    if (action === 'refresh') {
      return this.handleRefreshAction(connectionState, sessionId);
    }
    
    return this.handleUpdateAction(connectionState, sessionId, data);
  }

  /**
   * Handle DELETE session requests
   */
  private handleDeleteRequest(connectionState: WSConnectionState, sessionId?: string): Promise<unknown> {
    if (this.isEmptySessionId(sessionId)) {
      throw new Error('Session ID required');
    }
    
    await this.getSessionForUser(connectionState.userId ?? '', sessionId ?? '');
    await this.sessionStore.delete(sessionId ?? '');
    return { success: true };
  }

  /**
   * Handle session refresh action
   */
  private handleRefreshAction(connectionState: WSConnectionState, sessionId?: string): Promise<unknown> {
    const ws = this.connectionManager.getWebSocket(connectionState.id);
    if (ws === undefined || sessionId === undefined) {
      throw new Error('WebSocket or session ID not found');
    }
    
    const refreshed = await this.authHandler.refreshAuth(ws, connectionState.id, sessionId);
    if (!refreshed) {
      throw new Error('Failed to refresh session');
    }
    
    return { success: true };
  }

  /**
   * Handle session update action
   */
  private handleUpdateAction(connectionState: WSConnectionState, sessionId?: string, data?: unknown): Promise<unknown> {
    if (sessionId === undefined) {
      throw new Error('Session ID required');
    }
    
    await this.getSessionForUser(connectionState.userId ?? '', sessionId);
    await this.sessionStore.update(sessionId, data as Record<string, unknown>);
    return { success: true };
  }

  /**
   * Get session and validate user ownership
   */
  private getSessionForUser(userId: string, sessionId: string): Promise<Session | null> {
    const session = await this.sessionStore.get(sessionId);
    if (!session || session.data.userId !== userId) {
      throw new Error('Session not found');
    }
    return session;
  }

  /**
   * Check if session ID is empty
   */
  private isEmptySessionId(sessionId?: string): boolean {
    return sessionId === undefined || sessionId === null || sessionId === '';
  }
}