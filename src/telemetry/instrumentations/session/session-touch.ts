/**
 * Session touch instrumentation
 * @module telemetry/instrumentations/session/session-touch
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session touch method (if available)
 */
export function instrumentTouch(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;

  // Check if touch method exists
  if (!('touch' in store) || typeof store.touch !== 'function') {
    return;
  }

  const originalTouch = store.touch.bind(store);

  store.touch = async function (sessionId: string): Promise<boolean> {
    const span = tracer.startSpan('session.touch', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'touch',
        'session.id': sessionId,
      },
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () =>
        originalTouch(sessionId),
      );

      span.setAttributes({
        'session.touched': result,
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
