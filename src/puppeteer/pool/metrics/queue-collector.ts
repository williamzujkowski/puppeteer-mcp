/**
 * Queue metrics collector for browser pool
 * @module puppeteer/pool/metrics/queue-collector
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { BaseMetricCollector } from './base-collector.js';
import {
  MetricEventType,
} from './types.js';
import type {
  QueueMetrics,
  MetricCollector,
  MetricDataPoint,
} from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('queue-collector');

/**
 * Collects queue-related metrics
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */
export class QueueMetricsCollector
  extends BaseMetricCollector
  implements MetricCollector<QueueMetrics>
{
  private queueWaitTimes: number[] = [];
  private totalQueued = 0;
  private totalDequeued = 0;
  private currentQueueLength = 0;
  private queueLengthHistory: MetricDataPoint[] = [];

  /**
   * Record queue addition
   * @nist au-3 "Content of audit records"
   */
  recordQueueAdd(): void {
    this.totalQueued++;
    this.currentQueueLength++;
    this.recordQueueLength();

    logger.debug({ queueLength: this.currentQueueLength }, 'Item added to queue');

    this.notify({
      type: MetricEventType.QUEUE_UPDATED,
      timestamp: new Date(),
      data: {
        action: 'add',
        queueLength: this.currentQueueLength,
        totalQueued: this.totalQueued,
      },
    });
  }

  /**
   * Record queue removal with wait time
   * @nist au-3 "Content of audit records"
   */
  recordQueueRemove(waitTime: number): void {
    this.totalDequeued++;
    this.currentQueueLength = Math.max(0, this.currentQueueLength - 1);
    this.queueWaitTimes.push(waitTime);
    this.limitArraySize(this.queueWaitTimes);
    this.recordQueueLength();

    logger.debug(
      { queueLength: this.currentQueueLength, waitTime },
      'Item removed from queue'
    );

    this.notify({
      type: MetricEventType.QUEUE_UPDATED,
      timestamp: new Date(),
      data: {
        action: 'remove',
        queueLength: this.currentQueueLength,
        totalDequeued: this.totalDequeued,
        waitTime,
      },
    });
  }

  /**
   * Get queue length history
   */
  getQueueLengthHistory(): MetricDataPoint[] {
    return [...this.queueLengthHistory];
  }

  /**
   * Collect queue metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  collect(): QueueMetrics {
    return {
      queueLength: this.currentQueueLength,
      averageWaitTime: this.calculateAverage(this.queueWaitTimes),
      maxWaitTime: Math.max(0, ...this.queueWaitTimes),
      totalQueued: this.totalQueued,
      totalDequeued: this.totalDequeued,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.queueWaitTimes = [];
    this.totalQueued = 0;
    this.totalDequeued = 0;
    this.currentQueueLength = 0;
    this.queueLengthHistory = [];

    logger.info('Queue metrics reset');
  }

  /**
   * Record current queue length for time series
   * @private
   */
  private recordQueueLength(): void {
    this.addTimeSeriesDataPoint(this.queueLengthHistory, this.currentQueueLength);
  }
}