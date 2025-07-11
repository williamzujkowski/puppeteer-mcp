/**
 * Session get instrumentation
 * @module telemetry/instrumentations/session/session-get
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Session } from '../../../types/session.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session get method
 */
export function instrumentGet(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalGet = store.get.bind(store);

  store.get = async function (sessionId: string): Promise<Session | null> {
    const span = tracer.startSpan('session.get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'get',
        'session.id': sessionId,
      },
    });

    try {
      const session = await context.with(trace.setSpan(context.active(), span), async () =>
        originalGet(sessionId),
      );

      const found = Boolean(session);
      span.setAttributes({
        'session.found': found,
        'session.success': true,
      });

      if (session) {
        span.setAttributes({
          'session.user_id': session.data.userId,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return session;
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
