/**
 * Redis session store module exports
 * @module store/redis
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 * @nist ac-12 "Session termination"
 */

// Main store class
export { RedisSessionStore } from './redis-session-store.js';

// Core components
export { RedisClientManager } from './redis-client.js';
export { SessionSerializer } from './session-serializer.js';
export { SessionOperations } from './session-operations.js';
export { SessionExpiryManager } from './session-expiry.js';
export { SessionIndexing } from './session-indexing.js';

// Monitoring and metrics
export { RedisHealthMonitor } from './redis-health.js';
export { RedisMetricsCollector } from './redis-metrics.js';

// Migration and backup
export { RedisMigrationManager } from './redis-migration.js';

// Types
export type {
  RedisStoreInfo,
  RedisClient,
  Pipeline,
  FallbackStore,
  SerializedSession,
  RedisHealthResult,
  HealthCheckResult,
  RedisMetrics,
  MigrationConfig,
  StoreLogger,
  OperationContext,
  SessionQuery
} from './types.js';