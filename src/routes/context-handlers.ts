/**
 * Context route handlers
 * @module routes/context-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { logDataAccess, createLogger } from '../utils/logger.js';
import { ContextStorage } from './context-storage.js';
import { contextConfigSchema } from './context-validators.js';
import { getPageManager } from '../puppeteer/pages/page-manager.js';
import { BrowserActionExecutor, validateAction } from '../puppeteer/actions/index.js';
import type { BrowserPool } from '../puppeteer/interfaces/browser-pool.interface.js';
import type { 
  BrowserAction, 
  ActionContext 
} from '../puppeteer/interfaces/action-executor.interface.js';

const logger = createLogger('routes:context-handlers');

/**
 * Context route handlers
 * @nist ac-3 "Access enforcement"
 */
export class ContextHandlers {
  private storage: ContextStorage;
  private browserPool?: BrowserPool;
  private actionExecutor: BrowserActionExecutor;

  constructor(browserPool?: BrowserPool) {
    this.storage = new ContextStorage();
    this.browserPool = browserPool;
    
    // Create action executor with page manager if browser pool is available
    const pageManager = browserPool ? getPageManager(browserPool) : undefined;
    this.actionExecutor = new BrowserActionExecutor(pageManager);
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
            contextId as string,
            req.user.sessionId || req.user.userId
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

      if (!this.browserPool) {
        throw new AppError('Browser pool not available', 503);
      }

      const { contextId } = req.params;
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }

      // Verify context exists and user has access
      await this.storage.getContext(contextId as string, req.user.userId, req.user.roles);

      // Parse and validate browser action
      const browserAction = req.body as BrowserAction;
      
      // Validate action structure
      const validationResult = validateAction(browserAction);
      if (!validationResult.valid) {
        throw new AppError(
          `Invalid action: ${validationResult.errors.map(e => e.message).join(', ')}`,
          400
        );
      }

      // Create action context
      const actionContext: ActionContext = {
        sessionId: req.user.sessionId || req.user.userId,
        contextId: contextId as string,
        userId: req.user.userId,
        metadata: {
          userAgent: req.get('user-agent'),
          ip: req.ip,
          timestamp: new Date().toISOString(),
        },
      };

      // Update context last used timestamp
      this.storage.touchContext(contextId as string, req.user.userId, req.user.roles);

      // Log action execution
      await logDataAccess('WRITE', `context/${contextId}`, {
        userId: req.user.userId,
        action: 'execute_browser_action',
        actionType: browserAction.type,
        pageId: browserAction.pageId,
      });

      logger.info('Executing browser action', {
        sessionId: actionContext.sessionId,
        contextId: actionContext.contextId,
        userId: req.user.userId,
        actionType: browserAction.type,
        pageId: browserAction.pageId,
      });

      // Execute action using action executor
      const result = await this.actionExecutor.execute(browserAction, actionContext);

      // Return result
      res.json({
        success: result.success,
        data: {
          ...result,
          contextId,
          executedAt: result.timestamp.toISOString(),
        },
        ...(result.error && { error: result.error }),
      });

    } catch (error) {
      logger.error('Action execution failed', {
        contextId: req.params.contextId,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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

  /**
   * List pages for a context
   * GET /v1/contexts/:contextId/pages
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  listPages = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      if (!this.browserPool) {
        throw new AppError('Browser pool not available', 503);
      }

      const { contextId } = req.params;
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }

      // Verify context exists and user has access
      await this.storage.getContext(contextId as string, req.user.userId, req.user.roles);

      // Get pages for context
      const pageManager = getPageManager(this.browserPool);
      const pages = await pageManager.listPagesForContext(
        contextId as string,
        req.user.sessionId || req.user.userId
      );

      res.json({
        success: true,
        data: pages,
      });
    } catch (error) {
      next(error);
    }
  })();

  /**
   * Create a new page in a context
   * POST /v1/contexts/:contextId/pages
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  createPage = (req: Request, res: Response, next: NextFunction): void => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      if (!this.browserPool) {
        throw new AppError('Browser pool not available', 503);
      }

      const { contextId } = req.params;
      if (contextId === null || contextId === '') {
        throw new AppError('Context ID is required', 400);
      }

      // Verify context exists and user has access
      const context = await this.storage.getContext(contextId as string, req.user.userId, req.user.roles);

      // Acquire browser for this session
      const browser = await this.browserPool.acquireBrowser(req.user.sessionId || req.user.userId);

      // Create page with context configuration and optional overrides
      const pageOptions = {
        viewport: req.body.viewport || context.config.viewport,
        userAgent: req.body.userAgent || context.config.userAgent,
        extraHeaders: req.body.extraHeaders || context.config.extraHTTPHeaders,
        javaScriptEnabled: req.body.javaScriptEnabled ?? context.config.javaScriptEnabled,
        bypassCSP: req.body.bypassCSP ?? context.config.bypassCSP,
        ignoreHTTPSErrors: req.body.ignoreHTTPSErrors ?? context.config.ignoreHTTPSErrors,
      };

      const pageManager = getPageManager(this.browserPool);
      const pageInfo = await pageManager.createPage(
        contextId as string,
        req.user.sessionId || req.user.userId,
        browser.id,
        pageOptions
      );

      res.status(201).json({
        success: true,
        data: pageInfo,
      });
    } catch (error) {
      next(error);
    }
  })();
}