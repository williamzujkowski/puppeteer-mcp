/**
 * Session cleanup instrumentation
 * @module telemetry/instrumentations/session/session-cleanup
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { appMetrics } from '../../metrics/index.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session deleteExpired method
 */
export function instrumentDeleteExpired(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalDeleteExpired = store.deleteExpired.bind(store);

  store.deleteExpired = async function(): Promise<number> {
    const span = tracer.startSpan('session.deleteExpired', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'deleteExpired',
      },
    });

    try {
      const count = await context.with(
        trace.setSpan(context.active(), span),
        async () => originalDeleteExpired()
      );

      span.setAttributes({
        'session.deleted_count': count,
        'session.success': true,
      });

      // Record metrics for expired session cleanup
      if (count > 0) {
        appMetrics.sessionDestroyed.add(count, { reason: 'cleanup' });
        appMetrics.sessionActiveSessions.add(-count);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return count;
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