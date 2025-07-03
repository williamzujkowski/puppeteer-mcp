/**
 * MCP Authentication Bridge Tests
 * @module tests/unit/mcp/auth
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { MCPAuthBridge, MCP_TOOL_PERMISSIONS, type AuthContext, type MCPAuthCredentials } from '../../../src/mcp/auth/mcp-auth.js';
import { generateToken } from '../../../src/auth/jwt.js';
import { apiKeyStore } from '../../../src/store/api-key-store.js';
import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import { Permission } from '../../../src/auth/permissions.js';
import { AppError } from '../../../src/core/errors/app-error.js';
import * as logger from '../../../src/utils/logger.js';
import { pino } from 'pino';

// Mock logger
jest.mock('../../../src/utils/logger.js', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
  logDataAccess: jest.fn().mockResolvedValue(undefined),
}));

// Mock config for JWT
jest.mock('../../../src/core/config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-for-testing-only-32-chars-long!!',
    JWT_ALGORITHM: 'HS256',
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
  },
}));

describe('MCPAuthBridge', () => {
  let authBridge: MCPAuthBridge;
  let sessionStore: InMemorySessionStore;
  let mockLogger: pino.Logger;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only-32-chars-long!!';
    process.env.JWT_ALGORITHM = 'HS256';
    process.env.JWT_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(mockLogger);
    authBridge = new MCPAuthBridge(sessionStore, mockLogger);
  });

  afterEach(async () => {
    await sessionStore.clear();
    await apiKeyStore.clear();
  });

  describe('authenticate', () => {
    it('should reject when no auth credentials provided', async () => {
      await expect(authBridge.authenticate()).rejects.toThrow(
        new AppError('Authentication required', 401)
      );
      
      expect(logger.logSecurityEvent).toHaveBeenCalledWith(
        logger.SecurityEventType.LOGIN_FAILURE,
        expect.objectContaining({
          reason: 'No authentication credentials provided',
          result: 'failure',
        })
      );
    });

    it('should reject invalid authentication type', async () => {
      const auth = {
        type: 'invalid' as any,
        credentials: 'test',
      };

      await expect(authBridge.authenticate(auth)).rejects.toThrow(
        new AppError('Invalid authentication type', 400)
      );
    });

    describe('JWT authentication', () => {
      it('should authenticate valid JWT token', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const username = 'testuser';
        const roles = ['user', 'poweruser'];
        const sessionId = '987e6543-e21b-12d3-a456-426614174001';

        const token = generateToken({
          sub: userId,
          username,
          roles,
          sessionId,
          type: 'access',
        });

        const auth: MCPAuthCredentials = {
          type: 'jwt',
          credentials: token,
        };

        // Add try-catch to see actual error
        try {
          const result = await authBridge.authenticate(auth);

          expect(result).toEqual({
            userId,
            username,
            roles,
            permissions: expect.arrayContaining([
              Permission.SESSION_CREATE,
              Permission.CONTEXT_EXECUTE,
            ]),
            sessionId,
            authMethod: 'jwt',
          });

          expect(logger.logSecurityEvent).toHaveBeenCalledWith(
            logger.SecurityEventType.LOGIN_SUCCESS,
            expect.objectContaining({
              userId,
              result: 'success',
              metadata: expect.objectContaining({
                method: 'jwt',
                context: 'mcp',
              }),
            })
          );
        } catch (error) {
          console.error('JWT authentication error:', error);
          throw error;
        }
      });

      it('should handle Bearer token format', async () => {
        const token = generateToken({
          sub: '123e4567-e89b-12d3-a456-426614174000',
          username: 'testuser',
          roles: ['user'],
          sessionId: '987e6543-e21b-12d3-a456-426614174001',
          type: 'access',
        });

        const auth: MCPAuthCredentials = {
          type: 'jwt',
          credentials: `Bearer ${token}`,
        };

        const result = await authBridge.authenticate(auth);
        expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
      });

      it('should reject invalid JWT token', async () => {
        const auth: MCPAuthCredentials = {
          type: 'jwt',
          credentials: 'invalid-token',
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid or expired JWT token', 401)
        );

        expect(logger.logSecurityEvent).toHaveBeenCalledWith(
          logger.SecurityEventType.LOGIN_FAILURE,
          expect.objectContaining({
            result: 'failure',
            metadata: expect.objectContaining({
              method: 'jwt',
            }),
          })
        );
      });

      it('should reject expired JWT token', async () => {
        const token = generateToken(
          {
            sub: '123e4567-e89b-12d3-a456-426614174000',
            username: 'testuser',
            roles: ['user'],
            sessionId: '987e6543-e21b-12d3-a456-426614174001',
            type: 'access',
          },
          -1 // Negative expiry to create expired token
        );

        const auth: MCPAuthCredentials = {
          type: 'jwt',
          credentials: token,
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid or expired JWT token', 401)
        );
      });
    });

    describe('API key authentication', () => {
      it('should authenticate valid API key', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const { plainTextKey } = await apiKeyStore.create({
          userId,
          name: 'Test API Key',
          roles: ['service'],
          scopes: ['context:*', 'custom:permission'],
        });

        const auth: MCPAuthCredentials = {
          type: 'apikey',
          credentials: plainTextKey,
        };

        const result = await authBridge.authenticate(auth);

        expect(result).toEqual({
          userId,
          roles: ['service'],
          permissions: expect.arrayContaining([
            Permission.CONTEXT_CREATE,
            Permission.CONTEXT_EXECUTE,
            'context:*',
            'custom:permission',
          ]),
          apiKeyId: expect.any(String),
          authMethod: 'apikey',
        });

        expect(logger.logSecurityEvent).toHaveBeenCalledWith(
          logger.SecurityEventType.LOGIN_SUCCESS,
          expect.objectContaining({
            userId,
            result: 'success',
            metadata: expect.objectContaining({
              method: 'apikey',
              context: 'mcp',
            }),
          })
        );
      });

      it('should reject invalid API key', async () => {
        const auth: MCPAuthCredentials = {
          type: 'apikey',
          credentials: 'mcp_invalid_key_123',
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid API key', 401)
        );

        expect(logger.logSecurityEvent).toHaveBeenCalledWith(
          logger.SecurityEventType.LOGIN_FAILURE,
          expect.objectContaining({
            reason: 'Invalid API key',
            result: 'failure',
          })
        );
      });

      it('should reject revoked API key', async () => {
        const { apiKey, plainTextKey } = await apiKeyStore.create({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test API Key',
        });

        await apiKeyStore.revoke(apiKey.id);

        const auth: MCPAuthCredentials = {
          type: 'apikey',
          credentials: plainTextKey,
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid API key', 401)
        );
      });
    });

    describe('Session authentication', () => {
      it('should authenticate valid session', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const username = 'testuser';
        const roles = ['user', 'admin'];

        const sessionId = await sessionStore.create({
          userId,
          username,
          roles,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });

        const auth: MCPAuthCredentials = {
          type: 'session',
          credentials: sessionId,
        };

        const result = await authBridge.authenticate(auth);

        expect(result).toEqual({
          userId,
          username,
          roles,
          permissions: expect.arrayContaining([Permission.ADMIN_ALL]),
          sessionId,
          authMethod: 'session',
        });

        expect(logger.logSecurityEvent).toHaveBeenCalledWith(
          logger.SecurityEventType.LOGIN_SUCCESS,
          expect.objectContaining({
            userId,
            result: 'success',
            metadata: expect.objectContaining({
              method: 'session',
              context: 'mcp',
            }),
          })
        );
      });

      it('should reject invalid session', async () => {
        const auth: MCPAuthCredentials = {
          type: 'session',
          credentials: 'invalid-session-id',
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid or expired session', 401)
        );

        expect(logger.logSecurityEvent).toHaveBeenCalledWith(
          logger.SecurityEventType.LOGIN_FAILURE,
          expect.objectContaining({
            reason: 'Invalid or expired session',
            result: 'failure',
          })
        );
      });

      it('should reject expired session', async () => {
        const sessionId = await sessionStore.create({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          username: 'testuser',
          roles: ['user'],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
        });

        const auth: MCPAuthCredentials = {
          type: 'session',
          credentials: sessionId,
        };

        await expect(authBridge.authenticate(auth)).rejects.toThrow(
          new AppError('Invalid or expired session', 401)
        );
      });

      it('should touch session on successful authentication', async () => {
        const sessionId = await sessionStore.create({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          username: 'testuser',
          roles: ['user'],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });

        const touchSpy = jest.spyOn(sessionStore, 'touch');

        const auth: MCPAuthCredentials = {
          type: 'session',
          credentials: sessionId,
        };

        await authBridge.authenticate(auth);

        expect(touchSpy).toHaveBeenCalledWith(sessionId);
      });
    });
  });

  describe('hasToolPermission', () => {
    it('should return true when user has required permission', () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['user'],
        permissions: [Permission.CONTEXT_EXECUTE],
        authMethod: 'jwt',
      };

      expect(authBridge.hasToolPermission(authContext, 'navigate')).toBe(true);
      expect(authBridge.hasToolPermission(authContext, 'click')).toBe(true);
    });

    it('should return false when user lacks required permission', () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['readonly'],
        permissions: [Permission.CONTEXT_READ],
        authMethod: 'jwt',
      };

      expect(authBridge.hasToolPermission(authContext, 'navigate')).toBe(false);
      expect(authBridge.hasToolPermission(authContext, 'type')).toBe(false);
    });

    it('should return false for unknown tools', () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['admin'],
        permissions: [Permission.ADMIN_ALL],
        authMethod: 'jwt',
      };

      expect(authBridge.hasToolPermission(authContext, 'unknownTool')).toBe(false);
    });
  });

  describe('requireToolPermission', () => {
    it('should pass when user has permission', async () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['user'],
        permissions: [Permission.CONTEXT_EXECUTE],
        authMethod: 'jwt',
      };

      await expect(
        authBridge.requireToolPermission(authContext, 'navigate')
      ).resolves.toBeUndefined();
    });

    it('should throw when user lacks permission', async () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['readonly'],
        permissions: [Permission.CONTEXT_READ],
        authMethod: 'jwt',
      };

      await expect(
        authBridge.requireToolPermission(authContext, 'navigate')
      ).rejects.toThrow(
        new AppError(
          `Permission denied: ${Permission.CONTEXT_EXECUTE} required for tool navigate`,
          403
        )
      );

      expect(logger.logSecurityEvent).toHaveBeenCalledWith(
        logger.SecurityEventType.ACCESS_DENIED,
        expect.objectContaining({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          resource: 'mcp:tool:navigate',
          action: Permission.CONTEXT_EXECUTE,
          result: 'failure',
        })
      );
    });

    it('should throw for unknown tools', async () => {
      const authContext: AuthContext = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['admin'],
        permissions: [Permission.ADMIN_ALL],
        authMethod: 'jwt',
      };

      await expect(
        authBridge.requireToolPermission(authContext, 'unknownTool')
      ).rejects.toThrow(
        new AppError(
          'Permission denied: unknown required for tool unknownTool',
          403
        )
      );
    });
  });

  describe('extractCredentials', () => {
    it('should extract JWT from Authorization header', () => {
      const result = authBridge.extractCredentials({
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        },
      });

      expect(result).toEqual({
        type: 'jwt',
        credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      });
    });

    it('should extract API key from x-api-key header', () => {
      const result = authBridge.extractCredentials({
        headers: {
          'x-api-key': 'mcp_test_key_123',
        },
      });

      expect(result).toEqual({
        type: 'apikey',
        credentials: 'mcp_test_key_123',
      });
    });

    it('should extract API key from apikey header', () => {
      const result = authBridge.extractCredentials({
        headers: {
          apikey: 'mcp_test_key_456',
        },
      });

      expect(result).toEqual({
        type: 'apikey',
        credentials: 'mcp_test_key_456',
      });
    });

    it('should extract JWT from query parameter', () => {
      const result = authBridge.extractCredentials({
        query: {
          token: 'jwt_token_from_query',
        },
      });

      expect(result).toEqual({
        type: 'jwt',
        credentials: 'jwt_token_from_query',
      });
    });

    it('should extract API key from query parameter', () => {
      const result = authBridge.extractCredentials({
        query: {
          apikey: 'mcp_query_key_789',
        },
      });

      expect(result).toEqual({
        type: 'apikey',
        credentials: 'mcp_query_key_789',
      });
    });

    it('should extract session ID from query parameter', () => {
      const result = authBridge.extractCredentials({
        query: {
          sessionId: 'session-uuid-123',
        },
      });

      expect(result).toEqual({
        type: 'session',
        credentials: 'session-uuid-123',
      });
    });

    it('should extract auth from WebSocket metadata', () => {
      const result = authBridge.extractCredentials({
        metadata: {
          auth: {
            type: 'jwt',
            credentials: 'ws_jwt_token',
          },
        },
      });

      expect(result).toEqual({
        type: 'jwt',
        credentials: 'ws_jwt_token',
      });
    });

    it('should handle array values in headers', () => {
      const result = authBridge.extractCredentials({
        headers: {
          authorization: ['Bearer token1', 'Bearer token2'],
        },
      });

      expect(result).toEqual({
        type: 'jwt',
        credentials: 'token1',
      });
    });

    it('should handle array values in query', () => {
      const result = authBridge.extractCredentials({
        query: {
          apikey: ['key1', 'key2'],
        },
      });

      expect(result).toEqual({
        type: 'apikey',
        credentials: 'key1',
      });
    });

    it('should return undefined when no credentials found', () => {
      const result = authBridge.extractCredentials({
        headers: {},
        query: {},
      });

      expect(result).toBeUndefined();
    });

    it('should ignore invalid WebSocket metadata', () => {
      const result = authBridge.extractCredentials({
        metadata: {
          auth: {
            type: 'invalid',
            credentials: 'test',
          },
        },
      });

      expect(result).toBeUndefined();
    });
  });

  describe('MCP_TOOL_PERMISSIONS', () => {
    it('should have permissions for all browser control tools', () => {
      const browserTools = ['navigate', 'click', 'type', 'scroll', 'waitForSelector', 'evaluate'];
      
      browserTools.forEach(tool => {
        expect(MCP_TOOL_PERMISSIONS[tool]).toBe(Permission.CONTEXT_EXECUTE);
      });
    });

    it('should have read permissions for information tools', () => {
      const infoTools = ['screenshot', 'getTitle', 'getUrl', 'getContent', 'getCookies'];
      
      infoTools.forEach(tool => {
        expect(MCP_TOOL_PERMISSIONS[tool]).toBe(Permission.CONTEXT_READ);
      });
    });

    it('should have appropriate permissions for session management', () => {
      expect(MCP_TOOL_PERMISSIONS['createSession']).toBe(Permission.SESSION_CREATE);
      expect(MCP_TOOL_PERMISSIONS['closeSession']).toBe(Permission.SESSION_DELETE);
      expect(MCP_TOOL_PERMISSIONS['listSessions']).toBe(Permission.SESSION_LIST);
    });

    it('should have appropriate permissions for context management', () => {
      expect(MCP_TOOL_PERMISSIONS['createContext']).toBe(Permission.CONTEXT_CREATE);
      expect(MCP_TOOL_PERMISSIONS['getContext']).toBe(Permission.CONTEXT_READ);
      expect(MCP_TOOL_PERMISSIONS['updateContext']).toBe(Permission.CONTEXT_UPDATE);
      expect(MCP_TOOL_PERMISSIONS['deleteContext']).toBe(Permission.CONTEXT_DELETE);
      expect(MCP_TOOL_PERMISSIONS['listContexts']).toBe(Permission.CONTEXT_LIST);
    });
  });
});