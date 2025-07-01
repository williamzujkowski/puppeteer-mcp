/**
 * Health endpoint integration tests
 * @module tests/integration/health.integration
 */

import { jest } from '@jest/globals';

// Mock the config module before it's imported
jest.mock('../../src/core/config.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 0,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-secret-key-for-integration-tests-must-be-at-least-32-chars',
    JWT_EXPIRY: '1h',
    BCRYPT_ROUNDS: 10,
    RATE_LIMIT_WINDOW: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    CORS_ORIGIN: '*',
    CORS_CREDENTIALS: true,
  },
}));

import request from 'supertest';
import { createApp } from '../../src/server.js';
import type { Application } from 'express';
import { waitForServer } from '../setup-integration.js';
import http from 'http';

describe.skip('Health Endpoints Integration (TODO: Fix config loading)', () => {
  let app: Application;
  let server: http.Server;

  beforeAll(async () => {
    // Create the full application
    app = await createApp();
    server = http.createServer(app);

    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    await waitForServer(server);
    global.testServer = server;
  });

  afterAll(async () => {
    if (server !== undefined) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('GET /api/health', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        version: expect.any(String),
      });

      // Verify uptime is positive
      expect(response.body.uptime).toBeGreaterThan(0);

      // Verify timestamp is recent
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should include proper headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('GET /api/health/live', () => {
    it('should return live status quickly', async () => {
      const start = Date.now();
      const response = await request(app).get('/api/health/live');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'alive' });
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });
  });

  describe('GET /api/health/ready', () => {
    it('should check all dependencies', async () => {
      const response = await request(app).get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ready',
        checks: {
          server: true,
          // Additional checks would be added here as dependencies grow
          // database: true,
          // cache: true,
          // messageQueue: true,
        },
      });
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/api/health/ready'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ready');
      });
    });
  });

  describe('Error scenarios', () => {
    it('should handle invalid health endpoints', async () => {
      const response = await request(app).get('/api/health/invalid');

      expect(response.status).toBe(404);
    });

    it('should reject non-GET methods', async () => {
      // Test POST
      let response = await request(app).post('/api/health');
      expect(response.status).toBe(405); // Method Not Allowed

      // Test PUT
      response = await request(app).put('/api/health');
      expect(response.status).toBe(405); // Method Not Allowed

      // Test DELETE
      response = await request(app).delete('/api/health');
      expect(response.status).toBe(405); // Method Not Allowed

      // Test PATCH
      response = await request(app).patch('/api/health');
      expect(response.status).toBe(405); // Method Not Allowed
    });
  });

  describe('Load testing', () => {
    it('should handle multiple concurrent health checks', async () => {
      const concurrentRequests = 50;
      const results = await Promise.all(
        Array(concurrentRequests)
          .fill(null)
          .map(async (_, index) => {
            const start = Date.now();
            const response = await request(app).get('/api/health');
            const duration = Date.now() - start;

            return {
              index,
              status: response.status,
              duration,
            };
          }),
      );

      // All requests should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Calculate average response time
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(100); // Average should be under 100ms

      // Check for any outliers
      const maxDuration = Math.max(...results.map((r) => r.duration));
      expect(maxDuration).toBeLessThan(500); // No request should take more than 500ms
    });
  });
});
