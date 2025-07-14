/**
 * MCP Server Implementation
 * @module mcp/server
 * @description Model Context Protocol server that exposes our multi-protocol platform to LLMs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { InMemorySessionStore } from '../store/in-memory-session-store.js';
import { MCPAuthBridge } from './auth/mcp-auth.js';
import { RestAdapter } from './adapters/rest-adapter.js';
import { GrpcAdapter } from './adapters/grpc-adapter.js';
import { WebSocketAdapter } from './adapters/ws-adapter.js';
import { WSConnectionManager } from '../ws/connection-manager.js';
import { WSSubscriptionManager } from '../ws/subscription-manager.js';
import { setupTransport } from './server-transport.js';
import { setupResourceHandlers } from './server-resource-handlers.js';
import { setupProtocolHandlers } from './server-protocol-handlers.js';
import { executeTool } from './server-tool-handlers.js';
import { Application } from 'express';
import type { GrpcServer } from '../grpc/server.js';
import { WebSocketServer } from 'ws';

// Import tool handlers
import { ExecuteApiTool } from './tools/execute-api.js';
import { SessionTools } from './tools/session-tools.js';
import { BrowserContextTool } from './tools/browser-context.js';
import { ExecuteInContextTool } from './tools/execute-in-context.js';
import { ServerInfoToolImpl } from './tools/server-info.js';
import { TOOL_DEFINITIONS } from './tools/tool-definitions.js';

// Import resource handlers
import { ApiCatalogResource } from './resources/api-catalog.js';
import { SystemHealthResource } from './resources/system-health.js';

// Create store instance
let sessionStore: InMemorySessionStore | undefined;
let authBridge: MCPAuthBridge | undefined;

/**
 * MCP Server implementation for multi-protocol API platform
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class MCPServer {
  private server: Server;
  private restAdapter?: RestAdapter;
  private grpcAdapter?: GrpcAdapter;
  private wsAdapter?: WebSocketAdapter;

  // Tool handlers
  private executeApiTool: ExecuteApiTool;
  public sessionTools: SessionTools;
  public browserContextTool: BrowserContextTool;
  private executeInContextTool: ExecuteInContextTool;
  private serverInfoTool: ServerInfoToolImpl;

  // Resource handlers
  private apiCatalogResource: ApiCatalogResource;
  private systemHealthResource: SystemHealthResource;

  constructor(app?: Application, grpcServer?: GrpcServer, wsServer?: WebSocketServer) {
    // Initialize store instances for this server
    sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));
    authBridge = new MCPAuthBridge(sessionStore, logger.child({ module: 'mcp-auth' }));

    this.server = new Server(
      {
        name: 'puppeteer-mcp',
        version: '1.0.14',
      },
      {
        capabilities: {
          logging: {},
          resources: {
            subscribe: false,
            listChanged: false,
          },
          tools: {
            listChanged: false,
          },
          prompts: {
            listChanged: false,
          },
          experimental: {
            browserAutomation: {},
            multiProtocolAdapter: {},
          },
        },
      },
    );

    // Initialize protocol adapters
    if (app) {
      this.restAdapter = new RestAdapter(app);
    }

    if (grpcServer) {
      // GrpcAdapter expects our custom GrpcServer type
      this.grpcAdapter = new GrpcAdapter(grpcServer);
    }

    if (wsServer !== null && wsServer !== undefined) {
      // WebSocketAdapter needs logger and managers, we'll create minimal ones
      const wsLogger = logger.child({ module: 'ws-adapter' });
      const connectionManager = new WSConnectionManager(wsLogger);
      const subscriptionManager = new WSSubscriptionManager(wsLogger, connectionManager);
      this.wsAdapter = new WebSocketAdapter(wsLogger, connectionManager, subscriptionManager);
    }

    // Initialize tool handlers
    this.executeApiTool = new ExecuteApiTool(this.restAdapter, this.grpcAdapter, this.wsAdapter);
    this.sessionTools = new SessionTools(sessionStore);
    this.browserContextTool = new BrowserContextTool(authBridge);
    this.executeInContextTool = new ExecuteInContextTool(this.restAdapter);
    this.serverInfoTool = new ServerInfoToolImpl();

    // Initialize resource handlers
    this.apiCatalogResource = new ApiCatalogResource(this.restAdapter);
    this.systemHealthResource = new SystemHealthResource();

    this.setupHandlers();
  }

  /**
   * Set up request handlers for MCP protocol
   */
  private setupHandlers(): void {
    this.setupProtocolHandlers();
    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  /**
   * Set up core MCP protocol handlers
   */
  private setupProtocolHandlers(): void {
    setupProtocolHandlers(this.server);
  }

  /**
   * Set up tool-related handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: TOOL_DEFINITIONS,
      };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const progressToken = request.params._meta?.progressToken;

      logger.info({
        msg: 'MCP tool execution',
        tool: name,
        hasProgressToken: progressToken !== undefined,
        timestamp: new Date().toISOString(),
      });

      // Send initial progress notification if token provided
      if (progressToken !== undefined) {
        await this.sendProgressNotification(String(progressToken), 0, `Starting ${name} execution`);
      }

      try {
        const result = await this.executeTool(name, args);

        // Send completion progress notification if token provided
        if (progressToken !== undefined) {
          await this.sendProgressNotification(
            String(progressToken),
            100,
            `Completed ${name} execution`,
          );
        }

        // Ensure result is in proper MCP format
        if (typeof result === 'object' && result !== null && 'content' in result) {
          return result;
        }

        // Wrap non-MCP results
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({
          msg: 'MCP tool execution failed',
          tool: name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });
  }

  /**
   * Send progress notification
   */
  private async sendProgressNotification(
    progressToken: string,
    progress: number,
    message: string,
  ): Promise<void> {
    await this.server.notification({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        total: 100,
        message,
      },
    });
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(name: string, args: unknown): Promise<unknown> {
    return executeTool(name, args, {
      executeApiTool: this.executeApiTool,
      sessionTools: this.sessionTools,
      browserContextTool: this.browserContextTool,
      executeInContextTool: this.executeInContextTool,
      serverInfoTool: this.serverInfoTool,
    });
  }

  /**
   * Set up resource-related handlers
   */
  private setupResourceHandlers(): void {
    setupResourceHandlers(this.server, this.apiCatalogResource, this.systemHealthResource);
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    await setupTransport(this.server);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();

    // Clean up the session store
    if (sessionStore) {
      await sessionStore.destroy();
    }

    logger.info({
      msg: 'MCP server stopped',
      timestamp: new Date().toISOString(),
    });
  }
}

// Export factory function to create MCP server with protocol adapters
export function createMCPServer(options?: {
  app?: Application;
  grpcServer?: GrpcServer;
  wsServer?: WebSocketServer;
}): MCPServer {
  return new MCPServer(
    options?.app ?? undefined,
    options?.grpcServer ?? undefined,
    options?.wsServer ?? undefined,
  );
}
