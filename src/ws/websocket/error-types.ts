/**
 * WebSocket error types and interfaces
 * @module ws/websocket/error-types
 * @nist au-3 "Content of audit records"
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error types
 */
export enum ErrorType {
  CONNECTION_ERROR = 'connection_error',
  MESSAGE_ERROR = 'message_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  VALIDATION_ERROR = 'validation_error',
  PROCESSING_ERROR = 'processing_error',
  SYSTEM_ERROR = 'system_error',
}

/**
 * Error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  connectionId?: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  recoveryStrategy?: import('./types.js').ErrorRecoveryStrategy;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: ErrorInfo[];
  errorRate: number; // errors per minute
}
