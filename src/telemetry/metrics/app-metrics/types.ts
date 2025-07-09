/**
 * Shared types for application metrics
 * @module telemetry/metrics/app-metrics/types
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { 
  Counter, 
  Histogram, 
  UpDownCounter, 
  Meter,
  Attributes,
} from '@opentelemetry/api';

/**
 * Base metrics interface
 */
export interface BaseMetrics {
  meter: Meter;
}

/**
 * HTTP metrics interface
 */
export interface HttpMetrics extends BaseMetrics {
  httpRequestsTotal: Counter;
  httpRequestDuration: Histogram;
  httpRequestSize: Histogram;
  httpResponseSize: Histogram;
  httpActiveRequests: UpDownCounter;
}

/**
 * gRPC metrics interface
 */
export interface GrpcMetrics extends BaseMetrics {
  grpcCallsTotal: Counter;
  grpcCallDuration: Histogram;
  grpcMessagesSent: Counter;
  grpcMessagesReceived: Counter;
  grpcActiveStreams: UpDownCounter;
}

/**
 * WebSocket metrics interface
 */
export interface WebSocketMetrics extends BaseMetrics {
  wsConnectionsTotal: Counter;
  wsActiveConnections: UpDownCounter;
  wsMessagesSent: Counter;
  wsMessagesReceived: Counter;
  wsMessageSize: Histogram;
}

/**
 * Security metrics interface
 */
export interface SecurityMetrics extends BaseMetrics {
  authAttemptsTotal: Counter;
  authFailuresTotal: Counter;
  authTokensIssued: Counter;
  authTokensRevoked: Counter;
  authActiveTokens: UpDownCounter;
}

/**
 * Session metrics interface
 */
export interface SessionMetrics extends BaseMetrics {
  sessionCreated: Counter;
  sessionDestroyed: Counter;
  sessionDuration: Histogram;
  sessionActiveSessions: UpDownCounter;
}

/**
 * Puppeteer metrics interface
 */
export interface PuppeteerMetrics extends BaseMetrics {
  errorsTotal: Counter;
  unhandledExceptions: Counter;
  validationErrors: Counter;
  apiCallsTotal: Counter;
  apiCallDuration: Histogram;
  apiRateLimitHits: Counter;
}

/**
 * MCP metrics interface
 */
export interface McpMetrics extends BaseMetrics {
  // MCP specific metrics will be added here as needed
  mcpRequestsTotal: any;
  mcpRequestDuration: any;
  mcpActiveConnections: any;
  mcpToolCalls: any;
  mcpErrors: any;
}

/**
 * HTTP request labels
 */
export interface HttpRequestLabels extends Attributes {
  method: string;
  route: string;
  status_code: string;
  status_class: string;
}

/**
 * gRPC call labels
 */
export interface GrpcCallLabels extends Attributes {
  service: string;
  method: string;
  status: string;
}

/**
 * Authentication labels
 */
export interface AuthLabels extends Attributes {
  method: string;
  success: string;
  reason?: string;
}

/**
 * Error labels
 */
export interface ErrorLabels extends Attributes {
  type: string;
  category: string;
  handled: string;
}

/**
 * API call labels
 */
export interface ApiCallLabels extends Attributes {
  endpoint: string;
  method: string;
  success: string;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method: string;
  route: string;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
}