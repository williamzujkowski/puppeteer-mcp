/**
 * Unit tests for MCP Server
 * @module tests/unit/mcp/mcp-server
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MCPServer } from '../../../src/mcp/server.js';
import { logger } from '../../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../../src/utils/logger.js');
jest.mock('../../../src/store/session-store.js');
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
      
      // Mock the stdio transport connection
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(mcpServer as any, 'server', 'get').mockReturnValue({
        connect: mockConnect,
        close: jest.fn(),
      });
      
      await mcpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Starting MCP server',
          transportType: 'stdio',
        })
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
      // const mockSession = {
      //   id: 'test-session-123',
      //   userId: 'testuser',
      //   createdAt: new Date().toISOString(),
      //   expiresAt: new Date(Date.now() + 3600000).toISOString(),
      // };
      
      const result = await (mcpServer as any).createSessionTool({
        username: 'testuser',
        password: 'testpass',
        duration: 3600,
      });
      
      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
      
      const sessionData = JSON.parse(result.content[0].text);
      expect(sessionData).toHaveProperty('id');
      expect(sessionData).toHaveProperty('userId', 'testuser');
    });

    it('should handle unknown tool error', async () => {
      await expect(
        (mcpServer as any).server.handleRequest({
          method: 'tools/call',
          params: {
            name: 'unknown-tool',
            arguments: {},
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Resource Access', () => {
    it('should return API catalog', async () => {
      const result = await (mcpServer as any).getApiCatalog();
      
      expect(result).toHaveProperty('contents');
      expect(result.contents[0].mimeType).toBe('application/json');
      
      const catalog = JSON.parse(result.contents[0].text);
      expect(catalog).toHaveProperty('rest');
      expect(catalog).toHaveProperty('grpc');
      expect(catalog).toHaveProperty('websocket');
    });

    it('should return system health', async () => {
      const result = await (mcpServer as any).getSystemHealth();
      
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
      
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(mcpServer as any, 'server', 'get').mockReturnValue({
        connect: mockConnect,
        close: jest.fn(),
      });
      
      await mcpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP server started with stdio transport',
        })
      );
    });

    it('should support HTTP transport', async () => {
      process.env.MCP_TRANSPORT = 'http';
      
      // Mock HTTP transport creation
      jest.mock('../../../src/mcp/transport/index.js', () => ({
        ...jest.requireActual('../../../src/mcp/transport/index.js'),
        createHttpTransport: jest.fn().mockReturnValue({
          start: jest.fn().mockResolvedValue(undefined),
        }),
      }));
      
      await mcpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP transport started',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should log errors during tool execution', async () => {
      const mockError = new Error('Tool execution failed');
      
      // Mock a tool that throws an error
      jest.spyOn(mcpServer as any, 'executeApiTool').mockRejectedValue(mockError);
      
      try {
        await (mcpServer as any).server.handleRequest({
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
        })
      );
    });

    it('should handle resource not found errors', async () => {
      await expect(
        (mcpServer as any).server.handleRequest({
          method: 'resources/read',
          params: {
            uri: 'api://unknown-resource',
          },
        })
      ).rejects.toThrow();
    });
  });
});