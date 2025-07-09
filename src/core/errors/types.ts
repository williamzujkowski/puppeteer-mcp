/**
 * Comprehensive TypeScript types and interfaces for error system
 * @module core/errors/types
 */

import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { EnhancedAppError } from './enhanced-app-error.js';
import { 
  ErrorContext, 
  ErrorCategory, 
  ErrorSeverity
} from './error-context.js';
import { 
  RestErrorResponse, 
  GrpcErrorResponse, 
  WebSocketErrorResponse, 
  McpErrorResponse 
} from './error-serialization.js';
import { 
  ErrorTrackingEntry
} from './error-tracking.js';

/**
 * Union type for all error types
 */
export type AnyError = Error | AppError | EnhancedAppError | ZodError;

/**
 * Union type for all error response formats
 */
export type ErrorResponse = RestErrorResponse | GrpcErrorResponse | WebSocketErrorResponse | McpErrorResponse;

/**
 * Error factory function type
 */
export type ErrorFactory<T extends EnhancedAppError> = (...args: any[]) => T;

/**
 * Error handler function type
 */
export type ErrorHandler<T = void> = (error: AnyError, context?: Record<string, unknown>) => T | Promise<T>;

/**
 * Error mapper function type
 */
export type ErrorMapper<TInput, TOutput> = (input: TInput) => TOutput;

/**
 * Error predicate function type
 */
export type ErrorPredicate<T extends AnyError = AnyError> = (error: T) => boolean;

/**
 * Error transformer function type
 */
export type ErrorTransformer<T extends AnyError = AnyError> = (error: T) => T;

/**
 * Error validation result type
 */
export interface ErrorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Error statistics type
 */
