/**
 * Cleanup recovery action
 * @module ws/websocket/health/recovery/cleanup-action
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist ir-4 "Incident handling"
 */

import { RecoveryAction, type RecoveryContext } from './base.js';
import type { RecoveryActionResult } from '../types.js';
import { HealthStatus } from '../types.js';

/**
 * Performs cleanup operations to recover system health
 * @nist ir-4 "Incident handling"
 */
export class CleanupRecoveryAction extends RecoveryAction {
  protected canHandle(context: RecoveryContext): boolean {
    // Handle warning or critical status with connection or memory issues
    return (
      context.status !== HealthStatus.HEALTHY &&
      context.issues.some(
        (issue) =>
          issue.includes('connection') || issue.includes('memory') || issue.includes('turnover'),
      )
    );
  }

  protected async execute(context: RecoveryContext): Promise<RecoveryActionResult> {
    const cleanupTasks: string[] = [];

    try {
      // Clean up stale connections
      const staleConnections = context.connectionManager.cleanupStaleConnections(60000); // 1 minute
      if (staleConnections > 0) {
        cleanupTasks.push(`Removed ${staleConnections} stale connections`);
      }

      // Clean up rate limit state
      const rateLimitCleaned = context.securityManager.cleanupRateLimitState();
      if (rateLimitCleaned > 0) {
        cleanupTasks.push(`Cleaned ${rateLimitCleaned} rate limit entries`);
      }

      // Clean up event subscriptions
      context.eventHandler.cleanup();
      cleanupTasks.push('Cleaned up orphaned event subscriptions');

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        cleanupTasks.push('Triggered garbage collection');
      }

      this.logger.info('Cleanup recovery completed', {
        tasksPerformed: cleanupTasks.length,
        tasks: cleanupTasks,
      });

      return {
        success: true,
        message: `Cleanup completed: ${cleanupTasks.join(', ')}`,
        actionsExecuted: cleanupTasks,
      };
    } catch (error) {
      this.logger.error('Cleanup recovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actionsExecuted: cleanupTasks,
      };
    }
  }

  protected override shouldContinueChain(
    context: RecoveryContext,
    _result: RecoveryActionResult,
  ): boolean {
    // Continue if status is still critical
    return context.status === HealthStatus.CRITICAL;
  }
}
