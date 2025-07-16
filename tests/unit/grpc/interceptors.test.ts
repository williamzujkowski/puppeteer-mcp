/**
 * gRPC interceptor tests
 * @module tests/unit/grpc/interceptors
 * @standard TS:JEST
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { authInterceptor } from '../../../src/grpc/interceptors/auth.interceptor.js';
import { loggingInterceptor } from '../../../src/grpc/interceptors/logging.interceptor.js';
import { errorInterceptor } from '../../../src/grpc/interceptors/error.interceptor.js';
import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import { verifyToken } from '../../../src/auth/jwt.js';
import { AppError } from '../../../src/core/errors/app-error.js';

// Mock JWT module
jest.mock('../../../src/auth/jwt.js', () => ({
  verifyToken: jest.fn(),
}));

// Mock logger utility
jest.mock('../../../src/utils/logger.js', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  logDataAccess: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    AUTH_SUCCESS: 'auth_success',
    AUTH_FAILURE: 'auth_failure',
    API_ACCESS: 'api_access',
    ERROR: 'error',
    INVALID_TOKEN: 'invalid_token',
  },
}));

describe('gRPC Interceptors', () => {
  let logger: pino.Logger;
  let sessionStore: InMemorySessionStore;
  let mockCall: any;
  let mockCallback: jest.Mock;
  let mockNext: jest.Mock;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(logger);

    mockCallback = jest.fn();
    mockNext = jest.fn();

    mockCall = {
      metadata: new grpc.Metadata(),
      handler: {
        path: '/test.Service/TestMethod',
      },
      request: {},
      sendMetadata: jest.fn(),
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await sessionStore.clear();
  });

  describe('authInterceptor', () => {
    const createInterceptor = (): any => authInterceptor(logger, sessionStore);

    beforeEach(async () => {
      // Create a test session with correct SessionData format
      await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
    });

    it('should authenticate successfully with valid token', async () => {
      // Create a session and get the generated ID
      const sessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

      mockCall.metadata.set('authorization', 'Bearer valid-token');

      // Mock JWT verification to return the actual session ID
      (verifyToken as jest.Mock).mockResolvedValue({
        sessionId,
        sub: 'test-user',
        username: 'testuser',
        roles: ['user'],
        type: 'access',
      });

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      // Verify successful authentication
      expect(mockNext).toHaveBeenCalledWith(mockCall, mockCallback);
      expect(mockCallback).not.toHaveBeenCalled();
      expect(mockCall.session).toBeDefined();
      expect(mockCall.userId).toBe('test-user');
      expect(mockCall.username).toBe('testuser');
      expect(mockCall.sendMetadata).toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Missing authentication token'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      mockCall.metadata.set('authorization', 'Bearer invalid-token');
      (verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Authentication failed'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with expired session', async () => {
      // Create expired session with correct SessionData format
      const expiredSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      mockCall.metadata.set('authorization', 'Bearer valid-token');
      (verifyToken as jest.Mock).mockResolvedValue({
        sessionId: expiredSessionId,
        sub: 'test-user',
        username: 'testuser',
        roles: ['user'],
        type: 'access',
      });

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Invalid authentication token'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should support API key authentication', async () => {
      mockCall.metadata.set('x-api-key', 'test-api-key');

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      // For now, API key auth should fail (not implemented)
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
        }),
      );
    });
  });

  describe('loggingInterceptor', () => {
    const createInterceptor = (): any => loggingInterceptor(logger);

    it('should log successful requests', async () => {
      // Mock child logger creation
      const childLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(),
      };
      jest.spyOn(logger, 'child').mockReturnValue(childLogger as any);

      // Simulate successful response
      mockNext.mockImplementation((call, callback) => {
        void setTimeout(() => {
          callback(null, { result: 'success' });
        }, 10);
      });

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      // Wait for async operations
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });

      expect(childLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grpc_request',
        }),
        'gRPC request received',
      );

      expect(mockCallback).toHaveBeenCalledWith(null, { result: 'success' });
    });

    it('should log failed requests', async () => {
      // Mock child logger creation
      const childLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(),
      };
      jest.spyOn(logger, 'child').mockReturnValue(childLogger as any);

      const error = new Error('Test error');
      (error as any).code = grpc.status.INTERNAL;

      // Simulate error response
      mockNext.mockImplementation((call, callback) => {
        void setTimeout(() => {
          callback(error);
        }, 10);
      });

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      // Wait for async operations
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grpc_response',
          statusCode: grpc.status.INTERNAL,
          error: 'Test error',
        }),
        'gRPC request failed',
      );

      expect(mockCallback).toHaveBeenCalledWith(error, undefined);
    });

    it('should add request ID if not present', async () => {
      // Mock child logger creation
      const childLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(),
      };
      jest.spyOn(logger, 'child').mockReturnValue(childLogger as any);

      mockNext.mockImplementation((call, callback) => {
        void setTimeout(() => {
          callback(null, {});
        }, 10);
      });

      const interceptor = createInterceptor();
      await interceptor(mockCall, mockCallback, mockNext);

      // Wait for async operations
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });

      const requestId = mockCall.metadata.get('x-request-id');
      expect(requestId).toBeDefined();
      expect(requestId[0]).toMatch(/^[0-9a-f-]+$/); // UUID format
    });
  });

  describe('errorInterceptor', () => {
    const createInterceptor = (): any => errorInterceptor(logger);

    it('should handle AppError correctly', () => {
      const appError = new AppError('Validation failed', 400);

      mockNext.mockImplementation((call, callback) => {
        callback(appError);
      });

      const interceptor = createInterceptor();
      void interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Validation failed',
        }),
      );
    });

    it('should handle generic errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database error');

      mockNext.mockImplementation((call, callback) => {
        callback(error);
      });

      const interceptor = createInterceptor();
      void interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INTERNAL,
          message: 'Internal server error', // Generic message in production
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should expose error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Detailed error message');

      mockNext.mockImplementation((call, callback) => {
        callback(error);
      });

      const interceptor = createInterceptor();
      void interceptor(mockCall, mockCallback, mockNext);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INTERNAL,
          message: 'Detailed error message', // Actual message in development
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should map error codes correctly', () => {
      const testCases = [
        { appCode: 401, grpcCode: grpc.status.UNAUTHENTICATED },
        { appCode: 403, grpcCode: grpc.status.PERMISSION_DENIED },
        { appCode: 404, grpcCode: grpc.status.NOT_FOUND },
        { appCode: 409, grpcCode: grpc.status.ALREADY_EXISTS },
        { appCode: 429, grpcCode: grpc.status.RESOURCE_EXHAUSTED },
      ];

      for (const { appCode, grpcCode } of testCases) {
        const error = new AppError('Test error', appCode);

        mockNext.mockImplementation((call, callback) => {
          callback(error);
        });

        const interceptor = createInterceptor();
        void interceptor(mockCall, mockCallback, mockNext);

        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            code: grpcCode,
          }),
        );

        mockCallback.mockClear();
      }
    });
  });
});
