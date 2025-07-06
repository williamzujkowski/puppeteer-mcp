/**
 * MCP Server Implementation
 * @module mcp/server
 * @description Model Context Protocol server that exposes our multi-protocol platform to LLMs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  PingRequestSchema,
  CancelledNotificationSchema,
  LATEST_PROTOCOL_VERSION,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { InMemorySessionStore } from '../store/in-memory-session-store.js';
import { MCPAuthBridge } from './auth/mcp-auth.js';
import {
  TransportType,
  getTransportType,
  createStdioTransport,
  createHttpTransport,
} from './transport/index.js';
import { RestAdapter } from './adapters/rest-adapter.js';
import { GrpcAdapter } from './adapters/grpc-adapter.js';
import { WebSocketAdapter } from './adapters/ws-adapter.js';
import { WSConnectionManager } from '../ws/connection-manager.js';
import { WSSubscriptionManager } from '../ws/subscription-manager.js';
import { Application } from 'express';
import type { GrpcServer } from '../grpc/server.js';
import { WebSocketServer } from 'ws';

// Import tool handlers
import { ExecuteApiTool } from './tools/execute-api.js';
import { SessionTools } from './tools/session-tools.js';
import { BrowserContextTool } from './tools/browser-context.js';
import { ExecuteInContextTool } from './tools/execute-in-context.js';
import { TOOL_DEFINITIONS } from './tools/tool-definitions.js';

// Import resource handlers
import { ApiCatalogResource } from './resources/api-catalog.js';
import { SystemHealthResource } from './resources/system-health.js';

// Import types
import type {
  ExecuteApiArgs,
  CreateSessionArgs,
  ListSessionsArgs,
  DeleteSessionArgs,
  CreateBrowserContextArgs,
  ExecuteInContextArgs,
} from './types/tool-types.js';

// Create store instance
const sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));
const authBridge = new MCPAuthBridge(sessionStore, logger.child({ module: 'mcp-auth' }));

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

  // Resource handlers
  private apiCatalogResource: ApiCatalogResource;
  private systemHealthResource: SystemHealthResource;

  constructor(app?: Application, grpcServer?: GrpcServer, wsServer?: WebSocketServer) {
    this.server = new Server(
      {
        name: 'puppeteer-mcp',
        version: '1.0.10',
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
    // Initialize request handler - Required by MCP 2025-06-18
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      logger.info({
        msg: 'MCP initialization request received',
        clientProtocolVersion: request.params.protocolVersion,
        timestamp: new Date().toISOString(),
      });

      return {
        protocolVersion: LATEST_PROTOCOL_VERSION,
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
        serverInfo: {
          name: 'puppeteer-mcp',
          version: '1.0.10',
          title: 'Puppeteer MCP Server',
        },
        instructions: 'Multi-protocol browser automation platform with REST/gRPC/WebSocket/MCP interfaces. Use tools for browser automation, session management, and API execution.',
      };
    });

    // Initialized notification handler - Required by MCP 2025-06-18
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      logger.info({
        msg: 'MCP server initialized successfully',
        protocolVersion: LATEST_PROTOCOL_VERSION,
        timestamp: new Date().toISOString(),
      });
    });

    // Ping request handler - Required by MCP 2025-06-18
    this.server.setRequestHandler(PingRequestSchema, async () => {
      logger.debug({
        msg: 'MCP ping received',
        timestamp: new Date().toISOString(),
      });
      return {};
    });

    // Cancellation notification handler - Required by MCP 2025-06-18
    this.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
      logger.info({
        msg: 'MCP request cancellation received',
        requestId: notification.params.requestId,
        reason: notification.params.reason,
        timestamp: new Date().toISOString(),
      });
      // TODO: Implement actual request cancellation logic
    });
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
        hasProgressToken: !!progressToken,
        timestamp: new Date().toISOString(),
      });

      // Send initial progress notification if token provided
      if (progressToken) {
        await this.server.notification({
          method: 'notifications/progress',
          params: {
            progressToken,
            progress: 0,
            total: 100,
            message: `Starting ${name} execution`,
          },
        });
      }

      try {
        let result;
        switch (name) {
          case 'execute-api':
            result = await this.executeApiTool.execute(args as unknown as ExecuteApiArgs);
            break;
          case 'create-session':
            result = await this.sessionTools.createSession(args as unknown as CreateSessionArgs);
            break;
          case 'list-sessions':
            result = await this.sessionTools.listSessions(args as unknown as ListSessionsArgs);
            break;
          case 'delete-session':
            result = await this.sessionTools.deleteSession(args as unknown as DeleteSessionArgs);
            break;
          case 'create-browser-context':
            result = await this.browserContextTool.createBrowserContext(
              args as unknown as CreateBrowserContextArgs,
            );
            break;
          case 'execute-in-context':
            result = await this.executeInContextTool.execute(args as unknown as ExecuteInContextArgs);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Send completion progress notification if token provided
        if (progressToken) {
          await this.server.notification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress: 100,
              total: 100,
              message: `Completed ${name} execution`,
            },
          });
        }

        return result;
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
   * Set up resource-related handlers
   */
  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, () => {
      return {
        resources: [
          {
            uri: 'api://catalog',
            name: 'api-catalog',
            title: 'API Catalog',
            description: 'Complete catalog of available APIs across all protocols',
            mimeType: 'application/json',
          },
          {
            uri: 'api://health',
            name: 'system-health',
            title: 'System Health',
            description: 'Current system health and status including browser pool',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      logger.info({
        msg: 'MCP resource access',
        resource: uri,
        timestamp: new Date().toISOString(),
      });

      switch (uri) {
        case 'api://catalog': {
          const catalog = await this.apiCatalogResource.getApiCatalog();
          return {
            contents: catalog.contents,
          };
        }
        case 'api://health': {
          const health = this.systemHealthResource.getSystemHealth();
          return {
            contents: health.contents,
          };
        }
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transportType = getTransportType();

    logger.info({
      msg: 'Starting MCP server',
      transportType,
      timestamp: new Date().toISOString(),
    });

    switch (transportType) {
      case TransportType.STDIO: {
        const stdioTransport = createStdioTransport();
        await this.server.connect(stdioTransport.getTransport());
        // Await any async connection setup
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        logger.info({
          msg: 'MCP server started with stdio transport',
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case TransportType.HTTP: {
        // HTTP transport requires a different approach
        // The MCP SDK doesn't directly support HTTP transport yet
        // We'll need to implement a custom bridge
        const httpTransport = createHttpTransport();
        await httpTransport.start();

        logger.info({
          msg: 'MCP HTTP transport started',
          note: 'HTTP transport bridge implementation pending',
          timestamp: new Date().toISOString(),
        });
        break;
      }

      default:
        throw new Error(`Unsupported transport type: ${String(transportType)}`);
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();

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
