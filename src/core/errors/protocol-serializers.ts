/**
 * Protocol-specific error serializers (REST, gRPC, WebSocket, MCP)
 * @module core/errors/protocol-serializers
 * @nist si-11 "Error handling"
 */

import {
  SerializedError,
  RestErrorResponse,
  GrpcErrorResponse,
  WebSocketErrorResponse,
  McpErrorResponse,
  SerializationOptions,
} from './serialization-interfaces.js';
import { httpToGrpcStatus, httpToMcpErrorCode } from './serialization-helpers.js';

/**
 * Build REST API serialization options
 */
export function buildRestSerializationOptions(options: SerializationOptions): SerializationOptions {
  return {
    ...options,
    includeStack: options.includeStack ?? false,
    includeTechnicalDetails: options.includeTechnicalDetails ?? true,
    includeRetryConfig: options.includeRetryConfig ?? true,
    includeHelpLinks: options.includeHelpLinks ?? true,
    includeTags: options.includeTags ?? false,
    sanitizeSensitiveData: options.sanitizeSensitiveData ?? true,
  };
}

/**
 * Build REST API error object
 */
export function buildRestErrorObject(serialized: SerializedError): RestErrorResponse['error'] {
  return {
    code: serialized.errorCode,
    message: serialized.message,
    userMessage: serialized.userMessage,
    category: serialized.category,
    severity: serialized.severity,
    details: serialized.technicalDetails,
    recoverySuggestions: serialized.recoverySuggestions,
    retryConfig: serialized.retryConfig,
    helpLinks: serialized.helpLinks,
    timestamp: serialized.context.timestamp,
    requestId: serialized.context.requestId,
    correlationIds: serialized.context.correlationIds,
    tags: serialized.tags,
  };
}

/**
 * Build REST API meta object
 */
export function buildRestMetaObject(options: SerializationOptions): RestErrorResponse['meta'] {
  const meta: RestErrorResponse['meta'] = {
    version: '1.0',
    endpoint: options.endpoint ?? 'unknown',
    method: options.method ?? 'unknown',
  };

  if (options.requestDuration !== undefined) {
    meta.requestDuration = options.requestDuration;
  }

  return meta;
}

/**
 * Serialize error for gRPC response
 */
export function serializeForGrpc(serialized: SerializedError): GrpcErrorResponse {
  return {
    code: httpToGrpcStatus(serialized.statusCode),
    message: serialized.userMessage,
    details: JSON.stringify(serialized.technicalDetails ?? {}),
    metadata: {
      errorCode: serialized.errorCode,
      category: serialized.category,
      severity: serialized.severity,
      userMessage: serialized.userMessage,
      recoverySuggestions: serialized.recoverySuggestions,
      ...(serialized.retryConfig !== undefined && {
        retryConfig: JSON.stringify(serialized.retryConfig),
      }),
      ...(serialized.helpLinks !== undefined && {
        helpLinks: JSON.stringify(serialized.helpLinks),
      }),
      timestamp: serialized.context.timestamp,
      requestId: serialized.context.requestId,
      ...(serialized.context.correlationIds !== undefined && {
        correlationIds: JSON.stringify(serialized.context.correlationIds),
      }),
      ...(serialized.tags !== undefined && { tags: JSON.stringify(serialized.tags) }),
    },
  };
}

/**
 * Serialize error for WebSocket response
 */
export function serializeForWebSocket(
  serialized: SerializedError,
  messageId?: string,
  connectionId?: string,
): WebSocketErrorResponse {
  return {
    type: 'error',
    id: messageId,
    error: {
      code: serialized.errorCode,
      message: serialized.message,
      userMessage: serialized.userMessage,
      category: serialized.category,
      severity: serialized.severity,
      details: serialized.technicalDetails,
      recoverySuggestions: serialized.recoverySuggestions,
      retryConfig: serialized.retryConfig,
      helpLinks: serialized.helpLinks,
      timestamp: serialized.context.timestamp,
      requestId: serialized.context.requestId,
      correlationIds: serialized.context.correlationIds,
      tags: serialized.tags,
    },
    meta: {
      connectionId: connectionId ?? 'unknown',
      protocol: 'websocket',
    },
  };
}

/**
 * Serialize error for MCP response
 */
export function serializeForMcp(
  serialized: SerializedError,
  id?: string | number,
): McpErrorResponse {
  return {
    jsonrpc: '2.0',
    error: {
      code: httpToMcpErrorCode(serialized.statusCode),
      message: serialized.userMessage,
      data: {
        errorCode: serialized.errorCode,
        category: serialized.category,
        severity: serialized.severity,
        userMessage: serialized.userMessage,
        details: serialized.technicalDetails,
        recoverySuggestions: serialized.recoverySuggestions,
        retryConfig: serialized.retryConfig,
        helpLinks: serialized.helpLinks,
        timestamp: serialized.context.timestamp,
        requestId: serialized.context.requestId,
        correlationIds: serialized.context.correlationIds,
        tags: serialized.tags,
      },
    },
    id,
  };
}
