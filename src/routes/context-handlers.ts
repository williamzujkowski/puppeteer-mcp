/**
 * Context route handlers
 * @module routes/context-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { ContextStorage } from './context-storage.js';
import { contextConfigSchema } from './context-validators.js';
import { getPageManager } from '../puppeteer/pages/page-manager.js';
import type { BrowserPool } from '../puppeteer/interfaces/browser-pool.interface.js';
import { ContextPageHandlers } from './context-page-handlers.js';
import { ContextActionHandlers } from './context-action-handlers.js';

/**
 * Context route handlers
 * @nist ac-3 "Access enforcement"
 */
export class ContextHandlers {
  private storage: ContextStorage;
  private browserPool?: BrowserPool;
  private pageHandlers: ContextPageHandlers;
  private actionHandlers: ContextActionHandlers;

  constructor(browserPool?: BrowserPool) {
    this.storage = new ContextStorage();
    this.browserPool = browserPool;
    this.pageHandlers = new ContextPageHandlers(browserPool, this.storage);
    this.actionHandlers = new ContextActionHandlers(browserPool, this.storage);
  }

  /**
   * Create a new browser context
   * POST /v1/contexts
   * @nist au-2 "Audit events"
   */
  createContext = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (req.user === null || req.user === undefined) {
        throw new AppError('Not authenticated', 401);
      }

      // Validate request body
      const config = contextConfigSchema.parse(req.body);

      // Create context
      const context = await this.storage.createContext(req.user.userId, config);

      // If browser pool is available and createPage is requested, create initial page
      let pageInfo;
      if (this.browserPool && req.body.createPage !== false) {
        try {
          const pageManager = getPageManager(this.browserPool);
          
          // Acquire browser for this session
          const browser = await this.browserPool.acquireBrowser(req.user.sessionId || req.user.userId);
          
          // Create initial page with context configuration
          const pageOptions = {
            viewport: config.viewport,
            userAgent: config.userAgent,
            extraHeaders: config.extraHTTPHeaders,
            javaScriptEnabled: config.javaScriptEnabled,
            bypassCSP: config.bypassCSP,
            ignoreHTTPSErrors: config.ignoreHTTPSErrors,
          };

          pageInfo = await pageManager.createPage(
            context.id,
            req.user.sessionId || req.user.userId,
            browser.id,
            pageOptions
          );
        } catch (pageError) {
          // Log but don't fail context creation if page creation fails
          console.warn('Failed to create initial page for context:', pageError);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          ...context,
          ...(pageInfo && { page: pageInfo }),
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

      const userContextList = await this.storage.getUserContexts(req.user.userId);

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
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }
      const context = await this.storage.getContext(contextId as string, req.user.userId, req.user.roles);

      // Get associated pages if browser pool is available
      let pages: unknown[] = [];
      if (this.browserPool) {
        try {
          const pageManager = getPageManager(this.browserPool);
          pages = await pageManager.listPagesForContext(
            contextId as string,
            req.user.sessionId || req.user.userId
          );
        } catch (pageError) {
          // Log but don't fail context retrieval if page listing fails
          console.warn('Failed to list pages for context:', pageError);
          pages = [];
        }
      }

      res.json({
        success: true,
        data: {
          ...context,
          ...(pages && { pages }),
        },
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
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }

      // Validate partial update
      const updates = contextConfigSchema.partial().parse(req.body);

      // Update context
      const context = await this.storage.updateContext(contextId as string, updates, req.user.userId, req.user.roles);

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
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }

      // Clean up associated pages if browser pool is available
      if (this.browserPool) {
        try {
          const pageManager = getPageManager(this.browserPool);
          await pageManager.closePagesForContext(
            contextId as string
          );
        } catch (pageError) {
          // Log but don't fail context deletion if page cleanup fails
          console.warn('Failed to clean up pages for context:', pageError);
        }
      }

      await this.storage.deleteContext(contextId as string, req.user.userId, req.user.roles);

      res.json({
        success: true,
        message: 'Context deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  })();

  // Delegate methods to handlers
  executeAction = (req: Request, res: Response, next: NextFunction) => {
    this.actionHandlers.executeAction(req, res, next);
  };

  getMetrics = (req: Request, res: Response, next: NextFunction) => {
    this.pageHandlers.getMetrics(req, res, next);
  };
  
  listPages = (req: Request, res: Response, next: NextFunction) => {
    this.pageHandlers.listPages(req, res, next);
  };
  
  createPage = (req: Request, res: Response, next: NextFunction) => {
    this.pageHandlers.createPage(req, res, next);
  };
}