/**
 * Context proxy management
 * @module puppeteer/proxy/manager/context-manager
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import type { ProxyRotationEvent } from '../../types/proxy.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';

const logger = createLogger('proxy-context-manager');

/**
 * Manages proxy assignments for contexts
 */
export class ProxyContextManager extends EventEmitter {
  private contextProxies = new Map<string, string>();
  private rotationTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Assign a proxy to a context
   */
  assignProxy(contextId: string, proxyId: string): void {
    this.contextProxies.set(contextId, proxyId);

    logger.info({
      msg: 'Proxy assigned to context',
      contextId,
      proxyId,
    });
  }

  /**
   * Get proxy for a context
   */
  getContextProxy(contextId: string): string | undefined {
    return this.contextProxies.get(contextId);
  }

  /**
   * Remove context proxy assignment
   */
  removeContext(contextId: string): void {
    const proxyId = this.contextProxies.get(contextId);
    if (proxyId !== undefined) {
      this.contextProxies.delete(contextId);
      this.clearRotationTimer(contextId);

      logger.info({
        msg: 'Context proxy assignment removed',
        contextId,
        proxyId,
      });
    }
  }

  /**
   * Rotate proxy for a context
   */
  async rotateProxy(
    contextId: string,
    newProxyId: string,
    reason: 'scheduled' | 'error' | 'health' | 'manual',
  ): Promise<ProxyRotationEvent> {
    const oldProxyId = this.contextProxies.get(contextId);
    this.contextProxies.set(contextId, newProxyId);

    const rotationEvent: ProxyRotationEvent = {
      contextId,
      oldProxyId,
      newProxyId,
      reason,
      timestamp: new Date(),
    };

    this.emit('proxy:rotated', rotationEvent);

    logger.info({
      msg: 'Proxy rotated for context',
      contextId,
      oldProxyId,
      newProxyId,
      reason,
    });

    await logSecurityEvent(SecurityEventType.RESOURCE_UPDATED, {
      resource: `context:${contextId}`,
      action: 'proxy_rotation',
      reason,
    });

    return rotationEvent;
  }

  /**
   * Schedule rotation for a context
   */
  scheduleRotation(
    contextId: string,
    intervalMs: number,
    rotationCallback: () => Promise<void>,
  ): void {
    this.clearRotationTimer(contextId);

    const timer = setInterval(() => {
      void (async () => {
        try {
          await rotationCallback();
        } catch (error) {
          logger.error({
            msg: 'Scheduled rotation failed',
            contextId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })();
    }, intervalMs);

    this.rotationTimers.set(contextId, timer);

    logger.info({
      msg: 'Proxy rotation scheduled',
      contextId,
      intervalMs,
    });
  }

  /**
   * Clear rotation timer
   */
  clearRotationTimer(contextId: string): void {
    const timer = this.rotationTimers.get(contextId);
    if (timer) {
      clearInterval(timer);
      this.rotationTimers.delete(contextId);
    }
  }

  /**
   * Get all context assignments
   */
  getAllAssignments(): Map<string, string> {
    return new Map(this.contextProxies);
  }

  /**
   * Get contexts using a specific proxy
   */
  getContextsUsingProxy(proxyId: string): string[] {
    const contexts: string[] = [];
    for (const [contextId, assignedProxyId] of this.contextProxies) {
      if (assignedProxyId === proxyId) {
        contexts.push(contextId);
      }
    }
    return contexts;
  }

  /**
   * Clear all context assignments
   */
  clear(): void {
    // Clear all rotation timers
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();
    this.contextProxies.clear();
  }
}
