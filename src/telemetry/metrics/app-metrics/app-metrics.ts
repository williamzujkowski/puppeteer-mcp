/**
 * Main application metrics coordinator
 * @module telemetry/metrics/app-metrics/app-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { getMeter } from '../../index.js';
import { HttpMetricsImpl } from './http-metrics.js';
import { GrpcMetricsImpl } from './grpc-metrics.js';
import { WebSocketMetricsImpl } from './websocket-metrics.js';
import { SecurityMetricsImpl } from './security-metrics.js';
import { SessionMetricsImpl } from './session-metrics.js';
import { PuppeteerMetricsImpl } from './puppeteer-metrics.js';
import { McpMetricsImpl } from './mcp-metrics.js';

/**
 * Application metrics coordinator
 */
export class AppMetrics {
  private readonly meter: Meter;
  
  // Metric modules
  public readonly http: HttpMetricsImpl;
  public readonly grpc: GrpcMetricsImpl;
  public readonly websocket: WebSocketMetricsImpl;
  public readonly security: SecurityMetricsImpl;
  public readonly session: SessionMetricsImpl;
  public readonly puppeteer: PuppeteerMetricsImpl;
  public readonly mcp: McpMetricsImpl;

  constructor(meterName: string = 'puppeteer-mcp-metrics') {
    this.meter = getMeter(meterName);
    
    // Initialize metric modules
    this.http = new HttpMetricsImpl(this.meter);
    this.grpc = new GrpcMetricsImpl(this.meter);
    this.websocket = new WebSocketMetricsImpl(this.meter);
    this.security = new SecurityMetricsImpl(this.meter);
    this.session = new SessionMetricsImpl(this.meter);
    this.puppeteer = new PuppeteerMetricsImpl(this.meter);
    this.mcp = new McpMetricsImpl(this.meter);
  }

  // Backward compatibility getters
  get httpRequestsTotal(): typeof this.http.httpRequestsTotal { return this.http.httpRequestsTotal; }
  get httpRequestDuration(): typeof this.http.httpRequestDuration { return this.http.httpRequestDuration; }
  get httpRequestSize(): typeof this.http.httpRequestSize { return this.http.httpRequestSize; }
  get httpResponseSize(): typeof this.http.httpResponseSize { return this.http.httpResponseSize; }
  get httpActiveRequests(): typeof this.http.httpActiveRequests { return this.http.httpActiveRequests; }
  
  get grpcCallsTotal(): typeof this.grpc.grpcCallsTotal { return this.grpc.grpcCallsTotal; }
  get grpcCallDuration(): typeof this.grpc.grpcCallDuration { return this.grpc.grpcCallDuration; }
  get grpcMessagesSent(): typeof this.grpc.grpcMessagesSent { return this.grpc.grpcMessagesSent; }
  get grpcMessagesReceived(): typeof this.grpc.grpcMessagesReceived { return this.grpc.grpcMessagesReceived; }
  get grpcActiveStreams(): typeof this.grpc.grpcActiveStreams { return this.grpc.grpcActiveStreams; }
  
  get wsConnectionsTotal(): typeof this.websocket.wsConnectionsTotal { return this.websocket.wsConnectionsTotal; }
  get wsActiveConnections(): typeof this.websocket.wsActiveConnections { return this.websocket.wsActiveConnections; }
  get wsMessagesSent(): typeof this.websocket.wsMessagesSent { return this.websocket.wsMessagesSent; }
  get wsMessagesReceived(): typeof this.websocket.wsMessagesReceived { return this.websocket.wsMessagesReceived; }
  get wsMessageSize(): typeof this.websocket.wsMessageSize { return this.websocket.wsMessageSize; }
  
  get authAttemptsTotal(): typeof this.security.authAttemptsTotal { return this.security.authAttemptsTotal; }
  get authFailuresTotal(): typeof this.security.authFailuresTotal { return this.security.authFailuresTotal; }
  get authTokensIssued(): typeof this.security.authTokensIssued { return this.security.authTokensIssued; }
  get authTokensRevoked(): typeof this.security.authTokensRevoked { return this.security.authTokensRevoked; }
  get authActiveTokens(): typeof this.security.authActiveTokens { return this.security.authActiveTokens; }
  
  get sessionCreated(): typeof this.session.sessionCreated { return this.session.sessionCreated; }
  get sessionDestroyed(): typeof this.session.sessionDestroyed { return this.session.sessionDestroyed; }
  get sessionDuration(): typeof this.session.sessionDuration { return this.session.sessionDuration; }
  get sessionActiveSessions(): typeof this.session.sessionActiveSessions { return this.session.sessionActiveSessions; }
  
  get errorsTotal(): typeof this.puppeteer.errorsTotal { return this.puppeteer.errorsTotal; }
  get unhandledExceptions(): typeof this.puppeteer.unhandledExceptions { return this.puppeteer.unhandledExceptions; }
  get validationErrors(): typeof this.puppeteer.validationErrors { return this.puppeteer.validationErrors; }
  get apiCallsTotal(): typeof this.puppeteer.apiCallsTotal { return this.puppeteer.apiCallsTotal; }
  get apiCallDuration(): typeof this.puppeteer.apiCallDuration { return this.puppeteer.apiCallDuration; }
  get apiRateLimitHits(): typeof this.puppeteer.apiRateLimitHits { return this.puppeteer.apiRateLimitHits; }

  /**
   * Record HTTP request (legacy compatibility)
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize: number = 0,
    responseSize: number = 0,
  ): void {
    this.http.recordHttpRequestLegacy(method, route, statusCode, duration, requestSize, responseSize);
  }

  /**
   * Record gRPC call (legacy compatibility)
   */
  recordGrpcCall(
    service: string,
    method: string,
    status: string,
    duration: number,
  ): void {
    this.grpc.recordGrpcCall(service, method, status, duration);
  }

  /**
   * Record authentication attempt (legacy compatibility)
   */
  recordAuthAttempt(
    method: string,
    success: boolean,
    reason?: string,
  ): void {
    this.security.recordAuthAttempt(method, success, reason);
  }

  /**
   * Record error (legacy compatibility)
   */
  recordError(
    type: string,
    category: string,
    handled: boolean = true,
  ): void {
    this.puppeteer.recordError(type, category, handled);
  }

  /**
   * Record API call (legacy compatibility)
   */
  recordApiCall(
    endpoint: string,
    method: string,
    duration: number,
    success: boolean,
  ): void {
    this.puppeteer.recordApiCall(endpoint, method, duration, success);
  }

  /**
   * Get meter instance
   */
  getMeter(): Meter {
    return this.meter;
  }
}