export interface ErrorStatistics {
  total: number;
  operational: number;
  nonOperational: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byStatusCode: Record<number, number>;
  averageResolutionTime: number;
  mostCommonErrors: Array<{
    errorCode: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Error correlation type
 */
export interface ErrorCorrelation {
  id: string;
  pattern: string;
  errors: ErrorTrackingEntry[];
  startTime: Date;
  endTime: Date;
  affectedUsers: string[];
  affectedSessions: string[];
  commonContext: Record<string, unknown>;
}

/**
 * Error trend analysis type
 */
export interface ErrorTrendAnalysis {
  period: {
    start: Date;
    end: Date;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  dataPoints: Array<{
    timestamp: Date;
    count: number;
    category: ErrorCategory;
  }>;
  predictions: Array<{
    timestamp: Date;
    predictedCount: number;
    confidence: number;
  }>;
}

/**
 * Error health assessment type
 */
export interface ErrorHealthAssessment {
  score: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high';
    action: string;
    description: string;
    expectedImpact: string;
  }>;
}

/**
 * Error reporting configuration type
 */
export interface ErrorReportingConfig {
  enabled: boolean;
  endpoints: {
    webhook?: string;
    email?: string;
    slack?: string;
    teams?: string;
  };
  filters: {
    categories?: ErrorCategory[];
    severities?: ErrorSeverity[];
    errorCodes?: string[];
    excludeOperational?: boolean;
  };
  throttling: {
    maxReportsPerHour: number;
    duplicateWindow: number; // in minutes
  };
  templates: {
    subject: string;
    body: string;
  };
}

/**
 * Error audit log entry type
 */
export interface ErrorAuditLogEntry {
  timestamp: Date;
  eventType: 'error_occurred' | 'error_resolved' | 'error_escalated' | 'error_pattern_detected';
  errorId: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  details: Record<string, unknown>;
  actions: Array<{
    type: 'automatic' | 'manual';
    action: string;
    result: 'success' | 'failure';
    timestamp: Date;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Error escalation rule type
 */
export interface ErrorEscalationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    categories?: ErrorCategory[];
    severities?: ErrorSeverity[];
    errorCodes?: string[];
    count?: number;
    timeWindow?: number; // in minutes
    userImpact?: 'single' | 'multiple' | 'system-wide';
  };
  actions: Array<{
    type: 'notify' | 'create_incident' | 'auto_resolve' | 'throttle';
    config: Record<string, unknown>;
    delay?: number; // in minutes
  }>;
  priority: number;
}

/**
 * Error monitoring configuration type
 */
export interface ErrorMonitoringConfig {
  enabled: boolean;
  intervals: {
    collection: number; // in seconds
    aggregation: number; // in seconds
    reporting: number; // in seconds
  };
  thresholds: {
    [key in ErrorCategory]: {
      warning: number;
      critical: number;
      timeWindow: number; // in minutes
    };
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    throttling: {
      maxAlertsPerHour: number;
      duplicateWindow: number; // in minutes
    };
  };
  retention: {
    rawData: number; // in days
    aggregatedData: number; // in days
    auditLogs: number; // in days
  };
}

/**
 * Error classification type
 */
export interface ErrorClassification {
  primary: ErrorCategory;
  secondary?: ErrorCategory;
  tags: string[];
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  technicalImpact: 'low' | 'medium' | 'high' | 'critical';
  userImpact: 'none' | 'single' | 'multiple' | 'system-wide';
  dataImpact: 'none' | 'read' | 'write' | 'corruption';
  securityImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error resolution type
 */
export interface ErrorResolution {
  id: string;
  errorId: string;
  method: 'automatic' | 'manual' | 'escalated';
  strategy: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  steps: Array<{
    order: number;
    description: string;
    startTime: Date;
    endTime: Date;
    success: boolean;
    details?: Record<string, unknown>;
  }>;
  outcome: {
    resolved: boolean;
    partiallyResolved: boolean;
    rootCause?: string;
    preventionMeasures?: string[];
    followUpRequired?: boolean;
  };
}

/**
 * Error aggregation type
 */
export interface ErrorAggregation {
  timeWindow: {
    start: Date;
    end: Date;
  };
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  metrics: {
    total: number;
    unique: number;
    resolved: number;
    unresolved: number;
    avgResolutionTime: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byStatusCode: Record<number, number>;
  };
  trends: {
    errorRate: number; // errors per unit time
    resolutionRate: number; // percentage
    escalationRate: number; // percentage
  };
}

/**
 * Error context enrichment type
 */
export interface ErrorContextEnrichment {
  requestMetadata?: {
    clientVersion?: string;
    clientPlatform?: string;
    clientLocation?: string;
    networkInfo?: {
      type: string;
      speed: string;
      latency: number;
    };
  };
  userMetadata?: {
    roles: string[];
    permissions: string[];
    preferences: Record<string, unknown>;
    history: Array<{
      action: string;
      timestamp: Date;
    }>;
  };
  systemMetadata?: {
    loadAverage: number[];
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    diskUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    processInfo: {
      pid: number;
      ppid: number;
      uptime: number;
      version: string;
    };
  };
  businessMetadata?: {
    tenant?: string;
    organizationId?: string;
    feature?: string;
    experimentId?: string;
    abTestVariant?: string;
  };
}

/**
 * Error middleware context type
 */
export interface ErrorMiddlewareContext {
  request: {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, unknown>;
    params: Record<string, unknown>;
    body?: unknown;
    user?: {
      id: string;
      roles: string[];
      permissions: string[];
    };
    session?: {
      id: string;
      data: Record<string, unknown>;
    };
  };
  response: {
    statusCode?: number;
    headers?: Record<string, string>;
    duration?: number;
  };
  error: AnyError;
  metadata: {
    timestamp: Date;
    environment: string;
    service: string;
    version: string;
    deployment: string;
  };
}

/**
 * Error handler registry type
 */
export interface ErrorHandlerRegistry {
  handlers: Map<string, ErrorHandler>;
  register(key: string, handler: ErrorHandler): void;
  unregister(key: string): boolean;
  get(key: string): ErrorHandler | undefined;
  has(key: string): boolean;
  clear(): void;
  list(): string[];
}

/**
 * Error transformation pipeline type
 */
export interface ErrorTransformationPipeline {
  transformers: ErrorTransformer[];
  add(transformer: ErrorTransformer): void;
  remove(transformer: ErrorTransformer): boolean;
  clear(): void;
  process(error: AnyError): AnyError;
}

/**
 * Error validation pipeline type
 */
export interface ErrorValidationPipeline {
  validators: Array<(error: AnyError) => ErrorValidationResult>;
  add(validator: (error: AnyError) => ErrorValidationResult): void;
  remove(validator: (error: AnyError) => ErrorValidationResult): boolean;
  clear(): void;
  validate(error: AnyError): ErrorValidationResult;
}

/**
 * Error cache configuration type
 */
export interface ErrorCacheConfig {
  enabled: boolean;
  ttl: number; // in seconds
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  keyGenerator: (error: AnyError) => string;
  serializer: (error: AnyError) => string;
  deserializer: (serialized: string) => AnyError;
}

/**
 * Error queue configuration type
 */
export interface ErrorQueueConfig {
  enabled: boolean;
  maxSize: number;
  batchSize: number;
  flushInterval: number; // in milliseconds
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    initialDelay: number;
    maxDelay: number;
  };
  deadLetterQueue: {
    enabled: boolean;
    maxSize: number;
    retention: number; // in days
  };
}

/**
 * Error system configuration type
 */
export interface ErrorSystemConfig {
  tracking: {
    enabled: boolean;
    storage: 'memory' | 'file' | 'database';
    config: Record<string, unknown>;
  };
  recovery: {
    enabled: boolean;
    maxAttempts: number;
    strategies: string[];
    config: Record<string, unknown>;
  };
  serialization: {
    includeStack: boolean;
    includeDetails: boolean;
    sanitizeSensitive: boolean;
    formats: ('rest' | 'grpc' | 'websocket' | 'mcp')[];
  };
  monitoring: ErrorMonitoringConfig;
  reporting: ErrorReportingConfig;
  caching: ErrorCacheConfig;
  queueing: ErrorQueueConfig;
  middleware: {
    enabled: boolean;
    order: number;
    config: Record<string, unknown>;
  };
}

/**
 * Error event type
 */
export interface ErrorEvent {
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  source: string;
  message: string;
  data?: Record<string, unknown>;
  error?: AnyError;
  context?: Record<string, unknown>;
}

/**
 * Error event listener type
 */
export type ErrorEventListener = (event: ErrorEvent) => void | Promise<void>;

/**
 * Error event emitter interface
 */
export interface ErrorEventEmitter {
  on(event: string, listener: ErrorEventListener): void;
  off(event: string, listener: ErrorEventListener): void;
  emit(event: string, data: ErrorEvent): void;
  once(event: string, listener: ErrorEventListener): void;
  removeAllListeners(event?: string): void;
  listenerCount(event: string): number;
}

/**
 * Error plugin interface
 */
export interface ErrorPlugin {
  name: string;
  version: string;
  enabled: boolean;
  install(system: ErrorSystemConfig): void | Promise<void>;
  uninstall(): void | Promise<void>;
  configure(config: Record<string, unknown>): void | Promise<void>;
  getStatus(): {
    installed: boolean;
    configured: boolean;
    healthy: boolean;
    metadata: Record<string, unknown>;
  };
}

/**
 * Error system metrics type
 */
export interface ErrorSystemMetrics {
  uptime: number;
  performance: {
    averageHandlingTime: number;
    peakHandlingTime: number;
    throughput: number; // errors per second
    memoryUsage: number;
    cpuUsage: number;
  };
  statistics: ErrorStatistics;
  health: ErrorHealthAssessment;
  plugins: Array<{
    name: string;
    status: 'active' | 'inactive' | 'error';
    metrics: Record<string, unknown>;
  }>;
}

/**
 * Type guards for error types
 */
export namespace ErrorTypeGuards {
  export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  export function isEnhancedAppError(error: unknown): error is EnhancedAppError {
    return error instanceof EnhancedAppError;
  }

  export function isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError;
  }

  export function isOperationalError(error: unknown): boolean {
    return error instanceof AppError && error.isOperational;
  }

  export function hasErrorCode(error: unknown, code: string): boolean {
    if (error instanceof EnhancedAppError) {
      return error.errorContext.errorCode === code;
    }
    return false;
  }

  export function hasCategory(error: unknown, category: ErrorCategory): boolean {
    if (error instanceof EnhancedAppError) {
      return error.errorContext.category === category;
    }
    return false;
  }

  export function hasSeverity(error: unknown, severity: ErrorSeverity): boolean {
    if (error instanceof EnhancedAppError) {
      return error.errorContext.severity === severity;
    }
    return false;
  }

  export function isRetryable(error: unknown): boolean {
    if (error instanceof EnhancedAppError) {
      return error.isRetryable();
    }
    return false;
  }

  export function containsSensitiveData(error: unknown): boolean {
    if (error instanceof EnhancedAppError) {
      return error.containsSensitiveData();
    }
    return false;
  }
}

/**
 * Utility types for error handling
 */
export namespace ErrorUtilityTypes {
  export type ErrorWithContext<T extends AnyError = AnyError> = T & {
    context: ErrorContext;
  };

