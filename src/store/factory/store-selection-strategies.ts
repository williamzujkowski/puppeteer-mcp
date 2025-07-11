/**
 * Store selection strategies for session store factory
 * @module store/factory/store-selection-strategies
 * @nist cm-6 "Configuration settings"
 * @nist cm-7 "Least functionality"
 */

import type { SessionStore } from '../session-store.interface.js';
import { InMemorySessionStore } from '../in-memory-session-store.js';
import { RedisSessionStore } from '../redis-session-store.js';
import type { pino } from 'pino';

/**
 * Store selection result
 */
export interface StoreSelectionResult {
  store: SessionStore;
  type: 'memory' | 'redis';
  fallbackReason?: string;
}

/**
 * Store selection strategy interface
 */
export interface StoreSelectionStrategy {
  selectStore(redisAvailable: boolean, logger: pino.Logger): StoreSelectionResult;
}

/**
 * Redis store selection strategy
 */
export class RedisSelectionStrategy implements StoreSelectionStrategy {
  selectStore(redisAvailable: boolean, logger: pino.Logger): StoreSelectionResult {
    if (redisAvailable) {
      logger.info('Using Redis session store');
      return {
        store: new RedisSessionStore(logger),
        type: 'redis',
      };
    }

    logger.warn('Falling back to in-memory store: Redis not available');
    return {
      store: new InMemorySessionStore(logger),
      type: 'memory',
      fallbackReason: 'Requested redis store but Redis not available',
    };
  }
}

/**
 * Memory store selection strategy
 */
export class MemorySelectionStrategy implements StoreSelectionStrategy {
  selectStore(_redisAvailable: boolean, logger: pino.Logger): StoreSelectionResult {
    logger.info('Using in-memory session store');
    return {
      store: new InMemorySessionStore(logger),
      type: 'memory',
    };
  }
}

/**
 * Auto store selection strategy
 */
export class AutoSelectionStrategy implements StoreSelectionStrategy {
  selectStore(redisAvailable: boolean, logger: pino.Logger): StoreSelectionResult {
    if (redisAvailable) {
      logger.info('Auto-selected Redis session store');
      return {
        store: new RedisSessionStore(logger),
        type: 'redis',
      };
    }

    logger.info('Auto-selected in-memory session store (Redis not available)');
    return {
      store: new InMemorySessionStore(logger),
      type: 'memory',
      fallbackReason: 'Redis not available',
    };
  }
}

/**
 * Store selection strategy factory
 */
export class StoreSelectionStrategyFactory {
  static create(preferredStore: 'memory' | 'redis' | 'auto'): StoreSelectionStrategy {
    switch (preferredStore) {
      case 'redis':
        return new RedisSelectionStrategy();
      case 'memory':
        return new MemorySelectionStrategy();
      case 'auto':
        return new AutoSelectionStrategy();
      default:
        return new AutoSelectionStrategy();
    }
  }
}
