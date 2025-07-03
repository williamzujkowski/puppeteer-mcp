/**
 * MCP Server Integration Test
 * @module tests/integration/mcp/mcp-integration
 * @description Integration test to verify MCP server instantiation and tool/resource registration
 */

import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  CallToolRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServer, createMCPServer } from '../../../src/mcp/server.js';
import { logger } from '../../../src/utils/logger.js';

// Mock dependencies to avoid external connections
jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      child: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/mcp/auth/user-service.js', () => ({
  userService: {
    authenticateUser: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      username: 'testuser',
      roles: ['user'],
      metadata: {},
    }),
  },
}));

jest.mock('../../../src/auth/jwt.js', () => ({
  generateTokenPair: jest.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }),
}));

// Mock WebSocket dependencies to prevent issues with logger
jest.mock('../../../src/ws/connection-manager.js', () => ({
  WSConnectionManager: jest.fn().mockImplementation(() => ({
    connections: new Map(),
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    getConnection: jest.fn(),
  })),
}));

jest.mock('../../../src/ws/subscription-manager.js', () => ({
  WSSubscriptionManager: jest.fn().mockImplementation(() => ({
    subscriptions: new Map(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
  })),
}));

// Mock the WebSocketAdapter to prevent logger issues
jest.mock('../../../src/mcp/adapters/ws-adapter.js', () => ({
  WebSocketAdapter: jest.fn().mockImplementation(() => ({
    executeRequest: jest.fn(),
    setupEventListeners: jest.fn(),
  })),
}));

describe('MCP Server Integration Tests', () => {
  let mcpServer: MCPServer;
  let mockHandlers: Map<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlers = new Map();
    
    // Mock the Server class from MCP SDK
    jest.spyOn(Server.prototype, 'setRequestHandler').mockImplementation((schema: any, handler: any) => {
      // Map schema to handler name
      let schemaName = 'unknown';
      if (schema === ListToolsRequestSchema) {
        schemaName = 'listTools';
      } else if (schema === CallToolRequestSchema) {
        schemaName = 'callTool';
      } else if (schema === ListResourcesRequestSchema) {
        schemaName = 'listResources';
      } else if (schema === ReadResourceRequestSchema) {
        schemaName = 'readResource';
      }
      mockHandlers.set(schemaName, handler);
      return undefined;
    });
    
    // Create MCP server without protocol adapters
    mcpServer = createMCPServer();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Server Instantiation', () => {
    it('should create MCP server instance successfully', () => {
      expect(mcpServer).toBeInstanceOf(MCPServer);
    });

    it('should register all request handlers', () => {
      // The server registers handlers in setupHandlers() and may call additional ones during initialization
      const setRequestHandlerMock = Server.prototype.setRequestHandler as jest.Mock;
      expect(setRequestHandlerMock).toHaveBeenCalled();
      expect(setRequestHandlerMock.mock.calls.length).toBeGreaterThanOrEqual(4);
      
      // Verify each handler is registered
      expect(mockHandlers.has('listTools')).toBeTruthy();
      expect(mockHandlers.has('callTool')).toBeTruthy();
      expect(mockHandlers.has('listResources')).toBeTruthy();
      expect(mockHandlers.has('readResource')).toBeTruthy();
    });
  });

  describe('Tool Registration', () => {
    it('should register all 6 tools', async () => {
      const listToolsHandler = mockHandlers.get('listTools');
      expect(listToolsHandler).toBeDefined();

      const response = await listToolsHandler({});
      expect(response.tools).toHaveLength(6);

      const toolNames = response.tools.map((tool: { name: string }) => tool.name);
      expect(toolNames).toEqual([
        'execute-api',
        'create-session',
        'list-sessions',
        'delete-session',
        'create-browser-context',
        'execute-in-context',
      ]);
    });

    it('should have proper input schemas for each tool', async () => {
      const listToolsHandler = mockHandlers.get('listTools');
      const response = await listToolsHandler({});

      // Verify execute-api tool
      const executeApiTool = response.tools.find((t: any) => t.name === 'execute-api');
      expect(executeApiTool).toBeDefined();
      expect(executeApiTool.inputSchema.type).toBe('object');
      expect(executeApiTool.inputSchema.properties).toHaveProperty('protocol');
      expect(executeApiTool.inputSchema.properties).toHaveProperty('operation');
      expect(executeApiTool.inputSchema.properties).toHaveProperty('auth');
      expect(executeApiTool.inputSchema.required).toEqual(['protocol', 'operation']);

      // Verify create-session tool
      const createSessionTool = response.tools.find((t: any) => t.name === 'create-session');
      expect(createSessionTool).toBeDefined();
      expect(createSessionTool.inputSchema.properties).toHaveProperty('username');
      expect(createSessionTool.inputSchema.properties).toHaveProperty('password');
      expect(createSessionTool.inputSchema.properties).toHaveProperty('duration');
      expect(createSessionTool.inputSchema.required).toEqual(['username', 'password']);

      // Verify list-sessions tool
      const listSessionsTool = response.tools.find((t: any) => t.name === 'list-sessions');
      expect(listSessionsTool).toBeDefined();
      expect(listSessionsTool.inputSchema.properties).toHaveProperty('userId');

      // Verify delete-session tool
      const deleteSessionTool = response.tools.find((t: any) => t.name === 'delete-session');
      expect(deleteSessionTool).toBeDefined();
      expect(deleteSessionTool.inputSchema.properties).toHaveProperty('sessionId');
      expect(deleteSessionTool.inputSchema.required).toEqual(['sessionId']);

      // Verify create-browser-context tool
      const createBrowserContextTool = response.tools.find((t: any) => t.name === 'create-browser-context');
      expect(createBrowserContextTool).toBeDefined();
      expect(createBrowserContextTool.inputSchema.properties).toHaveProperty('sessionId');
      expect(createBrowserContextTool.inputSchema.properties).toHaveProperty('options');
      expect(createBrowserContextTool.inputSchema.required).toEqual(['sessionId']);

      // Verify execute-in-context tool
      const executeInContextTool = response.tools.find((t: any) => t.name === 'execute-in-context');
      expect(executeInContextTool).toBeDefined();
      expect(executeInContextTool.inputSchema.properties).toHaveProperty('contextId');
      expect(executeInContextTool.inputSchema.properties).toHaveProperty('command');
      expect(executeInContextTool.inputSchema.properties).toHaveProperty('parameters');
      expect(executeInContextTool.inputSchema.required).toEqual(['contextId', 'command']);
    });
  });

  describe('Resource Registration', () => {
    it('should register both resources', async () => {
      const listResourcesHandler = mockHandlers.get('listResources');
      expect(listResourcesHandler).toBeDefined();

      const response = await listResourcesHandler({});
      expect(response.resources).toHaveLength(2);

      const resourceUris = response.resources.map((resource: { uri: string }) => resource.uri);
      expect(resourceUris).toEqual(['api://catalog', 'api://health']);
    });

    it('should have proper metadata for each resource', async () => {
      const listResourcesHandler = mockHandlers.get('listResources');
      const response = await listResourcesHandler({});

      // Verify API catalog resource
      const catalogResource = response.resources.find((r: any) => r.uri === 'api://catalog');
      expect(catalogResource).toBeDefined();
      expect(catalogResource.name).toBe('API Catalog');
      expect(catalogResource.description).toBe('Complete catalog of available APIs');
      expect(catalogResource.mimeType).toBe('application/json');

      // Verify health resource
      const healthResource = response.resources.find((r: any) => r.uri === 'api://health');
      expect(healthResource).toBeDefined();
      expect(healthResource.name).toBe('System Health');
      expect(healthResource.description).toBe('Current system health and status');
      expect(healthResource.mimeType).toBe('application/json');
    });
  });

  describe('Tool Execution', () => {
    it('should handle tool execution requests', async () => {
      const callToolHandler = mockHandlers.get('callTool');
      expect(callToolHandler).toBeDefined();

      // Test execute-api tool without adapters - should throw an error
      await expect(callToolHandler({
        params: {
          name: 'execute-api',
          arguments: {
            protocol: 'rest',
            operation: {
              method: 'GET',
              endpoint: '/health',
            },
          },
        },
      })).rejects.toThrow('REST adapter not initialized');
    });

    it('should log tool execution attempts', async () => {
      const callToolHandler = mockHandlers.get('callTool');
      
      await callToolHandler({
        params: {
          name: 'list-sessions',
          arguments: { userId: 'test-user' },
        },
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP tool execution',
          tool: 'list-sessions',
        })
      );
    });
  });

  describe('Resource Reading', () => {
    it('should handle resource read requests', async () => {
      const readResourceHandler = mockHandlers.get('readResource');
      expect(readResourceHandler).toBeDefined();

      // Test reading health resource
      const healthResponse = await readResourceHandler({
        params: { uri: 'api://health' },
      });

      expect(healthResponse.contents).toHaveLength(1);
      expect(healthResponse.contents[0].uri).toBe('api://health');
      expect(healthResponse.contents[0].mimeType).toBe('application/json');
      
      const healthData = JSON.parse(healthResponse.contents[0].text);
      expect(healthData).toHaveProperty('status', 'healthy');
      expect(healthData).toHaveProperty('services');
      expect(healthData.services).toEqual({
        rest: 'operational',
        grpc: 'operational',
        websocket: 'operational',
        mcp: 'operational',
      });

      // Test reading catalog resource
      const catalogResponse = await readResourceHandler({
        params: { uri: 'api://catalog' },
      });

      expect(catalogResponse.contents).toHaveLength(1);
      expect(catalogResponse.contents[0].uri).toBe('api://catalog');
      expect(catalogResponse.contents[0].mimeType).toBe('application/json');
      
      const catalogData = JSON.parse(catalogResponse.contents[0].text);
      expect(catalogData).toHaveProperty('rest');
      expect(catalogData).toHaveProperty('grpc');
      expect(catalogData).toHaveProperty('websocket');
    });

    it('should log resource access', async () => {
      const readResourceHandler = mockHandlers.get('readResource');
      
      await readResourceHandler({
        params: { uri: 'api://health' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP resource access',
          resource: 'api://health',
        })
      );
    });
  });

  describe('Server with Protocol Adapters', () => {
    it('should create MCP server with protocol adapters', () => {
      const mockApp = {} as any;
      const mockGrpcServer = {} as any;
      const mockWsServer = {} as any;

      const serverWithAdapters = createMCPServer({
        app: mockApp,
        grpcServer: mockGrpcServer,
        wsServer: mockWsServer,
      });

      expect(serverWithAdapters).toBeInstanceOf(MCPServer);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool requests', async () => {
      const callToolHandler = mockHandlers.get('callTool');
      
      await expect(callToolHandler({
        params: {
          name: 'unknown-tool',
          arguments: {},
        },
      })).rejects.toThrow('Unknown tool: unknown-tool');
    });

    it('should handle unknown resource requests', async () => {
      const readResourceHandler = mockHandlers.get('readResource');
      
      await expect(readResourceHandler({
        params: { uri: 'api://unknown' },
      })).rejects.toThrow('Unknown resource: api://unknown');
    });
  });
});