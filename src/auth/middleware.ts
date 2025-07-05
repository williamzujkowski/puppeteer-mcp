/**
 * Authentication middleware
 * @module auth/middleware
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist ac-7 "Unsuccessful logon attempts"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { verifyToken, extractTokenFromHeader } from './jwt.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { SessionStore } from '../store/session-store.interface.js';
import { z } from 'zod';

/**
 * Type alias for authenticated requests
 */
export type AuthenticatedRequest = Request;

/**
 * API key schema
 */
const apiKeySchema = z.object({
  key: z.string().min(32),
  name: z.string(),
  permissions: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Helper function to handle authentication success
 */
const handleAuthSuccess = async (
  req: Request,
  payload: { sub: string; username: string; roles: string[]; sessionId: string },
): Promise<void> => {
  // Attach user info to request
  req.user = {
    userId: payload.sub,
    username: payload.username,
    roles: payload.roles,
    sessionId: payload.sessionId,
  };

  // Log successful authentication
  await logSecurityEvent(SecurityEventType.ACCESS_GRANTED, {
    userId: payload.sub,
    resource: req.path,
    action: req.method,
    result: 'success',
    metadata: {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });
};

/**
 * Create JWT authentication middleware
 * @nist ia-2 "Identification and authentication"
 * @nist ac-7 "Unsuccessful logon attempts"
 */
export const createAuthMiddleware = (sessionStore: SessionStore) => {
  return (req: Request, _res: Response, next: NextFunction) =>
    void (async () => {
      try {
        // Extract token from Authorization header
        const token = extractTokenFromHeader(req.headers.authorization);

        if (token === null || token === undefined || token.trim().length === 0) {
          throw new AppError('No authentication token provided', 401);
        }

        // Verify token
        const payload = await verifyToken(token, 'access');

        // Verify session exists and is valid
        const session = await sessionStore.get(payload.sessionId);
        if (!session) {
          await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
            userId: payload.sub,
            reason: 'Session not found',
            result: 'failure',
            metadata: {
              ip: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
          throw new AppError('Invalid session', 401);
        }

        // Touch session to update last accessed time
        await sessionStore.touch(payload.sessionId);

        // Handle authentication success
        await handleAuthSuccess(req, payload);

        return next();
      } catch (error) {
        // Log failed authentication attempt
        await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
          resource: req.path,
          action: req.method,
          result: 'failure',
          reason: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });

        return next(error);
      }
    })();
};

/**
 * Create API key authentication middleware
 * @nist ia-2 "Identification and authentication"
 */
interface ApiKeyData {
  key: string;
  name: string;
  permissions: string[];
  expiresAt?: string;
}

export const createApiKeyMiddleware = (validateApiKey: (key: string) => Promise<ApiKeyData>) => {
  return (req: Request, _res: Response, next: NextFunction) =>
    void (async () => {
      try {
        const apiKey = req.headers['x-api-key'] as string | undefined;

        if (apiKey === null || apiKey === undefined || apiKey.trim().length === 0) {
          throw new AppError('No API key provided', 401);
        }

        // Validate API key
        const keyData = await validateApiKey(apiKey);
        const validatedKey = apiKeySchema.parse(keyData);

        // Check if key is expired
        if (validatedKey.expiresAt !== undefined && new Date(validatedKey.expiresAt) < new Date()) {
          throw new AppError('API key expired', 401);
        }

        // Attach key info to request (using a synthetic user object)
        req.user = {
          userId: `api-key:${validatedKey.name}`,
          username: `api-key:${validatedKey.name}`,
          roles: validatedKey.permissions,
          sessionId: 'api-key-session',
        };

        // Log successful authentication
        await logSecurityEvent(SecurityEventType.ACCESS_GRANTED, {
          userId: req.user.userId,
          resource: req.path,
          action: req.method,
          result: 'success',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            authMethod: 'api-key',
          },
        });

        return next();
      } catch (error) {
        // Log failed authentication attempt
        await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
          resource: req.path,
          action: req.method,
          result: 'failure',
          reason: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            authMethod: 'api-key',
          },
        });

        return next(error);
      }
    })();
};

/**
 * Create role-based access control middleware
 * @nist ac-3 "Access enforcement"
 */
export const requireRoles = (...requiredRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) =>
    void (async () => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const hasRequiredRole = requiredRoles.some((role) => req.user?.roles.includes(role));

        if (!hasRequiredRole) {
          await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
            userId: req.user.userId,
            resource: req.path,
            action: req.method,
            result: 'failure',
            reason: 'Insufficient permissions',
            metadata: {
              requiredRoles,
              userRoles: req.user.roles,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });

          throw new AppError(
            `Requires one of the following roles: ${requiredRoles.join(', ')}`,
            403,
          );
        }

        return next();
      } catch (error) {
        return next(error);
      }
    })();
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no credentials provided
 */
export const optionalAuth = (
  sessionStore: SessionStore,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const authMiddleware = createAuthMiddleware(sessionStore);

  return (req: Request, _res: Response, next: NextFunction) => {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token === null || token === undefined || token.trim().length === 0) {
      // No token provided, continue without authentication
      return next();
    }

    // Token provided, attempt authentication
    return authMiddleware(req, _res, next);
  };
};

/**
 * Create middleware to check specific permissions
 * @nist ac-3 "Access enforcement"
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) =>
    void (async () => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        // For API keys, roles are actually permissions
        const userPermissions = req.user.userId.startsWith('api-key:') ? req.user.roles : [];

        const hasRequiredPermission = requiredPermissions.every((perm) =>
          userPermissions.includes(perm),
        );

        if (!hasRequiredPermission) {
          await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
            userId: req.user.userId,
            resource: req.path,
            action: req.method,
            result: 'failure',
            reason: 'Missing required permissions',
            metadata: {
              requiredPermissions,
              userPermissions,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });

          throw new AppError(
            `Requires the following permissions: ${requiredPermissions.join(', ')}`,
            403,
          );
        }

        return next();
      } catch (error) {
        return next(error);
      }
    })();
};
