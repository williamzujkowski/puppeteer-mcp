/**
 * MCP Execute-in-Context Tool Tests
 * @module tests/unit/mcp/execute-in-context-tool
 * @description Unit tests for the execute-in-context MCP tool
 */

import { MCPServer } from '../../../src/mcp/server.js';
// import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
// import { contextStore } from '../../../src/store/context-store.js';
// import { userService } from '../../../src/mcp/auth/user-service.js';
// import { logger } from '../../../src/utils/logger.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Application } from 'express';

// Mock dependencies
jest.mock('../../../src/store/context-store.js');
jest.mock('../../../src/mcp/auth/user-service.js');
jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
    })),
  })),
}));

describe('MCP Execute-in-Context Tool', () => {
  let mcpServer: MCPServer;
  let mockApp: Partial<Application>;
  let mockRestAdapter: any;
  let executeInContextTool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock Express app
    mockApp = {};

    // Create mock REST adapter
    mockRestAdapter = {
      executeRequest: jest.fn(),
    };

    // Create MCP server instance
    mcpServer = new MCPServer(mockApp as Application);

    // Replace the REST adapter with our mock
    (mcpServer as any).restAdapter = mockRestAdapter;

    // Get the executeInContextTool instance and replace its restAdapter
    executeInContextTool = (mcpServer as any).executeInContextTool;
    executeInContextTool.restAdapter = mockRestAdapter;
  });

  describe('execute-in-context tool', () => {
    it('should execute a command in a context successfully', async () => {
      // Arrange
      const contextId = 'test-context-123';
      const command = 'navigate';
      const parameters = { url: 'https://example.com' };

      // Mock successful REST adapter response
      mockRestAdapter.executeRequest.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: { currentUrl: 'https://example.com' },
            }),
          },
        ],
        metadata: {
          status: 200,
          requestId: 'test-request-123',
        },
      });

      // Act
      const result = await executeInContextTool.execute({
        contextId,
        command,
        parameters,
      });

      // Assert
      expect(mockRestAdapter.executeRequest).toHaveBeenCalledWith({
        operation: {
          method: 'POST',
          endpoint: `/v1/contexts/${contextId}/execute`,
          body: {
            action: command,
            params: parameters,
          },
        },
        auth: undefined,
        sessionId: undefined,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toEqual({
        success: true,
        result: { currentUrl: 'https://example.com' },
      });
    });

    it('should handle missing contextId', async () => {
      // Act
      const result = await executeInContextTool.execute({
        command: 'navigate',
        parameters: { url: 'https://example.com' },
      });

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.error).toBe('Context ID is required');
      expect(responseData.code).toBe('INVALID_CONTEXT_ID');
    });

    it('should handle missing command', async () => {
      // Act
      const result = await executeInContextTool.execute({
        contextId: 'test-context-123',
        parameters: { url: 'https://example.com' },
      });

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.error).toBe('Command is required');
      expect(responseData.code).toBe('INVALID_COMMAND');
    });

    it('should use session authentication when sessionId is provided', async () => {
      // Arrange
      const contextId = 'test-context-123';
      const command = 'navigate';
      const sessionId = 'test-session-456';

      mockRestAdapter.executeRequest.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true }),
          },
        ],
      });

      // Act
      await executeInContextTool.execute({
        contextId,
        command,
        sessionId,
      });

      // Assert
      expect(mockRestAdapter.executeRequest).toHaveBeenCalledWith({
        operation: {
          method: 'POST',
          endpoint: `/v1/contexts/${contextId}/execute`,
          body: {
            action: command,
            params: {},
          },
        },
        auth: {
          type: 'session',
          credentials: sessionId,
        },
        sessionId,
      });
    });

    it('should handle REST adapter errors gracefully', async () => {
      // Arrange
      const error = new Error('Network error');
      mockRestAdapter.executeRequest.mockRejectedValue(error);

      // Act
      const result = await executeInContextTool.execute({
        contextId: 'test-context-123',
        command: 'navigate',
        parameters: { url: 'https://example.com' },
      });

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.error).toBe('Network error');
      expect(responseData.code).toBe('EXECUTION_FAILED');
    });

    it('should handle unparseable response gracefully', async () => {
      // Arrange
      mockRestAdapter.executeRequest.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Not valid JSON',
          },
        ],
      });

      // Act
      const result = await executeInContextTool.execute({
        contextId: 'test-context-123',
        command: 'navigate',
      });

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.result).toBe('Not valid JSON');
    });
  });
});
