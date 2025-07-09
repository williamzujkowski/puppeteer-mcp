/**
 * Transport layer for session replication
 * @module store/replication/replication-transport
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { Session, SessionData } from '../../types/session.js';
import type { Logger } from 'pino';

interface SessionOperationParams {
  store: SessionStore;
  sessionId: string;
  maxRetries: number;
  retryDelay: number;
}

interface UpdateSessionParams extends SessionOperationParams {
  sessionData: SessionData;
}

/**
 * Handles retry logic and transport operations
 */
export class ReplicationTransport {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error = new Error('No operation executed');
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.debug(
          { attempt, maxRetries, delay, error: lastError.message },
          'Retrying operation after delay'
        );
        
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Create session with retry
   */
  async createSession(
    store: SessionStore,
    sessionData: SessionData,
    maxRetries: number,
    retryDelay: number
  ): Promise<string> {
    return this.retryOperation(
      () => store.create(sessionData),
      maxRetries,
      retryDelay
    );
  }

  /**
   * Update session with retry
   */
  async updateSession(params: UpdateSessionParams): Promise<void> {
    const { store, sessionId, sessionData, maxRetries, retryDelay } = params;
    await this.retryOperation(
      () => store.update(sessionId, sessionData),
      maxRetries,
      retryDelay
    );
  }

  /**
   * Delete session with retry
   */
  async deleteSession(
    store: SessionStore,
    sessionId: string,
    maxRetries: number,
    retryDelay: number
  ): Promise<void> {
    await this.retryOperation(
      () => store.delete(sessionId),
      maxRetries,
      retryDelay
    );
  }

  /**
   * Touch session with retry
   */
  async touchSession(
    store: SessionStore,
    sessionId: string,
    maxRetries: number,
    retryDelay: number
  ): Promise<void> {
    await this.retryOperation(
      () => store.touch(sessionId),
      maxRetries,
      retryDelay
    );
  }

  /**
   * Get session with retry
   */
  async getSession(
    store: SessionStore,
    sessionId: string,
    maxRetries: number,
    retryDelay: number
  ): Promise<Session | null> {
    return this.retryOperation(
      () => store.get(sessionId),
      maxRetries,
      retryDelay
    );
  }

  /**
   * Get all sessions from a store
   * This method handles different store types
   */
  async getAllSessions(store: SessionStore): Promise<Session[]> {
    const storeName = store.constructor.name;
    
    try {
      if (storeName === 'InMemorySessionStore') {
        return await Promise.resolve(this.getAllSessionsFromInMemory(store));
      } else if (storeName === 'RedisSessionStore') {
        return this.getAllSessionsFromRedis(store);
      } else {
        this.logger.warn(
          { storeName },
          'Unknown store type for getAllSessions, returning empty array'
        );
        return [];
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), storeName },
        'Failed to get all sessions from store'
      );
      throw error;
    }
  }

  /**
   * Get all sessions from in-memory store
   */
  private getAllSessionsFromInMemory(store: SessionStore): Session[] {
    const sessions: Session[] = [];
    const inMemoryStore = store as unknown as { sessions?: Map<string, Session> };
    
    if (inMemoryStore.sessions instanceof Map) {
      for (const session of inMemoryStore.sessions.values()) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Get all sessions from Redis store
   */
  private async getAllSessionsFromRedis(store: SessionStore): Promise<Session[]> {
    interface RedisStoreInterface {
      getStore?: () => { redis?: boolean; client?: { keys: (pattern: string) => Promise<string[]> } };
      SESSION_KEY_PREFIX?: string;
    }
    
    const sessions: Session[] = [];
    const redisStore = store as unknown as RedisStoreInterface;
    
    if (redisStore.getStore === undefined || redisStore.SESSION_KEY_PREFIX === undefined) {
      return sessions;
    }
    
    const storeInfo = redisStore.getStore();
    if (storeInfo.redis !== true || storeInfo.client === undefined) {
      return sessions;
    }
    
    const sessionKeys = await storeInfo.client.keys(`${redisStore.SESSION_KEY_PREFIX}*`);
    
    for (const key of sessionKeys) {
      const sessionId = key.replace(redisStore.SESSION_KEY_PREFIX, '');
      const session = await store.get(sessionId);
      if (session !== null) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Batch operation wrapper
   */
  async batchOperation<T>(
    items: T[],
    batchSize: number,
    operation: (batch: T[]) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await operation(batch);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}