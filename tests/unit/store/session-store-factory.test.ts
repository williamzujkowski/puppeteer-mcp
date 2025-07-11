/**
 * Session store factory tests
 * @module tests/unit/store/session-store-factory
 */

import { SessionStoreFactory } from '../../../src/store/session-store-factory.js';
import { isRedisAvailable } from '../../../src/utils/redis-client.js';

// Mock dependencies
jest.mock('../../../src/utils/redis-client.js', () => ({
  isRedisAvailable: jest.fn(),
  getRedisClient: jest.fn(),
  initializeRedis: jest.fn(),
  closeRedis: jest.fn(),
  checkRedisHealth: jest.fn().mockResolvedValue({
    available: false,
    error: 'Redis not configured for testing',
  }),
}));

jest.mock('../../../src/core/config.js', () => ({
  config: {
    SESSION_STORE_TYPE: 'auto',
    SESSION_STORE_MONITORING_ENABLED: true,
    SESSION_STORE_REPLICATION_ENABLED: false,
    SESSION_STORE_MIGRATION_ENABLED: false,
    REDIS_MAX_RETRIES: 3,
    REDIS_RETRY_DELAY: 1000,
  },
}));

describe('SessionStoreFactory', () => {
  let factory: SessionStoreFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    factory = new SessionStoreFactory();
  });

  afterEach(async () => {
    await factory.destroyAll();
  });

  describe('create', () => {
    it('should create Redis store when Redis is available and preferred', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(true);

      const result = await factory.create('test-instance', {
        preferredStore: 'redis',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.type).toBe('redis');
      expect(result.store).toBeDefined();
      expect(result.store.constructor.name).toBe('RedisSessionStore');
      expect(result.metadata.redisAvailable).toBe(true);
      expect(result.metadata.fallbackReason).toBeUndefined();
    });

    it('should create in-memory store when memory is preferred', async () => {
      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.type).toBe('memory');
      expect(result.store).toBeDefined();
      expect(result.store.constructor.name).toBe('InMemorySessionStore');
      expect(result.metadata.fallbackReason).toBeUndefined();
    });

    it('should fallback to memory store when Redis is preferred but unavailable', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'redis',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.type).toBe('memory');
      expect(result.store).toBeDefined();
      expect(result.store.constructor.name).toBe('InMemorySessionStore');
      expect(result.metadata.redisAvailable).toBe(false);
      expect(result.metadata.fallbackReason).toBeDefined();
    });

    it('should auto-select Redis store when available', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(true);

      const result = await factory.create('test-instance', {
        preferredStore: 'auto',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.type).toBe('redis');
      expect(result.store.constructor.name).toBe('RedisSessionStore');
      expect(result.metadata.fallbackReason).toBeUndefined();
    });

    it('should auto-select memory store when Redis is unavailable', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'auto',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.type).toBe('memory');
      expect(result.store.constructor.name).toBe('InMemorySessionStore');
      expect(result.metadata.fallbackReason).toBe('Redis not available');
    });

    it('should create monitoring when enabled', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      expect(result.monitor).toBeDefined();
      expect(result.monitor?.constructor.name).toBe('SessionStoreMonitor');
    });

    it('should create replication when enabled', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: true,
        enableMigration: false,
      });

      expect(result.replication).toBeDefined();
      expect(result.replication?.constructor.name).toBe('SessionReplicationManager');
    });

    it('should create migration utilities when enabled', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      expect(result.migration).toBeDefined();
      expect(result.migration?.constructor.name).toBe('SessionMigration');
    });

    it('should throw error when creating duplicate instance', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('duplicate-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await expect(
        factory.create('duplicate-instance', {
          preferredStore: 'memory',
          enableMonitoring: false,
          enableReplication: false,
          enableMigration: false,
        }),
      ).rejects.toThrow("Session store instance 'duplicate-instance' already exists");
    });

    it('should create default instance when no instanceId provided', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create();

      expect(result).toBeDefined();
      expect(result.type).toBe('memory');

      const retrieved = factory.get();
      expect(retrieved).toBe(result);
    });
  });

  describe('get', () => {
    it('should return existing instance', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const created = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      const retrieved = factory.get('test-instance');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent instance', () => {
      const retrieved = factory.get('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should return default instance when no instanceId provided', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const created = await factory.create();
      const retrieved = factory.get();

      expect(retrieved).toBe(created);
    });
  });

  describe('list', () => {
    it('should return all instances', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('instance1', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.create('instance2', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      const instances = factory.list();

      expect(instances).toHaveLength(2);
      expect(instances.map((i) => i.instanceId).sort()).toEqual(['instance1', 'instance2']);
    });

    it('should return empty array when no instances exist', () => {
      const instances = factory.list();

      expect(instances).toHaveLength(0);
    });
  });

  describe('destroy', () => {
    it('should destroy existing instance', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.destroy('test-instance');

      const retrieved = factory.get('test-instance');
      expect(retrieved).toBeUndefined();
    });

    it('should throw error when destroying non-existent instance', async () => {
      await expect(factory.destroy('non-existent')).rejects.toThrow(
        "Session store instance 'non-existent' not found",
      );
    });

    it('should clean up monitoring when destroying instance', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      if (!result.monitor) {
        throw new Error('Monitor should be defined');
      }
      const destroySpy = jest.spyOn(result.monitor, 'destroy');

      await factory.destroy('test-instance');

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should clean up replication when destroying instance', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: true,
        enableMigration: false,
      });

      if (!result.replication) {
        throw new Error('Replication should be defined');
      }
      const destroySpy = jest.spyOn(result.replication, 'destroy');

      await factory.destroy('test-instance');

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('destroyAll', () => {
    it('should destroy all instances', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('instance1', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.create('instance2', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.destroyAll();

      const instances = factory.list();
      expect(instances).toHaveLength(0);
    });
  });

  describe('migrate', () => {
    it('should migrate sessions between stores', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const fromResult = await factory.create('from-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      await factory.create('to-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      // Create test session in source store
      await fromResult.store.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const stats = await factory.migrate('from-instance', 'to-instance');

      expect(stats.totalSessions).toBe(1);
      expect(stats.migratedSessions).toBe(1);
      expect(stats.failedSessions).toBe(0);
    });

    it('should throw error when source instance not found', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('to-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      await expect(factory.migrate('non-existent', 'to-instance')).rejects.toThrow(
        "Source session store 'non-existent' not found",
      );
    });

    it('should throw error when target instance not found', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('from-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      await expect(factory.migrate('from-instance', 'non-existent')).rejects.toThrow(
        "Target session store 'non-existent' not found",
      );
    });

    it('should throw error when migration not enabled for source', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('from-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.create('to-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      await expect(factory.migrate('from-instance', 'to-instance')).rejects.toThrow(
        "Migration not enabled for source store 'from-instance'",
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all instances', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('instance1', {
        preferredStore: 'memory',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.create('instance2', {
        preferredStore: 'memory',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      const health = await factory.getHealthStatus();

      // When Redis is not available and monitoring is enabled, 
      // the health check may fail causing 'unhealthy' status
      expect(health.overall).toBe('unhealthy');
      expect(health.instances).toHaveLength(2);
      expect(health.instances[0].instanceId).toBe('instance1');
      expect(health.instances[1].instanceId).toBe('instance2');
    });

    it('should return overall degraded status when some instances are degraded', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('instance1', {
        preferredStore: 'memory',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      // Mock health check to return degraded status
      if (result.monitor) {
        jest.spyOn(result.monitor, 'performHealthCheck').mockResolvedValue({
          status: 'degraded',
          timestamp: new Date(),
          checks: {
            redis: { available: false },
            sessionStore: { available: true },
            fallback: { available: true },
          },
          metrics: {} as any,
          alerts: [],
        });
      }

      const health = await factory.getHealthStatus();

      expect(health.overall).toBe('degraded');
    });
  });

  describe('getStatus', () => {
    it('should return factory status', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(true);

      await factory.create('instance1', {
        preferredStore: 'redis',
        enableMonitoring: true,
        enableReplication: false,
        enableMigration: false,
      });

      const status = factory.getStatus();

      expect(status.instanceCount).toBe(1);
      expect(status.redisAvailable).toBe(true);
      expect(status.config.defaultStoreType).toBe('auto');
      expect(status.instances).toHaveLength(1);
      expect(status.instances[0].instanceId).toBe('instance1');
      expect(status.instances[0].type).toBe('redis');
      expect(status.instances[0].enabledFeatures).toContain('monitoring');
    });
  });

  describe('switchStoreType', () => {
    it('should switch from memory to redis when redis becomes available', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      // Mock Redis becoming available
      (isRedisAvailable as jest.Mock).mockReturnValue(true);

      await factory.switchStoreType('test-instance', 'redis');

      const instance = factory.get('test-instance');
      expect(instance?.type).toBe('redis');
      expect(instance?.store.constructor.name).toBe('RedisSessionStore');
    });

    it('should switch from redis to memory', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(true);

      await factory.create('test-instance', {
        preferredStore: 'redis',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.switchStoreType('test-instance', 'memory');

      const instance = factory.get('test-instance');
      expect(instance?.type).toBe('memory');
      expect(instance?.store.constructor.name).toBe('InMemorySessionStore');
    });

    it('should throw error when switching to redis but redis is unavailable', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await expect(factory.switchStoreType('test-instance', 'redis')).rejects.toThrow(
        'Cannot switch to Redis store: Redis not available',
      );
    });

    it('should do nothing when switching to same store type', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await factory.switchStoreType('test-instance', 'memory');

      const instance = factory.get('test-instance');
      expect(instance?.type).toBe('memory');
    });
  });

  describe('createBackup', () => {
    it('should create backup of session data', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      // Create test session
      await result.store.create({
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const backup = await factory.createBackup('test-instance');

      expect(backup.instanceId).toBe('test-instance');
      expect(backup.storeType).toBe('memory');
      expect(backup.sessionCount).toBe(1);
      expect(backup.data).toHaveLength(1);
    });

    it('should throw error when migration not enabled', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      await expect(factory.createBackup('test-instance')).rejects.toThrow(
        "Migration not enabled for store 'test-instance'",
      );
    });
  });

  describe('restoreBackup', () => {
    it('should restore sessions from backup', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      const result = await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: true,
      });

      const backup = {
        data: [
          {
            id: 'test-session',
            data: {
              userId: 'test-user',
              username: 'testuser',
              roles: ['user'],
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            lastAccessedAt: new Date().toISOString(),
          },
        ],
        sessionCount: 1,
      };

      const stats = await factory.restoreBackup('test-instance', backup);

      expect(stats.restored).toBe(1);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);

      const session = await result.store.get('test-session');
      expect(session).toBeDefined();
    });

    it('should throw error when migration not enabled', async () => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await factory.create('test-instance', {
        preferredStore: 'memory',
        enableMonitoring: false,
        enableReplication: false,
        enableMigration: false,
      });

      const backup = { data: [], sessionCount: 0 };

      await expect(factory.restoreBackup('test-instance', backup)).rejects.toThrow(
        "Migration not enabled for store 'test-instance'",
      );
    });
  });
});
