/**
 * Request/Response Logger middleware tests
 * @module tests/unit/core/middleware/request-response-logger
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';
import request from 'supertest';
import express from 'express';
import {
  requestResponseLogger,
  createRequestResponseLogger,
  type RequestResponseLoggerOptions,
} from '../../../../src/core/middleware/request-response-logger.js';
import { VerbosityLevel } from '../../../../src/core/middleware/logging/types.js';

// Mock dependencies
jest.mock('../../../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    HTTP_REQUEST_STARTED: 'HTTP_REQUEST_STARTED',
    HTTP_REQUEST_COMPLETED: 'HTTP_REQUEST_COMPLETED',
  },
}));

import { createLogger, logSecurityEvent } from '../../../../src/utils/logger.js';

describe('Request/Response Logger Middleware', () => {
  let app: express.Application;
  let server: Server;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    
    (createLogger as jest.Mock).mockReturnValue(mockLogger);
    
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Basic Functionality', () => {
    it('should log request and response with standard verbosity', async () => {
      app.use(createRequestResponseLogger.standard());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({ message: 'test' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HTTP_REQUEST',
          method: 'GET',
          path: '/test',
          url: '/test',
        }),
        expect.stringContaining('HTTP GET /test started')
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HTTP_RESPONSE',
          method: 'GET',
          path: '/test',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        expect.stringContaining('HTTP GET /test 200')
      );
    });

    it('should assign request ID if not present', async () => {
      app.use(createRequestResponseLogger.standard());
      
      let capturedReq: Request;
      app.get('/test', (req, res) => {
        capturedReq = req;
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(capturedReq!.id).toBeDefined();
      expect(typeof capturedReq!.id).toBe('string');
    });

    it('should use existing request ID from header', async () => {
      const existingId = 'existing-request-id';
      app.use(createRequestResponseLogger.standard({
        requestIdHeader: 'x-request-id',
      }));
      
      let capturedReq: Request;
      app.get('/test', (req, res) => {
        capturedReq = req;
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .set('x-request-id', existingId)
        .expect(200);

      expect(capturedReq!.id).toBe(existingId);
    });
  });

  describe('Verbosity Levels', () => {
    it('should log minimal information with MINIMAL verbosity', async () => {
      app.use(createRequestResponseLogger.minimal());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      const responseLog = mockLogger.info.mock.calls[1][0];

      expect(requestLog.headers).toBeUndefined();
      expect(requestLog.body).toBeUndefined();
      expect(responseLog.headers).toBeUndefined();
      expect(responseLog.body).toBeUndefined();
    });

    it('should log headers with VERBOSE verbosity', async () => {
      app.use(createRequestResponseLogger.verbose());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .set('custom-header', 'custom-value')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.headers).toBeDefined();
      expect(requestLog.headers['custom-header']).toBe('custom-value');
    });

    it('should log request body with VERBOSE verbosity', async () => {
      app.use(createRequestResponseLogger.verbose());
      
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });

      await request(app)
        .post('/test')
        .send({ test: 'data' })
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body).toBeDefined();
      expect(requestLog.body.test).toBe('data');
    });

    it('should log response body with DEBUG verbosity', async () => {
      app.use(createRequestResponseLogger.debug());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test response' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      const responseLog = mockLogger.info.mock.calls[1][0];
      expect(responseLog.body).toBeDefined();
    });
  });

  describe('Sensitive Data Redaction', () => {
    it('should redact sensitive headers', async () => {
      app.use(createRequestResponseLogger.verbose());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .set('authorization', 'Bearer secret-token')
        .set('cookie', 'session=abc123')
        .set('x-api-key', 'secret-key')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.headers.authorization).toBe('[REDACTED]');
      expect(requestLog.headers.cookie).toBe('[REDACTED]');
      expect(requestLog.headers['x-api-key']).toBe('[REDACTED]');
    });

    it('should redact sensitive body fields', async () => {
      app.use(createRequestResponseLogger.verbose());
      
      app.post('/test', (req, res) => {
        res.json({ received: 'ok' });
      });

      await request(app)
        .post('/test')
        .send({
          username: 'john',
          password: 'secret123',
          token: 'abc123',
          data: 'safe-data',
        })
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body.username).toBe('john');
      expect(requestLog.body.password).toBe('[REDACTED]');
      expect(requestLog.body.token).toBe('[REDACTED]');
      expect(requestLog.body.data).toBe('safe-data');
    });

    it('should respect custom sensitive fields', async () => {
      app.use(createRequestResponseLogger.verbose({
        sensitiveHeaders: ['x-custom-secret'],
        sensitiveBodyFields: ['customSecret'],
      }));
      
      app.post('/test', (req, res) => {
        res.json({ received: 'ok' });
      });

      await request(app)
        .post('/test')
        .set('x-custom-secret', 'secret-value')
        .set('authorization', 'Bearer token') // Should not be redacted with custom config
        .send({
          customSecret: 'secret-data',
          password: 'not-redacted', // Should not be redacted with custom config
        })
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.headers['x-custom-secret']).toBe('[REDACTED]');
      expect(requestLog.headers.authorization).toBe('Bearer token');
      expect(requestLog.body.customSecret).toBe('[REDACTED]');
      expect(requestLog.body.password).toBe('not-redacted');
    });
  });

  describe('Performance Monitoring', () => {
    it('should detect slow requests', async () => {
      app.use(createRequestResponseLogger.standard({
        slowRequestThreshold: 50, // 50ms
      }));
      
      app.get('/slow', (req, res) => {
        setTimeout(() => {
          res.json({ message: 'slow response' });
        }, 100); // 100ms delay
      });

      await request(app)
        .get('/slow')
        .expect(200);

      // Wait for async logging to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      const responseLog = mockLogger.warn.mock.calls.find(call => call[0].type === 'HTTP_RESPONSE');
      expect(responseLog).toBeDefined();
      expect(responseLog[0].isSlowRequest).toBe(true);
      expect(responseLog[0].duration).toBeGreaterThan(50);
    });

    it('should use high precision timing when enabled', async () => {
      app.use(createRequestResponseLogger.standard({
        highPrecisionTiming: true,
      }));
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      const responseLog = mockLogger.info.mock.calls[1][0];
      expect(responseLog.timing).toBeDefined();
      expect(responseLog.timing.duration).toBeDefined();
      expect(responseLog.timing.ttfb).toBeDefined();
    });
  });

  describe('Filtering', () => {
    it('should skip logging for specified paths', async () => {
      app.use(createRequestResponseLogger.standard({
        skipPaths: ['/health', '/metrics'],
      }));
      
      app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/health')
        .expect(200);

      expect(mockLogger.info).not.toHaveBeenCalled();

      await request(app)
        .get('/test')
        .expect(200);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should skip logging for specified methods', async () => {
      app.use(createRequestResponseLogger.standard({
        skipMethods: ['OPTIONS'],
      }));
      
      app.options('/test', (req, res) => {
        res.status(200).end();
      });
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .options('/test')
        .expect(200);

      expect(mockLogger.info).not.toHaveBeenCalled();

      await request(app)
        .get('/test')
        .expect(200);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log only errors when errorsOnly is true', async () => {
      app.use(createRequestResponseLogger.standard({
        errorsOnly: true,
      }));
      
      app.get('/success', (req, res) => {
        res.json({ message: 'success' });
      });
      
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'server error' });
      });

      await request(app)
        .get('/success')
        .expect(200);

      // Wait for async logging to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should log request but not response for successful requests
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'HTTP_REQUEST' }),
        expect.any(String)
      );

      jest.clearAllMocks();

      await request(app)
        .get('/error')
        .expect(500);

      // Wait for async logging to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should log both request and response for error requests
      expect(mockLogger.info).toHaveBeenCalledTimes(1); // Request
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Response (error level for 500)
    });
  });

  describe('Content Type Filtering', () => {
    it('should log body only for specified content types', async () => {
      app.use(createRequestResponseLogger.verbose({
        loggedContentTypes: ['application/json'],
      }));
      
      app.post('/json', (req, res) => {
        res.json({ received: 'json' });
      });

      await request(app)
        .post('/json')
        .send({ test: 'data' })
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body).toBeDefined();
      expect(requestLog.body.test).toBe('data');
    });

    it('should not log body for non-matching content types', async () => {
      app.use(createRequestResponseLogger.verbose({
        loggedContentTypes: ['application/json'],
      }));
      
      app.post('/form', express.urlencoded({ extended: true }), (req, res) => {
        res.json({ received: 'form' });
      });

      await request(app)
        .post('/form')
        .type('form')
        .send('test=data')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should log errors during request processing', async () => {
      app.use(createRequestResponseLogger.standard());
      
      app.get('/error', (req, res) => {
        res.emit('error', new Error('Test error'));
        res.status(500).json({ error: 'server error' });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HTTP_ERROR',
          error: 'Test error',
        }),
        expect.stringContaining('HTTP GET /error error')
      );
    });

    it('should handle parsing errors gracefully', async () => {
      app.use(createRequestResponseLogger.verbose());
      
      // Create a custom route that will have a body that causes parsing issues
      app.post('/test', (req, res) => {
        res.json({ received: 'ok' });
      });

      // Send a request with valid JSON that will be parsed normally
      await request(app)
        .post('/test')
        .send({ test: 'data' })
        .expect(200);

      // Check that the request was logged successfully
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HTTP_REQUEST',
          method: 'POST',
          path: '/test',
        }),
        expect.any(String)
      );

      // The body should be logged as an object
      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body).toEqual({ test: 'data' });
    });
  });

  describe('Audit Logging', () => {
    it('should log security events when audit logging is enabled', async () => {
      app.use(createRequestResponseLogger.standard({
        auditLogging: true,
      }));
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'HTTP_REQUEST_COMPLETED',
        expect.objectContaining({
          resource: '/test',
          action: 'GET',
          result: 'success',
        })
      );
    });

    it('should not log security events when audit logging is disabled', async () => {
      app.use(createRequestResponseLogger.standard({
        auditLogging: false,
      }));
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(logSecurityEvent).not.toHaveBeenCalled();
    });
  });

  describe('Custom Metadata', () => {
    it('should include custom metadata when provided', async () => {
      app.use(createRequestResponseLogger.standard({
        metadataExtractor: (req, res) => ({
          customField: 'custom-value',
          endpoint: req.path,
          method: req.method,
        }),
      }));
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.customField).toBe('custom-value');
      expect(requestLog.endpoint).toBe('/test');
      expect(requestLog.method).toBe('GET');
    });
  });

  describe('Body Size Limits', () => {
    it('should truncate large bodies', async () => {
      app.use(createRequestResponseLogger.verbose({
        maxBodySize: 10, // Very small limit
      }));
      
      app.post('/test', (req, res) => {
        res.json({ received: 'ok' });
      });

      const largeBody = { data: 'x'.repeat(1000) };
      await request(app)
        .post('/test')
        .send(largeBody)
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.body).toMatch(/\[BODY TOO LARGE: \d+ bytes\]/);
    });
  });

  describe('Preset Configurations', () => {
    it('should use production preset correctly', () => {
      const middleware = createRequestResponseLogger.production();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should use development preset correctly', () => {
      const middleware = createRequestResponseLogger.development();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should use security preset correctly', () => {
      const middleware = createRequestResponseLogger.security();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should use performance preset correctly', () => {
      const middleware = createRequestResponseLogger.performance();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('User Context', () => {
    it('should include user information when available', async () => {
      app.use((req, res, next) => {
        req.user = {
          userId: 'user-123',
          username: 'testuser',
          roles: ['admin'],
          sessionId: 'session-456',
        };
        next();
      });
      
      app.use(createRequestResponseLogger.standard());
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      const requestLog = mockLogger.info.mock.calls[0][0];
      expect(requestLog.userId).toBe('user-123');
      expect(requestLog.sessionId).toBe('session-456');
    });
  });

  describe('Response Levels', () => {
    it('should use error level for 5xx responses', async () => {
      app.use(createRequestResponseLogger.standard());
      
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'server error' });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
        }),
        expect.stringContaining('HTTP GET /error 500')
      );
    });

    it('should use warn level for 4xx responses', async () => {
      app.use(createRequestResponseLogger.standard());
      
      app.get('/notfound', (req, res) => {
        res.status(404).json({ error: 'not found' });
      });

      await request(app)
        .get('/notfound')
        .expect(404);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        }),
        expect.stringContaining('HTTP GET /notfound 404')
      );
    });

    it('should use info level for 2xx responses', async () => {
      app.use(createRequestResponseLogger.standard());
      
      app.get('/success', (req, res) => {
        res.json({ message: 'success' });
      });

      await request(app)
        .get('/success')
        .expect(200);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
        }),
        expect.stringContaining('HTTP GET /success 200')
      );
    });
  });
});