  export type ErrorWithMetadata<T extends AnyError = AnyError> = T & {
    metadata: Record<string, unknown>;
  };

  export type ErrorWithRecovery<T extends AnyError = AnyError> = T & {
    recovery: {
      attempts: number;
      lastAttempt: Date;
      nextAttempt?: Date;
      strategy?: string;
    };
  };

  export type ErrorWithResolution<T extends AnyError = AnyError> = T & {
    resolution: ErrorResolution;
  };

  export type MaybeError<T> = T | Error;
  export type ErrorResult<T> = { success: true; data: T } | { success: false; error: AnyError };
  export type AsyncErrorResult<T> = Promise<ErrorResult<T>>;

  export type ErrorCallback<T = void> = (error: AnyError | null, result?: T) => void;
  export type AsyncErrorCallback<T = void> = (error: AnyError | null, result?: T) => Promise<void>;

  export type ErrorOrValue<T> = T | AnyError;
  export type MaybeErrorOrValue<T> = T | AnyError | null | undefined;
}

/**
 * Re-export all error system types
 */
export * from './error-context.js';
export * from './error-serialization.js';
export * from './error-tracking.js';
export * from './error-recovery.js';
export { AppError } from './app-error.js';
export { EnhancedAppError } from './enhanced-app-error.js';
export * from './domain-errors.js';
export * from './error-factory.js';