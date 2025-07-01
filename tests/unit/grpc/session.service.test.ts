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
  let mockCallback: jest.Mock;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(logger);
    service = new SessionServiceImpl(logger, sessionStore);
    
    mockCallback = jest.fn();
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
    (jwt.generateTokens as jest.Mock).mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', () => {
      mockCall.request = {
        user_id: 'user123',
        username: 'testuser',
        roles: ['user'],
        data: { key: 'value' },
        ttl_seconds: 3600,
      };

      service.createSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          user_id: 'user123',
          username: 'testuser',
          roles: ['user'],
        }),
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      }));
    });

    it('should fail when user_id is missing', () => {
      mockCall.request = {
        username: 'testuser',
      };

      service.createSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should use default TTL when not specified', () => {
      mockCall.request = {
        user_id: 'user123',
        username: 'testuser',
      };

      service.createSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          expires_at: expect.objectContaining({
            seconds: expect.any(Number),
          }),
        }),
      }));
    });
  });

  describe('getSession', () => {
    beforeEach(async () => {
      // Create a test session
      await sessionStore.create({
        id: 'test-session-id',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });
    });

    it('should get session successfully for owner', () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };

      service.getSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          id: 'test-session-id',
          user_id: 'test-user',
        }),
      }));
    });

    it('should allow admin to get any session', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };
      mockCall.userId = 'admin-user';
      mockCall.roles = ['admin'];

      service.getSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          id: 'test-session-id',
        }),
      }));
    });

    it('should deny access to other users sessions', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };
      mockCall.userId = 'other-user';
      mockCall.roles = ['user'];

      service.getSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Access denied'),
        })
      );
    });

    it('should return error for non-existent session', async () => {
      mockCall.request = {
        session_id: 'non-existent',
      };

      service.getSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found'),
        })
      );
    });
  });

  describe('updateSession', () => {
    beforeEach(async () => {
      await sessionStore.create({
        id: 'test-session-id',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: { existing: 'data' },
        expiresAt: Date.now() + 3600000,
      });
    });

    it('should update session data successfully', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
        data: { new: 'value' },
      };

      service.updateSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          data: expect.objectContaining({
            existing: 'data',
            new: 'value',
          }),
        }),
      }));
    });

    it('should update only specified fields with field mask', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
        data: { new: 'value' },
        roles: ['admin'],
        update_mask: {
          paths: ['roles'],
        },
      };

      service.updateSession(mockCall, mockCallback);

      const updatedSession = await sessionStore.get('test-session-id');
      expect(updatedSession?.roles).toEqual(['admin']);
      expect(updatedSession?.data).toEqual({ existing: 'data' }); // Data not updated
    });
  });

  describe('deleteSession', () => {
    beforeEach(async () => {
      await sessionStore.create({
        id: 'test-session-id',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });
    });

    it('should delete session successfully', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };

      service.deleteSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, { success: true });
      
      const session = await sessionStore.get('test-session-id');
      expect(session).toBeNull();
    });

    it('should deny deletion by non-owner', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };
      mockCall.userId = 'other-user';
      mockCall.roles = ['user'];

      service.deleteSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Access denied'),
        })
      );
    });
  });

  describe('refreshSession', () => {
    beforeEach(async () => {
      await sessionStore.create({
        id: 'test-session-id',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });

      (jwt.verifyRefreshToken as jest.Mock).mockResolvedValue({
        sessionId: 'test-session-id',
        userId: 'test-user',
      });
    });

    it('should refresh session successfully', async () => {
      mockCall.request = {
        refresh_token: 'valid-refresh-token',
      };

      service.refreshSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        session: expect.objectContaining({
          id: 'test-session-id',
        }),
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      }));
    });

    it('should fail with invalid refresh token', async () => {
      (jwt.verifyRefreshToken as jest.Mock).mockResolvedValue(null);
      
      mockCall.request = {
        refresh_token: 'invalid-token',
      };

      service.refreshSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid refresh token'),
        })
      );
    });
  });

  describe('validateSession', () => {
    beforeEach(async () => {
      await sessionStore.create({
        id: 'test-session-id',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });
    });

    it('should validate session by ID successfully', async () => {
      mockCall.request = {
        session_id: 'test-session-id',
      };

      service.validateSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        valid: true,
        session: expect.objectContaining({
          id: 'test-session-id',
        }),
      }));
    });

    it('should return invalid for expired session', async () => {
      // Create expired session
      await sessionStore.create({
        id: 'expired-session',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() - 1000, // Expired
      });

      mockCall.request = {
        session_id: 'expired-session',
      };

      service.validateSession(mockCall, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        valid: false,
        error: expect.objectContaining({
          code: 'SESSION_EXPIRED',
        }),
      }));
    });
  });
});