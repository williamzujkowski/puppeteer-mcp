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
      // Validate session
      if (!args.sessionId || args.sessionId === '') {
        return this.errorResponse('Session ID is required', 'INVALID_SESSION');
      }
      
      // Authenticate using session
      const authContext = await this.authBridge.authenticate({
        type: 'session',
        credentials: args.sessionId,
      });
      
      // Check permissions
      await this.authBridge.requireToolPermission(authContext, 'createContext');
      
      // Create context
      const context = await contextStore.create({
        sessionId: args.sessionId,
        name: args.name ?? 'browser-context',
        type: 'puppeteer',
        config: args.options ?? {},
        metadata: {
          createdBy: 'mcp',
          username: authContext.username,
        },
        status: 'active',
        userId: authContext.userId,
      });
      
      logger.info({
        msg: 'MCP browser context created',
        contextId: context.id,
        userId: authContext.userId,
        sessionId: args.sessionId,
      });
      
      return this.successResponse({
        contextId: context.id,
        name: context.name,
        type: context.type,
        status: context.status,
        createdAt: context.createdAt,
      });
    } catch (error) {
      logger.error({
        msg: 'MCP browser context creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to create context',
        'CONTEXT_CREATION_FAILED'
      );
    }
  }

  /**
   * Create error response
   */
  private errorResponse(error: string, code: string): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error, code }),
      }],
    };
  }

  /**
   * Create success response
   */
  private successResponse(data: unknown): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data),
      }],
    };
  }

  /**
   * Close a browser context and all its pages
   */
  async closeBrowserContext(args: { contextId: string; sessionId: string }): Promise<ToolResponse> {
    try {
      // Validate inputs
      if (!args.contextId) {
        return this.errorResponse('Context ID is required', 'INVALID_CONTEXT_ID');
      }
      if (!args.sessionId) {
        return this.errorResponse('Session ID is required', 'INVALID_SESSION');
      }
      
      // Authenticate using session
      const authContext = await this.authBridge.authenticate({
        type: 'session',
        credentials: args.sessionId,
      });
      
      // Get context to verify it exists and belongs to session
      const context = await contextStore.get(args.contextId);
      if (!context) {
        return this.errorResponse('Context not found', 'CONTEXT_NOT_FOUND');
      }
      if (context.sessionId !== args.sessionId) {
        return this.errorResponse('Context does not belong to this session', 'ACCESS_DENIED');
      }
      
      // Get page manager instance
      const pageManager = getPageManager(browserPool);
      
      // Close all pages for this context
      await pageManager.closePagesForContext(args.contextId);
      logger.info({
        msg: 'Closed all pages for context',
        contextId: args.contextId,
        sessionId: args.sessionId,
      });
      
      // Delete the context
      const deleted = await contextStore.delete(args.contextId);
      
      logger.info({
        msg: 'MCP browser context closed',
        contextId: args.contextId,
        userId: authContext.userId,
        sessionId: args.sessionId,
        deleted,
      });
      
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
        'CONTEXT_CLOSE_FAILED'
      );
    }
  }

  /**
   * List browser contexts for a session
   */
  async listBrowserContexts(args: { sessionId: string }): Promise<ToolResponse> {
    try {
      // Validate session
      if (!args.sessionId) {
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
        contexts: contexts.map(ctx => ({
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
        'CONTEXT_LIST_FAILED'
      );
    }
  }
}