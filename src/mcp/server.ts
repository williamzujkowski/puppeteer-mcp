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
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { InMemorySessionStore } from '../store/in-memory-session-store.js';
import { contextStore } from '../store/context-store.js';
import { generateTokenPair } from '../auth/jwt.js';
import { userService } from './auth/user-service.js';
import { MCPAuthBridge } from './auth/mcp-auth.js';
import type { SessionData } from '../types/session.js';

// Create store instance
const sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));
const authBridge = new MCPAuthBridge(sessionStore, logger.child({ module: 'mcp-auth' }));
import { 
  TransportType, 
  getTransportType, 
  createStdioTransport, 
  createHttpTransport 
} from './transport/index.js';
import { RestAdapter } from './adapters/rest-adapter.js';
import { GrpcAdapter } from './adapters/grpc-adapter.js';
import { WebSocketAdapter } from './adapters/ws-adapter.js';
import { WSConnectionManager } from '../ws/connection-manager.js';
import { WSSubscriptionManager } from '../ws/subscription-manager.js';
import { Application } from 'express';
import type { Server as GrpcServer } from '@grpc/grpc-js';

/**
 * MCP Server implementation for multi-protocol API platform
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class MCPServer {
  private server: Server;
  private startTime: number;
  private restAdapter?: RestAdapter;
  private grpcAdapter?: GrpcAdapter;
  private wsAdapter?: WebSocketAdapter;

  constructor(
    app?: Application,
    grpcServer?: GrpcServer,
    wsServer?: any
  ) {
    this.server = new Server(
      {
        name: 'puppeteer-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );
    
    this.startTime = Date.now();
    
    // Initialize protocol adapters
    if (app) {
      this.restAdapter = new RestAdapter(app);
    }
    
    if (grpcServer) {
      // GrpcAdapter expects a specific GrpcServer type, not the generic grpc.Server
      // For now, we'll cast it as any to avoid type issues
      this.grpcAdapter = new GrpcAdapter(grpcServer as any);
    }
    
    if (wsServer) {
      // WebSocketAdapter needs logger and managers, we'll create minimal ones
      const wsLogger = logger.child({ module: 'ws-adapter' });
      const connectionManager = new WSConnectionManager(wsLogger);
      const subscriptionManager = new WSSubscriptionManager(wsLogger, connectionManager);
      this.wsAdapter = new WebSocketAdapter(wsLogger, connectionManager, subscriptionManager);
    }
    
    this.setupHandlers();
    this.registerTools();
    this.registerResources();
  }

  /**
   * Set up request handlers for MCP protocol
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute-api',
            description: 'Execute API calls across REST, gRPC, or WebSocket protocols',
            inputSchema: {
              type: 'object',
              properties: {
                protocol: {
                  type: 'string',
                  enum: ['rest', 'grpc', 'websocket'],
                  description: 'Protocol to use',
                },
                operation: {
                  type: 'object',
                  description: 'Protocol-specific operation details',
                },
                auth: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['jwt', 'apikey', 'session'] },
                    credentials: { type: 'string' },
                  },
                },
              },
              required: ['protocol', 'operation'],
            },
          },
          {
            name: 'create-session',
            description: 'Create a new session for API interactions',
            inputSchema: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                password: { type: 'string' },
                duration: { type: 'number', description: 'Session duration in seconds' },
              },
              required: ['username', 'password'],
            },
          },
          {
            name: 'list-sessions',
            description: 'List active sessions',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
              },
            },
          },
          {
            name: 'delete-session',
            description: 'Delete an active session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID to delete' },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'create-browser-context',
            description: 'Create a Puppeteer browser context',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                options: {
                  type: 'object',
                  properties: {
                    headless: { type: 'boolean' },
                    viewport: {
                      type: 'object',
                      properties: {
                        width: { type: 'number' },
                        height: { type: 'number' },
                      },
                    },
                  },
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'execute-in-context',
            description: 'Execute commands in a browser context',
            inputSchema: {
              type: 'object',
              properties: {
                contextId: { type: 'string', description: 'Context ID to execute command in' },
                command: { type: 'string', description: 'Command to execute' },
                parameters: { type: 'object', description: 'Parameters for the command' },
              },
              required: ['contextId', 'command'],
            },
          },
        ],
      };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info({
        msg: 'MCP tool execution',
        tool: name,
        timestamp: new Date().toISOString(),
      });

      try {
        switch (name) {
          case 'execute-api':
            return await this.executeApiTool(args);
          case 'create-session':
            return await this.createSessionTool(args);
          case 'list-sessions':
            return await this.listSessionsTool(args);
          case 'delete-session':
            return await this.deleteSessionTool(args);
          case 'create-browser-context':
            return await this.createBrowserContextTool(args);
          case 'execute-in-context':
            return await this.executeInContextTool(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error({
          msg: 'MCP tool execution failed',
          tool: name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'api://catalog',
            name: 'API Catalog',
            description: 'Complete catalog of available APIs',
            mimeType: 'application/json',
          },
          {
            uri: 'api://health',
            name: 'System Health',
            description: 'Current system health and status',
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
        case 'api://catalog':
          return await this.getApiCatalog();
        case 'api://health':
          return await this.getSystemHealth();
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });
  }

  /**
   * Register available tools
   */
  private registerTools(): void {
    // Tools are defined in the ListToolsRequestSchema handler above
    // This method can be used for additional tool setup if needed
  }

  /**
   * Register available resources
   */
  private registerResources(): void {
    // Resources are defined in the ListResourcesRequestSchema handler above
    // This method can be used for additional resource setup if needed
  }

  /**
   * Execute API tool
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async executeApiTool(args: any): Promise<any> {
    const { protocol, operation, auth } = args;
    
    try {
      // Validate authentication if provided
      if (auth && auth.type === 'session' && !auth.credentials) {
        // If session type but no credentials, try to use sessionId from args
        if (args.sessionId) {
          auth.credentials = args.sessionId;
        }
      }
      
      switch (protocol) {
        case 'rest': {
          if (!this.restAdapter) {
            throw new McpError(
              ErrorCode.InvalidRequest, 
              'REST adapter not initialized. Express app required.'
            );
          }
          
          return await this.restAdapter.executeRequest({
            operation,
            auth,
            sessionId: args.sessionId,
          });
        }
        
        case 'grpc': {
          if (!this.grpcAdapter) {
            throw new McpError(
              ErrorCode.InvalidRequest, 
              'gRPC adapter not initialized. gRPC server required.'
            );
          }
          
          return await this.grpcAdapter.executeRequest({
            operation,
            auth,
            sessionId: args.sessionId,
          });
        }
        
        case 'websocket': {
          if (!this.wsAdapter) {
            throw new McpError(
              ErrorCode.InvalidRequest, 
              'WebSocket adapter not initialized. WebSocket server required.'
            );
          }
          
          return await this.wsAdapter.executeRequest({
            operation,
            auth,
            sessionId: args.sessionId,
          });
        }
        
        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unsupported protocol: ${protocol}`
          );
      }
    } catch (error) {
      // If it's already an McpError, re-throw it
      if (error instanceof McpError) {
        throw error;
      }
      
      // Otherwise, wrap it
      logger.error({
        msg: 'MCP API execution failed',
        protocol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'API execution failed'
      );
    }
  }

  /**
   * Create session tool
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  private async createSessionTool(args: any): Promise<any> {
    try {
      // Validate input
      if (!args.username || !args.password) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Username and password are required',
                code: 'INVALID_CREDENTIALS'
              }),
            },
          ],
        };
      }

      // Authenticate user
      const user = await userService.authenticateUser(args.username, args.password);
      
      // Calculate session duration (default 1 hour)
      const duration = args.duration || 3600;
      const expiresAt = new Date(Date.now() + duration * 1000);
      
      // Create session data
      const sessionData: SessionData = {
        userId: user.id,
        username: user.username,
        roles: user.roles,
        metadata: {
          ...user.metadata,
          authMethod: 'password',
          createdBy: 'mcp',
        },
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      
      // Create session in store
      const sessionId = await sessionStore.create(sessionData);
      
      // Generate JWT tokens
      const tokens = generateTokenPair(
        user.id,
        user.username,
        user.roles,
        sessionId
      );
      
      // Log session creation
      logger.info({
        msg: 'MCP session created',
        userId: user.id,
        username: user.username,
        sessionId,
        duration,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId,
              userId: user.id,
              username: user.username,
              roles: user.roles,
              createdAt: sessionData.createdAt,
              expiresAt: sessionData.expiresAt,
              tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
              },
            }),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'MCP session creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        username: args.username,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Authentication failed',
              code: 'AUTH_FAILED'
            }),
          },
        ],
      };
    }
  }

  /**
   * List sessions tool
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async listSessionsTool(args: any): Promise<any> {
    try {
      let sessions: any[] = [];
      
      if (args.userId) {
        // Get sessions for specific user
        const userSessions = await sessionStore.getByUserId(args.userId);
        sessions = userSessions.map(session => ({
          id: session.id,
          userId: session.data.userId,
          username: session.data.username,
          roles: session.data.roles,
          createdAt: session.data.createdAt,
          expiresAt: session.data.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
          metadata: session.data.metadata,
        }));
        
        logger.info({
          msg: 'Listed sessions for user',
          userId: args.userId,
          count: sessions.length,
        });
      } else {
        // Note: In production, this should require admin permissions
        // For now, return empty array for non-user-specific queries
        logger.warn({
          msg: 'Session listing without userId not implemented',
          note: 'Admin functionality required',
        });
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessions,
              count: sessions.length,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'MCP session listing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: args.userId,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to list sessions',
              code: 'LIST_FAILED'
            }),
          },
        ],
      };
    }
  }

  /**
   * Delete session tool
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async deleteSessionTool(args: any): Promise<any> {
    try {
      // Validate input
      if (!args.sessionId) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Session ID is required',
                code: 'INVALID_SESSION_ID'
              }),
            },
          ],
        };
      }
      
      // Get session to verify it exists
      const session = await sessionStore.get(args.sessionId);
      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
              }),
            },
          ],
        };
      }
      
      // Delete the session
      const deleted = await sessionStore.delete(args.sessionId);
      
      logger.info({
        msg: 'MCP session deleted',
        sessionId: args.sessionId,
        userId: session.data.userId,
        deleted,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: deleted,
              sessionId: args.sessionId,
              message: deleted ? 'Session deleted successfully' : 'Failed to delete session',
            }),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'MCP session deletion failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to delete session',
              code: 'DELETE_FAILED'
            }),
          },
        ],
      };
    }
  }

  /**
   * Create browser context tool
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async createBrowserContextTool(args: any): Promise<any> {
    try {
      // Validate session
      if (!args.sessionId) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Session ID is required',
                code: 'INVALID_SESSION'
              }),
            },
          ],
        };
      }
      
      // Authenticate using session
      const authContext = await authBridge.authenticate({
        type: 'session',
        credentials: args.sessionId,
      });
      
      // Check permissions
      await authBridge.requireToolPermission(authContext, 'createContext');
      
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
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              contextId: context.id,
              name: context.name,
              type: context.type,
              status: context.status,
              createdAt: context.createdAt,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'MCP browser context creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to create context',
              code: 'CONTEXT_CREATION_FAILED'
            }),
          },
        ],
      };
    }
  }

  /**
   * Execute in context tool
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async executeInContextTool(args: any): Promise<any> {
    try {
      // Validate input
      if (!args.contextId) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Context ID is required',
                code: 'INVALID_CONTEXT_ID'
              }),
            },
          ],
        };
      }
      
      if (!args.command) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Command is required',
                code: 'INVALID_COMMAND'
              }),
            },
          ],
        };
      }
      
      // Check if REST adapter is available
      if (!this.restAdapter) {
        throw new McpError(
          ErrorCode.InvalidRequest, 
          'REST adapter not initialized. Express app required.'
        );
      }
      
      // Execute the command via REST adapter
      const result = await this.restAdapter.executeRequest({
        operation: {
          method: 'POST',
          endpoint: `/v1/contexts/${args.contextId}/execute`,
          body: {
            action: args.command,
            params: args.parameters || {},
          },
        },
        // Use session authentication if provided
        auth: args.sessionId ? {
          type: 'session',
          credentials: args.sessionId,
        } : undefined,
        sessionId: args.sessionId,
      });
      
      logger.info({
        msg: 'MCP context command executed',
        contextId: args.contextId,
        command: args.command,
        hasParameters: !!args.parameters,
      });
      
      // Extract the response body from MCP response
      let responseBody = {};
      if (result.content?.[0] && result.content[0].type === 'text' && result.content[0].text) {
        try {
          responseBody = JSON.parse(result.content[0].text);
        } catch (parseError) {
          // If parsing fails, return the raw text
          responseBody = { result: result.content[0].text };
        }
      }
      
      // Return the result
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responseBody),
          },
        ],
      };
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
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to execute command',
              code: 'EXECUTION_FAILED'
            }),
          },
        ],
      };
    }
  }

  /**
   * Get API catalog resource
   * @nist ac-3 "Access enforcement"
   */
  private async getApiCatalog(): Promise<any> {
    // Get REST endpoints from adapter if available
    let restEndpoints = [];
    if (this.restAdapter) {
      const endpointsResponse = await this.restAdapter.listEndpoints();
      if (endpointsResponse.content[0]?.text) {
        const data = JSON.parse(endpointsResponse.content[0].text);
        restEndpoints = data.endpoints;
      }
    }
    
    const catalog = {
      rest: {
        baseUrl: '/api/v1',
        endpoints: restEndpoints.length > 0 ? restEndpoints : [
          {
            path: '/sessions',
            methods: ['GET', 'POST', 'DELETE'],
            description: 'Session management',
          },
          {
            path: '/sessions/:id',
            methods: ['GET', 'DELETE'],
            description: 'Individual session operations',
          },
          {
            path: '/contexts',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Context management',
          },
          {
            path: '/contexts/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Individual context operations',
          },
          {
            path: '/contexts/:id/execute',
            methods: ['POST'],
            description: 'Execute commands in context',
          },
          {
            path: '/api-keys',
            methods: ['GET', 'POST'],
            description: 'API key management',
          },
          {
            path: '/api-keys/:id',
            methods: ['DELETE'],
            description: 'Individual API key operations',
          },
          {
            path: '/health',
            methods: ['GET'],
            description: 'Health check',
          },
        ],
        authentication: {
          methods: ['jwt', 'apikey', 'session'],
          headers: {
            jwt: 'Authorization: Bearer <token>',
            apikey: 'X-API-Key: <key>',
          },
        },
      },
      grpc: {
        services: [
          {
            name: 'SessionService',
            methods: ['CreateSession', 'GetSession', 'DeleteSession', 'ListSessions'],
          },
          {
            name: 'ContextService',
            methods: ['CreateContext', 'GetContext', 'ExecuteCommand'],
          },
          {
            name: 'HealthService',
            methods: ['Check', 'Watch'],
          },
        ],
      },
      websocket: {
        endpoint: '/ws',
        topics: [
          {
            name: 'session-updates',
            description: 'Real-time session events',
          },
          {
            name: 'context-updates',
            description: 'Real-time context events',
          },
        ],
      },
    };
    
    return {
      contents: [
        {
          uri: 'api://catalog',
          mimeType: 'application/json',
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    };
  }

  /**
   * Get system health resource
   */
  private async getSystemHealth(): Promise<any> {
    const health = {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      services: {
        rest: 'operational',
        grpc: 'operational',
        websocket: 'operational',
        mcp: 'operational',
      },
      timestamp: new Date().toISOString(),
    };
    
    return {
      contents: [
        {
          uri: 'api://health',
          mimeType: 'application/json',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
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
        throw new Error(`Unsupported transport type: ${transportType}`);
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
  wsServer?: any;
}): MCPServer {
  return new MCPServer(options?.app, options?.grpcServer, options?.wsServer);
}