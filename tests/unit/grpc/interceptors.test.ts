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
import * as jwt from '../../../src/auth/jwt.js';
import { AppError } from '../../../src/core/errors/app-error.js';

// Mock JWT module
jest.mock('../../../src/auth/jwt.js');

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authInterceptor', () => {
    const interceptor = (call: any, callback: any): any => {
      const auth = authInterceptor(logger, sessionStore);
      return auth(call, callback, mockNext);
    };

    beforeEach(async () => {
      // Create a test session
      await sessionStore.create({
        id: 'test-session',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });

      // Mock JWT verification
      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue({
        sessionId: 'test-session',
        userId: 'test-user',
      });
    });

    it('should authenticate successfully with valid token', async () => {
      mockCall.metadata.set('authorization', 'Bearer valid-token');

      await interceptor(mockCall, mockCallback);

      expect(mockNext).toHaveBeenCalledWith(mockCall, mockCallback);
      expect(mockCall.session).toBeDefined();
      expect(mockCall.userId).toBe('test-user');
      expect(mockCall.username).toBe('testuser');
    });

    it('should reject request without token', async () => {
      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Missing authentication token'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      mockCall.metadata.set('authorization', 'Bearer invalid-token');
      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue(null);

      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Invalid authentication token'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with expired session', async () => {
      // Create expired session
      await sessionStore.create({
        id: 'expired-session',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() - 1000, // Expired
      });

      mockCall.metadata.set('authorization', 'Bearer valid-token');
      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue({
        sessionId: 'expired-session',
        userId: 'test-user',
      });

      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
          message: expect.stringContaining('Session expired'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should support API key authentication', async () => {
      mockCall.metadata.set('x-api-key', 'test-api-key');

      await interceptor(mockCall, mockCallback);

      // For now, API key auth should fail (not implemented)
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.UNAUTHENTICATED,
        })
      );
    });
  });

  describe('loggingInterceptor', () => {
    const interceptor = (call: any, callback: any): any => {
      const logging = loggingInterceptor(logger);
      return logging(call, callback, mockNext);
    };

    it('should log successful requests', async () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      // Simulate successful response
      mockNext.mockImplementation((call, callback) => {
        callback(null, { result: 'success' });
      });

      await interceptor(mockCall, mockCallback);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grpc_request',
        }),
        'gRPC request received'
      );

      expect(mockCallback).toHaveBeenCalledWith(null, { result: 'success' });
    });

    it('should log failed requests', async () => {
      const logSpy = jest.spyOn(logger, 'error');
      const error = new Error('Test error');
      (error as any).code = grpc.status.INTERNAL;

      // Simulate error response
      mockNext.mockImplementation((call, callback) => {
        callback(error);
      });

      await interceptor(mockCall, mockCallback);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grpc_response',
          statusCode: grpc.status.INTERNAL,
          error: 'Test error',
        }),
        'gRPC request failed'
      );

      expect(mockCallback).toHaveBeenCalledWith(error);
    });

    it('should add request ID if not present', async () => {
      mockNext.mockImplementation((call, callback) => {
        callback(null, {});
      });

      await interceptor(mockCall, mockCallback);

      const requestId = mockCall.metadata.get('x-request-id');
      expect(requestId).toBeDefined();
      expect(requestId[0]).toMatch(/^[0-9a-f-]+$/); // UUID format
    });
  });

  describe('errorInterceptor', () => {
    const interceptor = (call: any, callback: any): any => {
      const error = errorInterceptor(logger);
      return error(call, callback, mockNext);
    };

    it('should handle AppError correctly', async () => {
      const appError = new AppError('Validation failed', 'VALIDATION_ERROR');
      
      mockNext.mockImplementation((call, callback) => {
        callback(appError);
      });

      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Validation failed',
        })
      );
    });

    it('should handle generic errors in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database error');
      
      mockNext.mockImplementation((call, callback) => {
        callback(error);
      });

      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INTERNAL,
          message: 'Internal server error', // Generic message in production
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should expose error details in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Detailed error message');
      
      mockNext.mockImplementation((call, callback) => {
        callback(error);
      });

      await interceptor(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: grpc.status.INTERNAL,
          message: 'Detailed error message', // Actual message in development
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should map error codes correctly', async () => {
      const testCases = [
        { appCode: 'UNAUTHORIZED', grpcCode: grpc.status.UNAUTHENTICATED },
        { appCode: 'FORBIDDEN', grpcCode: grpc.status.PERMISSION_DENIED },
        { appCode: 'NOT_FOUND', grpcCode: grpc.status.NOT_FOUND },
        { appCode: 'CONFLICT', grpcCode: grpc.status.ALREADY_EXISTS },
        { appCode: 'RATE_LIMIT_EXCEEDED', grpcCode: grpc.status.RESOURCE_EXHAUSTED },
      ];

      for (const { appCode, grpcCode } of testCases) {
        const error = new AppError('Test error', appCode);
        
        mockNext.mockImplementation((call, callback) => {
          callback(error);
        });

        await interceptor(mockCall, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            code: grpcCode,
          })
        );

        mockCallback.mockClear();
      }
    });
  });
});