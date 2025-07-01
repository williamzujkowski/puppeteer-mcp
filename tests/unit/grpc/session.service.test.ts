/**
 * gRPC Session service tests
 * @module tests/unit/grpc/session.service
 * @standard TS:JEST
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { SessionServiceImpl } from '../../../src/grpc/services/session.service.js';
import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import * as jwt from '../../../src/auth/jwt.js';

// Mock JWT module
jest.mock('../../../src/auth/jwt.js');

describe('SessionService', () => {
  let service: SessionServiceImpl;
  let sessionStore: InMemorySessionStore;
  let logger: pino.Logger;
  let mockCall: any;

  // Helper function to promisify callback-based service calls
  const callServiceMethod = <T>(
    method: (call: any, callback: any) => void,
    call: any,
  ): Promise<{ error: any; response: T }> => {
    return new Promise((resolve) => {
      const callback = (error: any, response: T): void => {
        resolve({ error, response });
      };
      method.call(service, call, callback);
    });
  };

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(logger);
    service = new SessionServiceImpl(logger, sessionStore);
    mockCall = {
      request: {},
      metadata: new grpc.Metadata(),
      userId: 'test-user',
      username: 'testuser',
      roles: ['user'],
      session: {
        id: 'test-session',
        userId: 'test-user',
      },
    };

    // Mock JWT functions
    (jwt.generateTokens as jest.Mock).mockReturnValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear metadata to avoid interference between tests
    mockCall.metadata = new grpc.Metadata();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      mockCall.request = {
        user_id: 'user123',
        username: 'testuser',
        roles: ['user'],
        data: { key: 'value' },
        ttl_seconds: 3600,
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.createSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            user_id: 'user123',
            username: 'testuser',
            roles: ['user'],
          }),
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
      );
    });

    it('should fail when user_id is missing', async () => {
      mockCall.request = {
        username: 'testuser',
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.createSession(call, callback),
        mockCall,
      );

      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('required'),
        }),
      );
      expect(response).toBeUndefined();
    });

    it('should use default TTL when not specified', async () => {
      mockCall.request = {
        user_id: 'user123',
        username: 'testuser',
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.createSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            expires_at: expect.any(String),
            user_id: 'user123',
            username: 'testuser',
          }),
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
      );
    });
  });

  describe('getSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session and store the generated ID
      testSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    });

    it('should get session successfully for owner', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };
      // Set user info in metadata (as expected by SessionUtils.extractUserFromCall)
      mockCall.metadata.set('user-id', 'test-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.getSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            id: testSessionId,
            user_id: 'test-user',
          }),
        }),
      );
    });

    it('should allow admin to get any session', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };
      // Set admin user info in metadata
      mockCall.metadata.set('user-id', 'admin-user');
      mockCall.metadata.set('user-roles', 'admin');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.getSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            id: testSessionId,
          }),
        }),
      );
    });

    it('should deny access to other users sessions', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };
      // Set different user info in metadata
      mockCall.metadata.set('user-id', 'other-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.getSession(call, callback),
        mockCall,
      );

      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('Access denied'),
        }),
      );
      expect(response).toBeUndefined();
    });

    it('should return error for non-existent session', async () => {
      mockCall.request = {
        session_id: 'non-existent',
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.getSession(call, callback),
        mockCall,
      );

      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      );
      expect(response).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      testSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: { existing: 'data' },
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    });

    it('should update session data successfully', async () => {
      mockCall.request = {
        session_id: testSessionId,
        data: { new: 'value' },
      };
      // Set user info in metadata
      mockCall.metadata.set('user-id', 'test-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.updateSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            data: expect.objectContaining({
              existing: 'data',
              new: 'value',
            }),
          }),
        }),
      );
    });

    it('should update session with TTL extension', async () => {
      mockCall.request = {
        session_id: testSessionId,
        extend_ttl: true,
        ttl_seconds: 7200, // 2 hours
      };
      // Set user info in metadata
      mockCall.metadata.set('user-id', 'test-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.updateSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            id: testSessionId,
            user_id: 'test-user',
          }),
        }),
      );

      const updatedSession = await sessionStore.get(testSessionId);
      expect(updatedSession?.data.metadata).toEqual({ existing: 'data' }); // Data preserved
    });
  });

  describe('deleteSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      testSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    });

    it('should delete session successfully', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };
      // Set user info in metadata
      mockCall.metadata.set('user-id', 'test-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.deleteSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual({ success: true });

      const session = await sessionStore.get(testSessionId);
      expect(session).toBeNull();
    });

    it('should deny deletion by non-owner', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };
      // Set different user info in metadata
      mockCall.metadata.set('user-id', 'other-user');
      mockCall.metadata.set('user-roles', 'user');

      const { error, response } = await callServiceMethod(
        (call, callback) => service.deleteSession(call, callback),
        mockCall,
      );

      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('Access denied'),
        }),
      );
      expect(response).toBeUndefined();
    });
  });

  describe('refreshSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      testSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      (jwt.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sessionId: testSessionId,
        userId: 'test-user',
      });
    });

    it('should refresh session successfully', async () => {
      mockCall.request = {
        refresh_token: 'valid-refresh-token',
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.refreshSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          session: expect.objectContaining({
            id: testSessionId,
          }),
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
      );
    });

    it('should fail with invalid refresh token', async () => {
      (jwt.verifyRefreshToken as jest.Mock).mockResolvedValue(null);

      mockCall.request = {
        refresh_token: 'invalid-token',
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.refreshSession(call, callback),
        mockCall,
      );

      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('Invalid refresh token'),
        }),
      );
      expect(response).toBeUndefined();
    });
  });

  describe('validateSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      testSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    });

    it('should validate session by ID successfully', async () => {
      mockCall.request = {
        session_id: testSessionId,
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.validateSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          valid: true,
          session: expect.objectContaining({
            id: testSessionId,
          }),
        }),
      );
    });

    it('should return invalid for expired session', async () => {
      // Create expired session
      const expiredSessionId = await sessionStore.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        metadata: {},
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        createdAt: new Date().toISOString(),
      });

      mockCall.request = {
        session_id: expiredSessionId,
      };

      const { error, response } = await callServiceMethod(
        (call, callback) => service.validateSession(call, callback),
        mockCall,
      );

      expect(error).toBeNull();
      expect(response).toEqual(
        expect.objectContaining({
          valid: false,
        }),
      );
      // The expired session should be automatically deleted by the store
      const expiredSession = await sessionStore.get(expiredSessionId);
      expect(expiredSession).toBeNull();
    });
  });
});
