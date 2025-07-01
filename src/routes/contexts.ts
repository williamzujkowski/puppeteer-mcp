/**
 * Browser contexts API routes
 * @module routes/contexts
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SessionStore } from '../store/session-store.interface.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AppError } from '../core/errors/app-error.js';
import { logDataAccess } from '../utils/logger.js';

/**
 * Context configuration schema
 */
const contextConfigSchema = z.object({
  name: z.string().min(1).max(100),
  viewport: z
    .object({
      width: z.number().int().positive().max(3840),
      height: z.number().int().positive().max(2160),
    })
    .optional(),
  userAgent: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  geolocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().positive().optional(),
    })
    .optional(),
  permissions: z.array(z.enum(['geolocation', 'notifications', 'camera', 'microphone'])).optional(),
  httpCredentials: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  ignoreHTTPSErrors: z.boolean().optional(),
  javaScriptEnabled: z.boolean().optional(),
  bypassCSP: z.boolean().optional(),
  extraHTTPHeaders: z.record(z.string()).optional(),
});

/**
 * Create context routes
 * @nist ac-3 "Access enforcement"
 */
export const createContextRoutes = (sessionStore: SessionStore): Router => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionStore);

  // In-memory storage for contexts (replace with proper storage in production)
  interface Context {
    id: string;
    userId: string;
    config: z.infer<typeof contextConfigSchema>;
    createdAt: string;
    lastUsedAt: string;
    status: string;
  }
  const contexts = new Map<string, Context>();
  const userContexts = new Map<string, Set<string>>();

  /**
   * Create a new browser context
   * POST /v1/contexts
   * @nist au-2 "Audit events"
   */
  router.post('/', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      // Validate request body
      const config = contextConfigSchema.parse(req.body);

      // Generate context ID
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create context object
      const context = {
        id: contextId,
        userId: req.user.id,
        config,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        status: 'active',
      };

      // Store context
      contexts.set(contextId, context);

      // Track user contexts
      if (!userContexts.has(req.user.id)) {
        userContexts.set(req.user.id, new Set());
      }
      const userContextSet = userContexts.get(req.user.id);
      if (userContextSet !== undefined) {
        userContextSet.add(contextId);
      }

      // Log context creation
      await logDataAccess('WRITE', `context/${contextId}`, {
        userId: req.user.id,
        action: 'create_context',
        contextName: config.name,
      });

      res.status(201).json({
        success: true,
        data: {
          id: contextId,
          ...context,
        },
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Get all contexts for current user
   * GET /v1/contexts
   * @nist au-2 "Audit events"
   */
  router.get('/', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const userContextIds = userContexts.get(req.user.id) ?? new Set();
      const userContextList = Array.from(userContextIds)
        .map((id) => contexts.get(id))
        .filter((ctx): ctx is Context => ctx !== undefined);

      // Log data access
      await logDataAccess('READ', 'contexts', {
        userId: req.user.id,
        action: 'list_contexts',
        count: userContextList.length,
      });

      res.json({
        success: true,
        data: userContextList,
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Get a specific context
   * GET /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.get('/:contextId', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;
      const context = contexts.get(contextId);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check ownership
      if (context.userId !== req.user.id && !req.user.roles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Update last used timestamp
      context.lastUsedAt = new Date().toISOString();

      // Log data access
      await logDataAccess('READ', `context/${contextId}`, {
        userId: req.user.id,
        action: 'get_context',
      });

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Update a context configuration
   * PATCH /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.patch('/:contextId', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;
      const context = contexts.get(contextId);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check ownership
      if (context.userId !== req.user.id && !req.user.roles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Validate partial update
      const updates = contextConfigSchema.partial().parse(req.body);

      // Update context
      context.config = { ...context.config, ...updates };
      context.lastUsedAt = new Date().toISOString();

      // Log data modification
      await logDataAccess('WRITE', `context/${contextId}`, {
        userId: req.user.id,
        action: 'update_context',
        updates: Object.keys(updates),
      });

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Delete a context
   * DELETE /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.delete('/:contextId', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;
      const context = contexts.get(contextId);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check ownership
      if (context.userId !== req.user.id && !req.user.roles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Remove context
      contexts.delete(contextId);
      userContexts.get(context.userId)?.delete(contextId);

      // Log data deletion
      await logDataAccess('DELETE', `context/${contextId}`, {
        userId: req.user.id,
        action: 'delete_context',
        contextName: context.config.name,
      });

      res.json({
        success: true,
        message: 'Context deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Execute action in a context
   * POST /v1/contexts/:contextId/execute
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.post(
    '/:contextId/execute',
    authMiddleware,
    (req: Request, res: Response, next: NextFunction) => void (async () => {
      try {
        if (!req.user) {
          throw new AppError('Not authenticated', 401);
        }

        const { contextId } = req.params;
        const context = contexts.get(contextId);

        if (!context) {
          throw new AppError('Context not found', 404);
        }

        // Check ownership
        if (context.userId !== req.user.id && !req.user.roles.includes('admin')) {
          throw new AppError('Access denied', 403);
        }

        // Validate action
        const actionSchema = z.object({
          action: z.enum(['navigate', 'screenshot', 'evaluate', 'click', 'type', 'waitFor']),
          params: z.record(z.unknown()),
        });

        const { action, params } = actionSchema.parse(req.body);

        // Update last used timestamp
        context.lastUsedAt = new Date().toISOString();

        // Log action execution
        await logDataAccess('WRITE', `context/${contextId}`, {
          userId: req.user.id,
          action: 'execute_action',
          executedAction: action,
        });

        // TODO: Integrate with actual Puppeteer execution
        res.json({
          success: true,
          message: `Action '${action}' queued for execution`,
          data: {
            contextId,
            action,
            params,
            queuedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    })(),
  );

  /**
   * Get context metrics
   * GET /v1/contexts/:contextId/metrics
   * @nist au-2 "Audit events"
   */
  router.get('/:contextId/metrics', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;
      const context = contexts.get(contextId);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check ownership
      if (context.userId !== req.user.id && !req.user.roles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // TODO: Integrate with actual metrics collection
      const metrics = {
        memory: {
          used: Math.floor(Math.random() * 100) + 50, // MB
          limit: 512, // MB
        },
        cpu: {
          usage: Math.floor(Math.random() * 50) + 10, // %
        },
        network: {
          requests: Math.floor(Math.random() * 1000),
          bytesReceived: Math.floor(Math.random() * 10000000),
          bytesSent: Math.floor(Math.random() * 1000000),
        },
        duration: Date.now() - new Date(context.createdAt).getTime(), // ms
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};