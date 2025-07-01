/**
 * WebSocket session request handler
 * @module ws/session-handler
 * @nist ac-3 "Access enforcement"
 */

import type { SessionStore } from '../store/session-store.interface.js';
import type { WSConnectionState } from '../types/websocket.js';
import { WSAuthHandler } from './auth-handler.js';
import { WSConnectionManager } from './connection-manager.js';
import { pino } from 'pino';

export class WSSessionHandler {
  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore,
    private authHandler: WSAuthHandler,
    private connectionManager: WSConnectionManager
  ) {}

  /**
   * Handle session-related requests
   * @nist ac-3 "Access enforcement"
   */
  async handleSessionRequest(
    connectionState: WSConnectionState,
    method: string,
    sessionId?: string,
    data?: unknown,
    action?: string
  ): Promise<unknown> {
    if (connectionState.authenticated !== true || connectionState.userId === null || connectionState.userId === undefined || connectionState.userId.length === 0) {
      throw new Error('Authentication required');
    }

    switch (method) {
      case 'GET': {
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          // List user sessions
          const sessions = await this.sessionStore.getByUserId(connectionState.userId);
          return sessions;
        } else {
          // Get specific session
          const session = await this.sessionStore.get(sessionId);
          if (!session || session.data.userId !== connectionState.userId) {
            throw new Error('Session not found');
          }
          return session;
        }
      }

      case 'POST': {
        // Create new session
        interface SessionData {
          username?: string;
          roles?: string[];
        }
        const sessionData = data as SessionData;
        const newSessionId = await this.sessionStore.create({
          userId: connectionState.userId,
          username: sessionData?.username ?? 'unknown',
          roles: sessionData?.roles ?? ['user'],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        });
        
        return { sessionId: newSessionId };
      }

      case 'PUT': {
        if (action === 'refresh') {
          // Refresh session
          const ws = this.connectionManager.getWebSocket(connectionState.id);
          if (ws === undefined || sessionId === undefined) {
            throw new Error('WebSocket or session ID not found');
          }
          const refreshed = await this.authHandler.refreshAuth(
            ws,
            connectionState.id,
            sessionId
          );
          
          if (!refreshed) {
            throw new Error('Failed to refresh session');
          }
          
          return { success: true };
        } else {
          // Update session
          if (sessionId === undefined) {
            throw new Error('Session ID required');
          }
          const session = await this.sessionStore.get(sessionId);
          if (!session || session.data.userId !== connectionState.userId) {
            throw new Error('Session not found');
          }
          
          await this.sessionStore.update(sessionId, data as Record<string, unknown>);
          return { success: true };
        }
      }

      case 'DELETE': {
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          throw new Error('Session ID required');
        }
        
        const session = await this.sessionStore.get(sessionId);
        if (!session || session.data.userId !== connectionState.userId) {
          throw new Error('Session not found');
        }
        
        await this.sessionStore.delete(sessionId);
        return { success: true };
      }

      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
}