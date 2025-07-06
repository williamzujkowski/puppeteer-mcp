/**
 * Context page-related route handlers
 * @module routes/context-page-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { getPageManager } from '../puppeteer/pages/page-manager.js';
import { ContextStorage } from './context-storage.js';
import type { BrowserPool } from '../puppeteer/interfaces/browser-pool.interface.js';
import { validatePageRequest, buildPageOptions, getUserSessionId } from './context-page-helpers.js';

/**
 * Context page handlers
 * @nist ac-3 "Access enforcement"
 */
export class ContextPageHandlers {
  private storage: ContextStorage;
  private browserPool?: BrowserPool;

  constructor(browserPool?: BrowserPool, storage?: ContextStorage) {
    this.storage = storage || new ContextStorage();
    this.browserPool = browserPool;
  }

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
      // Validate request
      validatePageRequest(req);

      if (!this.browserPool) {
        throw new AppError('Browser pool not available', 503);
      }

      const { contextId } = req.params;

      // Verify context exists and user has access
      if (!req.user) {
        throw new Error('User not authenticated');
      }
      const context = await this.storage.getContext(contextId as string, req.user.userId, req.user.roles);

      // Acquire browser for this session
      const sessionId = getUserSessionId(req.user);
      const browser = await this.browserPool.acquireBrowser(sessionId);

      // Create page with context configuration and optional overrides
      const pageOptions = buildPageOptions(req.body, context.config);

      const pageManager = getPageManager(this.browserPool);
      const pageInfo = await pageManager.createPage(
        contextId as string,
        sessionId,
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