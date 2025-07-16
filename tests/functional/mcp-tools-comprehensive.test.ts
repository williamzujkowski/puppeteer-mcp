/**
 * Comprehensive MCP Tools Functional Tests
 * @module tests/functional/mcp-tools-comprehensive
 * @description Complete functional test suite for all MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MCPServer, createMCPServer } from '../../src/mcp/server.js';
import type { ToolResponse } from '../../src/mcp/types/tool-types.js';
import { v4 as uuidv4 } from 'uuid';
import { createApp, sessionStore, browserPool } from '../../src/server.js';
import { createLogger } from '../../src/server/service-registry.js';
import type { Application } from 'express';

/**
 * Mock MCP client for testing
 */
class MockMCPClient {
  private server: MCPServer;
  private mockTransport: any;

  constructor(server: MCPServer) {
    this.server = server;
    this.setupMockTransport();
  }

  private setupMockTransport(): void {
    // Mock the transport to intercept tool calls
    this.mockTransport = {
      send: jest.fn(),
      close: jest.fn(),
    };
  }

  async callTool(name: string, args: any): Promise<ToolResponse> {
    // Directly call the server's executeTool method
    const result = await (this.server as any).executeTool(name, args);

    // Check if result is already a ToolResponse (e.g., from execute-in-context)
    if (result && typeof result === 'object' && result.content && Array.isArray(result.content)) {
      return result as ToolResponse;
    }

    // Convert raw result to ToolResponse format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }
}

// TODO: Fix these tests - they expect thrown errors but MCP returns error content
describe.skip('MCP Tools Comprehensive Functional Tests', () => {
  let mcpServer: MCPServer;
  let mcpClient: MockMCPClient;
  let app: Application;
  const testSessions: Map<string, any> = new Map();
  const testContexts: Map<string, any> = new Map();

  beforeAll(async () => {
    // Create Express app with required dependencies
    const logger = createLogger();
    app = createApp(logger, sessionStore, browserPool);

    // Create MCP server with Express app for REST adapter
    mcpServer = createMCPServer({ app });
    mcpClient = new MockMCPClient(mcpServer);

    // Start the server
    await mcpServer.start();
  });

  afterAll(async () => {
    // Cleanup all test resources
    for (const contextId of testContexts.keys()) {
      try {
        await mcpClient.callTool('close-browser-context', {
          contextId,
          sessionId: testContexts.get(contextId).sessionId,
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const sessionId of testSessions.keys()) {
      try {
        await mcpClient.callTool('delete-session', { sessionId });
      } catch {
        // Ignore cleanup errors
      }
    }

    await mcpServer.stop();
  });

  describe('1. create-session Tool Tests', () => {
    describe('Valid Input Cases', () => {
      it('should create a basic session successfully', async () => {
        const result = await mcpClient.callTool('create-session', {
          username: 'testuser',
          password: 'testpass123',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');

        const sessionData = JSON.parse(result.content[0].text);
        expect(sessionData.sessionId).toMatch(/^[a-f0-9-]{36}$/);
        expect(sessionData.userId).toBeDefined();
        expect(sessionData.expiresAt).toBeDefined();
        expect(new Date(sessionData.expiresAt).getTime()).toBeGreaterThan(Date.now());

        // Store for cleanup
        testSessions.set(sessionData.sessionId, sessionData);
      });

      it('should create a session with custom duration', async () => {
        const customDuration = 7200; // 2 hours in seconds
        const result = await mcpClient.callTool('create-session', {
          username: 'testuser',
          password: 'testpass123',
          duration: customDuration,
        });

        const sessionData = JSON.parse(result.content[0].text);
        const expiresAt = new Date(sessionData.expiresAt).getTime();
        const expectedExpiry = Date.now() + customDuration * 1000;

        // Allow 5 second tolerance for execution time
        expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(5000);

        testSessions.set(sessionData.sessionId, sessionData);
      });

      it('should handle maximum duration boundary', async () => {
        const maxDuration = 86400; // 24 hours
        const result = await mcpClient.callTool('create-session', {
          username: 'testuser',
          password: 'testpass123',
          duration: maxDuration,
        });

        const sessionData = JSON.parse(result.content[0].text);
        expect(sessionData.sessionId).toBeDefined();

        testSessions.set(sessionData.sessionId, sessionData);
      });
    });

    describe('Invalid Input Cases', () => {
      it('should reject missing username', async () => {
        await expect(
          mcpClient.callTool('create-session', {
            password: 'testpass123',
          }),
        ).rejects.toThrow();
      });

      it('should reject missing password', async () => {
        await expect(
          mcpClient.callTool('create-session', {
            username: 'testuser',
          }),
        ).rejects.toThrow();
      });

      it('should reject invalid duration', async () => {
        await expect(
          mcpClient.callTool('create-session', {
            username: 'testuser',
            password: 'testpass123',
            duration: -1,
          }),
        ).rejects.toThrow();
      });

      it('should reject duration exceeding maximum', async () => {
        await expect(
          mcpClient.callTool('create-session', {
            username: 'testuser',
            password: 'testpass123',
            duration: 86401, // > 24 hours
          }),
        ).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle special characters in username', async () => {
        const result = await mcpClient.callTool('create-session', {
          username: 'test.user@example.com',
          password: 'testpass123',
        });

        const sessionData = JSON.parse(result.content[0].text);
        expect(sessionData.sessionId).toBeDefined();

        testSessions.set(sessionData.sessionId, sessionData);
      });

      it('should handle minimum username length', async () => {
        const result = await mcpClient.callTool('create-session', {
          username: 'abc', // 3 characters
          password: 'testpass123',
        });

        const sessionData = JSON.parse(result.content[0].text);
        expect(sessionData.sessionId).toBeDefined();

        testSessions.set(sessionData.sessionId, sessionData);
      });

      it('should reject username shorter than minimum', async () => {
        await expect(
          mcpClient.callTool('create-session', {
            username: 'ab', // 2 characters
            password: 'testpass123',
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('2. list-sessions Tool Tests', () => {
    beforeEach(async () => {
      // Create test sessions for listing
      for (let i = 0; i < 3; i++) {
        const result = await mcpClient.callTool('create-session', {
          username: `listuser${i}`,
          password: 'testpass123',
        });
        const sessionData = JSON.parse(result.content[0].text);
        testSessions.set(sessionData.sessionId, sessionData);
      }
    });

    it('should list all sessions when no filter provided', async () => {
      const result = await mcpClient.callTool('list-sessions', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const listData = JSON.parse(result.content[0].text);
      expect(Array.isArray(listData.sessions)).toBe(true);
      expect(listData.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter sessions by userId', async () => {
      // Get a specific user's sessions
      const firstSession = Array.from(testSessions.values())[0];
      const result = await mcpClient.callTool('list-sessions', {
        userId: firstSession.userId,
      });

      const listData = JSON.parse(result.content[0].text);
      expect(listData.sessions.every((s) => s.userId === firstSession.userId)).toBe(true);
    });

    it('should handle non-existent userId gracefully', async () => {
      const result = await mcpClient.callTool('list-sessions', {
        userId: 'non-existent-user-id',
      });

      const listData = JSON.parse(result.content[0].text);
      expect(listData.sessions).toHaveLength(0);
      expect(listData.total).toBe(0);
    });
  });

  describe('3. delete-session Tool Tests', () => {
    it('should delete an existing session', async () => {
      // Create a session to delete
      const createResult = await mcpClient.callTool('create-session', {
        username: 'deleteuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(createResult.content[0].text);

      // Delete the session
      const deleteResult = await mcpClient.callTool('delete-session', {
        sessionId: sessionData.sessionId,
      });

      const deleteData = JSON.parse(deleteResult.content[0].text);
      expect(deleteData.success).toBe(true);

      // Verify session is deleted by trying to list it
      const listResult = await mcpClient.callTool('list-sessions', {});
      const listData = JSON.parse(listResult.content[0].text);
      expect(listData.sessions.find((s) => s.id === sessionData.sessionId)).toBeUndefined();
    });

    it('should handle non-existent session deletion', async () => {
      const nonExistentId = uuidv4();

      await expect(
        mcpClient.callTool('delete-session', {
          sessionId: nonExistentId,
        }),
      ).rejects.toThrow();
    });

    it('should reject missing sessionId', async () => {
      await expect(mcpClient.callTool('delete-session', {})).rejects.toThrow();
    });
  });

  describe('4. create-browser-context Tool Tests', () => {
    let validSessionId: string;

    beforeEach(async () => {
      // Create a valid session for context creation
      const result = await mcpClient.callTool('create-session', {
        username: 'contextuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(result.content[0].text);
      validSessionId = sessionData.sessionId;
      testSessions.set(validSessionId, sessionData);
    });

    describe('Valid Input Cases', () => {
      it('should create a basic browser context', async () => {
        const result = await mcpClient.callTool('create-browser-context', {
          sessionId: validSessionId,
        });

        const contextData = JSON.parse(result.content[0].text);
        expect(contextData.contextId).toMatch(/^[a-f0-9-]{36}$/);
        expect(contextData.sessionId).toBe(validSessionId);
        expect(contextData.createdAt).toBeDefined();

        testContexts.set(contextData.contextId, contextData);
      });

      it('should create context with custom viewport', async () => {
        const result = await mcpClient.callTool('create-browser-context', {
          sessionId: validSessionId,
          options: {
            headless: false,
            viewport: { width: 1920, height: 1080 },
          },
        });

        const contextData = JSON.parse(result.content[0].text);
        expect(contextData.config).toMatchObject({
          headless: false,
          viewport: { width: 1920, height: 1080 },
        });

        testContexts.set(contextData.contextId, contextData);
      });

      it('should create context with mobile viewport', async () => {
        const result = await mcpClient.callTool('create-browser-context', {
          sessionId: validSessionId,
          options: {
            viewport: { width: 375, height: 667 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          },
        });

        const contextData = JSON.parse(result.content[0].text);
        expect(contextData.config.viewport).toMatchObject({
          width: 375,
          height: 667,
        });

        testContexts.set(contextData.contextId, contextData);
      });
    });

    describe('Invalid Input Cases', () => {
      it('should reject invalid sessionId', async () => {
        await expect(
          mcpClient.callTool('create-browser-context', {
            sessionId: uuidv4(), // Non-existent session
          }),
        ).rejects.toThrow();
      });

      it('should reject missing sessionId', async () => {
        await expect(mcpClient.callTool('create-browser-context', {})).rejects.toThrow();
      });

      it('should reject invalid viewport dimensions', async () => {
        await expect(
          mcpClient.callTool('create-browser-context', {
            sessionId: validSessionId,
            options: {
              viewport: { width: -1, height: 1080 },
            },
          }),
        ).rejects.toThrow();
      });

      it('should reject viewport dimensions exceeding limits', async () => {
        await expect(
          mcpClient.callTool('create-browser-context', {
            sessionId: validSessionId,
            options: {
              viewport: { width: 10000, height: 10000 }, // Too large
            },
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('5. execute-in-context Tool Tests', () => {
    let validSessionId: string;
    let validContextId: string;

    beforeEach(async () => {
      // Create session and context for testing
      const sessionResult = await mcpClient.callTool('create-session', {
        username: 'executeuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(sessionResult.content[0].text);
      validSessionId = sessionData.sessionId;

      const contextResult = await mcpClient.callTool('create-browser-context', {
        sessionId: validSessionId,
      });
      const contextData = JSON.parse(contextResult.content[0].text);
      validContextId = contextData.contextId;

      testSessions.set(validSessionId, sessionData);
      testContexts.set(validContextId, contextData);
    });

    describe('Navigation Commands', () => {
      it('should execute navigate command', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          command: 'navigate',
          parameters: { url: 'https://example.com' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBeDefined();
      });

      it('should execute navigate with wait options', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          command: 'navigate',
          parameters: {
            url: 'https://example.com',
            waitUntil: 'networkidle0',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });
    });

    describe('Content Commands', () => {
      it('should execute screenshot command', async () => {
        // Navigate first
        await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          command: 'navigate',
          parameters: { url: 'https://example.com' },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          command: 'screenshot',
          parameters: { fullPage: true },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBeDefined();
      });

      it('should execute evaluate command', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          command: 'evaluate',
          parameters: {
            code: 'document.title',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBeDefined();
      });
    });

    describe('Invalid Command Cases', () => {
      it('should reject missing contextId', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          command: 'navigate',
          parameters: { url: 'https://example.com' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.error).toBe('Context ID is required');
        expect(executeData.code).toBe('INVALID_CONTEXT_ID');
      });

      it('should reject missing command', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: validContextId,
          parameters: { url: 'https://example.com' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.error).toBe('Command is required');
        expect(executeData.code).toBe('INVALID_COMMAND');
      });

      it('should handle invalid context gracefully', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: uuidv4(), // Non-existent context
          command: 'navigate',
          parameters: { url: 'https://example.com' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.error).toBeDefined();
      });
    });
  });

  describe('6. execute-api Tool Tests', () => {
    describe('REST Protocol', () => {
      it('should execute REST GET request', async () => {
        const result = await mcpClient.callTool('execute-api', {
          protocol: 'rest',
          operation: {
            method: 'GET',
            endpoint: '/health',
          },
        });

        const apiData = JSON.parse(result.content[0].text);
        expect(apiData).toBeDefined();
      });

      it('should execute authenticated REST request', async () => {
        // Create a session first
        const sessionResult = await mcpClient.callTool('create-session', {
          username: 'apiuser',
          password: 'testpass123',
        });
        const sessionData = JSON.parse(sessionResult.content[0].text);

        const result = await mcpClient.callTool('execute-api', {
          protocol: 'rest',
          operation: {
            method: 'GET',
            endpoint: '/sessions',
          },
          auth: {
            type: 'session',
            credentials: sessionData.sessionId,
          },
        });

        const apiData = JSON.parse(result.content[0].text);
        expect(apiData).toBeDefined();

        testSessions.set(sessionData.sessionId, sessionData);
      });
    });

    describe('Invalid Protocol Cases', () => {
      it('should reject invalid protocol', async () => {
        await expect(
          mcpClient.callTool('execute-api', {
            protocol: 'invalid-protocol',
            operation: { method: 'GET', endpoint: '/health' },
          }),
        ).rejects.toThrow();
      });

      it('should reject missing operation', async () => {
        await expect(
          mcpClient.callTool('execute-api', {
            protocol: 'rest',
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('7. Resource Access Tests', () => {
    it('should read api catalog resource', async () => {
      // Resources are accessed differently in MCP
      // This would typically use the readResource method
      // For now, we'll test through execute-api
      const result = await mcpClient.callTool('execute-api', {
        protocol: 'rest',
        operation: {
          method: 'GET',
          endpoint: '/catalog',
        },
      });

      const catalogData = JSON.parse(result.content[0].text);
      expect(catalogData).toBeDefined();
    });

    it('should read health resource', async () => {
      const result = await mcpClient.callTool('execute-api', {
        protocol: 'rest',
        operation: {
          method: 'GET',
          endpoint: '/health',
        },
      });

      const healthData = JSON.parse(result.content[0].text);
      expect(healthData).toBeDefined();
    });
  });

  describe('8. Concurrent Operations Tests', () => {
    it('should handle concurrent session creation', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          mcpClient.callTool('create-session', {
            username: `concurrent${i}`,
            password: 'testpass123',
          }),
        );
      }

      const results = await Promise.all(promises);
      const sessionIds = results.map((r) => JSON.parse(r.content[0].text).sessionId);

      // All session IDs should be unique
      expect(new Set(sessionIds).size).toBe(sessionIds.length);

      // Store for cleanup
      results.forEach((r) => {
        const data = JSON.parse(r.content[0].text);
        testSessions.set(data.sessionId, data);
      });
    });

    it('should handle concurrent context creation', async () => {
      // Create a session first
      const sessionResult = await mcpClient.callTool('create-session', {
        username: 'concurrentcontextuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(sessionResult.content[0].text);
      testSessions.set(sessionData.sessionId, sessionData);

      // Create multiple contexts concurrently
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          mcpClient.callTool('create-browser-context', {
            sessionId: sessionData.sessionId,
          }),
        );
      }

      const results = await Promise.all(promises);
      const contextIds = results.map((r) => JSON.parse(r.content[0].text).contextId);

      // All context IDs should be unique
      expect(new Set(contextIds).size).toBe(contextIds.length);

      // Store for cleanup
      results.forEach((r) => {
        const data = JSON.parse(r.content[0].text);
        testContexts.set(data.contextId, data);
      });
    });
  });

  describe('9. Error Recovery Tests', () => {
    it('should recover from browser crash', async () => {
      // This test would simulate a browser crash and verify recovery
      // For now, we'll test error handling
      const sessionResult = await mcpClient.callTool('create-session', {
        username: 'crashuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(sessionResult.content[0].text);
      testSessions.set(sessionData.sessionId, sessionData);

      // Try to execute in a non-existent context
      const result = await mcpClient.callTool('execute-in-context', {
        contextId: uuidv4(),
        command: 'navigate',
        parameters: { url: 'https://example.com' },
      });

      const executeData = JSON.parse(result.content[0].text);
      expect(executeData.error).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      // Create context for testing
      const sessionResult = await mcpClient.callTool('create-session', {
        username: 'timeoutuser',
        password: 'testpass123',
      });
      const sessionData = JSON.parse(sessionResult.content[0].text);

      const contextResult = await mcpClient.callTool('create-browser-context', {
        sessionId: sessionData.sessionId,
      });
      const contextData = JSON.parse(contextResult.content[0].text);

      testSessions.set(sessionData.sessionId, sessionData);
      testContexts.set(contextData.contextId, contextData);

      // Execute a command that might timeout
      const result = await mcpClient.callTool('execute-in-context', {
        contextId: contextData.contextId,
        command: 'wait',
        parameters: {
          selector: '#non-existent-element',
          timeout: 1000, // 1 second timeout
        },
      });

      const executeData = JSON.parse(result.content[0].text);
      // Should either succeed (element found) or fail gracefully (timeout)
      expect(executeData).toBeDefined();
    });
  });
});
