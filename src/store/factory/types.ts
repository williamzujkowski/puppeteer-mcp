/**
 * Shared types for session store factory
 * @module store/factory/types
 * @nist cm-6 "Configuration settings"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { SessionStoreMonitor } from '../session-monitoring.js';
import type { SessionReplicationManager } from '../session-replication.js';
import type { SessionMigration } from '../session-migration.js';
import type { pino } from 'pino';

/**
 * Session store factory configuration
 */
export interface SessionStoreFactoryConfig {
  /**
   * Preferred store type
   */
  preferredStore?: 'memory' | 'redis' | 'auto';
  
  /**
   * Enable monitoring
   */
  enableMonitoring?: boolean;
  
  /**
   * Enable replication
   */
  enableReplication?: boolean;
  
  /**
   * Enable migration utilities
   */
  enableMigration?: boolean;
  
  /**
   * Logger instance
   */
  logger?: pino.Logger;
  
  /**
   * Monitoring configuration
   */
  monitoringConfig?: {
    healthCheckInterval?: number;
    metricsRetentionPeriod?: number;
    alertThresholds?: {
      maxLatency?: number;
      maxErrorRate?: number;
    };
  };
  
  /**
   * Replication configuration
   */
  replicationConfig?: {
    mode?: 'master-slave' | 'master-master' | 'active-passive';
    syncInterval?: number;
    conflictResolution?: 'last-write-wins' | 'oldest-wins' | 'manual';
  };
}

/**
 * Session store factory result
 */
export interface SessionStoreFactoryResult {
  store: SessionStore;
  type: 'memory' | 'redis';
  monitor?: SessionStoreMonitor;
  replication?: SessionReplicationManager;
  migration?: SessionMigration;
  metadata: {
    createdAt: Date;
    config: SessionStoreFactoryConfig;
    redisAvailable: boolean;
    fallbackReason?: string;
  };
}

/**
 * Extracted configuration for simplified processing
 */
export interface ExtractedConfiguration {
  preferredStore: 'memory' | 'redis' | 'auto';
  enableMonitoring: boolean;
  enableReplication: boolean;
  enableMigration: boolean;
  logger: pino.Logger;
  monitoringConfig: NonNullable<SessionStoreFactoryConfig['monitoringConfig']>;
  replicationConfig: NonNullable<SessionStoreFactoryConfig['replicationConfig']>;
}

/**
 * Migration statistics result
 */
export interface MigrationStats {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  duration: number;
}

/**
 * Health status types
 */
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  instances: Array<{
    instanceId: string;
    type: 'memory' | 'redis';
    status: 'healthy' | 'degraded' | 'unhealthy';
    monitor?: unknown;
    replication?: unknown;
  }>;
}

/**
 * Backup result type
 */
export interface BackupResult {
  instanceId: string;
  storeType: 'memory' | 'redis';
  sessionCount: number;
  createdAt: Date;
  data: Array<unknown>;
}

/**
 * Restore statistics
 */
export interface RestoreStats {
  restored: number;
  skipped: number;
  failed: number;
}