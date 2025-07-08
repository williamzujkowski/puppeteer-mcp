/**
 * Unit tests for core error classes
 * @module tests/unit/core/errors
 */

import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  UnprocessableEntityError,
  InternalServerError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  SessionExpiredError,
  TokenError,
  ResourceLockedError,
  DuplicateEntryError,
  DatabaseError,
  ExternalServiceError,
  ErrorCodes,
  serializeErrorForREST,
  serializeErrorForGRPC,
  serializeErrorForWebSocket,
  isAppError,
  isOperationalError,
  normalizeError,
} from '../../../src/core/errors.js';
import { ZodError } from 'zod';

describe('Core Errors', () => {
  describe('AppError', () => {
    it('should create a basic AppError', () => {
      const error = new AppError('Test error', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should accept operational flag', () => {
      const error = new AppError('Non-operational error', 500, false);
      expect(error.isOperational).toBe(false);
    });

    it('should accept details', () => {
      const details = { userId: '123', action: 'test' };
      const error = new AppError('Context error', 500, true, details);
      expect(error.details).toEqual(details);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Stack error', 500);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('errors.test.ts');
    });
  });

  describe('Specific Error Classes', () => {
    describe('ValidationError', () => {
      it('should create ValidationError with correct defaults', () => {
        const error = new ValidationError('Invalid input');
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe('Invalid input');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('ValidationError');
      });

      it('should accept validation details', () => {
        const details = { field: 'email', value: 'invalid' };
        const error = new ValidationError('Invalid email', details);
        expect(error.details).toEqual(details);
      });
    });

    describe('AuthenticationError', () => {
      it('should create AuthenticationError', () => {
        const error = new AuthenticationError('Invalid credentials');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Invalid credentials');
        expect(error.name).toBe('AuthenticationError');
      });

      it('should use default message if none provided', () => {
        const error = new AuthenticationError();
        expect(error.message).toBe('Authentication failed');
      });
    });

    describe('AuthorizationError', () => {
      it('should create AuthorizationError', () => {
        const error = new AuthorizationError('Access denied');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(403);
        expect(error.name).toBe('AuthorizationError');
      });

      it('should use default message', () => {
        const error = new AuthorizationError();
        expect(error.message).toBe('Insufficient permissions');
      });
    });

    describe('NotFoundError', () => {
      it('should create NotFoundError', () => {
        const error = new NotFoundError('User');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('User not found');
        expect(error.name).toBe('NotFoundError');
      });
    });

    describe('ConflictError', () => {
      it('should create ConflictError', () => {
        const error = new ConflictError('Email already exists');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(409);
        expect(error.name).toBe('ConflictError');
      });
    });

    describe('RateLimitError', () => {
      it('should create RateLimitError', () => {
        const error = new RateLimitError();
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(429);
        expect(error.message).toBe('Too many requests');
        expect(error.name).toBe('RateLimitError');
      });

      it('should accept custom message', () => {
        const error = new RateLimitError('Rate limit exceeded');
        expect(error.message).toBe('Rate limit exceeded');
      });
    });

    describe('BadRequestError', () => {
      it('should create BadRequestError', () => {
        const error = new BadRequestError('Invalid request');
        expect(error.statusCode).toBe(400);
        expect(error.name).toBe('BadRequestError');
      });
    });

    describe('UnprocessableEntityError', () => {
      it('should create UnprocessableEntityError', () => {
        const error = new UnprocessableEntityError('Cannot process');
        expect(error.statusCode).toBe(422);
        expect(error.name).toBe('UnprocessableEntityError');
      });
    });

    describe('InternalServerError', () => {
      it('should create InternalServerError', () => {
        const error = new InternalServerError();
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Internal server error');
        expect(error.isOperational).toBe(false);
        expect(error.name).toBe('InternalServerError');
      });
    });

    describe('ServiceUnavailableError', () => {
      it('should create ServiceUnavailableError', () => {
        const error = new ServiceUnavailableError();
        expect(error.statusCode).toBe(503);
        expect(error.message).toBe('Service temporarily unavailable');
        expect(error.name).toBe('ServiceUnavailableError');
      });
    });

    describe('GatewayTimeoutError', () => {
      it('should create GatewayTimeoutError', () => {
        const error = new GatewayTimeoutError();
        expect(error.statusCode).toBe(504);
        expect(error.message).toBe('Gateway timeout');
        expect(error.name).toBe('GatewayTimeoutError');
      });
    });

    describe('SessionExpiredError', () => {
      it('should create SessionExpiredError', () => {
        const error = new SessionExpiredError();
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Session has expired');
        expect(error.name).toBe('SessionExpiredError');
      });
    });

    describe('TokenError', () => {
      it('should create TokenError', () => {
        const error = new TokenError('Invalid token');
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe('TokenError');
        expect(error.details).toEqual({ code: 'INVALID_TOKEN' });
      });

      it('should accept token expired code', () => {
        const error = new TokenError('Token expired', 'TOKEN_EXPIRED');
        expect(error.details).toEqual({ code: 'TOKEN_EXPIRED' });
      });
    });

    describe('ResourceLockedError', () => {
      it('should create ResourceLockedError', () => {
        const error = new ResourceLockedError('Session');
        expect(error.statusCode).toBe(423);
        expect(error.message).toBe('Resource Session is locked');
        expect(error.name).toBe('ResourceLockedError');
      });
    });

    describe('DuplicateEntryError', () => {
      it('should create DuplicateEntryError', () => {
        const error = new DuplicateEntryError('email', 'test@example.com');
        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('Duplicate entry for email: test@example.com');
        expect(error.details).toEqual({ field: 'email', value: 'test@example.com' });
        expect(error.name).toBe('DuplicateEntryError');
      });
    });

    describe('DatabaseError', () => {
      it('should create DatabaseError', () => {
        const originalError = new Error('Connection lost');
        const error = new DatabaseError('Database connection failed', originalError);
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(false);
        expect(error.details).toEqual({ originalError });
        expect(error.name).toBe('DatabaseError');
      });
    });

    describe('ExternalServiceError', () => {
      it('should create ExternalServiceError', () => {
        const error = new ExternalServiceError('GitHub', 'API rate limit exceeded');
        expect(error.statusCode).toBe(502);
        expect(error.message).toBe('External service error (GitHub): API rate limit exceeded');
        expect(error.details).toEqual({ service: 'GitHub' });
        expect(error.name).toBe('ExternalServiceError');
      });

      it('should accept custom status code', () => {
        const error = new ExternalServiceError('Redis', 'Connection timeout', 503);
        expect(error.statusCode).toBe(503);
      });
    });
  });

  describe('Error Codes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
      expect(ErrorCodes.TOO_MANY_REQUESTS).toBe('TOO_MANY_REQUESTS');
      expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
      expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
      expect(ErrorCodes.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
    });
  });

  describe('Error Serialization', () => {
    describe('serializeErrorForREST', () => {
      it('should serialize AppError correctly', () => {
        const error = new ValidationError('Invalid input', { field: 'email' });
        const result = serializeErrorForREST(error, 'req-123');

        expect(result.error.code).toBe('BAD_REQUEST');
        expect(result.error.message).toBe('Invalid input');
        expect(result.error.details).toEqual({ field: 'email' });
        expect(result.error.requestId).toBe('req-123');
        expect(result.error.timestamp).toBeDefined();
      });

      it('should serialize ZodError correctly', () => {
        const zodError = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['user', 'email'],
            message: 'Expected string, received number',
          },
        ]);

        const result = serializeErrorForREST(zodError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toBe('Validation failed');
        expect(result.error.details?.errors).toBeDefined();
        expect((result.error.details?.errors as any[])[0]).toEqual({
          path: 'user.email',
          message: 'Expected string, received number',
          type: 'invalid_type',
        });
      });

      it('should serialize generic Error correctly', () => {
        const error = new Error('Something went wrong');
        process.env.NODE_ENV = 'development';

        const result = serializeErrorForREST(error);
        expect(result.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(result.error.message).toBe('Something went wrong');
      });

      it('should hide error details in production', () => {
        const error = new Error('Database connection failed');
        process.env.NODE_ENV = 'production';

        const result = serializeErrorForREST(error);
        expect(result.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(result.error.message).toBe('An unexpected error occurred');
      });
    });

    describe('serializeErrorForGRPC', () => {
      it('should serialize AppError for gRPC', () => {
        const error = new ValidationError('Invalid input');
        const result = serializeErrorForGRPC(error);

        expect(result.code).toBe(3); // INVALID_ARGUMENT
        expect(result.message).toBe('Invalid input');
        expect(result.details).toBe('{}');
      });

      it('should serialize ZodError for gRPC', () => {
        const zodError = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['email'],
            message: 'Invalid type',
          },
        ]);

        const result = serializeErrorForGRPC(zodError);
        expect(result.code).toBe(3); // INVALID_ARGUMENT
        expect(result.message).toBe('Validation failed');
        expect(JSON.parse(result.details)).toBeDefined();
      });

      it('should map HTTP status codes to gRPC codes', () => {
        const tests = [
          { error: new BadRequestError('Bad'), expectedCode: 3 }, // INVALID_ARGUMENT
          { error: new AuthenticationError(), expectedCode: 16 }, // UNAUTHENTICATED
          { error: new AuthorizationError(), expectedCode: 7 }, // PERMISSION_DENIED
          { error: new NotFoundError('Resource'), expectedCode: 5 }, // NOT_FOUND
          { error: new ConflictError('Exists'), expectedCode: 6 }, // ALREADY_EXISTS
          { error: new RateLimitError(), expectedCode: 8 }, // RESOURCE_EXHAUSTED
          { error: new InternalServerError(), expectedCode: 13 }, // INTERNAL
          { error: new ServiceUnavailableError(), expectedCode: 14 }, // UNAVAILABLE
        ];

        tests.forEach(({ error, expectedCode }) => {
          const result = serializeErrorForGRPC(error);
          expect(result.code).toBe(expectedCode);
        });
      });
    });

    describe('serializeErrorForWebSocket', () => {
      it('should serialize error for WebSocket', () => {
        const error = new ValidationError('Invalid data');
        const result = serializeErrorForWebSocket(error, 'msg-123');

        expect(result.type).toBe('error');
        expect(result.id).toBe('msg-123');
        expect(result.error.code).toBe('BAD_REQUEST');
        expect(result.error.message).toBe('Invalid data');
      });
    });
  });

  describe('Type Guards', () => {
    describe('isAppError', () => {
      it('should identify AppError instances', () => {
        expect(isAppError(new AppError('Test', 500))).toBe(true);
        expect(isAppError(new ValidationError('Test'))).toBe(true);
        expect(isAppError(new AuthenticationError())).toBe(true);
      });

      it('should reject non-AppError instances', () => {
        expect(isAppError(new Error('Regular error'))).toBe(false);
        expect(isAppError({ message: 'Not an error' })).toBe(false);
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
        expect(isAppError('string')).toBe(false);
      });
    });

    describe('isOperationalError', () => {
      it('should identify operational errors', () => {
        expect(isOperationalError(new ValidationError('Test'))).toBe(true);
        expect(isOperationalError(new BadRequestError('Test'))).toBe(true);
      });

      it('should reject non-operational errors', () => {
        expect(isOperationalError(new InternalServerError())).toBe(false);
        expect(isOperationalError(new DatabaseError('Failed'))).toBe(false);
        expect(isOperationalError(new Error('Regular'))).toBe(false);
      });
    });
  });

  describe('normalizeError', () => {
    it('should return Error instances as-is', () => {
      const error = new Error('Test');
      expect(normalizeError(error)).toBe(error);
    });

    it('should convert strings to Error', () => {
      const error = normalizeError('String error');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('String error');
    });

    it('should extract message from objects', () => {
      const error = normalizeError({ message: 'Object error' });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Object error');
    });

    it('should handle unknown values', () => {
      expect(normalizeError(null).message).toBe('An unknown error occurred');
      expect(normalizeError(undefined).message).toBe('An unknown error occurred');
      expect(normalizeError(123).message).toBe('An unknown error occurred');
    });
  });
});
