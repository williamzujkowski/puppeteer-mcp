/**
 * Unit tests for security headers middleware
 * @module tests/unit/core/middleware/security-headers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  securityHeaders,
  additionalSecurityHeaders,
  createCSRFProtection,
  createCSRFTokenEndpoint,
} from '../../../../src/core/middleware/security-headers.js';

// Mock dependencies
jest.mock('../../../../src/core/config.js', () => ({
  config: {
    CSP_DIRECTIVES: '',
    HSTS_MAX_AGE: 31536000,
    TLS_ENABLED: true,
    CORS_ORIGIN: 'https://example.com',
    CORS_CREDENTIALS: true,
    CORS_MAX_AGE: 86400,
  },
}));

jest.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
  },
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    CSRF_TOKEN_MISSING: 'CSRF_TOKEN_MISSING',
    CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  },
}));

describe('Security Headers Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      path: '/api/test',
      method: 'GET',
      headers: {},
      session: {},
      query: {},
      body: {},
    };

    mockRes = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('securityHeaders', () => {
    it('should create helmet middleware', () => {
      const middleware = securityHeaders();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('additionalSecurityHeaders', () => {
    it('should set additional security headers', () => {
      const middleware = additionalSecurityHeaders();
      void middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Expect-CT', 'max-age=86400, enforce');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockRes.removeHeader).toHaveBeenCalledWith('Server');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('CSRF Protection', () => {
    describe('createCSRFProtection', () => {
      it('should create CSRF protection middleware array', () => {
        const middlewares = createCSRFProtection();
        expect(Array.isArray(middlewares)).toBe(true);
        expect(middlewares).toHaveLength(2);
      });

      it('should skip CSRF for health endpoints', () => {
        const middlewares = createCSRFProtection();
        const [secretMiddleware, validationMiddleware] = middlewares;

        mockReq.path = '/health';

        void secretMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();

        mockNext.mockClear();
        void validationMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip CSRF for safe HTTP methods', () => {
        const middlewares = createCSRFProtection();
        const [, validationMiddleware] = middlewares;

        mockReq.method = 'GET';
        mockReq.path = '/api/test';

        void validationMiddleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should generate CSRF secret if not exists', () => {
        const middlewares = createCSRFProtection();
        const [secretMiddleware] = middlewares;

        mockReq.session = {};

        void secretMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockReq.session).toHaveProperty('csrfSecret');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject POST request without CSRF token', () => {
        const middlewares = createCSRFProtection();
        const [secretMiddleware, validationMiddleware] = middlewares;

        mockReq.method = 'POST';
        mockReq.path = '/api/test';
        mockReq.session = { csrfSecret: 'test-secret' };

        // First run secret middleware
        void secretMiddleware(mockReq as Request, mockRes as Response, mockNext);

        // Then validation middleware
        void validationMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token is required',
          },
        });
      });

      it('should handle CSRF token validation', () => {
        const middlewares = createCSRFProtection();
        const [secretMiddleware, validationMiddleware] = middlewares;

        mockReq.method = 'POST';
        mockReq.path = '/api/test';
        mockReq.session = { csrfSecret: 'test-secret' };
        mockReq.headers = { 'x-csrf-token': 'valid-token' };

        // Should not throw when running middleware
        expect(() => {
          void secretMiddleware(mockReq as Request, mockRes as Response, mockNext);
        }).not.toThrow();

        expect(() => {
          void validationMiddleware(mockReq as Request, mockRes as Response, mockNext);
        }).not.toThrow();
      });
    });

    describe('createCSRFTokenEndpoint', () => {
      it('should generate CSRF token when secret exists', () => {
        const endpoint = createCSRFTokenEndpoint();

        mockReq.session = { csrfSecret: 'test-secret' };

        // Mock CSRF token creation
        jest.doMock('csrf', () => ({
          __esModule: true,
          default: jest.fn(() => ({
            create: () => 'generated-token',
          })),
        }));

        void endpoint(mockReq as Request, mockRes as Response);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            csrfToken: expect.any(String),
            expires: expect.any(Number),
          },
        });
      });

      it('should return error when secret is missing', () => {
        const endpoint = createCSRFTokenEndpoint();

        mockReq.session = {};

        void endpoint(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'CSRF_SECRET_MISSING',
            message: 'CSRF secret not initialized',
          },
        });
      });
    });
  });

  describe('Request type extensions', () => {
    it('should handle requests with session property', () => {
      const middleware = additionalSecurityHeaders();

      mockReq.session = { csrfSecret: 'test-secret' };

      expect(() => {
        void middleware(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
