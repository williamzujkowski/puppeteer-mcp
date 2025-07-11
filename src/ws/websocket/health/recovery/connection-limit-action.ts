/**
 * Connection limit recovery action
 * @module ws/websocket/health/recovery/connection-limit-action
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist ir-4 "Incident handling"
 * @nist sc-5 "Denial of service protection"
 */

import type { pino } from 'pino';
import { RecoveryAction, type RecoveryContext } from './base.js';
import type { RecoveryActionResult } from '../types.js';
import { HealthStatus } from '../types.js';

/**
 * Handles connection limit issues
 * @nist ir-4 "Incident handling"
 * @nist sc-5 "Denial of service protection"
 */
export class ConnectionLimitRecoveryAction extends RecoveryAction {
  private readonly connectionThreshold: number;

  constructor(logger: pino.Logger, connectionThreshold = 900) {
    super('connection-limit', logger);
    this.connectionThreshold = connectionThreshold;
  }

  protected canHandle(context: RecoveryContext): boolean {
    // Handle when connections exceed threshold or specific connection limit issues
    return (
      context.metrics.activeConnections > this.connectionThreshold ||
      context.issues.some((issue) => issue.includes('Connection limit'))
    );
  }

  protected async execute(context: RecoveryContext): Promise<RecoveryActionResult> {
    const actions: string[] = [];

    try {
      // Get all connections sorted by age
      const connections = context.connectionManager.getAllConnections();
      const sortedConnections = connections.sort(
        (a, b) => a.state.connectedAt.getTime() - b.state.connectedAt.getTime(),
      );

      // Calculate how many connections to close
      const excessConnections = Math.max(0, connections.length - this.connectionThreshold);

      if (excessConnections === 0) {
        return {
          success: true,
          message: 'Connection count within limits',
          actionsExecuted: actions,
        };
      }

      // Close oldest unauthenticated connections first
      let closedCount = 0;
      const unauthenticated = sortedConnections.filter((c) => !c.state.authenticated);

      for (const conn of unauthenticated) {
        if (closedCount >= excessConnections) break;

        conn.ws.close(1008, 'Server connection limit reached');
        context.connectionManager.removeConnection(conn.connectionId);
        closedCount++;
      }

      if (closedCount > 0) {
        actions.push(`Closed ${closedCount} unauthenticated connections`);
      }

      // If still over limit, close oldest authenticated connections
      if (closedCount < excessConnections) {
        const authenticated = sortedConnections.filter((c) => c.state.authenticated);

        for (const conn of authenticated) {
          if (closedCount >= excessConnections) break;

          conn.ws.close(1008, 'Server connection limit reached');
          context.connectionManager.removeConnection(conn.connectionId);
          closedCount++;
        }

        actions.push(`Closed ${closedCount - unauthenticated.length} authenticated connections`);
      }

      this.logger.info('Connection limit recovery completed', {
        connectionsClosed: closedCount,
        currentConnections: context.connectionManager.getStats().total,
      });

      return {
        success: true,
        message: `Reduced connections by ${closedCount} to stay within limits`,
        actionsExecuted: actions,
      };
    } catch (error) {
      this.logger.error('Connection limit recovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: `Connection limit recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actionsExecuted: actions,
      };
    }
  }

  protected override shouldContinueChain(
    context: RecoveryContext,
    _result: RecoveryActionResult,
  ): boolean {
    // Continue if other critical issues exist
    return (
      context.status === HealthStatus.CRITICAL &&
      context.issues.some((issue) => !issue.includes('Connection limit'))
    );
  }
}
