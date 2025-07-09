/**
 * Migration validation and verification functionality
 * @module store/migration/migration-validator
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { 
  SessionValidationResult, 
  RestoreStrategy, 
  RestoreCommand, 
  RestoreOptions,
  ValidationOptions,
  ValidationResult
} from './types.js';
import { getAllSessions, isSessionExpired, isValidSessionStructure, createSessionIdSet, findMissingSessions, findExtraSessions, filterExpiredSessions } from './migration-utils.js';
import { MigrationMetrics } from './migration-metrics.js';

/**
 * Migration validator class
 */
export class MigrationValidator {
  private logger: pino.Logger;
  private metrics: MigrationMetrics;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    this.metrics = new MigrationMetrics(logger);
  }

  /**
   * Validate that two stores contain the same sessions
   */
  async validateMigration(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const { checkExpired = false } = options;
    
    this.metrics.logValidationStart();

    const sourceSessions = await getAllSessions(sourceStore, this.logger);
    const targetSessions = await getAllSessions(targetStore, this.logger);
    
    // Filter out expired sessions if requested
    const activeSourceSessions = checkExpired 
      ? filterExpiredSessions(sourceSessions)
      : sourceSessions;
    
    const activeTargetSessions = checkExpired
      ? filterExpiredSessions(targetSessions)
      : targetSessions;

    const sourceIds = createSessionIdSet(activeSourceSessions);
    const targetIds = createSessionIdSet(activeTargetSessions);

    const missingSessions = findMissingSessions(sourceIds, targetIds);
    const extraSessions = findExtraSessions(sourceIds, targetIds);

    const valid = missingSessions.length === 0 && extraSessions.length === 0;

    const result: ValidationResult = {
      valid,
      sourceSessions: activeSourceSessions.length,
      targetSessions: activeTargetSessions.length,
      missingSessions,
      extraSessions
    };

    this.metrics.logValidationCompletion(result);

    return result;
  }
}

/**
 * Standard restore strategy implementation
 */
export class StandardRestoreStrategy implements RestoreStrategy {
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Validate session for restore operation
   */
  async validate(
    session: Session, 
    store: SessionStore, 
    options: RestoreOptions
  ): Promise<SessionValidationResult> {
    // Validate session structure
    if (!isValidSessionStructure(session)) {
      return {
        isValid: false,
        isExpired: false,
        exists: false,
        shouldSkip: true,
        reason: 'Invalid session structure'
      };
    }

    // Check if session is expired
    const isExpired = isSessionExpired(session);
    if (options.skipExpired === true && isExpired) {
      return {
        isValid: true,
        isExpired: true,
        exists: false,
        shouldSkip: true,
        reason: 'Session expired'
      };
    }

    // Check if session exists in store
    const exists = await store.exists(session.id);
    if (exists && options.overwrite !== true) {
      return {
        isValid: true,
        isExpired,
        exists: true,
        shouldSkip: true,
        reason: 'Session exists and overwrite disabled'
      };
    }

    return {
      isValid: true,
      isExpired,
      exists,
      shouldSkip: false
    };
  }

  /**
   * Execute restore command
   */
  async execute(command: RestoreCommand, store: SessionStore): Promise<void> {
    const { session, operation } = command;

    switch (operation) {
      case 'create':
        await store.create(session.data);
        break;
      case 'update':
        await store.update(session.id, session.data);
        break;
      case 'skip':
        // No operation needed for skip
        break;
      default:
        throw new Error(`Unknown restore operation: ${String(operation)}`);
    }
  }
}