/**
 * MCP Server Session Management Tests
 * @module mcp/server.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPServer } from '../../../src/mcp/server.js';

// Mock the logger
jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
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
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  logDataAccess: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    // Authentication events
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    ACCESS_GRANTED: 'ACCESS_GRANTED',
    ACCESS_DENIED: 'ACCESS_DENIED',
    PERMISSION_CHANGE: 'PERMISSION_CHANGE',

    // API Key events
    API_KEY_CREATED: 'API_KEY_CREATED',
    API_KEY_REVOKED: 'API_KEY_REVOKED',
    API_KEY_USED: 'API_KEY_USED',

    // Data access events
    DATA_ACCESS: 'DATA_ACCESS',
    DATA_MODIFICATION: 'DATA_MODIFICATION',
    DATA_DELETION: 'DATA_DELETION',
    API_ACCESS: 'API_ACCESS',
    RESOURCE_CREATED: 'RESOURCE_CREATED',
    RESOURCE_UPDATED: 'RESOURCE_UPDATED',
    RESOURCE_DELETED: 'RESOURCE_DELETED',

    // Security violations
    INVALID_TOKEN: 'INVALID_TOKEN',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    VALIDATION_FAILURE: 'VALIDATION_FAILURE',

    // Connection events
    CONNECTION_ATTEMPT: 'CONNECTION_ATTEMPT',
    CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED',
    CONNECTION_TERMINATED: 'CONNECTION_TERMINATED',
    CONNECTION_CLOSED: 'CONNECTION_CLOSED',

    // System events
    CONFIG_CHANGE: 'CONFIG_CHANGE',
    SERVICE_START: 'SERVICE_START',
    SERVICE_STOP: 'SERVICE_STOP',
    ERROR: 'ERROR',

    // Command execution events
    COMMAND_EXECUTED: 'COMMAND_EXECUTED',

    // Session events
    SESSION_CREATED: 'SESSION_CREATED',
    SESSION_UPDATED: 'SESSION_UPDATED',
    SESSION_DELETED: 'SESSION_DELETED',
  },
}));

// Mock the config
jest.mock('../../../src/core/config.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-for-testing-purposes-only',
    jwtExpiresIn: '1h',
    jwtRefreshExpiresIn: '7d',
  },
}));

// Mock the JWT generation
jest.mock('../../../src/auth/jwt.js', () => ({
  generateTokenPair: jest.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }),
  verifyToken: jest.fn(),
  extractTokenFromHeader: jest.fn(),
}));

// Mock the browser pool
jest.mock('../../../src/server.js', () => ({
  browserPool: {
    launch: jest.fn().mockResolvedValue({
      id: 'mock-browser-id',
      browser: {
        close: jest.fn(),
        newContext: jest.fn().mockResolvedValue({
          id: 'mock-context-id',
          close: jest.fn(),
        }),
      },
    }),
    close: jest.fn(),
  },
}));

// Mock the context store
jest.mock('../../../src/store/context-store.js', () => ({
  contextStore: {
    create: jest.fn().mockResolvedValue('mock-context-id'),
    get: jest.fn().mockResolvedValue({
      id: 'mock-context-id',
      sessionId: 'mock-session-id',
      name: 'test-browser',
      type: 'puppeteer',
      status: 'active',
      createdAt: new Date().toISOString(),
    }),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true),
  },
}));

// Mock the page manager
jest.mock('../../../src/puppeteer/pages/page-manager.js', () => ({
  getPageManager: jest.fn(() => ({
    closePagesForSession: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock proxy context integration
jest.mock('../../../src/puppeteer/proxy/proxy-context-integration.js', () => ({
  createProxyBrowserContext: jest.fn().mockResolvedValue({
    proxyId: null,
    browser: {
      id: 'mock-browser-id',
    },
  }),
  cleanupContextProxy: jest.fn().mockResolvedValue(undefined),
}));

// Mock the MCP auth bridge
jest.mock('../../../src/mcp/auth/mcp-auth.js', () => ({
  MCPAuthBridge: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue({
      userId: 'user-demo-001',
      username: 'demo',
      roles: ['user'],
      metadata: {},
    }),
    requireToolPermission: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('MCP Server Session Management', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  afterEach(async () => {
    await server.stop();
    jest.clearAllMocks();
  });

  describe('createSessionTool', () => {
    it('should create a session with valid credentials', async () => {
      const args = {
        username: 'demo',
        password: 'demo123!',
        duration: 3600,
      };

      const result = await (server as any).sessionTools.createSession(args);

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
        username: 'demo', // Use existing user
        password: 'wrongpassword123', // Wrong password
      };

      const result = await (server as any).sessionTools.createSession(args);

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

      const result = await (server as any).sessionTools.createSession(args);

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

      const result = await (server as any).sessionTools.createSession(args);
      const response = JSON.parse(result.content[0].text);

      expect(response.sessionId).toBeDefined();
      // Default duration is 3600 seconds (1 hour)
      const createdAt = new Date(response.createdAt);
      const expiresAt = new Date(response.expiresAt);
      const durationMs = expiresAt.getTime() - createdAt.getTime();
      // Allow for minor timing differences (within 1 second)
      expect(durationMs).toBeGreaterThanOrEqual(3599 * 1000);
      expect(durationMs).toBeLessThanOrEqual(3601 * 1000);
    });
  });

  describe('listSessionsTool', () => {
    it('should list sessions for a user', async () => {
      // First create a session
      const createArgs = {
        username: 'demo',
        password: 'demo123!',
      };
      await (server as any).sessionTools.createSession(createArgs);

      // Then list sessions
      const listArgs = {
        userId: 'user-demo-001',
      };

      const result = await (server as any).sessionTools.listSessions(listArgs);

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

      const result = await (server as any).sessionTools.listSessions(args);
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
      const createResult = await (server as any).sessionTools.createSession(createArgs);
      const { sessionId } = JSON.parse(createResult.content[0].text);

      // Then delete it
      const deleteArgs = {
        sessionId,
      };

      const result = await (server as any).sessionTools.deleteSession(deleteArgs);

      expect(result).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Session deleted successfully');
    });

    it('should fail to delete non-existent session', async () => {
      const args = {
        sessionId: 'non-existent-session',
      };

      const result = await (server as any).sessionTools.deleteSession(args);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBe('Session not found');
      expect(response.code).toBe('SESSION_NOT_FOUND');
    });

    it('should fail with missing session ID', async () => {
      const args = {};

      const result = await (server as any).sessionTools.deleteSession(args);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBe('Session ID is required');
      expect(response.code).toBe('INVALID_SESSION_ID');
    });
  });

  describe('createBrowserContextTool', () => {
    it.skip('should create browser context with valid session', async () => {
      // First create a session
      const createArgs = {
        username: 'demo',
        password: 'demo123!',
      };
      const createResult = await (server as any).sessionTools.createSession(createArgs);
      const { sessionId } = JSON.parse(createResult.content[0].text);

      // Then create browser context
      const contextArgs = {
        sessionId,
        name: 'test-browser',
        options: {
          headless: true,
        },
      };

      const result = await (server as any).browserContextTool.createBrowserContext(contextArgs);

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

      const result = await (server as any).browserContextTool.createBrowserContext(args);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBeDefined();
      expect(response.code).toBe('CONTEXT_CREATION_FAILED');
    });

    it('should fail with missing session ID', async () => {
      const args = {};

      const result = await (server as any).browserContextTool.createBrowserContext(args);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBe('Session ID is required');
      expect(response.code).toBe('CONTEXT_CREATION_FAILED');
    });
  });

  describe('Authentication Flow', () => {
    it.skip('should support full authentication workflow', async () => {
      // 1. Create session
      const createArgs = {
        username: 'admin',
        password: 'admin123!',
      };
      const createResult = await (server as any).sessionTools.createSession(createArgs);
      const session = JSON.parse(createResult.content[0].text);

      expect(session.sessionId).toBeDefined();
      expect(session.roles).toContain('admin');

      // 2. List sessions
      const listResult = await (server as any).sessionTools.listSessions({
        userId: session.userId,
      });
      const sessions = JSON.parse(listResult.content[0].text);
      expect(sessions.count).toBeGreaterThan(0);

      // 3. Create browser context
      const contextResult = await (server as any).browserContextTool.createBrowserContext({
        sessionId: session.sessionId,
      });
      const context = JSON.parse(contextResult.content[0].text);
      expect(context.contextId).toBeDefined();

      // 4. Delete session
      const deleteResult = await (server as any).sessionTools.deleteSession({
        sessionId: session.sessionId,
      });
      const deleted = JSON.parse(deleteResult.content[0].text);
      expect(deleted.success).toBe(true);
    });
  });
});
