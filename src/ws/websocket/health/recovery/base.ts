/**
 * Base recovery action handler
 * @module ws/websocket/health/recovery/base
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist ir-4 "Incident handling"
 */

import type { pino } from 'pino';
import type { HealthStatus, HealthMetrics, HealthCheckContext, RecoveryActionResult } from '../types.js';

/**
 * Recovery action context
 */
export interface RecoveryContext extends HealthCheckContext {
  status: HealthStatus;
  metrics: HealthMetrics;
  issues: string[];
}

/**
 * Abstract base class for recovery actions (Chain of Responsibility pattern)
 * @nist ir-4 "Incident handling"
 */
export abstract class RecoveryAction {
  protected logger: pino.Logger;
  protected next?: RecoveryAction;
  protected name: string;

  constructor(name: string, logger: pino.Logger) {
    this.name = name;
    this.logger = logger.child({ module: `recovery-${name}` });
  }

  /**
   * Set the next handler in the chain
   */
  setNext(handler: RecoveryAction): RecoveryAction {
    this.next = handler;
    return handler;
  }

  /**
   * Handle recovery request
   */
  async handle(context: RecoveryContext): Promise<RecoveryActionResult> {
    const actionsExecuted: string[] = [];

    // Check if this handler can process the request
    if (this.canHandle(context)) {
      this.logger.info('Executing recovery action', {
        action: this.name,
        status: context.status,
        issueCount: context.issues.length,
      });

      try {
        const result = await this.execute(context);
        actionsExecuted.push(`${this.name}: ${result.message}`);

        // If action failed or we should continue, pass to next handler
        if (!result.success || this.shouldContinueChain(context, result)) {
          if (this.next) {
            const nextResult = await this.next.handle(context);
            actionsExecuted.push(...nextResult.actionsExecuted);
            return {
              success: result.success && nextResult.success,
              message: `${result.message}; ${nextResult.message}`,
              actionsExecuted,
            };
          }
        }

        return { ...result, actionsExecuted };
      } catch (error) {
        this.logger.error('Recovery action failed', {
          action: this.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        actionsExecuted.push(`${this.name}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Continue to next handler on error
        if (this.next) {
          const nextResult = await this.next.handle(context);
          actionsExecuted.push(...nextResult.actionsExecuted);
          return {
            success: false,
            message: `${this.name} failed; ${nextResult.message}`,
            actionsExecuted,
          };
        }

        return {
          success: false,
          message: `Recovery action '${this.name}' failed`,
          actionsExecuted,
        };
      }
    }

    // Pass to next handler if this one can't handle
    if (this.next) {
      return this.next.handle(context);
    }

    return {
      success: true,
      message: 'No recovery actions needed',
      actionsExecuted,
    };
  }

  /**
   * Check if this handler can process the recovery request
   */
  protected abstract canHandle(context: RecoveryContext): boolean;

  /**
   * Execute the recovery action
   */
  protected abstract execute(context: RecoveryContext): Promise<RecoveryActionResult>;

  /**
   * Determine if chain should continue after this action
   */
  protected shouldContinueChain(_context: RecoveryContext, _result: RecoveryActionResult): boolean {
    return false; // By default, stop chain if action succeeds
  }
}