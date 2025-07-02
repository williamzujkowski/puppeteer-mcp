/**
 * REST Adapter Tests
 * @module mcp/adapters/rest-adapter.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { Application } from 'express';
import { RestAdapter } from './rest-adapter.js';
import { AppError } from '../../core/errors/app-error.js';
import { sessionStore } from '../../store/session-store.js';
import { apiKeyStore } from '../../store/api-key-store.js';

// Mock dependencies
jest.mock('../../store/session-store.js');
jest.mock('../../store/api-key-store.js');
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    API_ACCESS: 'API_ACCESS',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

describe('RestAdapter', () => {
  let app: Application;
  let adapter: RestAdapter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Set up test routes
    app.get('/api/v1/health', (_req, res) => {
      res.json({ status: 'healthy' });
    });
    
    app.get('/api/v1/sessions', (req, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ sessions: [] });
    });
    
    adapter = new RestAdapter(app);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should execute a public endpoint without authentication', async () => {
      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/health',
        },
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text as string);
      expect(response).toEqual({ status: 'healthy' });
      expect(result.metadata?.status).toBe(200);
    });

    it('should handle JWT authentication', async () => {
      // Mock JWT verification
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        metadata: { username: 'testuser', roles: ['user'] },
      };
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSession);

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/sessions',
        },
        auth: {
          type: 'jwt',
          credentials: 'valid-jwt-token',
        },
      });

      expect(result.metadata?.status).toBe(200);
    });

    it('should handle API key authentication', async () => {
      // Mock API key verification
      const mockKeyData = {
        id: 'key-123',
        userId: 'user-123',
        name: 'test-key',
        roles: ['user'],
      };
      (apiKeyStore.verify as jest.Mock).mockResolvedValue(mockKeyData);

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/sessions',
        },
        auth: {
          type: 'apikey',
          credentials: 'valid-api-key',
        },
      });

      expect(result.metadata?.status).toBe(200);
    });

    it('should handle session authentication', async () => {
      // Mock session lookup
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        metadata: { username: 'testuser', roles: ['user'] },
      };
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSession);

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/sessions',
        },
        auth: {
          type: 'session',
          credentials: 'session-123',
        },
      });

      expect(result.metadata?.status).toBe(200);
    });

    it('should handle validation errors', async () => {
      const result = await adapter.executeRequest({
        operation: {
          method: 'INVALID',
          endpoint: '/api/v1/health',
        },
      });

      expect(result.metadata?.status).toBe(400);
      const response = JSON.parse(result.content[0].text as string);
      expect(response.error.message).toBe('Validation error');
    });

    it('should handle authentication failures', async () => {
      (sessionStore.get as jest.Mock).mockResolvedValue(null);

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/sessions',
        },
        auth: {
          type: 'jwt',
          credentials: 'invalid-jwt-token',
        },
      });

      expect(result.metadata?.status).toBe(401);
      const response = JSON.parse(result.content[0].text as string);
      expect(response.error.message).toBe('Invalid session');
    });

    it('should handle route not found errors', async () => {
      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/nonexistent',
        },
      });

      expect(result.metadata?.status).toBe(404);
      const response = JSON.parse(result.content[0].text as string);
      expect(response.error.message).toContain('Route not found');
    });

    it('should include request metadata in response', async () => {
      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/health',
          headers: {
            'x-custom-header': 'test-value',
          },
        },
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
      expect(result.metadata?.requestId).toBeDefined();
      expect(result.metadata?.requestId).toMatch(/^mcp-rest-/);
    });

    it('should pass query parameters', async () => {
      app.get('/api/v1/test', (req, res) => {
        res.json({ query: req.query });
      });

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/test',
          query: {
            foo: 'bar',
            baz: 'qux',
          },
        },
      });

      const response = JSON.parse(result.content[0].text as string);
      expect(response.query).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('should pass request body', async () => {
      app.post('/api/v1/test', (req, res) => {
        res.json({ body: req.body });
      });

      const result = await adapter.executeRequest({
        operation: {
          method: 'POST',
          endpoint: '/api/v1/test',
          body: {
            name: 'test',
            value: 123,
          },
        },
      });

      const response = JSON.parse(result.content[0].text as string);
      expect(response.body).toEqual({ name: 'test', value: 123 });
    });
  });

  describe('listEndpoints', () => {
    it('should return a list of available endpoints', async () => {
      const result = await adapter.listEndpoints();

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text as string);
      expect(response.baseUrl).toBe('/api/v1');
      expect(response.endpoints).toBeInstanceOf(Array);
      expect(response.endpoints.length).toBeGreaterThan(0);
      
      // Check for expected endpoints
      const healthEndpoint = response.endpoints.find(
        (e: any) => e.path === '/health'
      );
      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint.methods).toContain('GET');
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Create a route that throws an error
      app.get('/api/v1/error', () => {
        throw new Error('Unexpected error');
      });

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/error',
        },
      });

      expect(result.metadata?.status).toBe(500);
      const response = JSON.parse(result.content[0].text as string);
      expect(response.error.message).toBe('Unexpected error');
      expect(response.error.requestId).toBeDefined();
    });

    it('should handle AppError with custom status codes', async () => {
      app.get('/api/v1/app-error', () => {
        throw new AppError('Custom error', 403, { reason: 'forbidden' });
      });

      const result = await adapter.executeRequest({
        operation: {
          method: 'GET',
          endpoint: '/api/v1/app-error',
        },
      });

      expect(result.metadata?.status).toBe(403);
      const response = JSON.parse(result.content[0].text as string);
      expect(response.error.message).toBe('Custom error');
      expect(response.error.details).toEqual({ reason: 'forbidden' });
    });
  });
});