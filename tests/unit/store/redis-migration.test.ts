/**
 * Redis migration tests
 * @module tests/unit/store/redis-migration
 */

import { RedisMigrationManager } from '../../../src/store/redis/redis-migration.js';
import { MigrationManager } from '../../../src/store/redis/migration/index.js';
import type { StoreLogger } from '../../../src/store/redis/types.js';

describe('Redis Migration Compatibility', () => {
  const mockLogger: StoreLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  describe('RedisMigrationManager', () => {
    it('should be instance of MigrationManager', () => {
      const manager = new RedisMigrationManager(mockLogger);
      expect(manager).toBeInstanceOf(MigrationManager);
    });

    it('should have all required methods', () => {
      const manager = new RedisMigrationManager(mockLogger);
      
      // Check main methods exist
      expect(typeof manager.backupSessions).toBe('function');
      expect(typeof manager.restoreSessions).toBe('function');
      expect(typeof manager.migrateSessions).toBe('function');
      expect(typeof manager.cleanupExpiredSessions).toBe('function');
      expect(typeof manager.validateBackup).toBe('function');
      expect(typeof manager.getSessionStatistics).toBe('function');
      expect(typeof manager.compareBackups).toBe('function');
      expect(typeof manager.backupAndValidate).toBe('function');
      expect(typeof manager.fullMigration).toBe('function');
    });

    it('should create factory with all strategies', () => {
      const manager = new RedisMigrationManager(mockLogger);
      const factory = manager.getFactory();
      
      // Test factory can create all strategies
      expect(factory.createBackupStrategy()).toBeDefined();
      expect(factory.createRestoreStrategy()).toBeDefined();
      expect(factory.createTransferStrategy()).toBeDefined();
      expect(factory.createCleanupService()).toBeDefined();
      expect(factory.createValidationService()).toBeDefined();
    });
  });

  describe('Module exports', () => {
    it('should export all required types and classes', () => {
      // Import to verify exports work
      const {
        MigrationManager: MM,
        MigrationFactory,
        MigrationType,
        BackupStrategy,
        RestoreStrategy,
        TransferStrategy,
        CleanupService,
        ValidationService,
        SessionValidator,
        BaseMigration
      } = require('../../../src/store/redis/redis-migration.js');

      expect(MM).toBeDefined();
      expect(MigrationFactory).toBeDefined();
      expect(MigrationType).toBeDefined();
      expect(BackupStrategy).toBeDefined();
      expect(RestoreStrategy).toBeDefined();
      expect(TransferStrategy).toBeDefined();
      expect(CleanupService).toBeDefined();
      expect(ValidationService).toBeDefined();
      expect(SessionValidator).toBeDefined();
      expect(BaseMigration).toBeDefined();
    });
  });
});