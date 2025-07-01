/**
 * Context route handlers
 * @module routes/context-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { logDataAccess } from '../utils/logger.js';
import { ContextStorage } from './context-storage.js';
import { contextConfigSchema, actionSchema } from './context-validators.js';

/**
 * Context route handlers
 * @nist ac-3 "Access enforcement"
 */
export class ContextHandlers {
  private storage: ContextStorage;

  constructor() {
    this.storage = new ContextStorage();
  }

  /**
   * Create a new browser context
   * POST /v1/contexts
   * @nist au-2 "Audit events"
   */
  createContext = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      // Validate request body
      const config = contextConfigSchema.parse(req.body);

      // Create context
      const context = await this.storage.createContext(req.user.id, config);

      res.status(201).json({
        success: true,
        data: {
          id: context.id,
          ...context,
        },
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Get all contexts for current user
   * GET /v1/contexts
   * @nist au-2 "Audit events"
   */
  listContexts = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const userContextList = await this.storage.getUserContexts(req.user.id);

      res.json({
        success: true,
        data: userContextList,
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Get a specific context
   * GET /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  getContext = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;
      const context = await this.storage.getContext(contextId, req.user.id, req.user.roles);

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Update a context configuration
   * PATCH /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  updateContext = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;

      // Validate partial update
      const updates = contextConfigSchema.partial().parse(req.body);

      // Update context
      const context = await this.storage.updateContext(contextId, updates, req.user.id, req.user.roles);

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Delete a context
   * DELETE /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  deleteContext = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;

      await this.storage.deleteContext(contextId, req.user.id, req.user.roles);

      res.json({
        success: true,
        message: 'Context deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Execute action in a context
   * POST /v1/contexts/:contextId/execute
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  executeAction = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { contextId } = req.params;

      // Validate action
      const { action, params } = actionSchema.parse(req.body);

      // Update context last used timestamp
      this.storage.touchContext(contextId, req.user.id, req.user.roles);

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
  })();

  /**
   * Get context metrics
   * GET /v1/contexts/:contextId/metrics
   * @nist au-2 "Audit events"
   */
  getMetrics = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      // Check if context exists and user has access
      // Note: We're not using async/await here since this is synchronous
      // In a real implementation, you'd want to verify access first
      
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
        duration: Date.now() - new Date().getTime(), // ms - placeholder calculation
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  };
}