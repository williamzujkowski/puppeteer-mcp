/**
 * Health status manager for session store factory
 * @module store/factory/health-status-manager
 * @nist cm-6 "Configuration settings"
 */

import type { SessionStoreFactoryResult, HealthStatus } from './types.js';
import { isRedisAvailable } from '../../utils/redis-client.js';
import { config } from '../../core/config.js';

/**
 * Health status manager for session stores
 */
export class HealthStatusManager {
  /**
   * Get health status of all session stores
   */
  async getHealthStatus(instances: Map<string, SessionStoreFactoryResult>): Promise<HealthStatus> {
    const instanceHealthStatuses = await Promise.all(
      Array.from(instances.entries()).map(async ([instanceId, instance]) => {
        const status = await this.getInstanceHealthStatus(instance);
        return {
          instanceId,
          type: instance.type,
          ...status
        };
      })
    );

    const overall = this.determineOverallHealth(instanceHealthStatuses);

    return {
      overall,
      instances: instanceHealthStatuses
    };
  }

  /**
   * Get factory status
   */
  getStatus(instances: Map<string, SessionStoreFactoryResult>): {
    instanceCount: number;
    redisAvailable: boolean;
    config: {
      defaultStoreType: string;
      monitoringEnabled: boolean;
      replicationEnabled: boolean;
      migrationEnabled: boolean;
    };
    instances: Array<{
      instanceId: string;
      type: 'memory' | 'redis';
      createdAt: Date;
      enabledFeatures: string[];
    }>;
  } {
    const instanceStatuses = Array.from(instances.entries()).map(([instanceId, instance]) => ({
      instanceId,
      type: instance.type,
      createdAt: instance.metadata.createdAt,
      enabledFeatures: [
        instance.monitor ? 'monitoring' : null,
        instance.replication ? 'replication' : null,
        instance.migration ? 'migration' : null
      ].filter(Boolean) as string[]
    }));

    return {
      instanceCount: instances.size,
      redisAvailable: isRedisAvailable(),
      config: {
        defaultStoreType: config.SESSION_STORE_TYPE,
        monitoringEnabled: config.SESSION_STORE_MONITORING_ENABLED,
        replicationEnabled: config.SESSION_STORE_REPLICATION_ENABLED,
        migrationEnabled: config.SESSION_STORE_MIGRATION_ENABLED
      },
      instances: instanceStatuses
    };
  }

  private async getInstanceHealthStatus(instance: SessionStoreFactoryResult): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    monitor?: unknown;
    replication?: unknown;
  }> {
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let monitorHealth;
    let replicationHealth;

    // Get monitoring health
    if (instance.monitor) {
      const healthCheck = await instance.monitor.performHealthCheck();
      monitorHealth = healthCheck;
      status = healthCheck.status;
    }

    // Get replication health
    if (instance.replication) {
      replicationHealth = await instance.replication.getHealth();
      
      // Adjust status based on replication health
      if (!replicationHealth.primary.available) {
        status = 'unhealthy';
      } else if (replicationHealth.replicas.some((r: { available: boolean }) => !r.available)) {
        if (status === 'healthy') {
          status = 'degraded';
        }
      }
    }

    return {
      status,
      monitor: monitorHealth,
      replication: replicationHealth
    };
  }

  private determineOverallHealth(instances: Array<{ status: 'healthy' | 'degraded' | 'unhealthy' }>): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = instances.filter(i => i.status === 'unhealthy').length;
    const degradedCount = instances.filter(i => i.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}