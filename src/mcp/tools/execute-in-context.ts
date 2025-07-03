/**
 * Execute In Context Tool Implementation
 * @module mcp/tools/execute-in-context
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import type { RestAdapter } from '../adapters/rest-adapter.js';
import type { ExecuteInContextArgs, ToolResponse } from '../types/tool-types.js';
import type { MCPResponse } from '../adapters/adapter.interface.js';

/**
 * Execute in context tool handler
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ExecuteInContextTool {
  constructor(private restAdapter?: RestAdapter) {}

  /**
   * Execute command in context with reduced complexity
   */
  async execute(args: ExecuteInContextArgs): Promise<ToolResponse> {
    try {
      // Validate inputs
      const validation = this.validateArgs(args);
      if (validation) {
        return validation;
      }

      // Check adapter availability
      this.ensureRestAdapter();

      // Execute the command
      const result = await this.executeCommand(args);

      // Parse and return response
      return this.parseResponse(result);
    } catch (error) {
      logger.error({
        msg: 'MCP context execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        contextId: args.contextId,
        command: args.command,
      });

      // Handle specific error types
      if (error instanceof McpError) {
        throw error;
      }

      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to execute command',
        'EXECUTION_FAILED',
      );
    }
  }

  /**
   * Validate input arguments
   */
  private validateArgs(args: ExecuteInContextArgs): ToolResponse | null {
    if (!args.contextId) {
      return this.errorResponse('Context ID is required', 'INVALID_CONTEXT_ID');
    }

    if (!args.command) {
      return this.errorResponse('Command is required', 'INVALID_COMMAND');
    }

    return null;
  }

  /**
   * Ensure REST adapter is available
   */
  private ensureRestAdapter(): void {
    if (!this.restAdapter) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'REST adapter not initialized. Express app required.',
      );
    }
  }

  /**
   * Execute the command via REST adapter
   */
  private async executeCommand(args: ExecuteInContextArgs): Promise<MCPResponse> {
    if (!this.restAdapter) {
      throw new McpError(ErrorCode.InvalidRequest, 'REST adapter not initialized');
    }
    const result = await this.restAdapter.executeRequest({
      operation: {
        method: 'POST',
        endpoint: `/v1/contexts/${args.contextId}/execute`,
        body: {
          action: args.command,
          params: args.parameters ?? {},
        },
      },
      // Use session authentication if provided
      auth:
        args.sessionId !== undefined && args.sessionId !== null && args.sessionId !== ''
          ? {
              type: 'session',
              credentials: args.sessionId,
            }
          : undefined,
      sessionId: args.sessionId,
    });

    logger.info({
      msg: 'MCP context command executed',
      contextId: args.contextId,
      command: args.command,
      hasParameters: !!args.parameters,
    });

    return result;
  }

  /**
   * Parse the response from the adapter
   */
  private parseResponse(result: MCPResponse): ToolResponse {
    let responseBody = {};

    if (
      result.content?.[0] &&
      result.content[0].type === 'text' &&
      result.content[0].text !== undefined &&
      result.content[0].text !== null &&
      result.content[0].text !== ''
    ) {
      try {
        responseBody = JSON.parse(result.content[0].text);
      } catch (parseError) {
        // If parsing fails, return the raw text
        responseBody = { result: result.content[0].text };
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(responseBody),
        },
      ],
    };
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
}
