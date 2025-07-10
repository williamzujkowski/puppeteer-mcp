/**
 * Browser Context Tool Implementation
 * @module mcp/tools/browser-context
 */

import { logger } from '../../utils/logger.js';
import { contextStore } from '../../store/context-store.js';
import type { MCPAuthBridge } from '../auth/mcp-auth.js';
import type { CreateBrowserContextArgs, ToolResponse } from '../types/tool-types.js';
import { getPageManager } from '../../puppeteer/pages/page-manager.js';
import { browserPool } from '../../server.js';
import { createProxyBrowserContext, cleanupContextProxy } from '../../puppeteer/proxy/proxy-context-integration.js';
// import { ProxyManager } from '../../puppeteer/proxy/proxy-manager.js'; // Unused - proxy initialization handled elsewhere
import type { ContextProxyConfig } from '../../puppeteer/types/proxy.js';

/**
 * Browser context tool handler
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class BrowserContextTool {
  constructor(private authBridge: MCPAuthBridge) {}

  /**
   * Create a browser context
   */
  async createBrowserContext(args: CreateBrowserContextArgs): Promise<ToolResponse> {
    try {
      const authContext = await this.validateAndAuthenticate(args.sessionId);
      const proxyConfig = this.prepareProxyConfiguration(args.options?.proxy);
      
      // Note: ProxyManager initialization handled by createProxyBrowserContext

      const context = await this.createContextRecord(args, authContext, proxyConfig);
      const { proxyId } = await this.setupBrowserContextWithProxy(context, proxyConfig, args.sessionId);

      this.logContextCreation(context.id, authContext.userId, args.sessionId ?? 'unknown', proxyId);

      return this.buildContextResponse(context, proxyId);
    } catch (error) {
      logger.error({
        msg: 'MCP browser context creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });

      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to create context',
        'CONTEXT_CREATION_FAILED',
      );
    }
  }

  /**
   * Validate session ID and authenticate user
   */
  private async validateAndAuthenticate(sessionId: string | undefined | null): Promise<{ username: string; userId: string }> {
    if (sessionId === undefined || sessionId === null || sessionId === '') {
      throw new Error('Session ID is required');
    }

    const authContext = await this.authBridge.authenticate({
      type: 'session',
      credentials: sessionId,
    });

    await this.authBridge.requireToolPermission(authContext, 'createContext');
    
    if (authContext.username === null || authContext.username === undefined || authContext.username === '') {
      throw new Error('Username is required in authentication context');
    }
    
    return {
      username: authContext.username,
      userId: authContext.userId
    };
  }

  /**
   * Prepare proxy configuration from options
   */
  private prepareProxyConfiguration(proxyOptions?: unknown): ContextProxyConfig | undefined {
    if (proxyOptions === null || proxyOptions === undefined || typeof proxyOptions !== 'object') {
      return undefined;
    }

    const options = proxyOptions as Record<string, unknown>;
    return {
      enabled: (options.enabled as boolean) ?? false,
      proxy: options.config ? (options.config as any) : undefined,
      pool: options.pool ? (options.pool as any) : undefined,
      rotateOnError: (options.rotateOnError as boolean) ?? true,
      rotateOnInterval: (options.rotateOnInterval as boolean) ?? false,
      rotationInterval: (options.rotationInterval as number) ?? 3600000,
      validateCertificates: (options.validateCertificates as boolean) ?? true,
      allowInsecure: (options.allowInsecure as boolean) ?? false,
    };
  }

  /**
   * Create context record in store
   */
  private async createContextRecord(
    args: CreateBrowserContextArgs, 
    authContext: { username: string; userId: string }, 
    proxyConfig?: ContextProxyConfig
  ): Promise<{ id: string; name: string; type: string; status: string; createdAt: string }> {
    const context = await contextStore.create({
      sessionId: args.sessionId ?? 'unknown',
      name: args.name ?? 'browser-context',
      type: 'puppeteer',
      config: args.options ?? {},
      metadata: {
        createdBy: 'mcp',
        username: authContext.username,
      },
      status: 'active',
      userId: authContext.userId,
      proxyConfig: proxyConfig as Record<string, unknown> | undefined,
    });
    
    return {
      id: context.id,
      name: context.name,
      type: context.type,
      status: context.status,
      createdAt: new Date(context.createdAt).toISOString(),
    };
  }

  /**
   * Setup browser context with proxy if configured
   */
  private async setupBrowserContextWithProxy(
    context: { id: string }, 
    proxyConfig?: ContextProxyConfig, 
    sessionId?: string
  ): Promise<{ proxyId?: string; browserContextId?: string }> {
    if (!proxyConfig) {
      return {};
    }

    if (sessionId === null || sessionId === undefined || sessionId.trim() === '') {
      throw new Error('Session ID is required for proxy setup');
    }

    try {
      const browserInstance = await browserPool.acquireBrowser(sessionId);
      const proxyContext = await createProxyBrowserContext(browserInstance.browser, {
        proxyConfig,
        contextId: context.id,
      });

      await contextStore.update(context.id, {
        browserContextId: proxyContext.contextId,
        proxyId: proxyContext.proxyId,
      });

      return {
        proxyId: proxyContext.proxyId,
        browserContextId: proxyContext.contextId,
      };
    } catch (error) {
      await contextStore.delete(context.id);
      throw error;
    }
  }

  /**
   * Log context creation success
   */
  private logContextCreation(contextId: string, userId: string, sessionId: string, proxyId?: string): void {
    logger.info({
      msg: 'MCP browser context created',
      contextId,
      userId,
      sessionId,
      hasProxy: Boolean(proxyId),
      proxyId,
    });
  }

  /**
   * Build successful context creation response
   */
  private buildContextResponse(
    context: { id: string; name: string; type: string; status: string; createdAt: string }, 
    proxyId?: string
  ): ToolResponse {
    return this.successResponse({
      contextId: context.id,
      name: context.name,
      type: context.type,
      status: context.status,
      createdAt: context.createdAt,
      proxyEnabled: Boolean(proxyId),
      proxyId,
    });
  }

  /**
   * Create error response
   */
  private errorResponse(error: string, code: string): ToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error, code }),
        },
      ],
    };
  }

  /**
   * Create success response
   */
  private successResponse(data: unknown): ToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data),
        },
      ],
    };
  }

  /**
   * Close a browser context and all its pages
   */
  async closeBrowserContext(args: { contextId: string; sessionId: string }): Promise<ToolResponse> {
    try {
      const validationError = this.validateCloseContextArgs(args);
      if (validationError) return validationError;

      const authContext = await this.authBridge.authenticate({
        type: 'session',
        credentials: args.sessionId,
      });

      const contextValidation = await this.validateContextAccess(args);
      if ('content' in contextValidation) return contextValidation;

      await this.closeContextResources(args.contextId, args.sessionId);
      await this.cleanupContextProxy(contextValidation, args.contextId);

      const deleted = await contextStore.delete(args.contextId);
      this.logContextClosure(args.contextId, authContext.userId, args.sessionId, deleted);

      return this.successResponse({
        success: deleted,
        contextId: args.contextId,
        message: deleted ? 'Context closed successfully' : 'Failed to close context',
      });
    } catch (error) {
      logger.error({
        msg: 'MCP browser context closure failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        contextId: args.contextId,
        sessionId: args.sessionId,
      });

      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to close context',
        'CONTEXT_CLOSE_FAILED',
      );
    }
  }

  /**
   * Validate close context arguments
   */
  private validateCloseContextArgs(args: { contextId: string; sessionId: string }): ToolResponse | null {
    if (!args.contextId || args.contextId.trim() === '') {
      return this.errorResponse('Context ID is required', 'INVALID_CONTEXT_ID');
    }
    if (!args.sessionId || args.sessionId.trim() === '') {
      return this.errorResponse('Session ID is required', 'INVALID_SESSION');
    }
    return null;
  }

  /**
   * Validate context access permissions
   */
  private async validateContextAccess(args: { contextId: string; sessionId: string }): Promise<{ proxyId?: string; sessionId: string } | ToolResponse> {
    const context = await contextStore.get(args.contextId);
    if (!context) {
      return this.errorResponse('Context not found', 'CONTEXT_NOT_FOUND');
    }
    if (context.sessionId !== args.sessionId) {
      return this.errorResponse('Context does not belong to this session', 'ACCESS_DENIED');
    }
    return context;
  }

  /**
   * Close context resources (pages)
   */
  private async closeContextResources(contextId: string, sessionId: string): Promise<void> {
    const pageManager = getPageManager(browserPool);
    await pageManager.closePagesForContext(contextId);
    logger.info({
      msg: 'Closed all pages for context',
      contextId,
      sessionId,
    });
  }

  /**
   * Clean up proxy resources if any
   */
  private async cleanupContextProxy(context: { proxyId?: string }, contextId: string): Promise<void> {
    if (context.proxyId !== null && context.proxyId !== undefined && context.proxyId.trim() !== '') {
      await cleanupContextProxy(contextId);
    }
  }

  /**
   * Log context closure completion
   */
  private logContextClosure(contextId: string, userId: string, sessionId: string, deleted: boolean): void {
    logger.info({
      msg: 'MCP browser context closed',
      contextId,
      userId,
      sessionId,
      deleted,
    });
  }

  /**
   * List browser contexts for a session
   */
  async listBrowserContexts(args: { sessionId: string }): Promise<ToolResponse> {
    try {
      // Validate session
      if (args.sessionId === null || args.sessionId === undefined || args.sessionId.trim() === '') {
        return this.errorResponse('Session ID is required', 'INVALID_SESSION');
      }

      // Authenticate using session
      const authContext = await this.authBridge.authenticate({
        type: 'session',
        credentials: args.sessionId,
      });

      // Get contexts for this session
      const contexts = await contextStore.list({ sessionId: args.sessionId });

      logger.info({
        msg: 'Listed browser contexts',
        userId: authContext.userId,
        sessionId: args.sessionId,
        count: contexts.length,
      });

      return this.successResponse({
        contexts: contexts.map((ctx) => ({
          id: ctx.id,
          name: ctx.name,
          type: ctx.type,
          status: ctx.status,
          createdAt: ctx.createdAt,
          updatedAt: ctx.updatedAt,
        })),
        count: contexts.length,
      });
    } catch (error) {
      logger.error({
        msg: 'MCP browser context listing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });

      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to list contexts',
        'CONTEXT_LIST_FAILED',
      );
    }
  }
}
