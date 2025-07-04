/**
 * WebSocket authentication handler
 * @module ws/auth-handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { SessionStore } from '../store/session-store.interface.js';
import { verifyToken } from '../auth/jwt.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { hasPermission, Permission, getPermissionsForRoles } from '../auth/permissions.js';
import { WSApiKeyAuthHandler } from './auth-handler-apikey.js';
import { sendAuthSuccess, sendAuthError } from './auth-handler-messages.js';

interface AuthFailureOptions {
  ws: WebSocket;
  connectionId: string;
  messageId: string | undefined;
  code: string;
  reason: string;
}
import type { WSAuthMessage } from '../types/websocket.js';

/**
 * WebSocket authentication handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */
export class WSAuthHandler {
  private logger: pino.Logger;
  private sessionStore: SessionStore;
  private apiKeyHandler: WSApiKeyAuthHandler;

  constructor(logger: pino.Logger, sessionStore: SessionStore) {
    this.logger = logger.child({ module: 'ws-auth-handler' });
    this.sessionStore = sessionStore;
    this.apiKeyHandler = new WSApiKeyAuthHandler(logger, sessionStore);
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
  ): Promise<{ success: boolean; userId?: string; sessionId?: string; roles?: string[]; permissions?: string[]; scopes?: string[]; error?: string }> {
    try {
      const { token, apiKey } = message.data;

      // Validate input
      const validation = this.validateCredentials(token, apiKey);
      if (!validation.valid) {
        return await this.handleAuthFailure({ ws, connectionId, messageId: message.id, code: 'MISSING_CREDENTIALS', reason: validation.error ?? 'Missing credentials' });
      }

      // Try token authentication first
      if (this.hasValidToken(token)) {
        const result = await this.authenticateWithToken(ws, connectionId, message.id, token || '');
        if (result.success) {
          return result;
        }
      }

      // Try API key authentication
      if (this.apiKeyHandler.hasValidApiKey(apiKey)) {
        const result = await this.apiKeyHandler.authenticateWithApiKey(ws, connectionId, message.id, apiKey ?? '');
        if (result.success) {
          return result;
        }
      }

      // All authentication methods failed
      return await this.handleAuthFailure({ ws, connectionId, messageId: message.id, code: 'INVALID_CREDENTIALS', reason: 'Invalid token or API key' });
    } catch (error) {
      return this.handleAuthError(ws, connectionId, message.id, error);
    }
  }

  /**
   * Handle authentication failure
   */
  private async handleAuthFailure(options: AuthFailureOptions): Promise<{ success: boolean; error: string }> {
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

    sendAuthError(ws, messageId, code, reason);
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

    sendAuthError(ws, messageId, 'AUTH_ERROR', 'Authentication failed');
    return { success: false, error: 'Authentication error' };
  }

  /**
   * Check if token is valid and non-empty
   */
  private hasValidToken(token?: string): boolean {
    return token !== null && token !== undefined && token.length > 0;
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
  ): Promise<{ success: boolean; userId?: string; sessionId?: string; roles?: string[]; permissions?: string[]; scopes?: string[]; error?: string }> {
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
      sendAuthSuccess(ws, messageId, {
        sessionId: session.id,
        userId: session.data.userId,
        username: session.data.username,
        roles: session.data.roles,
        permissions: getPermissionsForRoles(session.data.roles),
      });

      return {
        success: true,
        userId: session.data.userId,
        sessionId: session.id,
        roles: session.data.roles,
        permissions: getPermissionsForRoles(session.data.roles),
      };
    } catch (error) {
      this.logger.debug('Token authentication failed:', error);
      return { success: false, error: 'Token validation failed' };
    }
  }



  /**
   * Validate connection has required permissions
   * @nist ac-3 "Access enforcement"
   */
  validatePermissions(
    connectionState: { authenticated?: boolean; roles?: string[]; permissions?: string[]; scopes?: string[] },
    requiredPermission?: Permission
  ): boolean {
    if (connectionState.authenticated !== true) {
      return false;
    }

    // If no specific permission required, just check authentication
    if (requiredPermission === null || requiredPermission === undefined) {
      return true;
    }

    // Check if user has the required permission
    const roles = connectionState.roles ?? [];
    const scopes = connectionState.scopes ?? [];
    
    return hasPermission(roles, requiredPermission, scopes);
  }

  /**
   * Refresh authentication
   * @nist ia-2 "Identification and authentication"
   */
  async refreshAuth(
    _ws: WebSocket,
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
          sessionId: sessionId,
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