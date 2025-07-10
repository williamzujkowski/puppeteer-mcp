/**
 * Validation service for backup files and migrations
 * @module store/redis/migration/validation-service
 * @nist si-10 "Information input validation"
 * @nist si-11 "Error handling"
 */

import { readFile } from 'fs/promises';
import type { StoreLogger } from '../types.js';
import type { BackupValidationResult, BackupData } from './types.js';
import { SessionValidator } from './session-validator.js';

/**
 * Validation options
 */
export interface ValidationOptions {
  sampleSize?: number;
  strict?: boolean;
  checkExpiry?: boolean;
}

/**
 * Service for validating backup files and session data
 */
export class ValidationService {
  private logger: StoreLogger;
  private validator: SessionValidator;

  constructor(logger: StoreLogger) {
    this.logger = logger;
    this.validator = new SessionValidator(logger);
  }

  /**
   * Validate backup file
   */
  async validateBackupFile(
    backupPath: string,
    options: ValidationOptions = {}
  ): Promise<BackupValidationResult> {
    const result: BackupValidationResult = {
      valid: false,
      errors: []
    };

    try {
      // Read and parse backup file
      const backupContent = await readFile(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Validate structure
      const structureValidation = this.validateBackupStructure(backupData);
      if (!structureValidation.valid) {
        result.errors.push(...structureValidation.errors);
        return result;
      }

      // Safe to cast after validation
      const validBackup = backupData as BackupData;

      // Validate sessions
      const sessionValidation = await this.validator.validateSessions(
        validBackup.sessions,
        {
          sampleSize: options.sampleSize,
          strict: options.strict
        }
      );

      if (!sessionValidation.valid) {
        result.errors.push(...sessionValidation.errors);
      }

      // Check for expired sessions if requested
      if (options.checkExpiry) {
        const expiryCheck = this.checkExpiredSessions(validBackup.sessions);
        if (expiryCheck.expiredCount > 0) {
          result.errors.push(
            `Found ${expiryCheck.expiredCount} expired sessions out of ${expiryCheck.checkedCount} checked`
          );
        }
      }

      result.valid = result.errors.length === 0;
      
      if (result.valid) {
        return {
          ...result,
          version: validBackup.version,
          sessionCount: validBackup.sessionCount,
          timestamp: validBackup.timestamp
        };
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Backup validation failed: ${errorMessage}`);
      this.logger.error({ error, backupPath }, 'Failed to validate backup file');
      return result;
    }
  }

  /**
   * Validate backup structure
   */
  private validateBackupStructure(data: unknown): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.validator.validateBackupData(data)) {
      errors.push('Invalid backup data structure');
      
      // Provide specific errors
      if (!data || typeof data !== 'object') {
        errors.push('Backup data must be an object');
      } else {
        const backup = data as Record<string, unknown>;
        
        if (!backup.timestamp) {
          errors.push('Missing timestamp field');
        }
        if (!backup.version) {
          errors.push('Missing version field');
        }
        if (!Array.isArray(backup.sessions)) {
          errors.push('Sessions must be an array');
        }
        if (typeof backup.sessionCount !== 'number') {
          errors.push('Session count must be a number');
        }
        if (typeof backup.preserveTTL !== 'boolean') {
          errors.push('PreserveTTL must be a boolean');
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check for expired sessions
   */
  private checkExpiredSessions(
    sessions: unknown[]
  ): {
    checkedCount: number;
    expiredCount: number;
  } {
    let checkedCount = 0;
    let expiredCount = 0;

    for (const session of sessions) {
      if (this.validator.validateBackupSession(session)) {
        checkedCount++;
        const backupSession = session as { data: string };
        if (this.validator.isSessionExpired(backupSession.data)) {
          expiredCount++;
        }
      }
    }

    return { checkedCount, expiredCount };
  }

  /**
   * Compare two backup files
   */
  async compareBackups(
    backupPath1: string,
    backupPath2: string
  ): Promise<{
    identical: boolean;
    differences: {
      sessionCount?: { file1: number; file2: number };
      timestamp?: { file1: string; file2: string };
      version?: { file1: string; file2: string };
      preserveTTL?: { file1: boolean; file2: boolean };
    };
  }> {
    try {
      const [backup1, backup2] = await Promise.all([
        this.loadBackupData(backupPath1),
        this.loadBackupData(backupPath2)
      ]);

      const differences: any = {};
      let identical = true;

      // Compare metadata
      if (backup1.sessionCount !== backup2.sessionCount) {
        identical = false;
        differences.sessionCount = {
          file1: backup1.sessionCount,
          file2: backup2.sessionCount
        };
      }

      if (backup1.timestamp !== backup2.timestamp) {
        identical = false;
        differences.timestamp = {
          file1: backup1.timestamp,
          file2: backup2.timestamp
        };
      }

      if (backup1.version !== backup2.version) {
        identical = false;
        differences.version = {
          file1: backup1.version,
          file2: backup2.version
        };
      }

      if (backup1.preserveTTL !== backup2.preserveTTL) {
        identical = false;
        differences.preserveTTL = {
          file1: backup1.preserveTTL,
          file2: backup2.preserveTTL
        };
      }

      return { identical, differences };

    } catch (error) {
      this.logger.error({ error }, 'Failed to compare backup files');
      throw error;
    }
  }

  /**
   * Load and validate backup data
   */
  private async loadBackupData(backupPath: string): Promise<BackupData> {
    const backupContent = await readFile(backupPath, 'utf8');
    const backupData = JSON.parse(backupContent);
    
    if (!this.validator.validateBackupData(backupData)) {
      throw new Error(`Invalid backup file: ${backupPath}`);
    }
    
    return backupData as BackupData;
  }
}