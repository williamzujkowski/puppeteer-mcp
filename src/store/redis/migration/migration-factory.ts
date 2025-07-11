/**
 * Factory for creating migration strategies
 * @module store/redis/migration/migration-factory
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { StoreLogger } from '../types.js';
import { BackupStrategy } from './backup-strategy.js';
import { RestoreStrategy } from './restore-strategy.js';
import { TransferStrategy } from './transfer-strategy.js';
import { CleanupService } from './cleanup-service.js';
import { ValidationService } from './validation-service.js';

/**
 * Migration type enumeration
 */
export enum MigrationType {
  BACKUP = 'backup',
  RESTORE = 'restore',
  TRANSFER = 'transfer',
  CLEANUP = 'cleanup',
  VALIDATE = 'validate',
}

/**
 * Factory for creating migration strategies
 */
export class MigrationFactory {
  private logger: StoreLogger;

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Create backup strategy
   */
  createBackupStrategy(): BackupStrategy {
    return new BackupStrategy(this.logger);
  }

  /**
   * Create restore strategy
   */
  createRestoreStrategy(): RestoreStrategy {
    return new RestoreStrategy(this.logger);
  }

  /**
   * Create transfer strategy
   */
  createTransferStrategy(): TransferStrategy {
    return new TransferStrategy(this.logger);
  }

  /**
   * Create cleanup service
   */
  createCleanupService(): CleanupService {
    return new CleanupService(this.logger);
  }

  /**
   * Create validation service
   */
  createValidationService(): ValidationService {
    return new ValidationService(this.logger);
  }

  /**
   * Get strategy by type
   */
  getStrategy(type: MigrationType): unknown {
    switch (type) {
      case MigrationType.BACKUP:
        return this.createBackupStrategy();
      case MigrationType.RESTORE:
        return this.createRestoreStrategy();
      case MigrationType.TRANSFER:
        return this.createTransferStrategy();
      case MigrationType.CLEANUP:
        return this.createCleanupService();
      case MigrationType.VALIDATE:
        return this.createValidationService();
      default:
        throw new Error(`Unknown migration type: ${type}`);
    }
  }

  /**
   * Create all services
   */
  createAllServices(): {
    backup: BackupStrategy;
    restore: RestoreStrategy;
    transfer: TransferStrategy;
    cleanup: CleanupService;
    validation: ValidationService;
  } {
    return {
      backup: this.createBackupStrategy(),
      restore: this.createRestoreStrategy(),
      transfer: this.createTransferStrategy(),
      cleanup: this.createCleanupService(),
      validation: this.createValidationService(),
    };
  }
}
