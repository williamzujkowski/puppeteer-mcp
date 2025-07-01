/**
 * In-memory session store tests
 * @module tests/unit/store/in-memory-session-store
 */

import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import type { SessionData } from '../../../src/types/session.js';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;
  let sessionData: SessionData;

  beforeEach(() => {
    store = new InMemorySessionStore();
    sessionData = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      roles: ['user'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  });

  afterEach(async () => {
    await store.clear();
  });

  afterAll(async () => {
    // Make sure to clean up completely
    await store.clear();
  });

  describe('create', () => {
    it('should create a new session and return ID', async () => {
      const id = await store.create(sessionData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('get', () => {
    it('should retrieve an existing session', async () => {
      const id = await store.create(sessionData);
      const session = await store.get(id);

      expect(session).toBeDefined();
      expect(session?.id).toBe(id);
      expect(session?.data).toMatchObject(sessionData);
      expect(session?.lastAccessedAt).toBeDefined();
    });

    it('should return null for non-existent session', async () => {
      const session = await store.get('non-existent-id');
      expect(session).toBeNull();
    });

    it('should return null for expired session', async () => {
      const expiredData: SessionData = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };

      const id = await store.create(expiredData);
      const session = await store.get(id);

      expect(session).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing session', async () => {
      const id = await store.create(sessionData);
      const updatedData = { roles: ['user', 'admin'] };

      const updated = await store.update(id, updatedData);

      expect(updated).toBeDefined();
      expect(updated?.data.roles).toEqual(['user', 'admin']);
      expect(updated?.data.username).toBe(sessionData.username); // Other fields unchanged
    });

    it('should return null when updating non-existent session', async () => {
      const updated = await store.update('non-existent-id', { roles: ['admin'] });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing session', async () => {
      const id = await store.create(sessionData);

      const deleted = await store.delete(id);
      expect(deleted).toBe(true);

      const session = await store.get(id);
      expect(session).toBeNull();
    });

    it('should return false when deleting non-existent session', async () => {
      const deleted = await store.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteExpired', () => {
    it('should delete all expired sessions', async () => {
      // Create mix of expired and valid sessions
      const validId = await store.create(sessionData);

      const expiredData1: SessionData = {
        ...sessionData,
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      const expiredData2: SessionData = {
        ...sessionData,
        userId: 'user-2',
        expiresAt: new Date(Date.now() - 2000).toISOString(),
      };

      await store.create(expiredData1);
      await store.create(expiredData2);

      const deletedCount = await store.deleteExpired();

      expect(deletedCount).toBe(2);
      expect(await store.exists(validId)).toBe(true);
    });
  });

  describe('getByUserId', () => {
    it('should return all sessions for a user', async () => {
      const userId = sessionData.userId;

      const id1 = await store.create(sessionData);
      const id2 = await store.create({ ...sessionData, createdAt: new Date().toISOString() });

      // Create session for different user
      await store.create({ ...sessionData, userId: 'different-user' });

      const sessions = await store.getByUserId(userId);

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id).sort()).toEqual([id1, id2].sort());
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await store.getByUserId('no-sessions-user');
      expect(sessions).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      const id = await store.create(sessionData);
      const exists = await store.exists(id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await store.exists('non-existent-id');
      expect(exists).toBe(false);
    });
  });

  describe('touch', () => {
    it('should update lastAccessedAt for existing session', async () => {
      const id = await store.create(sessionData);
      const originalSession = await store.get(id);
      const originalTime = new Date(originalSession?.lastAccessedAt ?? '').getTime();

      // Wait a bit to ensure time difference
      await new Promise<void>((resolve) => { setTimeout(resolve, 100); });

      const touched = await store.touch(id);
      expect(touched).toBe(true);

      const updatedSession = await store.get(id);
      const updatedTime = new Date(updatedSession?.lastAccessedAt ?? '').getTime();

      // Check that the timestamp is actually newer
      expect(updatedTime).toBeGreaterThan(originalTime);
    });

    it('should return false for non-existent session', async () => {
      const touched = await store.touch('non-existent-id');
      expect(touched).toBe(false);
    });
  });
});
