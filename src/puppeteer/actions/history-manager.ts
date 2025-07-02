/**
 * Action history management for browser automation
 * @module puppeteer/actions/history-manager
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 * @nist au-7 "Audit reduction and report generation"
 */

import type { ActionResult, ActionContext } from '../interfaces/action-executor.interface.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('puppeteer:action-history');

/**
 * Manages action execution history
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */
export class ActionHistoryManager {
  private readonly actionHistory = new Map<string, ActionResult[]>();
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add action result to history
   * @param context - Execution context
   * @param result - Action result to add
   */
  addToHistory(context: ActionContext, result: ActionResult): void {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) ?? [];
    
    history.push(result);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    
    this.actionHistory.set(contextKey, history);
  }

  /**
   * Get action execution history
   * @param context - Execution context
   * @param options - Query options
   * @returns Array of historical action results
   * @nist au-7 "Audit reduction and report generation"
   */
  getHistory(
    context: ActionContext,
    options?: {
      limit?: number;
      offset?: number;
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
    }
  ): ActionResult[] {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) ?? [];

    let filteredHistory = [...history];

    // Filter by action types
    if (options?.actionTypes && options.actionTypes.length > 0) {
      const actionTypes = options.actionTypes;
      filteredHistory = filteredHistory.filter(result => 
        actionTypes.includes(result.actionType)
      );
    }

    // Filter by date range
    if (options?.startDate) {
      const startDate = options.startDate;
      filteredHistory = filteredHistory.filter(result => 
        result.timestamp >= startDate
      );
    }
    if (options?.endDate) {
      const endDate = options.endDate;
      filteredHistory = filteredHistory.filter(result => 
        result.timestamp <= endDate
      );
    }

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    
    return filteredHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  clearHistory(context: ActionContext, before?: Date): void {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    
    if (before) {
      const history = this.actionHistory.get(contextKey) ?? [];
      const filteredHistory = history.filter(result => result.timestamp >= before);
      this.actionHistory.set(contextKey, filteredHistory);
    } else {
      this.actionHistory.delete(contextKey);
    }

    logger.info('Action history cleared', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      before: before?.toISOString(),
    });
  }

  /**
   * Get action metrics
   * @param context - Execution context
   * @returns Action execution metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(context: ActionContext): {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    averageDuration: number;
    actionTypeBreakdown: Record<string, number>;
  } {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) ?? [];

    const successfulActions = history.filter(result => result.success).length;
    const failedActions = history.length - successfulActions;
    const averageDuration = history.length > 0 
      ? history.reduce((sum, result) => sum + result.duration, 0) / history.length 
      : 0;

    const actionTypeBreakdown: Record<string, number> = {};
    for (const result of history) {
      actionTypeBreakdown[result.actionType] = (actionTypeBreakdown[result.actionType] ?? 0) + 1;
    }

    return {
      totalActions: history.length,
      successfulActions,
      failedActions,
      averageDuration,
      actionTypeBreakdown,
    };
  }
}