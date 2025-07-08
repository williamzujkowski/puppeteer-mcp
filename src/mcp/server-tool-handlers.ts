/**
 * MCP Server Tool Handlers
 * @module mcp/server-tool-handlers
 * @description Tool execution logic for MCP server
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ExecuteApiTool } from './tools/execute-api.js';
import type { SessionTools } from './tools/session-tools.js';
import type { BrowserContextTool } from './tools/browser-context.js';
import type { ExecuteInContextTool } from './tools/execute-in-context.js';
import type {
  ExecuteApiArgs,
  CreateSessionArgs,
  ListSessionsArgs,
  DeleteSessionArgs,
  CreateBrowserContextArgs,
  ExecuteInContextArgs,
} from './types/tool-types.js';

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: unknown,
  tools: {
    executeApiTool: ExecuteApiTool;
    sessionTools: SessionTools;
    browserContextTool: BrowserContextTool;
    executeInContextTool: ExecuteInContextTool;
  },
): Promise<unknown> {
  switch (name) {
    case 'execute-api':
      return tools.executeApiTool.execute(args as ExecuteApiArgs);
    case 'create-session':
      return tools.sessionTools.createSession(args as CreateSessionArgs);
    case 'list-sessions':
      return tools.sessionTools.listSessions(args as ListSessionsArgs);
    case 'delete-session':
      return tools.sessionTools.deleteSession(args as DeleteSessionArgs);
    case 'create-browser-context':
      return tools.browserContextTool.createBrowserContext(args as CreateBrowserContextArgs);
    case 'execute-in-context':
      return tools.executeInContextTool.execute(args as ExecuteInContextArgs);
    case 'close-browser-context':
      return tools.browserContextTool.closeBrowserContext(args as { contextId: string; sessionId: string });
    case 'list-browser-contexts':
      return tools.browserContextTool.listBrowserContexts(args as { sessionId: string });
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
