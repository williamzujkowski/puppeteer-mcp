/**
 * WebSocket authentication handler
 * @module ws/auth-handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStore } from '../store/session-store.interface.js';
import { verifyToken } from '../auth/jwt.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { WSMessageType } from '../types/websocket.js';

interface AuthFailureOptions {
  ws: WebSocket;
  connectionId: string;
  messageId: string | undefined;
  code: string;
  reason: string;
}
import type { WSAuthMessage, WSErrorMessage, WSEventMessage } from '../types/websocket.js';

/**
 * WebSocket authentication handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */
export class WSAuthHandler {
  private logger: pino.Logger;
  private sessionStore: SessionStore;

  constructor(logger: pino.Logger, sessionStore: SessionStore) {
    this.logger = logger.child({ module: 'ws-auth-handler' });
    this.sessionStore = sessionStore;
  }

  /**
   * Validate authentication credentials
   */
  private validateCredentials(token?: string, apiKey?: string): { valid: boolean; error?: string } {
    if ((token === null || token === undefined || token.length === 0) && 
        (apiKey === null || apiKey === undefined || apiKey.length === 0)) {
      return { valid: false, error: 'Missing credentials' };
    }
    return { valid: true };
  }

  /**
   * Handle authentication message
   * @nist ia-2 "User authentication"
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async handleAuth(
    ws: WebSocket,
    connectionId: string,
    message: WSAuthMessage
  ): Promise<{ success: boolean; userId?: string; sessionId?: string; error?: string }> {
    try {
      const { token, apiKey } = message.data;

      // Validate input
      const validation = this.validateCredentials(token, apiKey);
      if (!validation.valid) {
        return this.handleAuthFailure({ ws, connectionId, messageId: message.id, code: 'MISSING_CREDENTIALS', reason: validation.error ?? 'Missing credentials' });
      }

      // Try token authentication first
      if (this.hasValidToken(token)) {
        const result = await this.authenticateWithToken(ws, connectionId, message.id, token || '');
        if (result.success) {
          return result;
        }
      }

      // Try API key authentication
      if (this.hasValidApiKey(apiKey)) {
        const result = this.authenticateWithApiKey(ws, connectionId, message.id, apiKey ?? '');
        if (result.success) {
          return result;
        }
      }

      // All authentication methods failed
      return this.handleAuthFailure({ ws, connectionId, messageId: message.id, code: 'INVALID_CREDENTIALS', reason: 'Invalid token or API key' });
    } catch (error) {
      return this.handleAuthError(ws, connectionId, message.id, error);
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthFailure(options: AuthFailureOptions): Promise<{ success: boolean; error: string }> {
    return this.sendAuthFailureResponse(options);
  }

  private async sendAuthFailureResponse(options: AuthFailureOptions): Promise<{ success: boolean; error: string }> {
    const { ws, connectionId, messageId, code, reason } = options;
    await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
      resource: 'websocket',
      action: 'authenticate',
      result: 'failure',
      reason,
      metadata: { connectionId },
    });

    this.sendAuthError(ws, messageId, code, reason);
    return { success: false, error: reason };
  }

  /**
   * Handle authentication error
   */
  private async handleAuthError(
    ws: WebSocket,
    connectionId: string,
    messageId: string | undefined,
    error: unknown
  ): Promise<{ success: boolean; error: string }> {
    this.logger.error('Authentication error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
      resource: 'websocket',
      action: 'authenticate',
      result: 'failure',
      reason: errorMessage,
      metadata: { connectionId },
    });

