/**
 * Session modify instrumentation
 * @module telemetry/instrumentations/session/session-modify
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Session, SessionData } from '../../../types/session.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session update method
 */
export function instrumentUpdate(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalUpdate = store.update.bind(store);

  store.update = async function (
    sessionId: string,
    data: Partial<SessionData>,
  ): Promise<Session | null> {
    const span = tracer.startSpan('session.update', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'update',
        'session.id': sessionId,
        'session.update_fields': Object.keys(data).join(','),
      },
    });

    try {
      const session = await context.with(trace.setSpan(context.active(), span), async () =>
        originalUpdate(sessionId, data),
      );

      const updated = Boolean(session);
      span.setAttributes({
        'session.updated': updated,
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
