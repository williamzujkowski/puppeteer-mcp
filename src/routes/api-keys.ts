/**
 * API key management routes
 * @module routes/api-keys
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 * @nist ac-3 "Access enforcement"
 */

import { Router } from 'express';
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
 * Create API key routes with session store dependency
 */
export function createApiKeyRoutes(sessionStore: SessionStore): Router {
  const router = Router();
  const requireAuth = createCombinedAuthMiddleware(sessionStore);

/**
 * Create a new API key
 * @route POST /api/v1/api-keys
 * @nist ia-5 "Authenticator management"
 * @nist au-3 "Content of audit records"
 */
router.post(
  '/',
  requireAuth,
  validateRequest(createApiKeySchema),
  async (req, res) => {
    const { name, roles, scopes, expiresIn, metadata } = req.body;

    // Calculate expiration time if provided
    const expiresAt = expiresIn 
      ? Date.now() + expiresIn 
      : undefined;

    // Create API key
    const result = await apiKeyStore.create({
      userId: req.user!.userId,
      name,
      roles: roles ?? req.user!.roles,
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
        expiresAt: result.apiKey.expiresAt 
          ? new Date(result.apiKey.expiresAt).toISOString() 
          : undefined,
      },
      // Only returned on creation!
      plainTextKey: result.plainTextKey,
      warning: 'Save this key securely. It will not be shown again.',
    });
  }
);

/**
 * List user's API keys
 * @route GET /api/v1/api-keys
 * @nist ac-3 "Access enforcement"
 */
router.get(
  '/',
  requireAuth,
  validateRequest(listApiKeysSchema),
  async (req, res) => {
    const { active } = req.query;

    // Get all keys for user
    let keys = await apiKeyStore.list(req.user!.userId);

    // Filter by active status if requested
    if (active !== undefined) {
      const isActive = active === 'true';
      keys = keys.filter(key => key.active === isActive);
    }

    // Map to response format (never expose key hash)
    const response = keys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      roles: key.roles,
      scopes: key.scopes,
      active: key.active,
      createdAt: new Date(key.createdAt).toISOString(),
      lastUsedAt: key.lastUsedAt 
        ? new Date(key.lastUsedAt).toISOString() 
        : undefined,
      expiresAt: key.expiresAt 
        ? new Date(key.expiresAt).toISOString() 
        : undefined,
    }));

    res.json({ apiKeys: response });
  }
);

/**
 * Get API key details
 * @route GET /api/v1/api-keys/:id
 * @nist ac-3 "Access enforcement"
 */
router.get(
  '/:id',
  requireAuth,
  async (req, res) => {
    const { id } = req.params;

    if (!id) {
      throw new AppError('API key ID is required', 400);
    }

    const key = await apiKeyStore.get(id);
    
    if (!key) {
      throw new AppError('API key not found', 404);
    }

    // Ensure user owns the key
    if (key.userId !== req.user!.userId && !req.user!.roles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      apiKey: {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        roles: key.roles,
        scopes: key.scopes,
        active: key.active,
        createdAt: new Date(key.createdAt).toISOString(),
        lastUsedAt: key.lastUsedAt 
          ? new Date(key.lastUsedAt).toISOString() 
          : undefined,
        expiresAt: key.expiresAt 
          ? new Date(key.expiresAt).toISOString() 
          : undefined,
        metadata: key.metadata,
      },
    });
  }
);

/**
 * Revoke an API key
 * @route DELETE /api/v1/api-keys/:id
 * @nist ia-5 "Authenticator management"
 * @nist au-3 "Content of audit records"
 */
router.delete(
  '/:id',
  requireAuth,
  async (req, res) => {
    const { id } = req.params;

    if (!id) {
      throw new AppError('API key ID is required', 400);
    }

    const key = await apiKeyStore.get(id);
    
    if (!key) {
      throw new AppError('API key not found', 404);
    }

    // Ensure user owns the key
    if (key.userId !== req.user!.userId && !req.user!.roles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

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
  }
);

  return router;
}