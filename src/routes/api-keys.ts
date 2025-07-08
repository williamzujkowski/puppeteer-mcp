/**
 * API key management routes
 * @module routes/api-keys
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 * @nist ac-3 "Access enforcement"
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createCombinedAuthMiddleware } from '../auth/combined-middleware.js';
import { apiKeyStore } from '../store/api-key-store.js';
import { validateRequest } from '../core/middleware/validate-request.js';
import { AppError } from '../core/errors/app-error.js';
import type { SessionStore } from '../store/session-store.interface.js';

// Create API key schema
const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    roles: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
    expiresIn: z.number().positive().optional(), // Milliseconds
    metadata: z.record(z.unknown()).optional(),
  }),
});

// List API keys schema
const listApiKeysSchema = z.object({
  query: z.object({
    active: z.enum(['true', 'false']).optional(),
  }),
});

/**
 * Handle API key creation
 * @nist ia-5 "Authenticator management"
 * @nist au-3 "Content of audit records"
 */
function createApiKeyHandler(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const { name, roles, scopes, expiresIn, metadata } = req.body;

      // Ensure user exists
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      // Calculate expiration time if provided
      const expiresAt =
        expiresIn !== undefined && expiresIn !== null ? Date.now() + expiresIn : undefined;

      // Create API key
      const result = await apiKeyStore.create({
        userId: req.user.userId,
        name,
        roles: roles ?? req.user.roles,
        scopes,
        expiresAt,
        metadata,
      });

      // Return key info (only time plain text key is available)
      res.status(201).json({
        apiKey: {
          id: result.apiKey.id,
          name: result.apiKey.name,
          prefix: result.apiKey.prefix,
          roles: result.apiKey.roles,
          scopes: result.apiKey.scopes,
          createdAt: new Date(result.apiKey.createdAt).toISOString(),
          expiresAt:
            result.apiKey.expiresAt !== null && result.apiKey.expiresAt !== undefined
              ? new Date(result.apiKey.expiresAt).toISOString()
              : undefined,
        },
        // Only returned on creation!
        plainTextKey: result.plainTextKey,
        warning: 'Save this key securely. It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  })();
}

/**
 * Handle listing API keys
 * @nist ac-3 "Access enforcement"
 */
function listApiKeysHandler(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const { active } = req.query;

      // Ensure user exists
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      // Get all keys for user
      let keys = await apiKeyStore.list(req.user.userId);

      // Filter by active status if requested
      if (active !== undefined) {
        const isActive = active === 'true';
        keys = keys.filter((key) => key.active === isActive);
      }

      // Map to response format (never expose key hash)
      const response = keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        roles: key.roles,
        scopes: key.scopes,
        active: key.active,
        createdAt: new Date(key.createdAt).toISOString(),
        lastUsedAt:
          key.lastUsedAt !== null && key.lastUsedAt !== undefined
            ? new Date(key.lastUsedAt).toISOString()
            : undefined,
        expiresAt:
          key.expiresAt !== null && key.expiresAt !== undefined
            ? new Date(key.expiresAt).toISOString()
            : undefined,
      }));

      res.json({ apiKeys: response });
    } catch (error) {
      next(error);
    }
  })();
}

/**
 * Validate API key ID parameter
 */
function validateApiKeyId(id: string | undefined): asserts id is string {
  if (id === undefined || id === null || id === '') {
    throw new AppError('API key ID is required', 400);
  }
}

/**
 * Check if user can access API key
 */
function checkApiKeyAccess(
  key: { userId: string },
  user: { userId: string; roles: string[] },
): void {
  if (key.userId !== user.userId && !user.roles.includes('admin')) {
    throw new AppError('Access denied', 403);
  }
}

/**
 * Handle getting API key details
 * @nist ac-3 "Access enforcement"
 */
function getApiKeyHandler(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const { id } = req.params;
      validateApiKeyId(id);

      // Ensure user exists
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const key = await apiKeyStore.get(id);

      if (!key) {
        throw new AppError('API key not found', 404);
      }

      // Ensure user owns the key
      checkApiKeyAccess(key, req.user);

      res.json({
        apiKey: {
          id: key.id,
          name: key.name,
          prefix: key.prefix,
          roles: key.roles,
          scopes: key.scopes,
          active: key.active,
          createdAt: new Date(key.createdAt).toISOString(),
          lastUsedAt:
            key.lastUsedAt !== null && key.lastUsedAt !== undefined
              ? new Date(key.lastUsedAt).toISOString()
              : undefined,
          expiresAt:
            key.expiresAt !== null && key.expiresAt !== undefined
              ? new Date(key.expiresAt).toISOString()
              : undefined,
          metadata: key.metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  })();
}

/**
 * Handle revoking API key
 * @nist ia-5 "Authenticator management"
 * @nist au-3 "Content of audit records"
 */
function revokeApiKeyHandler(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const { id } = req.params;
      validateApiKeyId(id);

      // Ensure user exists
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const key = await apiKeyStore.get(id);

      if (!key) {
        throw new AppError('API key not found', 404);
      }

      // Ensure user owns the key
      checkApiKeyAccess(key, req.user);

      // Revoke the key
      await apiKeyStore.revoke(id);

      res.json({
        message: 'API key revoked successfully',
        apiKey: {
          id: key.id,
          name: key.name,
          revokedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  })();
}

/**
 * Create API key routes with session store dependency
 */
export function createApiKeyRoutes(sessionStore: SessionStore): Router {
  const router = Router();
  const requireAuth = createCombinedAuthMiddleware(sessionStore);

  // Wrapper to handle async requireAuth middleware
  const authWrapper = (req: Request, res: Response, next: NextFunction): void => {
    void requireAuth(req, res, next);
  };

  // Wrapper to handle async validateRequest middleware
  const validationWrapper =
    (schema: z.ZodSchema) =>
    (req: Request, res: Response, next: NextFunction): void => {
      void validateRequest(schema)(req, res, next);
    };

  // Create a new API key
  router.post('/', authWrapper, validationWrapper(createApiKeySchema), createApiKeyHandler);

  // List user's API keys
  router.get('/', authWrapper, validationWrapper(listApiKeysSchema), listApiKeysHandler);

  // Get API key details
  router.get('/:id', authWrapper, getApiKeyHandler);

  // Revoke an API key
  router.delete('/:id', authWrapper, revokeApiKeyHandler);

  return router;
}
