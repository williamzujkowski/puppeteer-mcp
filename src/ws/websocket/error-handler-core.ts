/**
 * Core WebSocket error handling functionality
 * @module ws/websocket/error-handler-core
 * @nist au-3 "Content of audit records"
 */

import type { pino } from 'pino';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { WSComponentDependencies } from './types.js';
import { ErrorType, ErrorSeverity, type ErrorInfo, type ErrorStats } from './error-types.js';

/**
 * Core error handling functionality
 * @nist au-3 "Content of audit records"
 */
export class ErrorHandlerCore {
  protected logger: pino.Logger;
  protected errors: ErrorInfo[] = [];
  protected errorStats: Map<ErrorType, number> = new Map();
  protected severityStats: Map<ErrorSeverity, number> = new Map();
  protected readonly maxStoredErrors = 1000;

  constructor({ logger }: WSComponentDependencies) {
    this.logger = logger.child({ module: 'ws-error-handler-core' });
    this.initializeStats();
  }

  /**
   * Record error information
   */
  protected async recordError(errorInfo: ErrorInfo): Promise<void> {
    // Add to error history
    this.errors.push(errorInfo);

    // Maintain size limit
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(-this.maxStoredErrors);
    }

    // Update statistics
    this.errorStats.set(errorInfo.type, (this.errorStats.get(errorInfo.type) ?? 0) + 1);
    this.severityStats.set(errorInfo.severity, (this.severityStats.get(errorInfo.severity) ?? 0) + 1);

    // Log security event
    await logSecurityEvent(SecurityEventType.ERROR_OCCURRED, {
      resource: 'websocket',
      action: 'error_handling',
      result: 'logged',
      metadata: {
        errorType: errorInfo.type,
        severity: errorInfo.severity,
        connectionId: errorInfo.connectionId,
        userId: errorInfo.userId,
        sessionId: errorInfo.sessionId,
        message: errorInfo.message,
      },
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.errors.filter(
      (error) => error.timestamp.getTime() > oneMinuteAgo,
    );

    const errorsByType = Object.values(ErrorType).reduce<Record<ErrorType, number>>((acc, type) => {
      acc[type] = this.errorStats.get(type) ?? 0;
      return acc;
    }, {} as Record<ErrorType, number>);

    const errorsBySeverity = Object.values(ErrorSeverity).reduce<Record<ErrorSeverity, number>>((acc, severity) => {
      acc[severity] = this.severityStats.get(severity) ?? 0;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: this.errors.slice(-50), // Last 50 errors
      errorRate: recentErrors.length, // errors per minute
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errors = [];
    this.errorStats.clear();
    this.severityStats.clear();
    this.initializeStats();
    
    this.logger.info('Error history cleared');
  }

  /**
   * Determine error severity based on error type and message
   */
  protected determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (message.includes('security') || message.includes('authorization')) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('validation') || message.includes('format')) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Initialize error statistics
   */
  private initializeStats(): void {
    Object.values(ErrorType).forEach((type) => {
      this.errorStats.set(type, 0);
    });

    Object.values(ErrorSeverity).forEach((severity) => {
      this.severityStats.set(severity, 0);
    });
  }
}