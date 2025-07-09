/**
 * Health checking for replication system
 * @module store/replication/health-checker
 * @nist au-3 "Audit logging for replication operations"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { HealthCheckResult, ReplicaHealthStatus } from './types.js';
import type { SessionData } from '../../types/session.js';
import type { Logger } from 'pino';
import { ReplicaManager } from './replica-manager.js';

/**
 * Handles health checking for replication system
 */
export class HealthChecker {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Check primary store health
   */
  async checkPrimaryHealth(primaryStore: SessionStore): Promise<HealthCheckResult> {
    try {
      const testSessionData: SessionData = {
        userId: 'health-check',
        username: 'health-check',
        roles: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000).toISOString()
      };
      
      const testId = await primaryStore.create(testSessionData);
      await primaryStore.delete(testId);
      
      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get health status of all replicas
   */
  async getHealth(
    primaryStore: SessionStore,
    replicaManager: ReplicaManager
  ): Promise<{
    primary: HealthCheckResult;
    replicas: ReplicaHealthStatus[];
  }> {
    // Check primary store health
    const primaryHealth = await this.checkPrimaryHealth(primaryStore);

    // Check replica health
    const replicasHealth = await replicaManager.getAllReplicasHealth();

    this.logger.debug({
      primaryAvailable: primaryHealth.available,
      replicaCount: replicasHealth.length,
      healthyReplicas: replicasHealth.filter(r => r.available).length
    }, 'Health check completed');

    return {
      primary: primaryHealth,
      replicas: replicasHealth
    };
  }
}