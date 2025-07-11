/**
 * Utility functions for session migration
 * @module store/migration/migration-utils
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { pino } from 'pino';

/**
 * Get all sessions from a store
 * This is a utility method since SessionStore interface doesn't have a getAll method
 */
export async function getAllSessions(store: SessionStore, logger: pino.Logger): Promise<Session[]> {
  const storeType = store.constructor.name;

  if (storeType === 'InMemorySessionStore') {
    return getAllSessionsFromInMemory(store);
  } else if (storeType === 'RedisSessionStore') {
    return getAllSessionsFromRedis(store, logger);
  }

  // For unknown store types, return empty array
  logger.warn({ storeType }, 'Unknown store type, cannot migrate');
  return [];
}

/**
 * Get all sessions from in-memory store
 */
function getAllSessionsFromInMemory(store: SessionStore): Session[] {
  const sessions: Session[] = [];

  // Type assertion for accessing internal structure
  const inMemoryStore = store as unknown as {
    sessions?: Map<string, Session>;
  };

  if (inMemoryStore.sessions && inMemoryStore.sessions instanceof Map) {
    for (const [, session] of inMemoryStore.sessions) {
      sessions.push(session);
    }
  }

  return sessions;
}

/**
 * Get all sessions from Redis store
 */
async function getAllSessionsFromRedis(
  store: SessionStore,
  logger: pino.Logger,
): Promise<Session[]> {
  const sessions: Session[] = [];

  try {
    // Type assertion for accessing internal structure
    const redisStore = store as unknown as {
      getStore: () => {
        redis?: unknown;
        client?: { keys: (pattern: string) => Promise<string[]> };
      };
      SESSION_KEY_PREFIX?: string;
    };

    // Get the Redis client from the store
    const storeData = redisStore.getStore();

    if (storeData?.redis !== undefined && storeData?.client !== undefined) {
      const keyPrefix = redisStore.SESSION_KEY_PREFIX ?? 'session:';

      // Scan for all session keys
      const sessionKeys = await storeData.client.keys(`${keyPrefix}*`);

      for (const key of sessionKeys) {
        const sessionId = key.replace(keyPrefix, '');
        const session = await store.get(sessionId);

        if (session) {
          sessions.push(session);
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get sessions from Redis store');
  }

  return sessions;
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: Session): boolean {
  return Boolean(session?.data?.expiresAt && new Date(session.data.expiresAt) < new Date());
}

/**
 * Validate session structure
 */
export function isValidSessionStructure(session: Session): boolean {
  return Boolean(session?.id && session?.data);
}

/**
 * Filter expired sessions from array
 */
export function filterExpiredSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => !isSessionExpired(session));
}

/**
 * Filter sessions by custom filter function
 */
export function filterSessionsByCustomFilter(
  sessions: Session[],
  filter: (session: Session) => boolean,
): Session[] {
  return sessions.filter(filter);
}

/**
 * Create error message from unknown error
 */
export function createErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Create session ID set from session array
 */
export function createSessionIdSet(sessions: Session[]): Set<string> {
  return new Set(sessions.map((session) => session.id));
}

/**
 * Find missing sessions between two sets
 */
export function findMissingSessions(sourceIds: Set<string>, targetIds: Set<string>): string[] {
  return Array.from(sourceIds).filter((id) => !targetIds.has(id));
}

/**
 * Find extra sessions in target that aren't in source
 */
export function findExtraSessions(sourceIds: Set<string>, targetIds: Set<string>): string[] {
  return Array.from(targetIds).filter((id) => !sourceIds.has(id));
}
