/**
 * Session metrics recording utilities
 * @module telemetry/instrumentations/session/session-metrics
 * @nist au-2 "Audit events"
 */

import { SpanKind, type Span } from '@opentelemetry/api';
import type { Session } from '../../../types/session.js';
import { appMetrics } from '../../metrics/index.js';
import { getTracer } from '../../index.js';
import type { MetricsLabels } from './types.js';

/**
 * Record session duration metrics
 */
export function recordSessionDuration(session: Session): void {
  const duration = calculateSessionDuration(session);
  
  const labels: MetricsLabels = {
    user_id: session.data.userId,
  };
  
  appMetrics.session.sessionDuration.record(duration, labels);
}

/**
 * Calculate session duration in seconds
 */
function calculateSessionDuration(session: Session): number {
  const now = Date.now();
  const createdAt = new Date(session.data.createdAt).getTime();
  return Math.floor((now - createdAt) / 1000);
}

/**
 * Record session creation metrics
 */
export function recordSessionCreated(userId: string): void {
  const labels: MetricsLabels = {
    user_id: userId,
  };
  
  appMetrics.session.sessionCreated.add(1, labels);
  appMetrics.session.sessionActiveSessions.add(1);
}

/**
 * Record session destruction metrics
 */
export function recordSessionDestroyed(userId: string, reason = 'manual'): void {
  const labels: MetricsLabels = {
    user_id: userId,
    reason,
  };
  
  appMetrics.session.sessionDestroyed.add(1, labels);
  appMetrics.session.sessionActiveSessions.add(-1);
}

/**
 * Record bulk session destruction metrics
 */
export function recordBulkSessionDestroyed(count: number, reason = 'cleanup'): void {
  const labels: MetricsLabels = {
    reason,
  };
  
  appMetrics.session.sessionDestroyed.add(count, labels);
  appMetrics.session.sessionActiveSessions.add(-count);
}

/**
 * Create session activity span for custom tracking
 */
export function createSessionActivitySpan(
  sessionId: string,
  activity: string,
  attributes: Record<string, string | number | boolean> = {}
): Span {
  const tracer = getTracer('session-activity');
  
  return tracer.startSpan(`session.activity.${activity}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'session.id': sessionId,
      'session.activity': activity,
      ...attributes,
    },
  }) as Span;
}