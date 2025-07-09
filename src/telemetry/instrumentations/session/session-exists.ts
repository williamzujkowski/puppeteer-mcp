/**
 * Session exists instrumentation
 * @module telemetry/instrumentations/session/session-exists
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session exists method
 */
export function instrumentExists(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalExists = store.exists.bind(store);

  store.exists = async function(sessionId: string): Promise<boolean> {
    const span = tracer.startSpan('session.exists', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'exists',
        'session.id': sessionId,
      },
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => originalExists(sessionId)
      );

      span.setAttributes({
        'session.exists': result,
        'session.success': true,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      
      span.setAttributes({
        'session.success': false,
        'session.error': errorMessage,
      });

      throw error;
    } finally {
      span.end();
    }
  };
}