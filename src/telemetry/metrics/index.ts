/**
 * OpenTelemetry metrics collection
 * @module telemetry/metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { 
  Counter, 
  Histogram, 
  UpDownCounter, 
  ObservableGauge,
  Meter,
} from '@opentelemetry/api';
import { getMeter } from '../index.js';

/**
 * Application metrics
 */
export class AppMetrics {
  private meter: Meter;
  
  // HTTP metrics
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly httpRequestSize: Histogram;
  readonly httpResponseSize: Histogram;
  readonly httpActiveRequests: UpDownCounter;
  
  // gRPC metrics
  readonly grpcCallsTotal: Counter;
  readonly grpcCallDuration: Histogram;
  readonly grpcMessagesSent: Counter;
  readonly grpcMessagesReceived: Counter;
  readonly grpcActiveStreams: UpDownCounter;
  
  // WebSocket metrics
  readonly wsConnectionsTotal: Counter;
  readonly wsActiveConnections: UpDownCounter;
  readonly wsMessagesSent: Counter;
  readonly wsMessagesReceived: Counter;
  readonly wsMessageSize: Histogram;
  
  // Authentication metrics
  readonly authAttemptsTotal: Counter;
  readonly authFailuresTotal: Counter;
  readonly authTokensIssued: Counter;
  readonly authTokensRevoked: Counter;
  readonly authActiveTokens: UpDownCounter;
  
  // Session metrics
  readonly sessionCreated: Counter;
  readonly sessionDestroyed: Counter;
  readonly sessionDuration: Histogram;
  readonly sessionActiveSessions: UpDownCounter;
  
  // Error metrics
  readonly errorsTotal: Counter;
  readonly unhandledExceptions: Counter;
  readonly validationErrors: Counter;
  
  // Business metrics
  readonly apiCallsTotal: Counter;
  readonly apiCallDuration: Histogram;
  readonly apiRateLimitHits: Counter;
  
