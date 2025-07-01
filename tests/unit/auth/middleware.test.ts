/**
 * Authentication middleware tests
 * @module tests/unit/auth/middleware
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  createApiKeyMiddleware,
  requireRoles,
  requirePermissions,
  optionalAuth,
  type AuthenticatedRequest,
} from '../../../src/auth/middleware.js';
import { SessionStore } from '../../../src/store/session-store.interface.js';
import { AppError } from '../../../src/core/errors/app-error.js';

// Mock dependencies
jest.mock('../../../src/auth/jwt.js', () => ({
  verifyToken: jest.fn(),
  extractTokenFromHeader: jest.fn(),
}));

jest.mock('../../../src/utils/logger.js', () => ({
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    ACCESS_GRANTED: 'ACCESS_GRANTED',
    ACCESS_DENIED: 'ACCESS_DENIED',
    INVALID_TOKEN: 'INVALID_TOKEN',
  },
}));

import { verifyToken, extractTokenFromHeader } from '../../../src/auth/jwt.js';

describe('Authentication Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockSessionStore: jest.Mocked<SessionStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    mockSessionStore = {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteExpired: jest.fn(),
      getByUserId: jest.fn(),
      exists: jest.fn(),
      touch: jest.fn(),
      list: jest.fn(),
      clear: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<SessionStore>;
  });

  describe('createAuthMiddleware', () => {
    let authMiddleware: ReturnType<typeof createAuthMiddleware>;

    beforeEach(() => {
      authMiddleware = createAuthMiddleware(mockSessionStore as any);
    });

    it('should authenticate valid token and attach user to request', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        sub: 'user-id',
        username: 'testuser',
        roles: ['user'],
        sessionId: 'session-id',
        type: 'access',
      };

      if (mockReq.headers) {
        mockReq.headers.authorization = `Bearer ${mockToken}`;
      }
      (extractTokenFromHeader as jest.Mock).mockReturnValue(mockToken);
      (verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      mockSessionStore.get.mockResolvedValue({
        id: 'session-id',
        data: {
          userId: 'user-id',
          username: 'testuser',
          roles: ['user'],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        lastAccessedAt: new Date().toISOString(),
      });
      mockSessionStore.touch.mockResolvedValue(true);

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      // Wait for async operations to complete
      await new Promise<void>(resolve => { setImmediate(resolve); });

      expect(extractTokenFromHeader).toHaveBeenCalledWith(mockReq.headers?.authorization);
      expect(verifyToken).toHaveBeenCalledWith(mockToken, 'access');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockSessionStore.get).toHaveBeenCalledWith('session-id');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockSessionStore.touch).toHaveBeenCalledWith('session-id');
      expect(mockReq.user).toEqual({
        id: 'user-id',
        username: 'testuser',
        roles: ['user'],
        sessionId: 'session-id',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without token', async () => {
      (extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'No authentication token provided',
        }),
      );
    });

    it('should reject invalid token', async () => {
      const mockToken = 'invalid.jwt.token';
      if (mockReq.headers) {
        mockReq.headers.authorization = `Bearer ${mockToken}`;
      }
      (extractTokenFromHeader as jest.Mock).mockReturnValue(mockToken);
      (verifyToken as jest.Mock).mockRejectedValue(
        new AppError('Invalid token', 401),
      );

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid token',
        }),
      );
    });

    it('should reject token with non-existent session', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        sub: 'user-id',
        username: 'testuser',
        roles: ['user'],
        sessionId: 'session-id',
        type: 'access',
      };

      if (mockReq.headers) {
        mockReq.headers.authorization = `Bearer ${mockToken}`;
      }
      (extractTokenFromHeader as jest.Mock).mockReturnValue(mockToken);
      (verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      mockSessionStore.get.mockResolvedValue(null);

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid session',
        }),
      );
    });
  });

  describe('createApiKeyMiddleware', () => {
    it('should authenticate valid API key', async () => {
      const mockApiKey = 'test-api-key-32-chars-long-minimum';
      const mockKeyData = {
        key: mockApiKey,
        name: 'test-key',
        permissions: ['read', 'write'],
      };

      const validateApiKey = jest.fn().mockResolvedValue(mockKeyData);
      const apiKeyMiddleware = createApiKeyMiddleware(validateApiKey);

      if (mockReq.headers) {
        mockReq.headers['x-api-key'] = mockApiKey;
      }

      apiKeyMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockReq.user).toEqual({
        id: 'api-key:test-key',
        username: 'api-key:test-key',
        roles: ['read', 'write'],
        sessionId: 'api-key-session',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without API key', async () => {
      const validateApiKey = jest.fn();
      const apiKeyMiddleware = createApiKeyMiddleware(validateApiKey);

      apiKeyMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'No API key provided',
        }),
      );
    });

    it('should reject expired API key', async () => {
      const mockApiKey = 'test-api-key-32-chars-long-minimum';
      const mockKeyData = {
        key: mockApiKey,
        name: 'test-key',
        permissions: ['read'],
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      const validateApiKey = jest.fn().mockResolvedValue(mockKeyData);
      const apiKeyMiddleware = createApiKeyMiddleware(validateApiKey);

      if (mockReq.headers) {
        mockReq.headers['x-api-key'] = mockApiKey;
      }

      apiKeyMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'API key expired',
        }),
      );
    });
  });

  describe('requireRoles', () => {
    it('should allow user with required role', async () => {
      mockReq.user = {
        id: 'user-id',
        username: 'testuser',
        roles: ['user', 'admin'],
        sessionId: 'session-id',
      };

      const middleware = requireRoles('admin');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow user with any of the required roles', async () => {
      mockReq.user = {
        id: 'user-id',
        username: 'testuser',
        roles: ['moderator'],
        sessionId: 'session-id',
      };

      const middleware = requireRoles('admin', 'moderator');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without required role', async () => {
      mockReq.user = {
        id: 'user-id',
        username: 'testuser',
        roles: ['user'],
        sessionId: 'session-id',
      };

      const middleware = requireRoles('admin');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('Requires one of the following roles: admin'),
        }),
      );
    });

    it('should reject unauthenticated user', async () => {
      const middleware = requireRoles('admin');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    });
  });

  describe('requirePermissions', () => {
    it('should allow API key with required permissions', async () => {
      mockReq.user = {
        id: 'api-key:test-key',
        username: 'api-key:test-key',
        roles: ['read', 'write', 'delete'],
        sessionId: 'api-key-session',
      };

      const middleware = requirePermissions('read', 'write');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject API key without all required permissions', async () => {
      mockReq.user = {
        id: 'api-key:test-key',
        username: 'api-key:test-key',
        roles: ['read'],
        sessionId: 'api-key-session',
      };

      const middleware = requirePermissions('read', 'write');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('Requires the following permissions: read, write'),
        }),
      );
    });

    it('should reject regular user (not API key)', async () => {
      mockReq.user = {
        id: 'user-id',
        username: 'testuser',
        roles: ['user', 'admin'],
        sessionId: 'session-id',
      };

      const middleware = requirePermissions('read');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('Requires the following permissions: read'),
        }),
      );
    });
  });

  describe('optionalAuth', () => {
    let authMiddleware: ReturnType<typeof optionalAuth>;

    beforeEach(() => {
      authMiddleware = optionalAuth(mockSessionStore as any);
    });

    it('should continue without authentication if no token provided', async () => {
      (extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeUndefined();
    });

    it('should authenticate if token is provided', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        sub: 'user-id',
        username: 'testuser',
        roles: ['user'],
        sessionId: 'session-id',
        type: 'access',
      };

      if (mockReq.headers) {
        mockReq.headers.authorization = `Bearer ${mockToken}`;
      }
      (extractTokenFromHeader as jest.Mock).mockReturnValue(mockToken);
      (verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      mockSessionStore.get.mockResolvedValue({
        id: 'session-id',
        data: {
          userId: 'user-id',
          username: 'testuser',
          roles: ['user'],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        lastAccessedAt: new Date().toISOString(),
      });
      mockSessionStore.touch.mockResolvedValue(true);

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);


      // Wait for async operations to complete

      await new Promise<void>(resolve => { setImmediate(resolve); });


      expect(mockReq.user).toBeDefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});