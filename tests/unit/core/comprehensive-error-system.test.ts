/**
 * Comprehensive tests for the error handling system
 * @module tests/unit/core/comprehensive-error-system.test
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Logger } from 'pino';
import { ZodError } from 'zod';

// Import error system components
import {
  ErrorContextBuilder,
  ErrorCategory,
  ErrorSeverity,
  RecoveryAction,
} from '../../../src/core/errors/error-context.js';
import { EnhancedAppError } from '../../../src/core/errors/enhanced-app-error.js';
import {
  AuthenticationDomainError,
  BrowserDomainError,
  NetworkDomainError,
  ValidationDomainError,
  ResourceDomainError,
} from '../../../src/core/errors/domain-errors.js';
import { ErrorFactory } from '../../../src/core/errors/error-factory.js';
import { ErrorSerializer } from '../../../src/core/errors/error-serialization.js';
import {
  ErrorTracker,
  InMemoryErrorTrackingStorage,
  ErrorAnalytics,
} from '../../../src/core/errors/error-tracking.js';
import {
  ErrorRecoveryManager,
  RetryManager,
  TokenRefreshRecoveryStrategy,
  SessionRestartRecoveryStrategy,
} from '../../../src/core/errors/error-recovery.js';
import {
  EnhancedErrorHandler,
  createEnhancedErrorHandler,
} from '../../../src/core/middleware/error-handler.js';
import { ErrorTypeGuards } from '../../../src/core/errors/types.js';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
} as unknown as Logger;

// Test data
const testContext = {
  requestId: 'test-request-123',
  userId: 'user-456',
  sessionId: 'session-789',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0 Test Browser',
};

describe('Comprehensive Error System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ErrorContext and Builder', () => {
    it('should create error context with builder pattern', () => {
      const context = new ErrorContextBuilder()
        .setErrorCode('TEST_ERROR')
        .setCategory(ErrorCategory.AUTHENTICATION)
        .setSeverity(ErrorSeverity.HIGH)
        .setUserMessage('Test error message')
        .setTechnicalDetails({ reason: 'test' })
        .addRecoverySuggestion(RecoveryAction.RETRY)
        .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
        .setRequestContext(testContext.requestId, testContext.userId)
        .addTag('test', 'true')
        .build();

      expect(context.errorCode).toBe('TEST_ERROR');
      expect(context.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(context.severity).toBe(ErrorSeverity.HIGH);
      expect(context.userMessage).toBe('Test error message');
      expect(context.recoverySuggestions).toContain(RecoveryAction.RETRY);
      expect(context.recoverySuggestions).toContain(RecoveryAction.CONTACT_SUPPORT);
      expect(context.context?.requestId).toBe(testContext.requestId);
      expect(context.context?.userId).toBe(testContext.userId);
      expect(context.tags?.test).toBe('true');
    });

    it('should apply default retry config for retryable categories', () => {
      const context = new ErrorContextBuilder()
        .setErrorCode('NETWORK_ERROR')
        .setCategory(ErrorCategory.NETWORK)
        .setSeverity(ErrorSeverity.MEDIUM)
        .setUserMessage('Network error')
        .build();

      expect(context.retryConfig).toBeDefined();
      expect(context.retryConfig?.maxAttempts).toBe(3);
      expect(context.retryConfig?.initialDelay).toBe(1000);
    });

    it('should validate error context with schema', () => {
      expect(() => {
        new ErrorContextBuilder()
          .setErrorCode('') // Invalid - empty string
          .setCategory(ErrorCategory.VALIDATION)
          .setSeverity(ErrorSeverity.LOW)
          .setUserMessage('') // Invalid - empty string
          .build();
      }).toThrow();
    });
  });

  describe('EnhancedAppError', () => {
    it('should create enhanced error with context', () => {
      const context = new ErrorContextBuilder()
        .setErrorCode('TEST_ERROR')
        .setCategory(ErrorCategory.SYSTEM)
        .setSeverity(ErrorSeverity.HIGH)
        .setUserMessage('System error occurred')
        .build();

      const error = new EnhancedAppError({
        message: 'Test error',
        context,
        statusCode: 500,
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.getUserMessage()).toBe('System error occurred');
      expect(error.getCategory()).toBe(ErrorCategory.SYSTEM);
      expect(error.getSeverity()).toBe(ErrorSeverity.HIGH);
      expect(error.shouldReport()).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const context = new ErrorContextBuilder()
        .setErrorCode('SERIALIZATION_TEST')
        .setCategory(ErrorCategory.VALIDATION)
        .setSeverity(ErrorSeverity.MEDIUM)
        .setUserMessage('Serialization test')
        .setTechnicalDetails({ field: 'test' })
        .build();

      const error = new EnhancedAppError({
        message: 'Test error',
        context,
        statusCode: 400,
      });
      const json = error.toJSON();

      expect(json.errorCode).toBe('SERIALIZATION_TEST');
      expect(json.category).toBe(ErrorCategory.VALIDATION);
      expect(json.severity).toBe(ErrorSeverity.MEDIUM);
      expect(json.userMessage).toBe('Serialization test');
      expect(json.technicalDetails).toEqual({ field: 'test' });
    });

    it('should create enhanced error from regular error', () => {
      const regularError = new Error('Regular error');
      const context = new ErrorContextBuilder()
        .setErrorCode('CONVERTED_ERROR')
        .setCategory(ErrorCategory.SYSTEM)
        .setSeverity(ErrorSeverity.HIGH)
        .setUserMessage('Converted error')
        .build();

      const enhanced = EnhancedAppError.fromError(regularError, context);

      expect(enhanced.message).toBe('Regular error');
      expect(enhanced.errorContext.errorCode).toBe('CONVERTED_ERROR');
      expect(enhanced.stack).toBe(regularError.stack);
    });
  });

  describe('Domain-Specific Errors', () => {
    it('should create authentication domain error', () => {
      const error = new AuthenticationDomainError({
        message: 'Invalid credentials',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        technicalDetails: { attempts: 3 },
        requestId: testContext.requestId,
        userId: testContext.userId,
      });

      expect(error.statusCode).toBe(401);
      expect(error.getCategory()).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.getSeverity()).toBe(ErrorSeverity.HIGH);
      expect(error.getRecoverySuggestions()).toContain(RecoveryAction.REFRESH_TOKEN);
      expect(error.getTechnicalDetails()).toEqual({ attempts: 3 });
    });

    it('should create browser domain error', () => {
      const error = new BrowserDomainError({
        message: 'Element not found',
        errorCode: 'BROWSER_ELEMENT_NOT_FOUND',
        browserInfo: {
          selector: '#test-element',
          pageId: 'page-123',
          action: 'click',
        },
        requestId: testContext.requestId,
        sessionId: testContext.sessionId,
      });

      expect(error.statusCode).toBe(500);
      expect(error.getCategory()).toBe(ErrorCategory.BROWSER);
      expect(error.getSeverity()).toBe(ErrorSeverity.MEDIUM);
      expect(error.getRecoverySuggestions()).toContain(RecoveryAction.RETRY);
      expect(error.getTechnicalDetails().selector).toBe('#test-element');
    });

    it('should create network domain error', () => {
      const error = new NetworkDomainError({
        message: 'Connection timeout',
        errorCode: 'NETWORK_TIMEOUT',
        networkInfo: {
          url: 'https://api.example.com',
          timeout: 5000,
          method: 'GET',
        },
        requestId: testContext.requestId,
      });

      expect(error.statusCode).toBe(500);
      expect(error.getCategory()).toBe(ErrorCategory.NETWORK);
      expect(error.getRecoverySuggestions()).toContain(RecoveryAction.CHECK_NETWORK);
      expect(error.isRetryable()).toBe(true);
    });

    it('should create validation domain error', () => {
      const error = new ValidationDomainError({
        message: 'Invalid email format',
        errorCode: 'VALIDATION_INVALID_EMAIL',
        validationErrors: [
          {
            field: 'email',
            message: 'invalid-email',
            code: 'invalid_email',
          },
        ],
        requestId: testContext.requestId,
      });

      expect(error.statusCode).toBe(400);
      expect(error.getCategory()).toBe(ErrorCategory.VALIDATION);
      expect(error.getSeverity()).toBe(ErrorSeverity.LOW);
      expect(error.getRecoverySuggestions()).toContain(RecoveryAction.FIX_INPUT);
    });

    it('should create resource domain error', () => {
      const error = new ResourceDomainError({
        message: 'Memory limit exceeded',
        errorCode: 'RESOURCE_MEMORY_EXHAUSTED',
        resourceInfo: {
          resourceType: 'memory',
          action: 'allocation',
          reason: 'limit_exceeded',
        },
        requestId: testContext.requestId,
      });

      expect(error.statusCode).toBe(503);
      expect(error.getCategory()).toBe(ErrorCategory.RESOURCE);
      expect(error.getSeverity()).toBe(ErrorSeverity.MEDIUM);
      expect(error.getRecoverySuggestions()).toContain(RecoveryAction.RETRY);
    });
  });

  describe('Error Factory', () => {
    it('should create authentication errors', () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);

      expect(error).toBeInstanceOf(AuthenticationDomainError);
      expect(error.statusCode).toBe(401);
      expect(error.errorContext.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
      expect(error.getRequestId()).toBe(testContext.requestId);
    });

    it('should create browser errors', () => {
      const error = ErrorFactory.browser.elementNotFound('#test-selector', 'page-123', testContext);

      expect(error).toBeInstanceOf(BrowserDomainError);
      expect(error.errorContext.errorCode).toBe('BROWSER_ELEMENT_NOT_FOUND');
      expect(error.getTechnicalDetails().selector).toBe('#test-selector');
    });

    it('should create validation errors', () => {
      const error = ErrorFactory.validation.required('username', testContext);

      expect(error).toBeInstanceOf(ValidationDomainError);
      expect(error.statusCode).toBe(400);
      expect(error.errorContext.errorCode).toBe('VALIDATION_REQUIRED');
      expect(error.getTechnicalDetails().validationErrors[0].field).toBe('username');
    });

    it('should use default context when set', () => {
      ErrorFactory.setDefaultContext(testContext);

      const error = ErrorFactory.auth.tokenExpired();

      expect(error.getRequestId()).toBe(testContext.requestId);
      expect(error.getUserId()).toBe(testContext.userId);

      ErrorFactory.clearDefaultContext();
    });
  });

  describe('Error Serialization', () => {
    let error: EnhancedAppError;

    beforeEach(() => {
      const context = new ErrorContextBuilder()
        .setErrorCode('SERIALIZATION_TEST')
        .setCategory(ErrorCategory.NETWORK)
        .setSeverity(ErrorSeverity.HIGH)
        .setUserMessage('Serialization test error')
        .setTechnicalDetails({ url: 'https://example.com' })
        .setRequestContext(testContext.requestId, testContext.userId)
        .build();

      error = new EnhancedAppError({
        message: 'Test error',
        context,
        statusCode: 500,
      });
    });

    it('should serialize for REST API', () => {
      const serialized = ErrorSerializer.serializeForRest(error, {
        requestId: testContext.requestId,
        endpoint: '/api/test',
        method: 'GET',
      });

      expect(serialized.error.code).toBe('SERIALIZATION_TEST');
      expect(serialized.error.message).toBe('Test error');
      expect(serialized.error.userMessage).toBe('Serialization test error');
      expect(serialized.error.category).toBe(ErrorCategory.NETWORK);
      expect(serialized.error.severity).toBe(ErrorSeverity.HIGH);
      expect(serialized.meta?.endpoint).toBe('/api/test');
      expect(serialized.meta?.method).toBe('GET');
    });

    it('should serialize for gRPC', () => {
      const serialized = ErrorSerializer.serializeForGrpc(error);

      expect(serialized.code).toBe(13); // INTERNAL
      expect(serialized.message).toBe('Serialization test error');
      expect(serialized.metadata.errorCode).toBe('SERIALIZATION_TEST');
      expect(serialized.metadata.category).toBe(ErrorCategory.NETWORK);
      expect(serialized.metadata.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should serialize for WebSocket', () => {
      const serialized = ErrorSerializer.serializeForWebSocket(error, 'msg-123');

      expect(serialized.type).toBe('error');
      expect(serialized.id).toBe('msg-123');
      expect(serialized.error.code).toBe('SERIALIZATION_TEST');
      expect(serialized.error.userMessage).toBe('Serialization test error');
      expect(serialized.meta?.protocol).toBe('websocket');
    });

    it('should serialize for MCP', () => {
      const serialized = ErrorSerializer.serializeForMcp(error, 'rpc-123');

      expect(serialized.jsonrpc).toBe('2.0');
      expect(serialized.id).toBe('rpc-123');
      expect(serialized.error.code).toBe(-32603); // Internal error
      expect(serialized.error.message).toBe('Serialization test error');
      expect(serialized.error.data?.errorCode).toBe('SERIALIZATION_TEST');
    });

    it('should handle Zod validation errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_string',
          path: ['email'],
          message: 'Invalid email format',
          validation: 'email',
        },
      ]);

      const serialized = ErrorSerializer.serializeForRest(zodError);

      expect(serialized.error.code).toBe('VALIDATION_ERROR');
      expect(serialized.error.message).toBe('Validation failed');
      expect(serialized.error.details).toBeDefined();
    });
  });

  describe('Error Tracking', () => {
    let errorTracker: ErrorTracker;
    let storage: InMemoryErrorTrackingStorage;

    beforeEach(() => {
      storage = new InMemoryErrorTrackingStorage();
      errorTracker = new ErrorTracker(storage, mockLogger);
    });

    it('should track error occurrence', async () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);

      const entryId = await errorTracker.trackError(error, testContext);

      expect(entryId).toBeDefined();
      expect(entryId).toMatch(/^err_\d+_[a-z0-9]+$/);

      const entry = await storage.get(entryId);
      expect(entry).toBeDefined();
      expect(entry?.error.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
      expect(entry?.context.requestId).toBe(testContext.requestId);
    });

    it('should resolve tracked errors', async () => {
      const error = ErrorFactory.browser.actionTimeout('click', '#button', 5000, testContext);

      const entryId = await errorTracker.trackError(error, testContext);
      await errorTracker.resolveError(entryId, 2000, true);

      const entry = await storage.get(entryId);
      expect(entry?.resolved).toBe(true);
      expect(entry?.resolutionTime).toBe(2000);
      expect(entry?.successfulRetry).toBe(true);
    });

    it('should record retry attempts', async () => {
      const error = ErrorFactory.network.timeout('https://api.example.com', 5000, testContext);

      const entryId = await errorTracker.trackError(error, testContext);
      await errorTracker.recordRetryAttempt(entryId);
      await errorTracker.recordRetryAttempt(entryId);

      const entry = await storage.get(entryId);
      expect(entry?.retryAttempts).toBe(2);
    });

    it('should generate error metrics', async () => {
      // Track multiple errors
      await errorTracker.trackError(ErrorFactory.auth.invalidCredentials(testContext), testContext);
      await errorTracker.trackError(
        ErrorFactory.browser.pageNotFound('page-123', testContext),
        testContext,
      );
      await errorTracker.trackError(
        ErrorFactory.validation.required('email', testContext),
        testContext,
      );

      const metrics = await errorTracker.getMetrics(60);

      expect(metrics.total).toBe(3);
      expect(metrics.byCategory[ErrorCategory.AUTHENTICATION]).toBe(1);
      expect(metrics.byCategory[ErrorCategory.BROWSER]).toBe(1);
      expect(metrics.byCategory[ErrorCategory.VALIDATION]).toBe(1);
    });
  });

  describe('Error Recovery', () => {
    let recoveryManager: ErrorRecoveryManager;
    let retryManager: RetryManager;

    beforeEach(() => {
      recoveryManager = new ErrorRecoveryManager(mockLogger);
      retryManager = new RetryManager(mockLogger);
    });

    it('should execute token refresh recovery strategy', async () => {
      const tokenRefreshFn = jest.fn().mockResolvedValue('new-token-123');
      const strategy = new TokenRefreshRecoveryStrategy(tokenRefreshFn);

      recoveryManager.registerStrategy(strategy);

      const error = ErrorFactory.auth.tokenExpired(testContext);
      const result = await recoveryManager.recover(error, testContext);

      expect(result.success).toBe(true);
      expect(result.result).toBe('new-token-123');
      expect(result.strategy).toBe('token_refresh');
      expect(tokenRefreshFn).toHaveBeenCalledTimes(1);
    });

    it('should execute session restart recovery strategy', async () => {
      const sessionRestartFn = jest.fn().mockResolvedValue(undefined);
      const strategy = new SessionRestartRecoveryStrategy(sessionRestartFn);

      recoveryManager.registerStrategy(strategy);

      const error = ErrorFactory.browser.browserCrashed('browser-123', testContext);
      const result = await recoveryManager.recover(error, {
        ...testContext,
        sessionId: 'session-123',
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('session_restart');
      expect(sessionRestartFn).toHaveBeenCalledWith('session-123');
    });

    it('should handle retry with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await retryManager.executeWithRetry(
        operation,
        {
          maxAttempts: 3,
          initialDelay: 100,
          backoffMultiplier: 2,
          maxDelay: 1000,
          jitter: 0.1,
        },
        testContext,
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should execute operation with automatic recovery', async () => {
      const tokenRefreshFn = jest.fn().mockResolvedValue('new-token');
      const strategy = new TokenRefreshRecoveryStrategy(tokenRefreshFn);
      recoveryManager.registerStrategy(strategy);

      let operationCalls = 0;
      const operation = jest.fn().mockImplementation(() => {
        operationCalls++;
        if (operationCalls === 1) {
          throw ErrorFactory.auth.tokenExpired(testContext);
        }
        return 'success-after-recovery';
      });

      const result = await recoveryManager.executeWithRecovery(operation, testContext);

      expect(result).toBe('success-after-recovery');
      expect(tokenRefreshFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Analytics', () => {
    let errorTracker: ErrorTracker;
    let analytics: ErrorAnalytics;

    beforeEach(() => {
      const storage = new InMemoryErrorTrackingStorage();
      errorTracker = new ErrorTracker(storage, mockLogger);
      analytics = new ErrorAnalytics(errorTracker);
    });

    it('should calculate error health score', async () => {
      // Track some errors
      await errorTracker.trackError(
        ErrorFactory.validation.required('email', testContext),
        testContext,
      );
      await errorTracker.trackError(ErrorFactory.auth.invalidCredentials(testContext), testContext);

      const healthScore = await analytics.getHealthScore(60);

      expect(typeof healthScore).toBe('number');
      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(100);
    });

    it('should analyze error trends', async () => {
      // Track errors over time
      await errorTracker.trackError(
        ErrorFactory.network.timeout('https://api.example.com', 5000, testContext),
        testContext,
      );
      await errorTracker.trackError(
        ErrorFactory.browser.pageNotFound('page-123', testContext),
        testContext,
      );

      const trendAnalysis = await analytics.getTrendAnalysis(60);

      expect(trendAnalysis.trend).toBeOneOf(['increasing', 'decreasing', 'stable']);
      expect(typeof trendAnalysis.changePercentage).toBe('number');
      expect(trendAnalysis.periods).toHaveLength(2);
    });
  });

  describe('Enhanced Error Handler Middleware', () => {
    let handler: EnhancedErrorHandler;
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      handler = new EnhancedErrorHandler(mockLogger);

      mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: { 'x-request-id': testContext.requestId },
        user: { id: testContext.userId },
        get: jest.fn((header: string) => {
          if (header === 'user-agent') return testContext.userAgent;
          return undefined;
        }),
        ip: testContext.ipAddress,
        query: {},
        params: {},
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
      };

      mockNext = jest.fn();
    });

    it('should handle enhanced app errors', async () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);
      const middleware = handler.getMiddleware();

      await middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTH_INVALID_CREDENTIALS',
            category: ErrorCategory.AUTHENTICATION,
            severity: ErrorSeverity.HIGH,
          }),
        }),
      );
    });

    it('should handle Zod validation errors', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_string',
          path: ['email'],
          message: 'Invalid email format',
          validation: 'email',
        },
      ]);

      const middleware = handler.getMiddleware();
      await middleware(zodError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            category: ErrorCategory.VALIDATION,
          }),
        }),
      );
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Generic error message');
      const middleware = handler.getMiddleware();

      await middleware(genericError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.CRITICAL,
          }),
        }),
      );
    });

    it('should set security headers', async () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);
      const middleware = handler.getMiddleware();

      await middleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
    });
  });

  describe('Error Type Guards', () => {
    it('should identify enhanced app errors', () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);

      expect(ErrorTypeGuards.isEnhancedAppError(error)).toBe(true);
      expect(ErrorTypeGuards.isAppError(error)).toBe(true);
      expect(ErrorTypeGuards.isOperationalError(error)).toBe(true);
    });

    it('should identify error categories and severities', () => {
      const authError = ErrorFactory.auth.tokenExpired(testContext);
      const browserError = ErrorFactory.browser.pageNotFound('page-123', testContext);

      expect(ErrorTypeGuards.hasCategory(authError, ErrorCategory.AUTHENTICATION)).toBe(true);
      expect(ErrorTypeGuards.hasCategory(browserError, ErrorCategory.BROWSER)).toBe(true);
      expect(ErrorTypeGuards.hasSeverity(authError, ErrorSeverity.HIGH)).toBe(true);
      expect(ErrorTypeGuards.hasSeverity(browserError, ErrorSeverity.MEDIUM)).toBe(true);
    });

    it('should identify retryable errors', () => {
      const networkError = ErrorFactory.network.timeout(
        'https://api.example.com',
        5000,
        testContext,
      );
      const validationError = ErrorFactory.validation.required('email', testContext);

      expect(ErrorTypeGuards.isRetryable(networkError)).toBe(true);
      expect(ErrorTypeGuards.isRetryable(validationError)).toBe(false);
    });

    it('should identify sensitive data', () => {
      const error = ErrorFactory.auth.invalidCredentials(testContext);
      // Auth errors typically don't contain sensitive data by default
      expect(ErrorTypeGuards.containsSensitiveData(error)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with tracking and recovery', async () => {
      const storage = new InMemoryErrorTrackingStorage();
      const errorTracker = new ErrorTracker(storage, mockLogger);
      const recoveryManager = new ErrorRecoveryManager(mockLogger, errorTracker);

      // Set up recovery strategy
      const tokenRefreshFn = jest.fn().mockResolvedValue('new-token');
      const strategy = new TokenRefreshRecoveryStrategy(tokenRefreshFn);
      recoveryManager.registerStrategy(strategy);

      // Create error handler with full configuration
      const errorHandler = createEnhancedErrorHandler(
        mockLogger,
        {
          trackErrors: true,
          enableRecovery: true,
          includeRetryConfig: true,
        },
        errorTracker,
        recoveryManager,
      );

      // Create mock req, res, next for this test
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: { 'x-request-id': testContext.requestId },
        user: { id: testContext.userId },
        get: jest.fn((header: string) => {
          if (header === 'user-agent') return testContext.userAgent;
          return undefined;
        }),
        ip: testContext.ipAddress,
        query: {},
        params: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
      };

      const mockNext = jest.fn();

      // Simulate error in middleware
      const error = ErrorFactory.auth.tokenExpired(testContext);
      await errorHandler(error, mockReq, mockRes, mockNext);

      // Verify error was tracked
      const metrics = await errorTracker.getMetrics(60);
      expect(metrics.total).toBe(1);
      expect(metrics.byCategory[ErrorCategory.AUTHENTICATION]).toBe(1);

      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTH_TOKEN_EXPIRED',
            category: 'authentication',
            severity: 'high',
          }),
        }),
      );
    });

    it('should handle error pattern detection', async () => {
      const storage = new InMemoryErrorTrackingStorage();
      const errorTracker = new ErrorTracker(storage, mockLogger);

      let patternDetected = false;
      errorTracker.on('error_threshold_exceeded', () => {
        patternDetected = true;
      });

      // Track multiple auth errors to trigger pattern detection (need 10 for AUTH threshold)
      for (let i = 0; i < 11; i++) {
        await errorTracker.trackError(
          ErrorFactory.auth.invalidCredentials({ ...testContext, requestId: `req-${i}` }),
          { ...testContext, requestId: `req-${i}` },
        );
      }

      // Give some time for pattern detection
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(patternDetected).toBe(true);
    });
  });

  afterEach(() => {
    ErrorFactory.clearDefaultContext();
  });
});

// Helper for Jest matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare module '@jest/expect' {
  interface Matchers<R> {
    toBeOneOf(expected: any[]): R;
  }
}
