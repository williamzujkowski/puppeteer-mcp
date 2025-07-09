/**
 * OpenTelemetry and logging correlation
 * @module telemetry/correlation
 * @nist au-2 "Audit events"
 * @nist au-10 "Non-repudiation"
 */

import { trace } from '@opentelemetry/api';
import pino from 'pino';
import { getCorrelationIds } from './context.js';

/**
 * Pino mixin for adding trace correlation
 */
export function createCorrelationMixin(): pino.MixinFn {
  return () => {
    const correlationIds = getCorrelationIds();
    
    // Only add fields that have values
    const mixin: Record<string, string> = {};
    
    if (correlationIds.traceId) {
      mixin.traceId = correlationIds.traceId;
    }
    
    if (correlationIds.spanId) {
      mixin.spanId = correlationIds.spanId;
    }
    
    if (correlationIds.requestId) {
      mixin.requestId = correlationIds.requestId;
    }
    
    return mixin;
  };
}

/**
 * Create correlated logger
 */
export function createCorrelatedLogger(name: string, options?: pino.LoggerOptions): pino.Logger {
  return pino({
    name,
    ...options,
    mixin: createCorrelationMixin(),
  });
}

/**
 * Log with automatic span event
 */
export function logAndTrace(
  logger: pino.Logger,
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  obj: unknown,
  msg?: string,
): void {
  // Log normally
  logger[level](obj, msg);
  
  // Add as span event if we have an active span
  const span = trace.getActiveSpan();
  if (span && (level === 'warn' || level === 'error' || level === 'fatal')) {
    const eventName = `log.${level}`;
    const attributes: Record<string, any> = {
      'log.severity': level,
    };
    
    if (msg) {
      attributes['log.message'] = msg;
    }
    
    if (obj && typeof obj === 'object') {
      // Add safe attributes from the log object
      const logObj = obj as Record<string, any>;
      if (logObj.error) {
        attributes['error'] = true;
        attributes['error.type'] = logObj.error.name || 'Error';
        attributes['error.message'] = logObj.error.message;
        if (logObj.error.stack) {
          attributes['error.stack'] = logObj.error.stack;
        }
      }
    }
    
    span.addEvent(eventName, attributes);
    
    // Set error status on span for errors
    if (level === 'error' || level === 'fatal') {
      span.setStatus({
        code: trace.SpanStatusCode.ERROR,
        message: msg || 'Error logged',
      });
    }
  }
}

/**
 * Enhanced logger wrapper with trace correlation
 */
export class CorrelatedLogger {
  constructor(private logger: pino.Logger) {}
  
  trace(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'trace', obj, msg);
  }
  
  debug(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'debug', obj, msg);
  }
  
  info(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'info', obj, msg);
  }
  
  warn(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'warn', obj, msg);
  }
  
  error(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'error', obj, msg);
  }
  
  fatal(obj: unknown, msg?: string): void {
    logAndTrace(this.logger, 'fatal', obj, msg);
  }
  
  child(bindings: pino.Bindings): CorrelatedLogger {
    return new CorrelatedLogger(this.logger.child(bindings));
  }
}

/**
 * Convert existing logger to correlated logger
 */
export function toCorrelatedLogger(logger: pino.Logger): CorrelatedLogger {
  return new CorrelatedLogger(logger);
}

/**
 * Structured logging helper for telemetry events
 */
export interface TelemetryEvent {
  operation: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Log telemetry event with correlation
 */
export function logTelemetryEvent(logger: pino.Logger, event: TelemetryEvent): void {
  const span = trace.getActiveSpan();
  const level = event.status === 'failed' ? 'error' : 'info';
  
  const logObj: Record<string, any> = {
    telemetry: true,
    operation: event.operation,
    status: event.status,
  };
  
  if (event.duration !== undefined) {
    logObj.duration = event.duration;
  }
  
  if (event.error) {
    logObj.error = {
      name: event.error.name,
      message: event.error.message,
      stack: event.error.stack,
    };
  }
  
  if (event.metadata) {
    logObj.metadata = event.metadata;
  }
  
  logger[level](logObj, `Telemetry: ${event.operation} ${event.status}`);
  
  // Add to span if available
  if (span) {
    span.addEvent(`telemetry.${event.operation}.${event.status}`, {
      ...logObj,
      timestamp: new Date().toISOString(),
    });
    
    if (event.status === 'failed' && event.error) {
      span.recordException(event.error);
      span.setStatus({
        code: trace.SpanStatusCode.ERROR,
        message: event.error.message,
      });
    }
  }
}