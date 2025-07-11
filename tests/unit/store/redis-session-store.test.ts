/**
 * Redis session store tests
 * @module tests/unit/store/redis-session-store
 */

import { RedisSessionStore } from '../../../src/store/redis-session-store.js';
import type { SessionData } from '../../../src/types/session.js';
import { getRedisClient, isRedisAvailable } from '../../../src/utils/redis-client.js';

// Mock Redis client
jest.mock('../../../src/utils/redis-client.js', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
  initializeRedis: jest.fn(),
  closeRedis: jest.fn(),
  checkRedisHealth: jest.fn(),
  testRedisConnection: jest.fn(),
}));

describe('RedisSessionStore', () => {
  let store: RedisSessionStore;
  let sessionData: SessionData;
  let mockRedisClient: any;

  const mockRedisClient_Base = {
    pipeline: jest.fn(),
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis client
    mockRedisClient = {
      ...mockRedisClient_Base,
      pipeline: jest.fn(() => ({
        setex: jest.fn(),
        sadd: jest.fn(),
        expire: jest.fn(),
        del: jest.fn(),
        srem: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 1],
          [null, 1],
        ]),
      })),
    };

    // Mock Redis availability
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    (isRedisAvailable as jest.Mock).mockReturnValue(true);

    store = new RedisSessionStore();
    sessionData = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      roles: ['user'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  });

  afterEach(async () => {
    await store.destroy();
  });

  describe('create', () => {
    it('should create a new session in Redis', async () => {
      const id = await store.create(sessionData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });

    it('should fallback to in-memory store when Redis is unavailable', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const id = await store.create(sessionData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      // Should not call Redis methods when falling back
      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.pipeline.mockReturnValue({
        setex: jest.fn(),
        sadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      });

      const id = await store.create(sessionData);

      expect(id).toBeDefined();
      // Should fallback to in-memory store
      expect(typeof id).toBe('string');
    });
  });

  describe('get', () => {
    it('should retrieve an existing session from Redis', async () => {
      const mockSessionData = JSON.stringify({
        id: 'test-id',
        data: sessionData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);

      const session = await store.get('test-id');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-id');
      expect(session?.data).toMatchObject(sessionData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:test-id');
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const session = await store.get('non-existent-id');

      expect(session).toBeNull();
    });

    it('should return null for expired session', async () => {
      const expiredData = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };

      const mockSessionData = JSON.stringify({
        id: 'expired-id',
        data: expiredData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);
      mockRedisClient.pipeline.mockReturnValue({
        del: jest.fn(),
        srem: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      });

      const session = await store.get('expired-id');

      expect(session).toBeNull();
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });

    it('should fallback to in-memory store on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const session = await store.get('test-id');

      expect(session).toBeNull(); // Fallback store won't have the session
    });
  });

  describe('update', () => {
    it('should update an existing session in Redis', async () => {
      const mockSessionData = JSON.stringify({
        id: 'test-id',
        data: sessionData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);
      mockRedisClient.setex.mockResolvedValue('OK');

      const updatedData = { roles: ['user', 'admin'] };
      const updated = await store.update('test-id', updatedData);

      expect(updated).toBeDefined();
      expect(updated?.data.roles).toEqual(['user', 'admin']);
      expect(updated?.data.username).toBe(sessionData.username);
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should return null when updating non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const updated = await store.update('non-existent-id', { roles: ['admin'] });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing session from Redis', async () => {
      const mockSessionData = JSON.stringify({
        id: 'test-id',
        data: sessionData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);
      mockRedisClient.pipeline.mockReturnValue({
        del: jest.fn(),
        srem: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      });

      const deleted = await store.delete('test-id');

      expect(deleted).toBe(true);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });

    it('should return false when deleting non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const deleted = await store.delete('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  describe('deleteExpired', () => {
    it('should clean up expired sessions from user sets', async () => {
      mockRedisClient.keys.mockResolvedValue(['user_sessions:user1', 'user_sessions:user2']);
      mockRedisClient.smembers
        .mockResolvedValueOnce(['session1', 'session2'])
        .mockResolvedValueOnce(['session3']);
      mockRedisClient.exists
        .mockResolvedValueOnce(0) // session1 expired
        .mockResolvedValueOnce(1) // session2 active
        .mockResolvedValueOnce(0); // session3 expired
      mockRedisClient.srem.mockResolvedValue(1);

      const deletedCount = await store.deleteExpired();

      expect(deletedCount).toBe(2);
      expect(mockRedisClient.srem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getByUserId', () => {
    it('should return all sessions for a user', async () => {
      const userId = sessionData.userId;
      const mockSessionData = JSON.stringify({
        id: 'test-id',
        data: sessionData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.smembers.mockResolvedValue(['session1', 'session2']);
      mockRedisClient.get.mockResolvedValue(mockSessionData);

      const sessions = await store.getByUserId(userId);

      expect(sessions).toHaveLength(2);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(`user_sessions:${userId}`);
    });

    it('should return empty array for user with no sessions', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      const sessions = await store.getByUserId('no-sessions-user');

      expect(sessions).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const exists = await store.exists('test-id');

      expect(exists).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('session:test-id');
    });

    it('should return false for non-existent session', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const exists = await store.exists('non-existent-id');

      expect(exists).toBe(false);
    });
  });

  describe('touch', () => {
    it('should update lastAccessedAt for existing session', async () => {
      const mockSessionData = JSON.stringify({
        id: 'test-id',
        data: sessionData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);
      mockRedisClient.setex.mockResolvedValue('OK');

      const touched = await store.touch('test-id');

      expect(touched).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const touched = await store.touch('non-existent-id');

      expect(touched).toBe(false);
    });

    it('should return false for expired session', async () => {
      const expiredData = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };

      const mockSessionData = JSON.stringify({
        id: 'expired-id',
        data: expiredData,
        lastAccessedAt: new Date().toISOString(),
      });

      mockRedisClient.get.mockResolvedValue(mockSessionData);
      mockRedisClient.pipeline.mockReturnValue({
        del: jest.fn(),
        srem: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      });

      const touched = await store.touch('expired-id');

      expect(touched).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all sessions from Redis', async () => {
      mockRedisClient.keys
        .mockResolvedValueOnce(['session:1', 'session:2'])
        .mockResolvedValueOnce(['user_sessions:user1']);
      mockRedisClient.del.mockResolvedValue(3);

      await store.clear();

      expect(mockRedisClient.keys).toHaveBeenCalledWith('session:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('user_sessions:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'session:1',
        'session:2',
        'user_sessions:user1',
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status for Redis and fallback', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const health = await store.healthCheck();

      expect(health.redis.available).toBe(true);
      expect(health.redis.latency).toBeDefined();
      expect(health.fallback.available).toBe(true);
    });

    it('should handle Redis health check failure', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const health = await store.healthCheck();

      expect(health.redis.available).toBe(false);
      expect(health.redis.error).toBe('Connection failed');
      expect(health.fallback.available).toBe(true);
    });
  });

  describe('Redis unavailable scenarios', () => {
    beforeEach(() => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);
      (getRedisClient as jest.Mock).mockReturnValue(null);
    });

    it('should use fallback store for all operations when Redis is unavailable', async () => {
      const id = await store.create(sessionData);
      expect(id).toBeDefined();

      const session = await store.get(id);
      expect(session).toBeDefined();

      const updated = await store.update(id, { roles: ['admin'] });
      expect(updated).toBeDefined();

      const touched = await store.touch(id);
      expect(touched).toBe(true);

      const exists = await store.exists(id);
      expect(exists).toBe(true);

      const deleted = await store.delete(id);
      expect(deleted).toBe(true);

      // Should not call Redis methods when Redis is unavailable
      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });
  });
});
