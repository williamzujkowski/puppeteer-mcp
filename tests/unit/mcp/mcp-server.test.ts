/**
 * Unit tests for MCP Server
 * @module tests/unit/mcp/mcp-server
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MCPServer } from '../../../src/mcp/server.js';
import { logger } from '../../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../../src/utils/logger.js');
jest.mock('../../../src/store/session-store.interface.js');
jest.mock('../../../src/store/context-store.js');

describe('MCP Server', () => {
  let mcpServer: MCPServer;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpServer = new MCPServer();
  });

  afterEach(async () => {
    // Clean up any resources
    try {
      await mcpServer.stop();
    } catch (error) {
      // Server might not be started
    }
  });

  describe('Server Initialization', () => {
    it('should create server with correct metadata', () => {
      expect(mcpServer).toBeDefined();
      expect(mcpServer).toBeInstanceOf(MCPServer);
    });

    it('should log server startup', async () => {
      // Set environment to use stdio transport
      process.env.MCP_TRANSPORT = 'stdio';

      // Mock the stdio transport
      const mockStdioTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the transport creation
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      jest.doMock('../../../src/mcp/transport/index.js', () => ({
        ...jest.requireActual('../../../src/mcp/transport/index.js'),
        createStdioTransport: jest.fn().mockReturnValue(mockStdioTransport),
      }));

      await mcpServer.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Starting MCP server',
          transportType: 'stdio',
        }),
      );
    });
  });

  describe('Tool Registration', () => {
    it('should register execute-api tool', () => {
      // This test will be implemented once we can access the registered tools
      expect(mcpServer).toBeDefined();
    });

    it('should register session management tools', () => {
      // This test will be implemented once we can access the registered tools
      expect(mcpServer).toBeDefined();
    });

    it('should register browser context tools', () => {
      // This test will be implemented once we can access the registered tools
      expect(mcpServer).toBeDefined();
    });
  });

  describe('Resource Registration', () => {
    it('should register API catalog resource', () => {
      // const _resources = (mcpServer as any).server._handlers?.get('resources/list');
      // This test will be implemented once we can access the registered resources
      expect(mcpServer).toBeDefined();
    });

    it('should register health resource', () => {
      // const _resources = (mcpServer as any).server._handlers?.get('resources/list');
      // This test will be implemented once we can access the registered resources
      expect(mcpServer).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    it('should handle create-session tool call', async () => {
      // Test through the server's tool handler system
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId: 'test-session-123',
              userId: 'user-testuser-001',
              username: 'testuser',
            }),
          },
        ],
      };

      // Mock the session tools
      jest.spyOn((mcpServer as any).sessionTools, 'createSession').mockResolvedValue(mockResponse);

      const result = await (mcpServer as any).server.handleRequest({
        method: 'tools/call',
        params: {
          name: 'create-session',
          arguments: {
            username: 'testuser',
            password: 'testpass',
            duration: 3600,
          },
        },
      });

      expect(result.content[0].type).toBe('text');
      const sessionData = JSON.parse(result.content[0].text);
      expect(sessionData).toHaveProperty('sessionId');
      expect(sessionData).toHaveProperty('userId');
    });

    it('should handle unknown tool error', async () => {
      const server = (mcpServer as any).server;
      await expect(
        server.handleRequest({
          method: 'tools/call',
          params: {
            name: 'unknown-tool',
            arguments: {},
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Resource Access', () => {
    it('should return API catalog', async () => {
      // Mock the API catalog resource
      const mockCatalog = {
        contents: [
          {
            mimeType: 'application/json',
            text: JSON.stringify({
              rest: {},
              grpc: {},
              websocket: {},
            }),
          },
        ],
      };

      jest
        .spyOn((mcpServer as any).apiCatalogResource, 'getApiCatalog')
        .mockResolvedValue(mockCatalog);

      const result = await (mcpServer as any).server.handleRequest({
        method: 'resources/read',
        params: {
          uri: 'api://catalog',
        },
      });

      expect(result).toHaveProperty('contents');
      expect(result.contents[0].mimeType).toBe('application/json');

      const catalog = JSON.parse(result.contents[0].text);
      expect(catalog).toHaveProperty('rest');
      expect(catalog).toHaveProperty('grpc');
      expect(catalog).toHaveProperty('websocket');
    });

    it('should return system health', async () => {
      // Mock the system health resource
      const mockHealth = {
        contents: [
          {
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'healthy',
              services: {},
            }),
          },
        ],
      };

      jest
        .spyOn((mcpServer as any).systemHealthResource, 'getSystemHealth')
        .mockReturnValue(mockHealth);

      const result = await (mcpServer as any).server.handleRequest({
        method: 'resources/read',
        params: {
          uri: 'api://health',
        },
      });

      expect(result).toHaveProperty('contents');
      expect(result.contents[0].mimeType).toBe('application/json');

      const health = JSON.parse(result.contents[0].text);
      expect(health).toHaveProperty('status', 'healthy');
      expect(health).toHaveProperty('services');
    });
  });

  describe('Transport Support', () => {
    it('should support stdio transport', async () => {
      process.env.MCP_TRANSPORT = 'stdio';

      // Create a new server instance for this test
      const testServer = new MCPServer();

      // Mock transport creation
      const mockStdioTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      jest.doMock('../../../src/mcp/transport/index.js', () => ({
        ...jest.requireActual('../../../src/mcp/transport/index.js'),
        createStdioTransport: jest.fn().mockReturnValue(mockStdioTransport),
      }));

      await testServer.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP server started with stdio transport',
        }),
      );

      await testServer.stop();
    });

    it('should support HTTP transport', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.MCP_HTTP_PORT = '3001';
      process.env.MCP_USE_TLS = 'false';

      // Mock HTTP transport creation
      const mockHttpTransport = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      jest.doMock('../../../src/mcp/transport/index.js', () => ({
        ...jest.requireActual('../../../src/mcp/transport/index.js'),
        createHttpTransport: jest.fn().mockReturnValue(mockHttpTransport),
      }));

      const testServer = new MCPServer();
      await testServer.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP transport started',
        }),
      );

      await testServer.stop();
    });
  });

  describe('Error Handling', () => {
    it('should log errors during tool execution', async () => {
      const mockError = new Error('Tool execution failed');

      // Mock a tool that throws an error
      jest.spyOn((mcpServer as any).executeApiTool, 'execute').mockRejectedValue(mockError);

      const server = (mcpServer as any).server;
      try {
        await server.handleRequest({
          method: 'tools/call',
          params: {
            name: 'execute-api',
            arguments: {},
          },
        });
      } catch (error) {
        // Expected error
      }

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP tool execution failed',
          tool: 'execute-api',
          error: 'Tool execution failed',
        }),
      );
    });

    it('should handle resource not found errors', async () => {
      const server = (mcpServer as any).server;

      await expect(
        server.handleRequest({
          method: 'resources/read',
          params: {
            uri: 'api://unknown-resource',
          },
        }),
      ).rejects.toThrow('Unknown resource: api://unknown-resource');
    });
  });
});
