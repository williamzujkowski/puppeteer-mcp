/**
 * OpenTelemetry context management and propagation
 * @module telemetry/context
 * @nist au-2 "Audit events"
 * @nist au-10 "Non-repudiation"
 */

import {
  context as otelContext,
  trace,
  propagation,
  Context,
  TextMapGetter,
  TextMapSetter,
  Span,
  Baggage,
} from '@opentelemetry/api';
import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import type { TelemetryConfig } from './config.js';

/**
 * Enhanced context with request and telemetry information
 */
export interface EnhancedContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  span?: Span;
  baggage?: Baggage;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * AsyncLocalStorage for enhanced context
 */
const contextStorage = new AsyncLocalStorage<EnhancedContext>();

/**
 * Get current enhanced context
 */
export function getCurrentContext(): EnhancedContext | undefined {
  return contextStorage.getStore();
}

/**
 * Run function with enhanced context
 */
export function runWithContext<T>(context: EnhancedContext, fn: () => T): T {
  return contextStorage.run(context, fn);
}

/**
 * Extract context from HTTP headers
 */
export function extractContextFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): Context {
  const getter: TextMapGetter = {
    keys: (carrier) => Object.keys(carrier),
    get: (carrier, key) => {
      const value = carrier[key];
      return Array.isArray(value) ? value[0] : value;
    },
  };

  return propagation.extract(otelContext.active(), headers, getter);
}

/**
 * Inject context into HTTP headers
 */
export function injectContextToHeaders(context: Context, headers: Record<string, string>): void {
  const setter: TextMapSetter = {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  };

  propagation.inject(context, headers, setter);
}

/**
 * Express middleware for context propagation
 */
export function contextPropagationMiddleware(config: TelemetryConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract context from incoming request
    const extractedContext = extractContextFromHeaders(req.headers);

    // Get or create request ID
    const requestId =
      req.id ??
      (req.headers['x-request-id'] as string) ??
      trace.getSpan(extractedContext)?.spanContext().traceId ??
      'unknown';

    // Create enhanced context
    const enhancedContext: EnhancedContext = {
      requestId,
      userId: req.user?.userId,
      sessionId: req.session?.id,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.headers['user-agent'] ?? 'unknown',
        'net.peer.ip': req.ip ?? 'unknown',
      },
    };

    // Run the rest of the request in context
    otelContext.with(extractedContext, () => {
      runWithContext(enhancedContext, () => {
        // Create span for this request
        const tracer = trace.getTracer(config.serviceName, config.serviceVersion);
        const span = tracer.startSpan(`${req.method} ${req.path}`, {
          attributes: enhancedContext.attributes,
        });

        enhancedContext.span = span;

        // Inject context into response headers for downstream propagation
        const responseHeaders: Record<string, string> = {};
        injectContextToHeaders(otelContext.active(), responseHeaders);

        Object.entries(responseHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // End span when response finishes
        res.on('finish', () => {
          span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response.size': res.get('content-length') ?? 0,
          });

          if (res.statusCode >= 400) {
            span.setStatus({
              code: trace.SpanStatusCode.ERROR,
              message: `HTTP ${res.statusCode}`,
            });
          }

          span.end();
        });

        next();
      });
    });
  };
}

/**
 * Wrap async function with context preservation
 */
export function wrapWithContext<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  spanName?: string,
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const currentContext = getCurrentContext();
    const activeContext = otelContext.active();

    return otelContext.with(activeContext, async () => {
      if (currentContext) {
        return runWithContext(currentContext, async () => {
          if (spanName && currentContext.span) {
            const tracer = trace.getTracer('puppeteer-mcp');
            const span = tracer.startSpan(spanName, {
              parent: currentContext.span,
            });

            try {
              const result = await fn(...args);
              span.setStatus({ code: trace.SpanStatusCode.OK });
              return result;
            } catch (error) {
              span.setStatus({
                code: trace.SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
              });
              throw error;
            } finally {
              span.end();
            }
          }

          return fn(...args);
        });
      }

      return fn(...args);
    });
  }) as T;
}

/**
 * Create child span in current context
 */
export function createChildSpan(name: string, attributes?: Record<string, any>): Span | undefined {
  const context = getCurrentContext();
  if (!context?.span) {
    return undefined;
  }

  const tracer = trace.getTracer('puppeteer-mcp');
  return tracer.startSpan(name, {
    parent: context.span,
    attributes: {
      ...context.attributes,
      ...attributes,
    },
  });
}

/**
 * Add attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, any>): void {
  const context = getCurrentContext();
  if (context?.span) {
    context.span.setAttributes(attributes);
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
  const context = getCurrentContext();
  if (context?.span) {
    context.span.addEvent(name, attributes);
  }
}

/**
 * Set span status
 */
export function setSpanStatus(code: trace.SpanStatusCode, message?: string): void {
  const context = getCurrentContext();
  if (context?.span) {
    context.span.setStatus({ code, message });
  }
}

/**
 * Get trace ID from current context
 */
export function getTraceId(): string | undefined {
  const context = getCurrentContext();
  return context?.span?.spanContext().traceId;
}

/**
 * Get span ID from current context
 */
export function getSpanId(): string | undefined {
  const context = getCurrentContext();
  return context?.span?.spanContext().spanId;
}

/**
 * Correlation ID for log integration
 */
export function getCorrelationIds(): {
  traceId?: string;
  spanId?: string;
  requestId?: string;
} {
  const context = getCurrentContext();
  return {
    traceId: context?.span?.spanContext().traceId,
    spanId: context?.span?.spanContext().spanId,
    requestId: context?.requestId,
  };
}
