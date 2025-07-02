/**
 * MCP Server Session Management Tests
 * @module mcp/server.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPServer } from './server.js';
import { logger } from '../utils/logger.js';

// Mock the logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  },
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    RESOURCE_CREATED: 'RESOURCE_CREATED',
  },
}));

describe('MCP Server Session Management', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSessionTool', () => {
    it('should create a session with valid credentials', async () => {
      const args = {
        username: 'demo',
        password: 'demo123!',
        duration: 3600,
      };

      const result = await (server as any).createSessionTool(args);
      
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response.sessionId).toBeDefined();
      expect(response.userId).toBe('user-demo-001');
      expect(response.username).toBe('demo');
      expect(response.roles).toEqual(['user']);
      expect(response.tokens).toBeDefined();
      expect(response.tokens.accessToken).toBeDefined();
      expect(response.tokens.refreshToken).toBeDefined();
    });

    it('should fail with invalid credentials', async () => {
      const args = {
        username: 'invalid',
        password: 'wrong',
      };

      const result = await (server as any).createSessionTool(args);
      
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.error).toBe('Invalid username or password');
      expect(response.code).toBe('AUTH_FAILED');
    });

    it('should fail with missing credentials', async () => {
      const args = {
        username: 'demo',
        // Missing password
      };

      const result = await (server as any).createSessionTool(args);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.error).toBe('Username and password are required');
      expect(response.code).toBe('INVALID_CREDENTIALS');
    });

    it('should create session with default duration', async () => {
      const args = {
        username: 'demo',
        password: 'demo123!',
        // No duration specified
      };

      const result = await (server as any).createSessionTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.sessionId).toBeDefined();
      // Default duration is 3600 seconds (1 hour)
      const createdAt = new Date(response.createdAt);
      const expiresAt = new Date(response.expiresAt);
      const durationMs = expiresAt.getTime() - createdAt.getTime();
      expect(durationMs).toBe(3600 * 1000);
    });
  });

  describe('listSessionsTool', () => {
    it('should list sessions for a user', async () => {
      // First create a session
      const createArgs = {
        username: 'demo',
        password: 'demo123!',
      };
      await (server as any).createSessionTool(createArgs);

      // Then list sessions
      const listArgs = {
        userId: 'user-demo-001',
      };

      const result = await (server as any).listSessionsTool(listArgs);
      
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.sessions).toBeDefined();
      expect(Array.isArray(response.sessions)).toBe(true);
      expect(response.count).toBeGreaterThan(0);
    });

    it('should return empty array for user with no sessions', async () => {
      const args = {
        userId: 'non-existent-user',
      };

      const result = await (server as any).listSessionsTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.sessions).toEqual([]);
      expect(response.count).toBe(0);
    });
  });

  describe('deleteSessionTool', () => {
    it('should delete an existing session', async () => {
      // First create a session
      const createArgs = {
        username: 'demo',
        password: 'demo123!',
      };
      const createResult = await (server as any).createSessionTool(createArgs);
      const { sessionId } = JSON.parse(createResult.content[0].text);

      // Then delete it
      const deleteArgs = {
        sessionId,
      };

      const result = await (server as any).deleteSessionTool(deleteArgs);
      
      expect(result).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Session deleted successfully');
    });

    it('should fail to delete non-existent session', async () => {
      const args = {
        sessionId: 'non-existent-session',
      };

      const result = await (server as any).deleteSessionTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.error).toBe('Session not found');
      expect(response.code).toBe('SESSION_NOT_FOUND');
    });

    it('should fail with missing session ID', async () => {
      const args = {};

      const result = await (server as any).deleteSessionTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.error).toBe('Session ID is required');
      expect(response.code).toBe('INVALID_SESSION_ID');
    });
  });

  describe('createBrowserContextTool', () => {
    it('should create browser context with valid session', async () => {
      // First create a session
      const createArgs = {
        username: 'demo',
        password: 'demo123!',
      };
      const createResult = await (server as any).createSessionTool(createArgs);
      const { sessionId } = JSON.parse(createResult.content[0].text);

      // Then create browser context
      const contextArgs = {
        sessionId,
        name: 'test-browser',
        options: {
          headless: true,
        },
      };

      const result = await (server as any).createBrowserContextTool(contextArgs);
      
      expect(result).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.contextId).toBeDefined();
      expect(response.name).toBe('test-browser');
      expect(response.type).toBe('puppeteer');
      expect(response.status).toBe('active');
    });

    it('should fail with invalid session', async () => {
      const args = {
        sessionId: 'invalid-session',
      };

      const result = await (server as any).createBrowserContextTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.error).toBeDefined();
      expect(response.code).toBe('CONTEXT_CREATION_FAILED');
    });

    it('should fail with missing session ID', async () => {
      const args = {};

      const result = await (server as any).createBrowserContextTool(args);
      const response = JSON.parse(result.content[0].text);
      
      expect(response.error).toBe('Session ID is required');
      expect(response.code).toBe('INVALID_SESSION');
    });
  });

  describe('Authentication Flow', () => {
    it('should support full authentication workflow', async () => {
      // 1. Create session
      const createArgs = {
        username: 'admin',
        password: 'admin123!',
      };
      const createResult = await (server as any).createSessionTool(createArgs);
      const session = JSON.parse(createResult.content[0].text);
      
      expect(session.sessionId).toBeDefined();
      expect(session.roles).toContain('admin');
      
      // 2. List sessions
      const listResult = await (server as any).listSessionsTool({
        userId: session.userId,
      });
      const sessions = JSON.parse(listResult.content[0].text);
      expect(sessions.count).toBeGreaterThan(0);
      
      // 3. Create browser context
      const contextResult = await (server as any).createBrowserContextTool({
        sessionId: session.sessionId,
      });
      const context = JSON.parse(contextResult.content[0].text);
      expect(context.contextId).toBeDefined();
      
      // 4. Delete session
      const deleteResult = await (server as any).deleteSessionTool({
        sessionId: session.sessionId,
      });
      const deleted = JSON.parse(deleteResult.content[0].text);
      expect(deleted.success).toBe(true);
    });
  });
});