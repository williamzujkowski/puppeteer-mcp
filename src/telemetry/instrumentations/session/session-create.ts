/**
 * Session creation instrumentation
 * @module telemetry/instrumentations/session/session-create
 * @nist au-2 "Audit events"
 */

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { SessionData } from '../../../types/session.js';
import { appMetrics } from '../../metrics/index.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session creation method
 */
export function instrumentCreate(ctx: InstrumentationContext): void {
  const { tracer, store } = ctx;
  const originalCreate = store.create.bind(store);

  store.create = async function(data: SessionData): Promise<string> {
    const span = tracer.startSpan('session.create', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'create',
        'session.user_id': data.userId,
        'session.has_metadata': Boolean(data.metadata),
      },
    });

    try {
      const sessionId = await context.with(
        trace.setSpan(context.active(), span),
        async () => originalCreate(data)
      );

      span.setAttributes({
        'session.id': sessionId,
        'session.created_at': data.createdAt,
        'session.success': true,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      // Record metrics
      appMetrics.session.sessionCreated.add(1, { user_id: data.userId });
      appMetrics.session.sessionActiveSessions.add(1);

      return sessionId;
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