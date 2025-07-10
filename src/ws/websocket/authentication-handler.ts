/**
 * WebSocket authentication and authorization handler
 * @module ws/websocket/authentication-handler
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { WSMessageType } from '../../types/websocket.js';
import type { WSAuthMessage, WSMessage } from '../../types/websocket.js';
import type { ConnectionManager } from './connection-manager.js';
import type { WSComponentDependencies } from './types.js';

/**
 * Authentication result
 */
interface AuthenticationResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * WebSocket authentication and authorization handler
 * @nist ac-3 "Access enforcement"
 */
export class AuthenticationHandler {
  private logger: pino.Logger;
  private sessionStore: SessionStore;

  constructor({ logger, sessionStore }: WSComponentDependencies) {
    this.logger = logger.child({ module: 'ws-auth-handler' });
    this.sessionStore = sessionStore;
  }

  /**
   * Handle authentication message
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async handleAuthentication(
    _ws: WebSocket,
    connectionId: string,
    message: WSAuthMessage,
    connectionManager: ConnectionManager,
  ): Promise<WSMessage> {
    try {
      const remoteAddress = this.getRemoteAddress(connectionId, connectionManager);

      // Log authentication attempt
      await logSecurityEvent(SecurityEventType.AUTHENTICATION_ATTEMPT, {
        resource: 'websocket',
        action: 'authenticate',
        metadata: {
          connectionId,
          remoteAddress,
          hasToken: Boolean(message.data.token),
          hasApiKey: Boolean(message.data.apiKey),
        },
      });

      const authResult = await this.authenticateCredentials(message);

      if (authResult.success && authResult.userId && authResult.sessionId) {
        // Authenticate the connection
        connectionManager.authenticateConnection({
          connectionId,
          userId: authResult.userId,
          sessionId: authResult.sessionId,
          roles: authResult.roles,
          permissions: authResult.permissions,
          scopes: authResult.scopes,
        });

        // Log successful authentication
        await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, {
          resource: 'websocket',
          action: 'authenticate',
          result: 'success',
          metadata: {
            connectionId,
            userId: authResult.userId,
            sessionId: authResult.sessionId,
            roleCount: authResult.roles?.length ?? 0,
            permissionCount: authResult.permissions?.length ?? 0,
            scopeCount: authResult.scopes?.length ?? 0,
            remoteAddress,
          },
        });

        this.logger.info('WebSocket authentication successful', {
          connectionId,
          userId: authResult.userId,
          sessionId: authResult.sessionId,
        });

        return this.createAuthSuccessMessage(message.id, authResult);
      } else {
        // Log authentication failure
        await logSecurityEvent(SecurityEventType.WS_AUTHENTICATION_FAILED, {
          resource: 'websocket',
          action: 'authenticate',
          result: 'failure',
          metadata: {
            connectionId,
            error: authResult.error?.code ?? 'unknown',
            remoteAddress,
          },
        });

        this.logger.warn('WebSocket authentication failed', {
          connectionId,
          error: authResult.error,
        });

        return this.createAuthErrorMessage(message.id, authResult.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';

      this.logger.error('Authentication error', {
        connectionId,
        error: errorMessage,
      });

      // Log authentication error
      await logSecurityEvent(SecurityEventType.WS_AUTHENTICATION_FAILED, {
        resource: 'websocket',
        action: 'authenticate',
        result: 'failure',
        metadata: {
          connectionId,
          error: errorMessage,
        },
      });

      return this.createAuthErrorMessage(message.id, {
        code: 'AUTHENTICATION_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Check if connection has required permissions
   * @nist ac-3 "Access enforcement"
   */
  hasPermission(connectionId: string, requiredPermission: string, connectionManager: ConnectionManager): boolean {
    const state = connectionManager.getConnectionState(connectionId);
    
    if (!state?.authenticated || !state.permissions) {
      return false;
    }

    return state.permissions.includes(requiredPermission) || state.permissions.includes('*');
  }

  /**
   * Check if connection has required role
   * @nist ac-3 "Access enforcement"
   */
  hasRole(connectionId: string, requiredRole: string, connectionManager: ConnectionManager): boolean {
    const state = connectionManager.getConnectionState(connectionId);
    
    if (!state?.authenticated || !state.roles) {
      return false;
    }

    return state.roles.includes(requiredRole) || state.roles.includes('admin');
  }

  /**
   * Check if connection has required scope
   * @nist ac-3 "Access enforcement"
   */
  hasScope(connectionId: string, requiredScope: string, connectionManager: ConnectionManager): boolean {
    const state = connectionManager.getConnectionState(connectionId);
    
    if (!state?.authenticated || !state.scopes) {
      return false;
    }

    return state.scopes.includes(requiredScope) || state.scopes.includes('*');
  }

  /**
   * Validate session token and extract user information
   */
  private async authenticateCredentials(message: WSAuthMessage): Promise<AuthenticationResult> {
    const { token, apiKey } = message.data;

    if (!token && !apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Token or API key required',
        },
      };
    }

    try {
      // Authenticate with session store
      if (token) {
        const session = await this.sessionStore.get(token);
        if (session && session.data.userId) {
          return {
            success: true,
            userId: session.data.userId,
            sessionId: session.id,
            roles: session.data.roles ?? [],
            permissions: (session.data as any).permissions ?? [],
            scopes: (session.data as any).scopes ?? [],
          };
        }
      }

      // Try API key authentication if token fails
      if (apiKey) {
        // API key authentication would need separate implementation
        const apiKeySession = null; // await this.sessionStore.getSessionByApiKey(apiKey);
        if (apiKeySession && (apiKeySession as any).userId) {
          return {
            success: true,
            userId: (apiKeySession as any).userId,
            sessionId: (apiKeySession as any).id,
            roles: (apiKeySession as any).roles ?? [],
            permissions: (apiKeySession as any).permissions ?? [],
            scopes: (apiKeySession as any).scopes ?? [],
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid token or API key',
        },
      };
    } catch (error) {
      this.logger.error('Error validating credentials', { error });
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Failed to validate credentials',
        },
      };
    }
  }

  /**
   * Create authentication success message
   */
  private createAuthSuccessMessage(requestId: string | undefined, authResult: AuthenticationResult): WSMessage {
    return {
      type: WSMessageType.AUTH_SUCCESS,
      id: requestId,
      timestamp: new Date().toISOString(),
      data: {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        roles: authResult.roles ?? [],
        permissions: authResult.permissions ?? [],
        scopes: authResult.scopes ?? [],
      },
    };
  }

  /**
   * Create authentication error message
   */
  private createAuthErrorMessage(
    requestId: string | undefined,
    error?: { code: string; message: string },
  ): WSMessage {
    return {
      type: WSMessageType.AUTH_ERROR,
      id: requestId,
      timestamp: new Date().toISOString(),
      error: error ?? {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      },
    };
  }

  /**
   * Get remote address for logging
   */
  private getRemoteAddress(connectionId: string, connectionManager: ConnectionManager): string | undefined {
    const state = connectionManager.getConnectionState(connectionId);
    return state?.remoteAddress;
  }
}