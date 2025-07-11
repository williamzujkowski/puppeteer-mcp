/**
 * Authentication and authorization for gRPC
 * @module mcp/adapters/grpc/auth-handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { z } from 'zod';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { AuthParams } from '../adapter.interface.js';
import type { ValidationResult } from './types.js';

/**
 * Authentication result interface
 */
interface AuthResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * gRPC authentication and authorization handler
 */
export class GrpcAuthHandler {
  /**
   * Authentication parameters schema
   */
  private readonly authParamsSchema = z.object({
    type: z.enum(['jwt', 'apikey', 'session']),
    credentials: z.string().min(1),
  });

  /**
   * Validate authentication parameters
   * @nist ia-2 "Identification and authentication"
   */
  validateAuthParams(auth: unknown): ValidationResult<AuthParams> {
    const result = this.authParamsSchema.safeParse(auth);

    if (!result.success) {
      return {
        success: false,
        error: `Authentication validation failed: ${result.error.message}`,
      };
    }

    return {
      success: true,
      data: result.data as AuthParams,
    };
  }

  /**
   * Authenticate request based on auth type
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   */
  async authenticate(
    auth: AuthParams,
    metadata: grpc.Metadata,
    sessionId?: string,
  ): Promise<AuthResult> {
    const startTime = Date.now();

    try {
      let result: AuthResult;

      switch (auth.type) {
        case 'jwt':
          result = await this.authenticateJWT(auth.credentials, metadata);
          break;
        case 'apikey':
          result = await this.authenticateAPIKey(auth.credentials, metadata);
          break;
        case 'session':
          result = await this.authenticateSession(auth.credentials, metadata);
          break;
        default:
          result = {
            success: false,
            error: `Unsupported authentication type: ${String(auth.type)}`,
          };
      }

      // Log authentication result
      await logSecurityEvent(
        result.success ? SecurityEventType.AUTH_SUCCESS : SecurityEventType.AUTH_FAILURE,
        {
          userId: result.userId ?? sessionId,
          resource: 'grpc-authentication',
          action: 'authenticate',
          result: result.success ? 'success' : 'failure',
          reason: result.error ?? undefined,
          metadata: {
            authType: auth.type,
            duration: Date.now() - startTime,
            protocol: 'grpc',
            ...result.metadata,
          },
        },
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';

      await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
        userId: sessionId,
        resource: 'grpc-authentication',
        action: 'authenticate',
        result: 'failure',
        reason: errorMessage,
        metadata: {
          authType: auth.type,
          duration: Date.now() - startTime,
          protocol: 'grpc',
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Authenticate JWT token
   * @nist ia-2 "Identification and authentication"
   */
  private authenticateJWT(token: string, _metadata: grpc.Metadata): Promise<AuthResult> {
    return Promise.resolve()
      .then(() => {
        // Basic JWT validation (in production, use proper JWT library)
        if (!token.startsWith('Bearer ')) {
          return {
            success: false,
            error: 'Invalid JWT format - must start with Bearer',
          };
        }

        const jwtToken = token.slice(7);
        if (jwtToken.split('.').length !== 3) {
          return {
            success: false,
            error: 'Invalid JWT structure',
          };
        }

        // Mock JWT validation - replace with actual JWT verification
        if (jwtToken === 'valid.jwt.token') {
          return {
            success: true,
            userId: 'jwt-user',
            metadata: {
              tokenType: 'jwt',
              issuer: 'mcp-grpc-service',
            },
          };
        }

        return {
          success: false,
          error: 'Invalid JWT token',
        };
      })
      .catch((error: unknown) => {
        return {
          success: false,
          error: `JWT authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      });
  }

  /**
   * Authenticate API key
   * @nist ia-2 "Identification and authentication"
   */
  private authenticateAPIKey(apiKey: string, _metadata: grpc.Metadata): Promise<AuthResult> {
    return Promise.resolve()
      .then(() => {
        // Basic API key validation
        if (apiKey.length < 10) {
          return {
            success: false,
            error: 'API key too short',
          };
        }

        // Mock API key validation - replace with actual key verification
        if (apiKey.startsWith('mcp-') && apiKey.length >= 32) {
          return {
            success: true,
            userId: `apikey-${apiKey.slice(-8)}`,
            metadata: {
              keyType: 'api',
              keyPrefix: apiKey.slice(0, 8),
            },
          };
        }

        return {
          success: false,
          error: 'Invalid API key',
        };
      })
      .catch((error: unknown) => {
        return {
          success: false,
          error: `API key authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      });
  }

  /**
   * Authenticate session
   * @nist ia-2 "Identification and authentication"
   */
  private authenticateSession(sessionId: string, _metadata: grpc.Metadata): Promise<AuthResult> {
    return Promise.resolve()
      .then(() => {
        // Basic session validation
        if (sessionId.length < 16) {
          return {
            success: false,
            error: 'Session ID too short',
          };
        }

        // Mock session validation - replace with actual session verification
        if (sessionId.startsWith('sess-') && sessionId.length >= 24) {
          return {
            success: true,
            userId: `session-${sessionId.slice(-8)}`,
            sessionId,
            metadata: {
              sessionType: 'active',
              sessionPrefix: sessionId.slice(0, 8),
            },
          };
        }

        return {
          success: false,
          error: 'Invalid session ID',
        };
      })
      .catch((error: unknown) => {
        return {
          success: false,
          error: `Session authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      });
  }

  /**
   * Check if service requires authentication
   * @nist ac-3 "Access enforcement"
   */
  requiresAuthentication(serviceName: string, _methodName: string): boolean {
    // Health service methods are publicly accessible
    if (serviceName === 'HealthService') {
      return false;
    }

    // All other services require authentication
    return true;
  }

  /**
   * Check if user has permission for operation
   * @nist ac-3 "Access enforcement"
   */
  async checkPermission(
    userId: string,
    serviceName: string,
    methodName: string,
    _metadata: grpc.Metadata,
  ): Promise<boolean> {
    try {
      // Basic permission check - in production, integrate with proper RBAC system

      // Admin users have full access
      if (userId.includes('admin')) {
        return true;
      }

      // Service-specific permissions
      switch (serviceName) {
        case 'SessionService':
          // Users can manage their own sessions
          return (
            methodName.includes('Get') ||
            methodName.includes('Update') ||
            methodName.includes('Refresh')
          );

        case 'ContextService':
          // Users can access context operations
          return true;

        case 'HealthService':
          // Public access
          return true;

        default:
          return false;
      }
    } catch (error) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId,
        resource: `${serviceName}.${methodName}`,
        action: 'permission_check',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Permission check error',
      });

      return false;
    }
  }
}
