/**
 * Session migration tests
 * @module tests/unit/store/session-migration
 */

import { SessionMigration } from '../../../src/store/session-migration.js';
import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import type { SessionData, Session } from '../../../src/types/session.js';

describe('SessionMigration', () => {
  let migration: SessionMigration;
  let sourceStore: InMemorySessionStore;
  let targetStore: InMemorySessionStore;
  let sessionData: SessionData;

  beforeEach(() => {
    migration = new SessionMigration();
    sourceStore = new InMemorySessionStore();
    targetStore = new InMemorySessionStore();
    
    sessionData = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      roles: ['user'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  });

  afterEach(async () => {
    await sourceStore.destroy();
    await targetStore.destroy();
  });

  describe('migrate', () => {
    it('should migrate all sessions from source to target', async () => {
      // Create test sessions in source store
      await sourceStore.create(sessionData);
      await sourceStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      const stats = await migration.migrate(sourceStore, targetStore);

      expect(stats.totalSessions).toBe(2);
      expect(stats.migratedSessions).toBe(2);
      expect(stats.failedSessions).toBe(0);
      expect(stats.skippedSessions).toBe(0);
      expect(stats.errors).toHaveLength(0);

      // Verify sessions exist in target store
      const migratedSession1 = await targetStore.get(id1);
      const migratedSession2 = await targetStore.get(id2);
      
      expect(migratedSession1).toBeDefined();
      expect(migratedSession2).toBeDefined();
      expect(migratedSession1?.data.username).toBe('testuser');
      expect(migratedSession2?.data.username).toBe('user2');
    });

    it('should skip existing sessions when skipExisting is true', async () => {
      // Create session in source store
      await sourceStore.create(sessionData);
      
      // Create same session in target store
      await targetStore.create(sessionData);

      const stats = await migration.migrate(sourceStore, targetStore, {
        skipExisting: true
      });

      expect(stats.totalSessions).toBe(1);
      expect(stats.migratedSessions).toBe(0);
      expect(stats.skippedSessions).toBe(1);
      expect(stats.failedSessions).toBe(0);
    });

    it('should delete from source after migration when deleteAfterMigration is true', async () => {
      // Create session in source store
      const id = await sourceStore.create(sessionData);

      const stats = await migration.migrate(sourceStore, targetStore, {
        deleteAfterMigration: true
      });

      expect(stats.migratedSessions).toBe(1);
      
      // Session should be deleted from source
      const sourceSession = await sourceStore.get(id);
      expect(sourceSession).toBeNull();
      
      // Session should exist in target
      const targetSession = await targetStore.get(id);
      expect(targetSession).toBeDefined();
    });

    it('should skip expired sessions', async () => {
      // Create expired session
      const expiredData: SessionData = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      await sourceStore.create(expiredData);

      const stats = await migration.migrate(sourceStore, targetStore);

      expect(stats.totalSessions).toBe(1);
      expect(stats.migratedSessions).toBe(0);
      expect(stats.skippedSessions).toBe(1);
    });

    it('should apply filter function when provided', async () => {
      // Create sessions with different roles
      await sourceStore.create({ ...sessionData, roles: ['user'] });
      await sourceStore.create({ ...sessionData, userId: 'admin', username: 'admin', roles: ['admin'] });

      const stats = await migration.migrate(sourceStore, targetStore, {
        filter: (session: Session) => session.data.roles.includes('admin')
      });

      expect(stats.totalSessions).toBe(2);
      expect(stats.migratedSessions).toBe(1);
    });

    it('should process sessions in batches', async () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        await sourceStore.create({
          ...sessionData,
          userId: `user${i}`,
          username: `user${i}`
        });
      }

      const stats = await migration.migrate(sourceStore, targetStore, {
        batchSize: 2
      });

      expect(stats.totalSessions).toBe(5);
      expect(stats.migratedSessions).toBe(5);
    });

    it('should call progress callback if provided', async () => {
      const progressCallback = jest.fn();
      
      await sourceStore.create(sessionData);

      await migration.migrate(sourceStore, targetStore, {
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledWith(1, 1);
    });

    it('should handle errors gracefully when continueOnError is true', async () => {
      // Create a session
      await sourceStore.create(sessionData);

      // Mock target store to throw error
      const originalCreate = targetStore.create;
      targetStore.create = jest.fn().mockRejectedValue(new Error('Target store error'));

      const stats = await migration.migrate(sourceStore, targetStore, {
        continueOnError: true
      });

      expect(stats.totalSessions).toBe(1);
      expect(stats.migratedSessions).toBe(0);
      expect(stats.failedSessions).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].error).toBe('Target store error');

      // Restore original method
      targetStore.create = originalCreate;
    });

    it('should throw error when continueOnError is false', async () => {
      await sourceStore.create(sessionData);

      // Mock target store to throw error
      targetStore.create = jest.fn().mockRejectedValue(new Error('Target store error'));

      await expect(migration.migrate(sourceStore, targetStore, {
        continueOnError: false
      })).rejects.toThrow('Target store error');
    });

    it('should handle empty source store', async () => {
      const stats = await migration.migrate(sourceStore, targetStore);

      expect(stats.totalSessions).toBe(0);
      expect(stats.migratedSessions).toBe(0);
      expect(stats.failedSessions).toBe(0);
      expect(stats.skippedSessions).toBe(0);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });

  describe('validateMigration', () => {
    it('should validate successful migration', async () => {
      // Create sessions in both stores
      await sourceStore.create(sessionData);
      await sourceStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      await targetStore.create(sessionData);
      await targetStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      const validation = await migration.validateMigration(sourceStore, targetStore);

      expect(validation.valid).toBe(true);
      expect(validation.sourceSessions).toBe(2);
      expect(validation.targetSessions).toBe(2);
      expect(validation.missingSessions).toHaveLength(0);
      expect(validation.extraSessions).toHaveLength(0);
    });

    it('should detect missing sessions in target', async () => {
      await sourceStore.create(sessionData);
      await sourceStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      // Only migrate one session
      await targetStore.create(sessionData);

      const validation = await migration.validateMigration(sourceStore, targetStore);

      expect(validation.valid).toBe(false);
      expect(validation.sourceSessions).toBe(2);
      expect(validation.targetSessions).toBe(1);
      expect(validation.missingSessions).toHaveLength(1);
      expect(validation.extraSessions).toHaveLength(0);
    });

    it('should detect extra sessions in target', async () => {
      await sourceStore.create(sessionData);

      await targetStore.create(sessionData);
      await targetStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      const validation = await migration.validateMigration(sourceStore, targetStore);

      expect(validation.valid).toBe(false);
      expect(validation.sourceSessions).toBe(1);
      expect(validation.targetSessions).toBe(2);
      expect(validation.missingSessions).toHaveLength(0);
      expect(validation.extraSessions).toHaveLength(1);
    });

    it('should filter expired sessions when checkExpired is true', async () => {
      const expiredData: SessionData = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      await sourceStore.create(expiredData);
      await targetStore.create(expiredData);

      const validation = await migration.validateMigration(sourceStore, targetStore, {
        checkExpired: true
      });

      expect(validation.valid).toBe(true);
      expect(validation.sourceSessions).toBe(0);
      expect(validation.targetSessions).toBe(0);
    });
  });

  describe('backup', () => {
    it('should create backup of all sessions', async () => {
      await sourceStore.create(sessionData);
      await sourceStore.create({ ...sessionData, userId: 'user2', username: 'user2' });

      const backup = await migration.backup(sourceStore);

      expect(backup).toHaveLength(2);
      expect(backup[0].data.username).toBe('testuser');
      expect(backup[1].data.username).toBe('user2');
    });

    it('should exclude expired sessions when includeExpired is false', async () => {
      await sourceStore.create(sessionData);
      
      const expiredData: SessionData = {
        ...sessionData,
        userId: 'expired-user',
        username: 'expired-user',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };
      await sourceStore.create(expiredData);

      const backup = await migration.backup(sourceStore, {
        includeExpired: false
      });

      expect(backup).toHaveLength(1);
      expect(backup[0].data.username).toBe('testuser');
    });

    it('should apply filter function when provided', async () => {
      await sourceStore.create({ ...sessionData, roles: ['user'] });
      await sourceStore.create({ ...sessionData, userId: 'admin', username: 'admin', roles: ['admin'] });

      const backup = await migration.backup(sourceStore, {
        filter: (session: Session) => session.data.roles.includes('admin')
      });

      expect(backup).toHaveLength(1);
      expect(backup[0].data.username).toBe('admin');
    });

    it('should return empty array for empty store', async () => {
      const backup = await migration.backup(sourceStore);

      expect(backup).toHaveLength(0);
    });
  });

  describe('restore', () => {
    it('should restore sessions from backup', async () => {
      const sessions = [
        {
          id: 'session1',
          data: sessionData,
          lastAccessedAt: new Date().toISOString()
        },
        {
          id: 'session2',
          data: { ...sessionData, userId: 'user2', username: 'user2' },
          lastAccessedAt: new Date().toISOString()
        }
      ];

      const stats = await migration.restore(targetStore, sessions);

      expect(stats.restored).toBe(2);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);

      const session1 = await targetStore.get('session1');
      const session2 = await targetStore.get('session2');

      expect(session1).toBeDefined();
      expect(session2).toBeDefined();
    });

    it('should skip existing sessions when overwrite is false', async () => {
      // Create existing session
      await targetStore.create(sessionData);

      const sessions = [
        {
          id: 'existing-session',
          data: sessionData,
          lastAccessedAt: new Date().toISOString()
        }
      ];

      const stats = await migration.restore(targetStore, sessions, {
        overwrite: false
      });

      expect(stats.restored).toBe(0);
      expect(stats.skipped).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should overwrite existing sessions when overwrite is true', async () => {
      // Create existing session
      const existingId = await targetStore.create(sessionData);

      const sessions = [
        {
          id: existingId,
          data: { ...sessionData, roles: ['admin'] },
          lastAccessedAt: new Date().toISOString()
        }
      ];

      const stats = await migration.restore(targetStore, sessions, {
        overwrite: true
      });

      expect(stats.restored).toBe(1);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);

      const updatedSession = await targetStore.get(existingId);
      expect(updatedSession?.data.roles).toEqual(['admin']);
    });

    it('should skip expired sessions when skipExpired is true', async () => {
      const expiredSession = {
        id: 'expired-session',
        data: {
          ...sessionData,
          expiresAt: new Date(Date.now() - 1000).toISOString()
        },
        lastAccessedAt: new Date().toISOString()
      };

      const stats = await migration.restore(targetStore, [expiredSession], {
        skipExpired: true
      });

      expect(stats.restored).toBe(0);
      expect(stats.skipped).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should call progress callback if provided', async () => {
      const progressCallback = jest.fn();
      
      const sessions = [
        {
          id: 'session1',
          data: sessionData,
          lastAccessedAt: new Date().toISOString()
        }
      ];

      await migration.restore(targetStore, sessions, {
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledWith(1, 1);
    });

    it('should handle restore errors gracefully', async () => {
      const sessions = [
        {
          id: 'failing-session',
          data: sessionData,
          lastAccessedAt: new Date().toISOString()
        }
      ];

      // Mock target store to throw error
      const originalCreate = targetStore.create;
      targetStore.create = jest.fn().mockRejectedValue(new Error('Restore error'));

      const stats = await migration.restore(targetStore, sessions);

      expect(stats.restored).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].error).toBe('Restore error');

      // Restore original method
      targetStore.create = originalCreate;
    });

    it('should restore empty backup without errors', async () => {
      const stats = await migration.restore(targetStore, []);

      expect(stats.restored).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.errors).toHaveLength(0);
    });
  });
});