/**
 * WebSocket API key authentication handler
 * @module ws/auth-handler-apikey
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { SessionStore } from '../store/session-store.interface.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { apiKeyStore } from '../store/api-key-store.js';
import { getPermissionsForRoles } from '../auth/permissions.js';
import { sendAuthSuccess } from './auth-handler-messages.js';

export interface ApiKeyAuthResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  error?: string;
}

/**
 * WebSocket API key authentication handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */
export class WSApiKeyAuthHandler {
  private logger: pino.Logger;
  private sessionStore: SessionStore;

  constructor(logger: pino.Logger, sessionStore: SessionStore) {
    this.logger = logger.child({ module: 'ws-apikey-auth-handler' });
    this.sessionStore = sessionStore;
  }

  /**
   * Check if API key is valid and non-empty
   */
  hasValidApiKey(apiKey?: string): boolean {
    return apiKey !== null && apiKey !== undefined && apiKey.length > 0;
  }

  /**
   * Authenticate with API key
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async authenticateWithApiKey(
    ws: WebSocket,
    _connectionId: string,
    messageId: string | undefined,
    apiKey: string,
  ): Promise<ApiKeyAuthResult> {
    try {
      // Verify API key
      const keyData = await apiKeyStore.verify(apiKey);

      if (!keyData) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          reason: 'Invalid API key',
          result: 'failure',
          metadata: { method: 'api_key' },
        });
        return { success: false, error: 'Invalid API key' };
      }

      // Create a new session for the API key
      const sessionData = {
        userId: keyData.userId,
        username: `apikey:${keyData.name}`,
        roles: keyData.roles,
        createdAt: new Date().toISOString(),
        expiresAt:
          keyData.expiresAt !== null && keyData.expiresAt !== undefined && keyData.expiresAt > 0
            ? new Date(keyData.expiresAt).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours default
        metadata: {
          authMethod: 'api_key',
          apiKeyId: keyData.id,
          apiKeyName: keyData.name,
        },
      };

      const sessionId = await this.sessionStore.create(sessionData);

      // Log successful authentication
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: keyData.userId,
        result: 'success',
        metadata: {
          method: 'api_key',
          apiKeyId: keyData.id,
          sessionId: sessionId,
        },
      });

      // Send success response with permissions
      sendAuthSuccess(ws, messageId, {
        sessionId: sessionId,
        userId: keyData.userId,
        username: `apikey:${keyData.name}`,
        roles: keyData.roles,
        permissions: getPermissionsForRoles(keyData.roles),
        scopes: keyData.scopes,
      });

      return {
        success: true,
        userId: keyData.userId,
        sessionId: sessionId,
        roles: keyData.roles,
        permissions: getPermissionsForRoles(keyData.roles),
        scopes: keyData.scopes,
      };
    } catch (error) {
      this.logger.error('API key authentication error:', error);
      return { success: false, error: 'API key validation failed' };
    }
  }
}
