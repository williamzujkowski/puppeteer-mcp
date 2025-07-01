/**
 * Sessions API integration tests
 * @module tests/integration/sessions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { createApp, sessionStore } from '../../src/server.js';
import { generateTokenPair } from '../../src/auth/jwt.js';
import type { SessionData } from '../../src/types/session.js';

describe('Sessions API Integration Tests', () => {
  let app: Application;
  let validAccessToken: string;
  let validRefreshToken: string;
  let sessionId: string;
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const username = 'testuser';
  const roles = ['user'];

  beforeAll(() => {
    app = createApp();
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
    validRefreshToken = tokens.refreshToken;
  });

  afterAll(async () => {
    await sessionStore.clear();
  });

  describe('POST /api/v1/sessions/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/refresh')
        .send({
          refreshToken: validRefreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(typeof response.body.data.refreshToken).toBe('string');
      expect(typeof response.body.data.expiresIn).toBe('number');
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/v1/sessions/refresh')
        .send({
          refreshToken: 'invalid.refresh.token',
        })
        .expect(401);
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject refresh for non-existent session', async () => {
      // Delete the session
      await sessionStore.delete(sessionId);

      await request(app)
        .post('/api/v1/sessions/refresh')
        .send({
          refreshToken: validRefreshToken,
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/sessions/revoke', () => {
    it('should revoke refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/sessions/revoke')
        .send({
          refreshToken: validRefreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token revoked successfully');

      // Verify session is deleted
      const session = await sessionStore.get(sessionId);
      expect(session).toBeNull();
    });

    it('should handle revoking invalid token', async () => {
      await request(app)
        .post('/api/v1/sessions/revoke')
        .send({
          refreshToken: 'invalid.refresh.token',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/sessions/current', () => {
    it('should return current session info with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/sessions/current')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', sessionId);
      expect(response.body.data).toHaveProperty('userId', userId);
      expect(response.body.data).toHaveProperty('username', username);
      expect(response.body.data).toHaveProperty('roles');
      expect(response.body.data.roles).toEqual(roles);
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('lastAccessedAt');
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/v1/sessions/current')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/v1/sessions/current')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);
    });
  });

  describe('GET /api/v1/sessions/my-sessions', () => {
    it('should return all sessions for current user', async () => {
      // Create additional sessions
      const sessionData: SessionData = {
        userId,
        username,
        roles,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const sessionId2 = await sessionStore.create(sessionData);

      const response = await request(app)
        .get('/api/v1/sessions/my-sessions')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2);

      // Check that current session is marked
      const currentSession = response.body.data.find((s: any) => s.id === sessionId);
      expect(currentSession).toBeDefined();
      expect(currentSession.isCurrent).toBe(true);

      const otherSession = response.body.data.find((s: any) => s.id === sessionId2);
      expect(otherSession).toBeDefined();
      expect(otherSession.isCurrent).toBe(false);
    });

    it('should return empty array for user with no sessions', async () => {
      // Clear all sessions
      await sessionStore.clear();

      // Create a new session for authentication
      const sessionData: SessionData = {
        userId: 'different-user',
        username: 'different',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const newSessionId = await sessionStore.create(sessionData);
      const tokens = generateTokenPair('different-user', 'different', ['user'], newSessionId);

      const response = await request(app)
        .get('/api/v1/sessions/my-sessions')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([{
        id: newSessionId,
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
        lastAccessedAt: expect.any(String),
        isCurrent: true,
      }]);
    });
  });

  describe('DELETE /api/v1/sessions/:sessionId', () => {
    it('should terminate specific session', async () => {
      // Create another session
      const sessionData: SessionData = {
        userId,
        username,
        roles,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const sessionToDelete = await sessionStore.create(sessionData);

      const response = await request(app)
        .delete(`/api/v1/sessions/${sessionToDelete}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session terminated successfully');

      // Verify session is deleted
      const deletedSession = await sessionStore.get(sessionToDelete);
      expect(deletedSession).toBeNull();

      // Verify current session still exists
      const currentSession = await sessionStore.get(sessionId);
      expect(currentSession).toBeTruthy();
    });

    it('should not allow terminating another user\'s session', async () => {
      // Create session for different user
      const otherUserData: SessionData = {
        userId: 'other-user',
        username: 'otheruser',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const otherSessionId = await sessionStore.create(otherUserData);

      await request(app)
        .delete(`/api/v1/sessions/${otherSessionId}`)
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app)
        .delete('/api/v1/sessions/non-existent-id')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/sessions/all', () => {
    it('should terminate all sessions except current', async () => {
      // Create additional sessions
      const sessionData: SessionData = {
        userId,
        username,
        roles,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const session2 = await sessionStore.create(sessionData);
      const session3 = await sessionStore.create(sessionData);

      const response = await request(app)
        .delete('/api/v1/sessions/all')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(2);

      // Verify other sessions are deleted
      expect(await sessionStore.get(session2)).toBeNull();
      expect(await sessionStore.get(session3)).toBeNull();

      // Verify current session still exists
      expect(await sessionStore.get(sessionId)).toBeTruthy();
    });

    it('should return 0 if no other sessions exist', async () => {
      const response = await request(app)
        .delete('/api/v1/sessions/all')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(0);
    });
  });

  describe('Admin endpoints', () => {
    let adminToken: string;
    let adminSessionId: string;

    beforeEach(async () => {
      // Create admin session
      const adminData: SessionData = {
        userId: 'admin-user',
        username: 'admin',
        roles: ['user', 'admin'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      adminSessionId = await sessionStore.create(adminData);
      const tokens = generateTokenPair('admin-user', 'admin', ['user', 'admin'], adminSessionId);
      adminToken = tokens.accessToken;
    });

    describe('DELETE /api/v1/sessions/admin/:sessionId', () => {
      it('should allow admin to terminate any session', async () => {
        const response = await request(app)
          .delete(`/api/v1/sessions/admin/${sessionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.terminatedUserId).toBe(userId);
        expect(response.body.data.terminatedUsername).toBe(username);

        // Verify session is deleted
        expect(await sessionStore.get(sessionId)).toBeNull();
      });

      it('should reject non-admin users', async () => {
        await request(app)
          .delete(`/api/v1/sessions/admin/${sessionId}`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(403);
      });
    });
  });
});