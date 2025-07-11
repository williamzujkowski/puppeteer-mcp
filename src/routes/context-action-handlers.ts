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
        // Check if request body has command format (from MCP)
        let browserAction: BrowserAction;
        let contextId: string;

        if (req.body.action && typeof req.body.action === 'string') {
          // MCP command format
          const result = await this.validateCommandRequest(req);
          contextId = result.contextId;
          browserAction = result.browserAction;
        } else {
          // Direct BrowserAction format
          const result = await this.validateExecuteRequest(req);
          contextId = result.contextId;
          browserAction = result.browserAction;
        }

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
   * Validate command-based request (from MCP)
   */
  private async validateCommandRequest(req: Request): Promise<{
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

    // Parse command format
    const { action: command, params } = req.body as {
      action: string;
      params?: Record<string, unknown>;
    };
    if (!command) {
      throw new AppError('Command is required', 400);
    }

    // Convert command to BrowserAction
    const browserAction = this.convertCommandToAction(command, params);

    // Validate the converted action
    const validationResult = validateAction(browserAction);
    if (!validationResult.valid) {
      throw new AppError(
        `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`,
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
   * Convert command format to BrowserAction
   */
  private convertCommandToAction(command: string, params?: Record<string, unknown>): BrowserAction {
    // Map common commands to action types
    const commandMap: Record<string, string> = {
      navigate: 'navigate',
      goto: 'navigate',
      click: 'click',
      type: 'type',
      fill: 'type',
      screenshot: 'screenshot',
      wait: 'wait',
      waitForSelector: 'wait',
      evaluate: 'evaluate',
      execute: 'evaluate',
      scroll: 'scroll',
      select: 'select',
      press: 'keyboard',
      hover: 'mouse',
      pdf: 'pdf',
      setCookie: 'cookie',
      getCookies: 'cookie',
      getContent: 'content',
      content: 'content',
    };

    const actionType = commandMap[command.toLowerCase()] ?? command;
    const pageId = ''; // Will be set by the executor

    // Build action based on type
    switch (actionType) {
      case 'navigate':
        return {
          type: 'navigate',
          pageId,
          url: (params?.url as string) ?? (params?.href as string) ?? '',
          waitUntil:
            (params?.waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2') ??
            'load',
        };

      case 'click':
        return {
          type: 'click',
          pageId,
          selector: (params?.selector as string) ?? '',
          button: (params?.button as 'left' | 'right' | 'middle') ?? 'left',
          clickCount: (params?.clickCount as number) ?? 1,
          delay: (params?.delay as number) ?? 0,
        };

      case 'type':
        return {
          type: 'type',
          pageId,
          selector: (params?.selector as string) ?? '',
          text: (params?.text as string) ?? (params?.value as string) ?? '',
          delay: (params?.delay as number) ?? 0,
        };

      case 'wait':
        if (params?.selector !== undefined && params.selector !== null) {
          return {
            type: 'wait',
            pageId,
            waitType: 'selector',
            selector: params.selector as string,
            timeout: (params?.timeout as number) ?? 30000,
          };
        } else {
          return {
            type: 'wait',
            pageId,
            waitType: 'timeout',
            duration: (params?.duration as number) ?? (params?.timeout as number) ?? 1000,
          };
        }

      case 'screenshot':
        return {
          type: 'screenshot',
          pageId,
          fullPage: (params?.fullPage as boolean) ?? false,
          format: (params?.format as 'png' | 'jpeg' | 'webp') ?? 'png',
          quality: params?.quality as number | undefined,
        };

      case 'evaluate':
        return {
          type: 'evaluate',
          pageId,
          function: (params?.code as string) ?? (params?.script as string) ?? '',
          args: (params?.args as unknown[]) ?? [],
        };

      case 'scroll':
        return {
          type: 'scroll',
          pageId,
          direction: (params?.direction as 'up' | 'down' | 'left' | 'right') ?? 'down',
          distance: (params?.distance as number) ?? (params?.amount as number) ?? 100,
        };

      case 'content':
        return {
          type: 'content',
          pageId,
          selector: params?.selector as string | undefined,
          timeout: (params?.timeout as number) ?? 30000,
        };

      default:
        // Generic action with all parameters
        return {
          type: actionType,
          pageId,
          ...params,
        } as BrowserAction;
    }
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
      ...(result.error !== undefined && result.error !== null && result.error !== ''
        ? { error: result.error }
        : {}),
    };
  }
}
