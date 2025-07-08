/**
 * Direct browser execution for MCP tools
 * @module mcp/tools/browser-executor
 * @description Provides direct browser automation without REST adapter dependency
 */

import { logger } from '../../utils/logger.js';
import { contextStore, type Context } from '../../store/context-store.js';
import { BrowserPool } from '../../puppeteer/pool/browser-pool.js';
import { BrowserActionExecutor } from '../../puppeteer/actions/action-executor.js';
import { getPageManager } from '../../puppeteer/pages/page-manager.js';
import type {
  BrowserAction,
  ActionContext,
  ActionResult,
} from '../../puppeteer/interfaces/action-executor.interface.js';
import type { ExecuteInContextArgs } from '../types/tool-types.js';

/**
 * Browser executor for direct MCP automation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class BrowserExecutor {
  private static instance: BrowserExecutor | null = null;
  private browserPool: BrowserPool | null = null;
  private actionExecutor: BrowserActionExecutor | null = null;
  private initialized = false;

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserExecutor {
    BrowserExecutor.instance ??= new BrowserExecutor();
    return BrowserExecutor.instance;
  }

  /**
   * Initialize browser pool and action executor
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create browser pool with configuration suitable for testing
      this.browserPool = new BrowserPool({
        maxBrowsers: 5, // Increased for concurrent tests
        maxPagesPerBrowser: 10, // Increased for more pages
        idleTimeout: 30000, // 30 seconds - reduced for faster cleanup
        healthCheckInterval: 15000, // 15 seconds
        acquisitionTimeout: 60000, // 60 seconds - increased timeout
        launchOptions: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security', // For testing cross-origin requests
          ],
        },
      });

      await this.browserPool.initialize();

      // Create action executor with page manager
      const pageManager = getPageManager(this.browserPool);
      this.actionExecutor = new BrowserActionExecutor(pageManager);

      this.initialized = true;

      logger.info({
        msg: 'MCP browser executor initialized',
        maxBrowsers: 2,
        headless: true,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize browser executor',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute command in browser context
   */
  async executeInContext(args: ExecuteInContextArgs): Promise<ActionResult> {
    try {
      // Ensure initialized
      await this.initialize();

      if (!this.browserPool || !this.actionExecutor) {
        throw new Error('Browser executor not properly initialized');
      }

      // Get context
      const context = await contextStore.get(args.contextId);
      if (!context) {
        throw new Error(`Context not found: ${args.contextId}`);
      }

      // Parse command into browser action
      const browserAction = this.parseCommand(args.command, args.parameters);

      // Create action context
      const actionContext: ActionContext = {
        sessionId: args.sessionId ?? context.sessionId,
        contextId: args.contextId,
        userId: context.userId,
        metadata: {
          source: 'mcp',
          timestamp: new Date().toISOString(),
        },
      };

      // Get or create page for context
      const pageId = await this.ensurePageForContext(context, actionContext.sessionId);
      browserAction.pageId = pageId;

      // Execute action
      const result = await this.actionExecutor.execute(browserAction, actionContext);

      logger.info({
        msg: 'MCP browser command executed',
        contextId: args.contextId,
        command: args.command,
        success: result.success,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      logger.error({
        msg: 'MCP browser execution failed',
        contextId: args.contextId,
        command: args.command,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser execution failed',
        timestamp: new Date(),
        duration: 0,
        actionType: args.command,
      };
    }
  }

  /**
   * Map common commands to browser actions
   */
  private getActionType(command: string): string {
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
      close: 'close',
    };

    return commandMap[command.toLowerCase()] ?? command;
  }

  /**
   * Create navigate action
   */
  private createNavigateAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'navigate',
      pageId: '', // Will be set later
      url: (parameters?.url as string) ?? (parameters?.href as string) ?? '',
      waitUntil:
        (parameters?.waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2') ??
        'load',
    };
  }

  /**
   * Create click action
   */
  private createClickAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'click',
      pageId: '',
      selector: (parameters?.selector as string) ?? '',
      button: (parameters?.button as 'left' | 'right' | 'middle') ?? 'left',
      clickCount: (parameters?.clickCount as number) ?? 1,
      delay: (parameters?.delay as number) ?? 0,
    };
  }

  /**
   * Create type action
   */
  private createTypeAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'type',
      pageId: '',
      selector: (parameters?.selector as string) ?? '',
      text: (parameters?.text as string) ?? (parameters?.value as string) ?? '',
      delay: (parameters?.delay as number) ?? 0,
    };
  }

  /**
   * Create screenshot action
   */
  private createScreenshotAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'screenshot',
      pageId: '',
      fullPage: (parameters?.fullPage as boolean) ?? false,
      format: (parameters?.format as 'png' | 'jpeg' | 'webp') ?? 'png',
      quality: (parameters?.quality as number) ?? undefined,
    };
  }

  /**
   * Create wait action
   */
  private createWaitAction(parameters?: Record<string, unknown>): BrowserAction {
    if (parameters?.selector !== undefined && parameters.selector !== null) {
      return {
        type: 'wait',
        pageId: '',
        waitType: 'selector',
        selector: parameters.selector as string,
      };
    } else {
      return {
        type: 'wait',
        pageId: '',
        waitType: 'timeout',
        duration: (parameters?.duration as number) ?? (parameters?.timeout as number) ?? 1000,
      };
    }
  }

  /**
   * Create evaluate action
   */
  private createEvaluateAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'evaluate',
      pageId: '',
      function: (parameters?.code as string) ?? (parameters?.script as string) ?? '',
      args: (parameters?.args as unknown[]) ?? [],
    };
  }

  /**
   * Create scroll action
   */
  private createScrollAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'scroll',
      pageId: '',
      direction: (parameters?.direction as 'up' | 'down' | 'left' | 'right') ?? 'down',
      distance: (parameters?.distance as number) ?? (parameters?.amount as number) ?? 100,
      smooth: (parameters?.smooth as boolean) ?? true,
    };
  }

  /**
   * Create content action
   */
  private createContentAction(parameters?: Record<string, unknown>): BrowserAction {
    return {
      type: 'content',
      pageId: '',
      selector: parameters?.selector as string | undefined,
      timeout: (parameters?.timeout as number) ?? 30000,
    };
  }

  /**
   * Parse command string into browser action
   */
  private parseCommand(command: string, parameters?: Record<string, unknown>): BrowserAction {
    const actionType = this.getActionType(command);

    // Build action based on type
    switch (actionType) {
      case 'navigate':
        return this.createNavigateAction(parameters);
      case 'click':
        return this.createClickAction(parameters);
      case 'type':
        return this.createTypeAction(parameters);
      case 'screenshot':
        return this.createScreenshotAction(parameters);
      case 'wait':
        return this.createWaitAction(parameters);
      case 'evaluate':
        return this.createEvaluateAction(parameters);
      case 'scroll':
        return this.createScrollAction(parameters);
      case 'content':
        return this.createContentAction(parameters);
      default:
        // Generic action with all parameters
        return {
          type: actionType,
          pageId: '',
          ...parameters,
        } as BrowserAction;
    }
  }

  /**
   * Ensure a page exists for the context
   */
  private async ensurePageForContext(context: Context, sessionId: string): Promise<string> {
    if (!this.browserPool) {
      throw new Error('Browser pool not initialized');
    }

    const pageManager = getPageManager(this.browserPool);

    // Check if context already has pages
    const existingPages = await pageManager.listPagesForContext(context.id, sessionId);

    if (existingPages.length > 0 && existingPages[0] !== undefined) {
      // Return the first available page
      return existingPages[0].id;
    }

    // Create new page for context
    const browser = await this.browserPool.acquireBrowser(sessionId);
    const pageInfo = await pageManager.createPage(
      context.id,
      sessionId,
      browser.id,
      context.config,
    );

    logger.info({
      msg: 'Created new page for MCP context',
      contextId: context.id,
      pageId: pageInfo.id,
      sessionId,
    });

    return pageInfo.id;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.browserPool) {
      await this.browserPool.shutdown();
      this.browserPool = null;
    }
    this.actionExecutor = null;
    this.initialized = false;
    BrowserExecutor.instance = null;
  }
}

/**
 * Export singleton getter for convenience
 */
export function getBrowserExecutor(): BrowserExecutor {
  return BrowserExecutor.getInstance();
}
