/**
 * Session validation utilities for migration operations
 * @module store/redis/migration/session-validator
 * @nist ac-3 "Access control for session validation"
 * @nist si-10 "Information input validation"
 */

import type { StoreLogger } from '../types.js';
import type { BackupSession, BackupData } from './types.js';

/**
 * Session validation service
 */
export class SessionValidator {
  private logger: StoreLogger;
  private readonly SESSION_KEY_PREFIX = 'session:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Validate session data format
   */
  validateSessionData(data: string): boolean {
    try {
      const session = JSON.parse(data);
      return Boolean(
        session &&
        typeof session.id === 'string' &&
        session.data &&
        typeof session.data.userId === 'string' &&
        typeof session.lastAccessedAt === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate session key format
   */
  validateSessionKey(key: string): boolean {
    return key.startsWith(this.SESSION_KEY_PREFIX) && key.length > this.SESSION_KEY_PREFIX.length;
  }

  /**
   * Validate backup data structure
   */
  validateBackupData(data: unknown): data is BackupData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const backup = data as Record<string, unknown>;
    
    return Boolean(
      backup.timestamp &&
      typeof backup.timestamp === 'string' &&
      backup.version &&
      typeof backup.version === 'string' &&
      Array.isArray(backup.sessions) &&
      typeof backup.sessionCount === 'number' &&
      typeof backup.preserveTTL === 'boolean'
    );
  }

  /**
   * Validate backup session entry
   */
  validateBackupSession(session: unknown): session is BackupSession {
    if (!session || typeof session !== 'object') {
      return false;
    }

    const backupSession = session as Record<string, unknown>;
    
    return Boolean(
      backupSession.key &&
      typeof backupSession.key === 'string' &&
      this.validateSessionKey(backupSession.key) &&
      backupSession.data &&
      typeof backupSession.data === 'string' &&
      (backupSession.ttl === undefined || typeof backupSession.ttl === 'number')
    );
  }

  /**
   * Validate TTL value
   */
  validateTTL(ttl: unknown): ttl is number {
    return typeof ttl === 'number' && ttl >= 0 && ttl <= 2147483647; // Max Redis TTL
  }

  /**
   * Calculate TTL from session data
   */
  calculateTTL(sessionData: string): number {
    try {
      const session = JSON.parse(sessionData);
      if (session.data?.expiresAt) {
        const ttl = Math.max(0, Math.ceil(
          (new Date(session.data.expiresAt).getTime() - Date.now()) / 1000
        ));
        return this.validateTTL(ttl) ? ttl : 0;
      }
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate TTL from session data');
    }
    return 0;
  }

  /**
   * Batch validate sessions
   */
  async validateSessions(
    sessions: unknown[],
    options: { 
      sampleSize?: number; 
      strict?: boolean;
    } = {}
  ): Promise<{
    valid: boolean;
    validCount: number;
    invalidCount: number;
    errors: string[];
  }> {
    const result = {
      valid: false,
      validCount: 0,
      invalidCount: 0,
      errors: [] as string[]
    };

    const samplesToCheck = options.sampleSize ?? sessions.length;
    const sessionsSample = sessions.slice(0, samplesToCheck);

    for (const [index, session] of sessionsSample.entries()) {
      if (!this.validateBackupSession(session)) {
        result.invalidCount++;
        result.errors.push(`Invalid session at index ${index}`);
        
        if (options.strict) {
          break;
        }
        continue;
      }

      const backupSession = session;
      if (!this.validateSessionData(backupSession.data)) {
        result.invalidCount++;
        result.errors.push(`Invalid session data for key: ${backupSession.key}`);
        
        if (options.strict) {
          break;
        }
      } else {
        result.validCount++;
      }
    }

    result.valid = options.strict 
      ? result.invalidCount === 0 
      : result.validCount > 0;

    return result;
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(sessionData: string): boolean {
    try {
      const session = JSON.parse(sessionData);
      if (session.data?.expiresAt) {
        return new Date(session.data.expiresAt) < new Date();
      }
    } catch {
      // Invalid session data is considered expired
      return true;
    }
    return false;
  }
}