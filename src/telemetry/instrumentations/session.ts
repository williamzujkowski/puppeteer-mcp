/**
 * Session management instrumentation for OpenTelemetry
 * @module telemetry/instrumentations/session
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { Session, SessionData } from '../../types/session.js';
import { getTracer } from '../index.js';
import { appMetrics } from '../metrics/index.js';

/**
 * Wrap session store with telemetry
 */
export function instrumentSessionStore(store: SessionStore): SessionStore {
  const tracer = getTracer('session-store');
  
  // Wrap create method
  const originalCreate = store.create.bind(store);
  store.create = async function(data: SessionData): Promise<string> {
    const span = tracer.startSpan('session.create', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'create',
        'session.user_id': data.userId,
        'session.has_metadata': !!data.metadata,
      },
    });
    
    try {
      const sessionId = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalCreate(data);
      });
      
      span.setAttributes({
        'session.id': sessionId,
        'session.created_at': data.createdAt,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      
      // Record metrics
      appMetrics.sessionCreated.add(1, { user_id: data.userId });
      appMetrics.sessionActiveSessions.add(1);
      
      return sessionId;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap get method
  const originalGet = store.get.bind(store);
  store.get = async function(sessionId: string): Promise<Session | null> {
    const span = tracer.startSpan('session.get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'get',
        'session.id': sessionId,
      },
    });
    
    try {
      const session = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalGet(sessionId);
      });
      
      span.setAttributes({
        'session.found': !!session,
      });
      
      if (session) {
        span.setAttributes({
          'session.user_id': session.data.userId,
        });
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      return session;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap update method
  const originalUpdate = store.update.bind(store);
  store.update = async function(
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
      const session = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalUpdate(sessionId, data);
      });
      
      span.setAttributes({
        'session.updated': !!session,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return session;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap delete method
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
      
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalDelete(sessionId);
      });
      
      span.setAttributes({
        'session.deleted': result,
      });
      
      if (result && session) {
        // Calculate session duration
        const duration = (Date.now() - new Date(session.data.createdAt).getTime()) / 1000; // seconds
        
        // Record metrics
        appMetrics.sessionDestroyed.add(1, { user_id: session.data.userId });
        appMetrics.sessionDuration.record(duration, { user_id: session.data.userId });
        appMetrics.sessionActiveSessions.add(-1);
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap deleteExpired method
  const originalDeleteExpired = store.deleteExpired.bind(store);
  store.deleteExpired = async function(): Promise<number> {
    const span = tracer.startSpan('session.deleteExpired', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'deleteExpired',
      },
    });
    
    try {
      const count = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalDeleteExpired();
      });
      
      span.setAttributes({
        'session.deleted_count': count,
      });
      
      // Record metrics
      if (count > 0) {
        appMetrics.sessionDestroyed.add(count, { reason: 'cleanup' });
        appMetrics.sessionActiveSessions.add(-count);
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      return count;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap getByUserId method
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
      const sessions = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalGetByUserId(userId);
      });
      
      span.setAttributes({
        'session.count': sessions.length,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return sessions;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap exists method
  const originalExists = store.exists.bind(store);
  store.exists = async function(id: string): Promise<boolean> {
    const span = tracer.startSpan('session.exists', {
      kind: SpanKind.CLIENT,
      attributes: {
        'session.operation': 'exists',
        'session.id': id,
      },
    });
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalExists(id);
      });
      
      span.setAttributes({
        'session.exists': result,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Wrap touch method if it exists
  if ('touch' in store && typeof store.touch === 'function') {
    const originalTouch = store.touch.bind(store);
    store.touch = async function(sessionId: string): Promise<boolean> {
      const span = tracer.startSpan('session.touch', {
        kind: SpanKind.CLIENT,
        attributes: {
          'session.operation': 'touch',
          'session.id': sessionId,
        },
      });
      
      try {
        const result = await context.with(trace.setSpan(context.active(), span), async () => {
          return originalTouch(sessionId);
        });
        
        span.setAttributes({
          'session.touched': result,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    };
  }
  
  return store;
}

/**
 * Create session activity span
 */
export function createSessionActivitySpan(
  sessionId: string,
  activity: string,
  attributes?: Record<string, any>,
): any {
  const tracer = getTracer('session-activity');
  
  return tracer.startSpan(`session.activity.${activity}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'session.id': sessionId,
      'session.activity': activity,
      ...attributes,
    },
  });
}