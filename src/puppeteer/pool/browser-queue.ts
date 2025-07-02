/**
 * Browser Pool Queue Management
 * @module puppeteer/pool/browser-queue
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';

const logger = createLogger('browser-queue');

/**
 * Queue request for browser acquisition
 */
export interface QueueRequest {
  sessionId: string;
  priority: number;
  timestamp: Date;
  timeout: number;
  resolve: (instance: BrowserInstance) => void;
  reject: (error: Error) => void;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Browser acquisition queue
 * @nist ac-4 "Information flow enforcement"
 */
export class BrowserQueue extends EventEmitter {
  private queue: QueueRequest[] = [];
  private processing = false;

  /**
   * Add request to queue
   */
  enqueue(request: Omit<QueueRequest, 'timestamp'>): void {
    const queueRequest: QueueRequest = {
      ...request,
      timestamp: new Date(),
    };

    // Set timeout
    queueRequest.timeoutHandle = setTimeout(() => {
      this.removeRequest(queueRequest);
      queueRequest.reject(new Error('Browser acquisition timeout'));
    }, request.timeout);

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(r => r.priority < request.priority);
    if (insertIndex === -1) {
      this.queue.push(queueRequest);
    } else {
      this.queue.splice(insertIndex, 0, queueRequest);
    }

    logger.debug({
      sessionId: request.sessionId,
      priority: request.priority,
      queueLength: this.queue.length,
    }, 'Request queued for browser acquisition');

    this.emit('request:queued', { sessionId: request.sessionId });
  }

  /**
   * Process next request in queue
   */
  processNext(instance: BrowserInstance): boolean {
    if (this.processing || this.queue.length === 0) {
      return false;
    }

    this.processing = true;

    try {
      const request = this.queue.shift();
      if (!request) {
        return false;
      }

      // Clear timeout
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
      }

      // Resolve the request
      request.resolve(instance);

      logger.debug({
        sessionId: request.sessionId,
        browserId: instance.id,
        waitTime: Date.now() - request.timestamp.getTime(),
      }, 'Browser acquisition request fulfilled');

      this.emit('request:fulfilled', { 
        sessionId: request.sessionId,
        browserId: instance.id,
      });

      return true;

    } finally {
      this.processing = false;
    }
  }

  /**
   * Remove request from queue
   */
  private removeRequest(request: QueueRequest): void {
    const index = this.queue.indexOf(request);
    if (index !== -1) {
      this.queue.splice(index, 1);
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
      }
    }
  }

  /**
   * Cancel all requests for a session
   */
  cancelSession(sessionId: string): number {
    const requests = this.queue.filter(r => r.sessionId === sessionId);
    
    for (const request of requests) {
      this.removeRequest(request);
      request.reject(new Error('Session cancelled'));
    }

    if (requests.length > 0) {
      logger.info({
        sessionId,
        cancelledCount: requests.length,
      }, 'Cancelled browser acquisition requests for session');
    }

    return requests.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    length: number;
    oldestWaitTime: number | null;
    priorityCounts: Record<number, number>;
  } {
    const now = Date.now();
    const oldestWaitTime = this.queue.length > 0 && this.queue[0]
      ? now - this.queue[0].timestamp.getTime()
      : null;

    const priorityCounts: Record<number, number> = {};
    for (const request of this.queue) {
      priorityCounts[request.priority] = (priorityCounts[request.priority] ?? 0) + 1;
    }

    return {
      length: this.queue.length,
      oldestWaitTime,
      priorityCounts,
    };
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    for (const request of this.queue) {
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
      }
      request.reject(new Error('Queue cleared'));
    }

    const clearedCount = this.queue.length;
    this.queue = [];

    if (clearedCount > 0) {
      logger.warn({ clearedCount }, 'Cleared all browser acquisition requests');
    }
  }
}