    this.sendAuthError(ws, messageId, 'AUTH_ERROR', 'Authentication failed');
    return { success: false, error: 'Authentication error' };
  }

  /**
   * Check if token is valid and non-empty
   */
  private hasValidToken(token?: string): boolean {
    return token !== null && token !== undefined && token.length > 0;
  }

  /**
   * Check if API key is valid and non-empty
   */
  private hasValidApiKey(apiKey?: string): boolean {
    return apiKey !== null && apiKey !== undefined && apiKey.length > 0;
  }

  /**
   * Authenticate with JWT token
   * @nist ia-2 "Identification and authentication"
   */
  private async authenticateWithToken(
    ws: WebSocket,
    connectionId: string,
    messageId: string | undefined,
    token: string
  ): Promise<{ success: boolean; userId?: string; sessionId?: string; error?: string }> {
    try {
      // Verify token
      const payload = await verifyToken(token, 'access');
      
      if (!payload?.sessionId) {
        return { success: false, error: 'Invalid token' };
      }

      // Get session
      const session = await this.sessionStore.get(payload.sessionId);
      
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check session expiration
      const expiresAt = new Date(session.data.expiresAt).getTime();
      if (expiresAt < Date.now()) {
        return { success: false, error: 'Session expired' };
      }

      // Update session last accessed time
      await this.sessionStore.touch(session.id);

      // Log successful authentication
      await logSecurityEvent(SecurityEventType.AUTH_SUCCESS, {
        resource: 'websocket',
        action: 'authenticate',
        result: 'success',
        metadata: {
          connectionId,
          sessionId: session.id,
          userId: session.data.userId,
          method: 'token',
        },
      });

      // Send success response
      this.sendAuthSuccess(ws, messageId, {
        sessionId: session.id,
        userId: session.data.userId,
        username: session.data.username,
        roles: session.data.roles,
      });

      return {
        success: true,
        userId: session.data.userId,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.debug('Token authentication failed:', error);
      return { success: false, error: 'Token validation failed' };
    }
  }

  /**
   * Authenticate with API key
   * @nist ia-2 "Identification and authentication"
   */
  private authenticateWithApiKey(
    _ws: WebSocket,
    _connectionId: string,
    _messageId: string | undefined,
    _apiKey: string
  ): { success: boolean; userId?: string; sessionId?: string; error?: string } {
    try {
      // TODO: Implement API key authentication
      // For now, this is a placeholder
      this.logger.warn('API key authentication not yet implemented');
      return { success: false, error: 'API key authentication not implemented' };
    } catch (error) {
      this.logger.debug('API key authentication failed:', error);
      return { success: false, error: 'API key validation failed' };
    }
  }

  /**
   * Send authentication success message
   */
  private sendAuthSuccess(ws: WebSocket, requestId: string | undefined, data: Record<string, unknown>): void {
    const message: WSEventMessage = {
      type: WSMessageType.EVENT,
      id: requestId ?? uuidv4(),
      timestamp: new Date().toISOString(),
      event: 'auth_success',
      data,
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send authentication error message
   */
  private sendAuthError(
    ws: WebSocket,
    requestId: string | undefined,
    code: string,
    message: string
  ): void {
    const errorMessage: WSErrorMessage = {
      type: WSMessageType.ERROR,
      id: requestId ?? uuidv4(),
      timestamp: new Date().toISOString(),
      error: {
        code,
        message,
      },
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMessage));
    }
  }

  /**
   * Validate connection has required permissions
   * @nist ac-3 "Access enforcement"
   */
  validatePermissions(
    connectionState: { authenticated?: boolean; roles?: string[]; permissions?: string[] },
    requiredRoles?: string[],
    requiredPermissions?: string[]
  ): boolean {
    if (connectionState.authenticated !== true) {
      return false;
    }

    // Check roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(role => 
        connectionState.roles?.includes(role)
      );
      if (!hasRole) {
        return false;
      }
    }

    // Check permissions (if implemented)
    if (requiredPermissions && requiredPermissions.length > 0) {
      // TODO: Implement permission checking
      return false;
    }

    return true;
  }

  /**
   * Refresh authentication
   * @nist ia-2 "Identification and authentication"
   */
  async refreshAuth(
    ws: WebSocket,
    connectionId: string,
    sessionId: string
  ): Promise<boolean> {
    try {
      // Get current session
      const session = await this.sessionStore.get(sessionId);
      
      if (!session) {
        this.logger.warn('Session not found for refresh', { connectionId, sessionId });
        return false;
      }

      // Check if session is still valid
      const expiresAt = new Date(session.data.expiresAt).getTime();
      if (expiresAt < Date.now()) {
        this.logger.warn('Session expired during refresh', { connectionId, sessionId });
        return false;
      }

      // Update session last accessed time
      await this.sessionStore.touch(session.id);

      // Log refresh
      await logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, {
        resource: 'websocket',
        action: 'refresh_auth',
        result: 'success',
        metadata: {
          connectionId,
          sessionId: session.id,
          userId: session.data.userId,
        },
      });

      return true;
    } catch (error) {
      this.logger.error('Error refreshing authentication:', error);
      return false;
    }
  }
}