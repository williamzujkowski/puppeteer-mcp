/**
 * Context action execution handlers
 * @module routes/context-action-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors/app-error.js';
import { logDataAccess, createLogger } from '../utils/logger.js';
import { ContextStorage } from './context-storage.js';
import { getPageManager } from '../puppeteer/pages/page-manager.js';
import { BrowserActionExecutor, validateAction } from '../puppeteer/actions/index.js';
import type { BrowserPool } from '../puppeteer/interfaces/browser-pool.interface.js';
import type {
  BrowserAction,
  ActionContext,
  ActionResult,
} from '../puppeteer/interfaces/action-executor.interface.js';

const logger = createLogger('routes:context-action-handlers');

/**
 * Context action execution handlers
 * @nist ac-3 "Access enforcement"
 */
export class ContextActionHandlers {
  private storage: ContextStorage;
  private browserPool?: BrowserPool;
  private actionExecutor: BrowserActionExecutor;

  constructor(browserPool?: BrowserPool, storage?: ContextStorage) {
    this.storage = storage ?? new ContextStorage();
    this.browserPool = browserPool;

    // Create action executor with page manager if browser pool is available
    const pageManager = browserPool ? getPageManager(browserPool) : undefined;
    this.actionExecutor = new BrowserActionExecutor(pageManager);
  }

  /**
   * Execute action in a context
   * POST /v1/contexts/:contextId/execute
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  executeAction = (req: Request, res: Response, next: NextFunction): void =>
    void (async () => {
      try {
        // Validate request
        const { contextId, browserAction } = await this.validateExecuteRequest(req);

        // Create action context
        const actionContext = this.createActionContext(req, contextId);

        // Update context and log action
        await this.updateContextAndLog(contextId, req, browserAction);

        // Execute action
        const result = await this.actionExecutor.execute(browserAction, actionContext);

        // Send response
        res.json(this.formatActionResult(result, contextId));
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
   * Validate execute action request
   */
  private async validateExecuteRequest(req: Request): Promise<{
    contextId: string;
    browserAction: BrowserAction;
  }> {
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
    const validationResult = validateAction(browserAction);
    if (!validationResult.valid) {
      throw new AppError(
        `Invalid action: ${validationResult.errors.map((e) => e.message).join(', ')}`,
        400,
      );
    }

    return { contextId: contextId as string, browserAction };
  }

  /**
   * Create action context from request
   */
  private createActionContext(req: Request, contextId: string): ActionContext {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    return {
      sessionId: req.user.sessionId ?? req.user.userId,
      contextId,
      userId: req.user.userId,
      metadata: {
        userAgent: req.get('user-agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Update context and log action execution
   */
  private async updateContextAndLog(
    contextId: string,
    req: Request,
    browserAction: BrowserAction,
  ): Promise<void> {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    // Update context last used timestamp
    this.storage.touchContext(contextId, req.user.userId, req.user.roles);

    // Log action execution
    await logDataAccess('WRITE', `context/${contextId}`, {
      userId: req.user.userId,
      action: 'execute_browser_action',
      actionType: browserAction.type,
      pageId: browserAction.pageId,
    });

    logger.info('Executing browser action', {
      sessionId: req.user.sessionId ?? req.user.userId,
      contextId,
      userId: req.user.userId,
      actionType: browserAction.type,
      pageId: browserAction.pageId,
    });
  }

  /**
   * Format action result for response
   */
  private formatActionResult(result: ActionResult, contextId: string): Record<string, unknown> {
    return {
      success: result.success,
      data: {
        ...result,
        contextId,
        executedAt: result.timestamp.toISOString(),
      },
      ...(result.error && { error: result.error }),
    };
  }
}
