/**
 * Tests for backward compatibility of refactored session manager
 * @module ws/websocket/session/__tests__/backward-compatibility
 * @nist ac-3 "Access enforcement"
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { pino } from 'pino';
import { SessionManager } from '../../session-manager.js';
import type { WSComponentDependencies } from '../../types.js';
import type { SessionStore } from '../../../../store/session-store.interface.js';
import type { ConnectionManager } from '../../connection-manager.js';

describe('SessionManager Backward Compatibility', () => {
  let mockDependencies: WSComponentDependencies;
  let sessionManager: SessionManager;
  let mockConnectionManager: ConnectionManager;

  beforeEach(() => {
    // Create mock dependencies
    mockDependencies = {
      logger: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as pino.Logger,
      sessionStore: {
        createSession: jest.fn(),
        updateSession: jest.fn(),
        deleteSession: jest.fn(),
        getSession: jest.fn(),
        getAllSessions: jest.fn(),
      } as unknown as SessionStore,
    };

    mockConnectionManager = {
      getConnection: jest.fn().mockReturnValue({ id: 'conn1' }),
    } as unknown as ConnectionManager;

    sessionManager = new SessionManager(mockDependencies, {
      sessionTimeout: 3600000,
      maxSessionsPerUser: 5,
      persistSessions: true,
    });
  });

  describe('API Compatibility', () => {
    it('should have all public methods', () => {
      expect(typeof sessionManager.start).toBe('function');
      expect(typeof sessionManager.stop).toBe('function');
      expect(typeof sessionManager.createOrUpdateSession).toBe('function');
      expect(typeof sessionManager.removeConnectionFromSession).toBe('function');
      expect(typeof sessionManager.removeSession).toBe('function');
      expect(typeof sessionManager.getSession).toBe('function');
      expect(typeof sessionManager.getUserSessions).toBe('function');
      expect(typeof sessionManager.validateSession).toBe('function');
      expect(typeof sessionManager.getSessionStats).toBe('function');
      expect(typeof sessionManager.cleanupExpiredSessions).toBe('function');
    });

    it('should accept same constructor parameters', () => {
      const newManager = new SessionManager(mockDependencies, {
        sessionTimeout: 1800000,
        maxSessionsPerUser: 3,
        persistSessions: false,
      });
      expect(newManager).toBeDefined();
    });
  });

  describe('Behavior Compatibility', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    afterEach(async () => {
      await sessionManager.stop();
    });

    it('should create session with same parameters', async () => {
      const result = await sessionManager.createOrUpdateSession('session1', 'user1', 'conn1', {
        roles: ['user'],
        permissions: ['read'],
        scopes: ['profile'],
        metadata: { device: 'desktop' },
      });

      expect(result).toBe(true);
    });

    it('should return session info in same format', async () => {
      await sessionManager.createOrUpdateSession('session1', 'user1', 'conn1', {
        roles: ['user'],
      });

      const session = sessionManager.getSession('session1');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('session1');
      expect(session?.userId).toBe('user1');
      expect(session?.connectionIds).toBeDefined();
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.lastActivity).toBeInstanceOf(Date);
      expect(session?.roles).toEqual(['user']);
    });

    it('should return same stats format', async () => {
      await sessionManager.createOrUpdateSession('session1', 'user1', 'conn1');
      await sessionManager.createOrUpdateSession('session2', 'user2', 'conn2');

      const stats = sessionManager.getSessionStats();
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('averageConnectionsPerSession');
      expect(stats).toHaveProperty('sessionsPerUser');
      expect(Array.isArray(stats.sessionsPerUser)).toBe(true);
    });

    it('should validate sessions with same behavior', async () => {
      await sessionManager.createOrUpdateSession('session1', 'user1', 'conn1');

      const isValid = await sessionManager.validateSession('session1', mockConnectionManager);
      expect(isValid).toBe(true);

      const isInvalid = await sessionManager.validateSession('nonexistent', mockConnectionManager);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Type Compatibility', () => {
    it('should export SessionInfo type', () => {
      // This test ensures the type is exported and can be imported
      const sessionInfo: import('../../session-manager.js').SessionInfo = {
        sessionId: 'test',
        userId: 'user1',
        connectionIds: new Set(['conn1']),
        createdAt: new Date(),
        lastActivity: new Date(),
        state: 'active' as any,
      };
      expect(sessionInfo).toBeDefined();
    });

    it('should export SessionStats type', () => {
      // This test ensures the type is exported and can be imported
      const stats: import('../../session-manager.js').SessionStats = {
        totalSessions: 1,
        activeSessions: 1,
        totalUsers: 1,
        averageConnectionsPerSession: 1,
        sessionsPerUser: [],
        sessionsByState: {} as any,
      };
      expect(stats).toBeDefined();
    });
  });
});
