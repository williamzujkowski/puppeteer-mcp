/**
 * Session list instrumentation
 * @module telemetry/instrumentations/session/session-list
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Session } from '../../../types/session.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session getByUserId method
 */
export function instrumentGetByUserId(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalGetByUserId = store.getByUserId.bind(store);

  store.getByUserId = async function(userId: string): Promise<Session[]> {
    const span = tracer.startSpan('session.getByUserId', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'getByUserId',
        'session.user_id': userId,
      },
    });

    try {
      const sessions = await context.with(
        trace.setSpan(context.active(), span),
        async () => originalGetByUserId(userId)
      );

      span.setAttributes({
        'session.count': sessions.length,
        'session.success': true,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return sessions;
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