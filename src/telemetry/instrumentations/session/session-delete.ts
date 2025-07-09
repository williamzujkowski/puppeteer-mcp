/**
 * Session deletion instrumentation
 * @module telemetry/instrumentations/session/session-delete
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { appMetrics } from '../../metrics/index.js';
import { recordSessionDuration } from './session-metrics.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session delete method
 */
export function instrumentDelete(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalDelete = store.delete.bind(store);

  store.delete = async function(sessionId: string): Promise<boolean> {
    const span = tracer.startSpan('session.delete', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'delete',
        'session.id': sessionId,
      },
    });

    try {
      // Get session details before deletion for metrics
      const session = await store.get(sessionId);

      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => originalDelete(sessionId)
      );

      span.setAttributes({
        'session.deleted': result,
        'session.success': true,
      });

      if (result && session) {
        span.setAttributes({
          'session.user_id': session.data.userId,
        });

        // Record session duration and metrics
        recordSessionDuration(session);
        appMetrics.session.sessionDestroyed.add(1, { user_id: session.data.userId });
        appMetrics.session.sessionActiveSessions.add(-1);
      }

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