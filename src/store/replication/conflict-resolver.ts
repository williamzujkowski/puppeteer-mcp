/**
 * Conflict resolution for session replication
 * @module store/replication/conflict-resolver
 * @nist sc-28 "Protection of information at rest"
 */

import type { Session } from '../../types/session.js';
import type { ReplicationConfig } from './types.js';
import type { Logger } from 'pino';

/**
 * Handles conflict resolution between primary and replica sessions
 */
export class ConflictResolver {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Resolve conflicts between primary and replica sessions
   * @param primarySession - Session from primary store
   * @param replicaSession - Session from replica store
   * @param strategy - Conflict resolution strategy
   * @returns True if primary should override replica
   */
  resolve(
    primarySession: Session,
    replicaSession: Session,
    strategy: ReplicationConfig['conflictResolution'],
  ): boolean {
    switch (strategy) {
      case 'last-write-wins':
        return this.resolveByLastWrite(primarySession, replicaSession);

      case 'oldest-wins':
        return this.resolveByOldest(primarySession, replicaSession);

      case 'manual':
        return this.resolveManually(primarySession, replicaSession);

      default:
        this.logger.warn(
          { strategy },
          'Unknown conflict resolution strategy, defaulting to primary wins',
        );
        return true;
    }
  }

  /**
   * Resolve by last write wins strategy
   */
  private resolveByLastWrite(primarySession: Session, replicaSession: Session): boolean {
    const primaryLastAccessed = new Date(primarySession.lastAccessedAt);
    const replicaLastAccessed = new Date(replicaSession.lastAccessedAt);

    this.logger.debug(
      {
        sessionId: primarySession.id,
        primaryLastAccessed,
        replicaLastAccessed,
        resolution: primaryLastAccessed > replicaLastAccessed ? 'primary' : 'replica',
      },
      'Resolving conflict by last-write-wins',
    );

    return primaryLastAccessed > replicaLastAccessed;
  }

  /**
   * Resolve by oldest wins strategy
   */
  private resolveByOldest(primarySession: Session, replicaSession: Session): boolean {
    const primaryCreated = new Date(primarySession.data.createdAt);
    const replicaCreated = new Date(replicaSession.data.createdAt);

    this.logger.debug(
      {
        sessionId: primarySession.id,
        primaryCreated,
        replicaCreated,
        resolution: primaryCreated < replicaCreated ? 'primary' : 'replica',
      },
      'Resolving conflict by oldest-wins',
    );

    return primaryCreated < replicaCreated;
  }

  /**
   * Handle manual conflict resolution
   * In production, this would queue conflicts for manual review
   */
  private resolveManually(primarySession: Session, replicaSession: Session): boolean {
    this.logger.warn(
      {
        sessionId: primarySession.id,
        primaryLastAccessed: primarySession.lastAccessedAt,
        replicaLastAccessed: replicaSession.lastAccessedAt,
        primaryData: primarySession.data,
        replicaData: replicaSession.data,
      },
      'Manual conflict resolution required',
    );

    // In manual mode, we don't update automatically
    return false;
  }

  /**
   * Check if sessions have conflicting data
   */
  hasConflict(primarySession: Session, replicaSession: Session): boolean {
    // Sessions conflict if they have different data
    return (
      primarySession.data.userId !== replicaSession.data.userId ||
      primarySession.data.username !== replicaSession.data.username ||
      JSON.stringify(primarySession.data.roles) !== JSON.stringify(replicaSession.data.roles) ||
      primarySession.lastAccessedAt !== replicaSession.lastAccessedAt
    );
  }

  /**
   * Generate conflict report
   */
  generateConflictReport(
    primarySession: Session,
    replicaSession: Session,
  ): {
    sessionId: string;
    differences: Array<{
      field: string;
      primary: unknown;
      replica: unknown;
    }>;
  } {
    const differences: Array<{
      field: string;
      primary: unknown;
      replica: unknown;
    }> = [];

    if (primarySession.data.userId !== replicaSession.data.userId) {
      differences.push({
        field: 'userId',
        primary: primarySession.data.userId,
        replica: replicaSession.data.userId,
      });
    }

    if (primarySession.data.username !== replicaSession.data.username) {
      differences.push({
        field: 'username',
        primary: primarySession.data.username,
        replica: replicaSession.data.username,
      });
    }

    if (JSON.stringify(primarySession.data.roles) !== JSON.stringify(replicaSession.data.roles)) {
      differences.push({
        field: 'roles',
        primary: primarySession.data.roles,
        replica: replicaSession.data.roles,
      });
    }

    if (primarySession.lastAccessedAt !== replicaSession.lastAccessedAt) {
      differences.push({
        field: 'lastAccessedAt',
        primary: primarySession.lastAccessedAt,
        replica: replicaSession.lastAccessedAt,
      });
    }

    return {
      sessionId: primarySession.id,
      differences,
    };
  }
}