  constructor(meterName: string = 'puppeteer-mcp-metrics') {
    this.meter = getMeter(meterName);
    
    // Initialize HTTP metrics
    this.httpRequestsTotal = this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
      unit: '1',
    });
    
    this.httpRequestDuration = this.meter.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });
    
    this.httpRequestSize = this.meter.createHistogram('http_request_size_bytes', {
      description: 'HTTP request size in bytes',
      unit: 'By',
    });
    
    this.httpResponseSize = this.meter.createHistogram('http_response_size_bytes', {
      description: 'HTTP response size in bytes',
      unit: 'By',
    });
    
    this.httpActiveRequests = this.meter.createUpDownCounter('http_active_requests', {
      description: 'Number of active HTTP requests',
      unit: '1',
    });
    
    // Initialize gRPC metrics
    this.grpcCallsTotal = this.meter.createCounter('grpc_calls_total', {
      description: 'Total number of gRPC calls',
      unit: '1',
    });
    
    this.grpcCallDuration = this.meter.createHistogram('grpc_call_duration_ms', {
      description: 'gRPC call duration in milliseconds',
      unit: 'ms',
    });
    
    this.grpcMessagesSent = this.meter.createCounter('grpc_messages_sent_total', {
      description: 'Total number of gRPC messages sent',
      unit: '1',
    });
    
    this.grpcMessagesReceived = this.meter.createCounter('grpc_messages_received_total', {
      description: 'Total number of gRPC messages received',
      unit: '1',
    });
    
    this.grpcActiveStreams = this.meter.createUpDownCounter('grpc_active_streams', {
      description: 'Number of active gRPC streams',
      unit: '1',
    });
    
    // Initialize WebSocket metrics
    this.wsConnectionsTotal = this.meter.createCounter('ws_connections_total', {
      description: 'Total number of WebSocket connections',
      unit: '1',
    });
    
    this.wsActiveConnections = this.meter.createUpDownCounter('ws_active_connections', {
      description: 'Number of active WebSocket connections',
      unit: '1',
    });
    
    this.wsMessagesSent = this.meter.createCounter('ws_messages_sent_total', {
      description: 'Total number of WebSocket messages sent',
      unit: '1',
    });
    
    this.wsMessagesReceived = this.meter.createCounter('ws_messages_received_total', {
      description: 'Total number of WebSocket messages received',
      unit: '1',
    });
    
    this.wsMessageSize = this.meter.createHistogram('ws_message_size_bytes', {
      description: 'WebSocket message size in bytes',
      unit: 'By',
    });
    
    // Initialize authentication metrics
    this.authAttemptsTotal = this.meter.createCounter('auth_attempts_total', {
      description: 'Total number of authentication attempts',
      unit: '1',
    });
    
    this.authFailuresTotal = this.meter.createCounter('auth_failures_total', {
      description: 'Total number of authentication failures',
      unit: '1',
    });
    
    this.authTokensIssued = this.meter.createCounter('auth_tokens_issued_total', {
      description: 'Total number of authentication tokens issued',
      unit: '1',
    });
    
    this.authTokensRevoked = this.meter.createCounter('auth_tokens_revoked_total', {
      description: 'Total number of authentication tokens revoked',
      unit: '1',
    });
    
    this.authActiveTokens = this.meter.createUpDownCounter('auth_active_tokens', {
      description: 'Number of active authentication tokens',
      unit: '1',
    });
    
    // Initialize session metrics
    this.sessionCreated = this.meter.createCounter('session_created_total', {
      description: 'Total number of sessions created',
      unit: '1',
    });
    
    this.sessionDestroyed = this.meter.createCounter('session_destroyed_total', {
      description: 'Total number of sessions destroyed',
      unit: '1',
    });
    
    this.sessionDuration = this.meter.createHistogram('session_duration_seconds', {
      description: 'Session duration in seconds',
      unit: 's',
    });
    
    this.sessionActiveSessions = this.meter.createUpDownCounter('session_active', {
      description: 'Number of active sessions',
      unit: '1',
    });
    
    // Initialize error metrics
    this.errorsTotal = this.meter.createCounter('errors_total', {
      description: 'Total number of errors',
      unit: '1',
    });
    
    this.unhandledExceptions = this.meter.createCounter('unhandled_exceptions_total', {
      description: 'Total number of unhandled exceptions',
      unit: '1',
    });
    
    this.validationErrors = this.meter.createCounter('validation_errors_total', {
      description: 'Total number of validation errors',
      unit: '1',
    });
    
    // Initialize business metrics
    this.apiCallsTotal = this.meter.createCounter('api_calls_total', {
      description: 'Total number of API calls',
      unit: '1',
    });
    
    this.apiCallDuration = this.meter.createHistogram('api_call_duration_ms', {
      description: 'API call duration in milliseconds',
      unit: 'ms',
    });
    
    this.apiRateLimitHits = this.meter.createCounter('api_rate_limit_hits_total', {
      description: 'Total number of rate limit hits',
      unit: '1',
    });
  }
  
  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize: number = 0,
    responseSize: number = 0,
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };
    
    this.httpRequestsTotal.add(1, labels);
    this.httpRequestDuration.record(duration, labels);
    
    if (requestSize > 0) {
      this.httpRequestSize.record(requestSize, labels);
    }
    
    if (responseSize > 0) {
      this.httpResponseSize.record(responseSize, labels);
    }
  }
  
  /**
   * Record gRPC call
   */
  recordGrpcCall(
    service: string,
    method: string,
    status: string,
    duration: number,
  ): void {
    const labels = {
      service,
      method,
      status,
    };
    
    this.grpcCallsTotal.add(1, labels);
    this.grpcCallDuration.record(duration, labels);
  }
  
  /**
   * Record authentication attempt
   */
  recordAuthAttempt(
    method: string,
    success: boolean,
    reason?: string,
  ): void {
    const labels = {
      method,
      success: success.toString(),
    };
    
    this.authAttemptsTotal.add(1, labels);
    
    if (!success) {
      this.authFailuresTotal.add(1, {
        ...labels,
        reason: reason ?? 'unknown',
      });
    }
  }
  
  /**
   * Record error
   */
  recordError(
    type: string,
    category: string,
    handled: boolean = true,
  ): void {
    const labels = {
      type,
      category,
      handled: handled.toString(),
    };
    
    this.errorsTotal.add(1, labels);
    
    if (!handled) {
      this.unhandledExceptions.add(1, labels);
    }
  }
  
  /**
   * Record API call
   */
  recordApiCall(
    endpoint: string,
    method: string,
    duration: number,
    success: boolean,
  ): void {
    const labels = {
      endpoint,
      method,
      success: success.toString(),
    };
    
    this.apiCallsTotal.add(1, labels);
    this.apiCallDuration.record(duration, labels);
  }
}

/**
 * Global metrics instance
 */
export const appMetrics = new AppMetrics();

/**
 * Create custom gauge
 */
export function createGauge(
  name: string,
  description: string,
  callback: () => number,
  unit: string = '1',
): ObservableGauge {
  const meter = getMeter();
  return meter.createObservableGauge(name, {
    description,
    unit,
  }, (result) => {
    result.observe(callback());
  });
}

/**
 * Create custom counter
 */
export function createCounter(
  name: string,
  description: string,
  unit: string = '1',
): Counter {
  const meter = getMeter();
  return meter.createCounter(name, {
    description,
    unit,
  });
}

/**
 * Create custom histogram
 */
export function createHistogram(
  name: string,
  description: string,
  unit: string = 'ms',
): Histogram {
  const meter = getMeter();
  return meter.createHistogram(name, {
    description,
    unit,
  });
}