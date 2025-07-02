/**
 * Browser Context Tool Implementation
 * @module mcp/tools/browser-context
 */

import { logger } from '../../utils/logger.js';
import { contextStore } from '../../store/context-store.js';
import type { MCPAuthBridge } from '../auth/mcp-auth.js';
import type { CreateBrowserContextArgs, ToolResponse } from '../types/tool-types.js';

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
      if (!args.sessionId) {
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
        name: args.name || 'browser-context',
        type: 'puppeteer',
        config: args.options || {},
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
  private successResponse(data: any): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data),
      }],
    };
  }
}