/**
 * Span creation and trace management
 * @module telemetry/instrumentations/puppeteer/trace-manager
 * @nist au-2 "Audit events"
 */

import { trace, context, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import { getTracer } from '../../index.js';
import { enrichAttributes } from './span-attributes.js';
import type { SpanCreator, PerformanceTiming } from './types.js';

/**
 * Create a new span with standardized configuration
 */
export function createSpan(
  name: string,
  attributes?: Record<string, unknown>,
  kind: SpanKind = SpanKind.CLIENT,
): Span {
  const tracer = getTracer('puppeteer');

  return tracer.startSpan(name, {
    kind,
    attributes: enrichAttributes(attributes ?? {}),
  }) as Span;
}

/**
 * Create and start an active span
 */
export function withActiveSpan<T>(
  name: string,
  attributes: Record<string, unknown>,
  fn: (span: Span) => Promise<T>,
  kind: SpanKind = SpanKind.CLIENT,
): Promise<T> {
  const tracer = getTracer('puppeteer');

  return tracer.startActiveSpan(
    name,
    {
      kind,
      attributes: enrichAttributes(attributes),
    },
    async (span: Span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        recordError(span, error as Error);
        throw error;
      } finally {
        span.end();
      }
    },
  ) as Promise<T>;
}

/**
 * Execute function with span context
 */
export async function withSpanContext<T>(span: Span, fn: () => Promise<T>): Promise<T> {
  return context.with(trace.setSpan(context.active(), span), fn);
}

/**
 * Record error in span with standardized format
 */
export function recordError(span: Span, error: Error): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  // Add error attributes
  span.setAttributes({
    'error.name': error.name,
    'error.message': error.message,
    'error.stack': error.stack ?? '',
    'error.timestamp': Date.now(),
  });
}

/**
 * Record success status in span
 */
export function recordSuccess(span: Span, attributes?: Record<string, unknown>): void {
  span.setStatus({ code: SpanStatusCode.OK });

  if (attributes) {
    span.setAttributes(attributes);
  }
}

/**
 * Add timing information to span
 */
export function addTiming(span: Span, timing: PerformanceTiming): void {
  const duration = timing.endTime
    ? timing.endTime - timing.startTime
    : Date.now() - timing.startTime;

  span.setAttributes({
    'timing.start': timing.startTime,
    'timing.duration': duration,
  });

  if (timing.endTime) {
    span.setAttributes({
      'timing.end': timing.endTime,
    });
  }
}

/**
 * Create span creator function with predefined attributes
 */
export function createSpanCreator(baseAttributes: Record<string, any>): SpanCreator {
  return (name: string, additionalAttributes?: Record<string, any>): Span => {
    return createSpan(name, {
      ...baseAttributes,
      ...additionalAttributes,
    });
  };
}

/**
 * Finish span with timing and status
 */
export function finishSpan(span: Span, startTime: number, success: boolean, error?: Error): void {
  const duration = Date.now() - startTime;

  span.setAttributes({
    'timing.duration': duration,
  });

  if (success) {
    recordSuccess(span);
  } else if (error) {
    recordError(span, error);
  } else {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Operation failed',
    });
  }

  span.end();
}

/**
 * Finish span with timing, status and additional attributes
 */
export function finishSpanWithAttributes(
  span: Span,
  startTime: number,
  success: boolean,
  attributes: Record<string, unknown>,
): void {
  const duration = Date.now() - startTime;

  span.setAttributes({
    'timing.duration': duration,
    ...attributes,
  });

  if (success) {
    recordSuccess(span);
  } else {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Operation failed',
    });
  }

  span.end();
}

/**
 * Create child span from current context
 */
export function createChildSpan(
  name: string,
  attributes?: Record<string, unknown>,
  kind: SpanKind = SpanKind.CLIENT,
): Span {
  const tracer = getTracer('puppeteer');
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    return tracer.startSpan(
      name,
      {
        kind,
        attributes: enrichAttributes(attributes ?? {}),
      },
      trace.setSpan(context.active(), activeSpan),
    ) as Span;
  }

  return createSpan(name, attributes, kind);
}

/**
 * Get current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Check if there's an active trace
 */
export function hasActiveTrace(): boolean {
  return trace.getActiveSpan() !== undefined;
}

/**
 * Create a span for measuring operation performance
 */
export async function measureOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();
  const span = createSpan(`measure.${operationName}`, {
    'operation.name': operationName,
    'operation.start': startTime,
    ...attributes,
  });

  try {
    const result = await withSpanContext(span, operation);

    const duration = Date.now() - startTime;
    span.setAttributes({
      'operation.duration': duration,
      'operation.success': true,
    });

    recordSuccess(span);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    span.setAttributes({
      'operation.duration': duration,
      'operation.success': false,
    });

    recordError(span, error as Error);
    throw error;
  } finally {
    span.end();
  }
}
