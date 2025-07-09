/**
 * Shared types and interfaces for Redis session store
 * @module store/redis/types
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 */

import type { Session, SessionData } from '../../types/session.js';

/**
 * Redis connection result with client info
 */
export interface RedisStoreInfo {
  redis: boolean;
  client: RedisClient | FallbackStore;
}

/**
 * Basic Redis client interface
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  expire(key: string, ttl: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ping(): Promise<string>;
  pipeline(): Pipeline;
}

/**
 * Redis pipeline interface
 */
export interface Pipeline {
  setex(key: string, ttl: number, value: string): Pipeline;
  sadd(key: string, ...members: string[]): Pipeline;
  srem(key: string, ...members: string[]): Pipeline;
  expire(key: string, ttl: number): Pipeline;
  del(...keys: string[]): Pipeline;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

/**
 * Fallback store interface (matches SessionStore methods)
 */
export interface FallbackStore {
  create(data: SessionData): Promise<string>;
  get(id: string): Promise<Session | null>;
  update(id: string, data: Partial<SessionData>): Promise<Session | null>;
  delete(id: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
  getByUserId(userId: string): Promise<Session[]>;
  exists(id: string): Promise<boolean>;
  touch(id: string): Promise<boolean>;
  clear(): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Session serialization format
 */
export interface SerializedSession {
  id: string;
  data: SessionData;
  lastAccessedAt: string;
}

/**
 * Redis health check result
 */
export interface RedisHealthResult {
  available: boolean;
  latency?: number;
  error?: string;
}

/**
 * Complete health check result
 */
export interface HealthCheckResult {
  redis: RedisHealthResult;
  fallback: { available: boolean };
}

/**
 * Redis performance metrics
 */
export interface RedisMetrics {
  operationsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  memoryUsage: number;
  connectionCount: number;
  lastUpdated: string;
}

/**
 * Migration/backup configuration
 */
export interface MigrationConfig {
  sourceRedisUrl?: string;
  targetRedisUrl?: string;
  batchSize: number;
  backupPath?: string;
  preserveTTL: boolean;
}

/**
 * Logger interface to ensure consistent logging
 */
export interface StoreLogger {
  info(obj: any, msg?: string): void;
  warn(obj: any, msg?: string): void;
  error(obj: any, msg?: string): void;
  debug(obj: any, msg?: string): void;
}

/**
 * Redis operation context for tracking
 */
export interface OperationContext {
  sessionId?: string;
  userId?: string;
  operation: string;
  timestamp: string;
  store: 'redis' | 'memory';
}

/**
 * Session indexing query options
 */
export interface SessionQuery {
  userId?: string;
  pattern?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'lastAccessedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}