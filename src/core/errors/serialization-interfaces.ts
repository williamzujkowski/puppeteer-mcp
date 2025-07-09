/**
 * Error serialization interfaces for all protocols
 * @module core/errors/serialization-interfaces
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorCategory, ErrorSeverity, RecoveryAction } from './error-context.js';

/**
 * Serialized error format for API responses
 */
export interface SerializedError {
  name: string;
  message: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  statusCode: number;
  isOperational: boolean;
  recoverySuggestions: RecoveryAction[];
  context: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    timestamp: string;
    stack?: string;
    correlationIds?: string[];
    operation?: string;
    resource?: string;
    environment?: {
      nodeVersion?: string;
      platform?: string;
      service?: string;
      version?: string;
    };
  };
  technicalDetails?: Record<string, unknown>;
  retryConfig?: {
    maxAttempts: number;
    initialDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
    jitter: number;
    retryableErrorCodes?: string[];
  };
  helpLinks?: {
    documentation?: string;
    troubleshooting?: string;
    support?: string;
    faq?: string;
  };
  tags?: Record<string, string>;
}

/**
 * REST API error response format
 */
export interface RestErrorResponse {
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    details?: Record<string, unknown>;
    recoverySuggestions?: RecoveryAction[];
    retryConfig?: SerializedError['retryConfig'];
    helpLinks?: SerializedError['helpLinks'];
    timestamp: string;
    requestId?: string;
    correlationIds?: string[];
    tags?: Record<string, string>;
  };
  meta?: {
    version: string;
    endpoint: string;
    method: string;
    requestDuration?: number;
  };
}

/**
 * gRPC error response format
 */
export interface GrpcErrorResponse {
  code: number;
  message: string;
  details: string;
  metadata: {
    errorCode: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    userMessage: string;
    recoverySuggestions: RecoveryAction[];
    retryConfig?: string; // JSON stringified
    helpLinks?: string; // JSON stringified
    timestamp: string;
    requestId?: string;
    correlationIds?: string; // JSON stringified array
    tags?: string; // JSON stringified
  };
}

/**
 * WebSocket error response format
 */
export interface WebSocketErrorResponse {
  type: 'error';
  id?: string;
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    details?: Record<string, unknown>;
    recoverySuggestions?: RecoveryAction[];
    retryConfig?: SerializedError['retryConfig'];
    helpLinks?: SerializedError['helpLinks'];
    timestamp: string;
    requestId?: string;
    correlationIds?: string[];
    tags?: Record<string, string>;
  };
  meta?: {
    connectionId: string;
    protocol: 'websocket';
  };
}

/**
 * MCP error response format
 */
export interface McpErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: {
      errorCode: string;
      category: ErrorCategory;
      severity: ErrorSeverity;
      userMessage: string;
      details?: Record<string, unknown>;
      recoverySuggestions?: RecoveryAction[];
      retryConfig?: SerializedError['retryConfig'];
      helpLinks?: SerializedError['helpLinks'];
      timestamp: string;
      requestId?: string;
      correlationIds?: string[];
      tags?: Record<string, string>;
    };
  };
  id?: string | number;
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  includeStack?: boolean;
  includeTechnicalDetails?: boolean;
  includeRetryConfig?: boolean;
  includeHelpLinks?: boolean;
  includeTags?: boolean;
  sanitizeSensitiveData?: boolean;
  requestId?: string;
  endpoint?: string;
  method?: string;
  requestDuration?: number;
  connectionId?: string;
  userId?: string;
}