/**
 * Combined authentication middleware supporting both JWT and API keys
 * @module auth/combined-middleware
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { verifyToken, extractTokenFromHeader } from './jwt.js';
import { apiKeyStore } from '../store/api-key-store.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import type { SessionStore } from '../store/session-store.interface.js';
import type { AuthenticatedRequest } from '../types/express.js';

/**
 * Create combined authentication middleware that supports both JWT and API keys
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */
export const createCombinedAuthMiddleware = (sessionStore: SessionStore) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for API key first
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
      if (apiKeyHeader !== undefined && apiKeyHeader.trim().length > 0) {
        const keyData = await apiKeyStore.verify(apiKeyHeader);

        if (!keyData) {
          await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
            resource: req.path,
            action: req.method,
            result: 'failure',
            reason: 'Invalid API key',
            metadata: {
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              authMethod: 'api-key',
            },
          });
          throw new AppError('Invalid API key', 401);
        }

        // Create user object from API key
        (req as AuthenticatedRequest).user = {
          userId: keyData.userId,
          username: `apikey:${keyData.name}`,
          roles: keyData.roles,
          sessionId: `apikey:${keyData.id}`, // Synthetic session ID
        };

        await logSecurityEvent(SecurityEventType.ACCESS_GRANTED, {
          userId: keyData.userId,
          resource: req.path,
          action: req.method,
          result: 'success',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            authMethod: 'api-key',
            apiKeyId: keyData.id,
          },
        });

        return next();
      }

      // Check for JWT token
      const token = extractTokenFromHeader(req.headers.authorization);

      if (token === null || token === undefined || token.trim().length === 0) {
        throw new AppError('No authentication credentials provided', 401);
      }

      // Verify JWT token
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

      // Attach user info to request
      (req as AuthenticatedRequest).user = {
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
          authMethod: 'jwt',
        },
      });

      next();
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

      next(error);
    }
  };
};

/**
 * Create a unified requireAuth middleware
 */
export const createRequireAuth = (
  sessionStore: SessionStore,
): ReturnType<typeof createCombinedAuthMiddleware> => {
  return createCombinedAuthMiddleware(sessionStore);
};
