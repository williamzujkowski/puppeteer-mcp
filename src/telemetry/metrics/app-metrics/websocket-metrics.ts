/**
 * WebSocket metrics module
 * @module telemetry/metrics/app-metrics/websocket-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { WebSocketMetrics } from './types.js';

/**
 * WebSocket metrics implementation
 */
export class WebSocketMetricsImpl implements WebSocketMetrics {
  public readonly meter: Meter;
  public readonly wsConnectionsTotal;
  public readonly wsActiveConnections;
  public readonly wsMessagesSent;
  public readonly wsMessagesReceived;
  public readonly wsMessageSize;

  constructor(meter: Meter) {
    this.meter = meter;

    this.wsConnectionsTotal = meter.createCounter('ws_connections_total', {
      description: 'Total number of WebSocket connections',
      unit: '1',
    });

    this.wsActiveConnections = meter.createUpDownCounter('ws_active_connections', {
      description: 'Number of active WebSocket connections',
      unit: '1',
    });

    this.wsMessagesSent = meter.createCounter('ws_messages_sent_total', {
      description: 'Total number of WebSocket messages sent',
      unit: '1',
    });

    this.wsMessagesReceived = meter.createCounter('ws_messages_received_total', {
      description: 'Total number of WebSocket messages received',
      unit: '1',
    });

    this.wsMessageSize = meter.createHistogram('ws_message_size_bytes', {
      description: 'WebSocket message size in bytes',
      unit: 'By',
    });
  }

  /**
   * Record WebSocket connection
   */
  recordConnection(): void {
    this.wsConnectionsTotal.add(1);
    this.wsActiveConnections.add(1);
  }

  /**
   * Record WebSocket disconnection
   */
  recordDisconnection(): void {
    this.wsActiveConnections.add(-1);
  }

  /**
   * Record WebSocket message sent
   */
  recordMessageSent(messageSize: number = 0): void {
    this.wsMessagesSent.add(1);

    if (messageSize > 0) {
      this.wsMessageSize.record(messageSize, { direction: 'sent' });
    }
  }

  /**
   * Record WebSocket message received
   */
  recordMessageReceived(messageSize: number = 0): void {
    this.wsMessagesReceived.add(1);

    if (messageSize > 0) {
      this.wsMessageSize.record(messageSize, { direction: 'received' });
    }
  }
}
