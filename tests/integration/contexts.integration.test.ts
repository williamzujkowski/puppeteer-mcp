/**
 * Contexts API integration tests
 * @module tests/integration/contexts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { createApp, sessionStore } from '../../src/server.js';
import { generateTokenPair } from '../../src/auth/jwt.js';
import type { SessionData } from '../../src/types/session.js';

describe('Contexts API Integration Tests', () => {
  let app: Application;
  let validAccessToken: string;
  let sessionId: string;
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const username = 'testuser';
  const roles = ['user'];

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    // Clear any existing sessions
    await sessionStore.clear();

    // Create a test session
    const sessionData: SessionData = {
      userId,
      username,
      roles,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    sessionId = await sessionStore.create(sessionData);

    // Generate tokens
    const tokens = generateTokenPair(userId, username, roles, sessionId);
    validAccessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await sessionStore.clear();
  });

  describe('POST /api/v1/contexts', () => {
    it('should create a new browser context', async () => {
      const contextConfig = {
        name: 'Test Context',
        viewport: {
          width: 1920,
          height: 1080,
        },
        userAgent: 'Mozilla/5.0 Test Agent',
        locale: 'en-US',
        timezone: 'America/New_York',
      };

      const response = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send(contextConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.id).toMatch(/^ctx_/);
      expect(response.body.data).toHaveProperty('userId', userId);
      expect(response.body.data).toHaveProperty('config');
      expect(response.body.data.config).toMatchObject(contextConfig);
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('lastUsedAt');
      expect(response.body.data).toHaveProperty('status', 'active');
    });

    it('should validate context configuration', async () => {
      const invalidConfig = {
        name: '', // Empty name
        viewport: {
          width: -100, // Invalid width
          height: 1080,
        },
      };

      const response = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/contexts')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/v1/contexts', () => {
    it('should list all contexts for current user', async () => {
      // Create some contexts
      const context1 = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Context 1' });

      const context2 = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Context 2' });

      const response = await request(app)
        .get('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2);

      const contextIds = response.body.data.map((c: { id: string }) => c.id);
      expect(contextIds).toContain(context1.body.data.id);
      expect(contextIds).toContain(context2.body.data.id);
    });

    it('should return empty array when no contexts exist', async () => {
      const response = await request(app)
        .get('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should not show other users contexts', async () => {
      // Create context for first user
      await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'User 1 Context' });

      // Create session for second user
      const user2Data: SessionData = {
        userId: 'user2-id',
        username: 'user2',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const user2SessionId = await sessionStore.create(user2Data);
      const user2Tokens = generateTokenPair('user2-id', 'user2', ['user'], user2SessionId);

      // Get contexts for second user
      const response = await request(app)
        .get('/api/v1/contexts')
        .set('Authorization', `Bearer ${user2Tokens.accessToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/contexts/:contextId', () => {
    it('should get specific context details', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          name: 'Test Context',
          viewport: { width: 1920, height: 1080 },
        });

      const contextId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', contextId);
      expect(response.body.data.config).toHaveProperty('name', 'Test Context');
    });

    it('should update lastUsedAt timestamp', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Test Context' });

      const contextId = createResponse.body.data.id;
      const originalLastUsed = createResponse.body.data.lastUsedAt;

      // Wait a bit
      await new Promise<void>((resolve) => { setTimeout(resolve, 100); });

      const response = await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.data.lastUsedAt).not.toBe(originalLastUsed);
    });

    it('should return 404 for non-existent context', async () => {
      await request(app)
        .get('/api/v1/contexts/non-existent-id')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(404);
    });

    it('should deny access to other users contexts', async () => {
      // Create context for first user
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Private Context' });

      const contextId = createResponse.body.data.id;

      // Create session for second user
      const user2Data: SessionData = {
        userId: 'user2-id',
        username: 'user2',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const user2SessionId = await sessionStore.create(user2Data);
      const user2Tokens = generateTokenPair('user2-id', 'user2', ['user'], user2SessionId);

      await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${user2Tokens.accessToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/contexts/:contextId', () => {
    it('should update context configuration', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          name: 'Original Name',
          viewport: { width: 1920, height: 1080 },
        });

      const contextId = createResponse.body.data.id;

      const updates = {
        name: 'Updated Name',
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
      };

      const response = await request(app)
        .patch(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.config.name).toBe('Updated Name');
      expect(response.body.data.config.locale).toBe('fr-FR');
      expect(response.body.data.config.timezone).toBe('Europe/Paris');
      expect(response.body.data.config.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should validate partial updates', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Test Context' });

      const contextId = createResponse.body.data.id;

      await request(app)
        .patch(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          viewport: { width: -100 }, // Invalid
        })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/contexts/:contextId', () => {
    it('should delete context', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'To Delete' });

      const contextId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Context deleted successfully');

      // Verify context is deleted
      await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/contexts/:contextId/execute', () => {
    it('should queue action for execution', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Test Context' });

      const contextId = createResponse.body.data.id;

      const action = {
        action: 'navigate',
        params: {
          url: 'https://example.com',
        },
      };

      const response = await request(app)
        .post(`/api/v1/contexts/${contextId}/execute`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send(action)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('queued for execution');
      expect(response.body.data).toHaveProperty('contextId', contextId);
      expect(response.body.data).toHaveProperty('action', 'navigate');
      expect(response.body.data).toHaveProperty('params', action.params);
      expect(response.body.data).toHaveProperty('queuedAt');
    });

    it('should validate action type', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Test Context' });

      const contextId = createResponse.body.data.id;

      await request(app)
        .post(`/api/v1/contexts/${contextId}/execute`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          action: 'invalid-action',
          params: {},
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/contexts/:contextId/metrics', () => {
    it('should return context metrics', async () => {
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Test Context' });

      const contextId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/contexts/${contextId}/metrics`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data.memory).toHaveProperty('used');
      expect(response.body.data.memory).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('cpu');
      expect(response.body.data.cpu).toHaveProperty('usage');
      expect(response.body.data).toHaveProperty('network');
      expect(response.body.data.network).toHaveProperty('requests');
      expect(response.body.data.network).toHaveProperty('bytesReceived');
      expect(response.body.data.network).toHaveProperty('bytesSent');
      expect(response.body.data).toHaveProperty('duration');
    });
  });

  describe('Admin access', () => {
    let adminToken: string;

    beforeEach(async () => {
      // Create admin session
      const adminData: SessionData = {
        userId: 'admin-user',
        username: 'admin',
        roles: ['user', 'admin'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const adminSessionId = await sessionStore.create(adminData);
      const tokens = generateTokenPair('admin-user', 'admin', ['user', 'admin'], adminSessionId);
      adminToken = tokens.accessToken;
    });

    it('should allow admin to access any context', async () => {
      // Create context as regular user
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'User Context' });

      const contextId = createResponse.body.data.id;

      // Access as admin
      const response = await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(contextId);
    });

    it('should allow admin to delete any context', async () => {
      // Create context as regular user
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'User Context' });

      const contextId = createResponse.body.data.id;

      // Delete as admin
      await request(app)
        .delete(`/api/v1/contexts/${contextId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});