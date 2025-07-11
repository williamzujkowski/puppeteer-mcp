/**
 * gRPC metrics module
 * @module telemetry/metrics/app-metrics/grpc-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { GrpcMetrics, GrpcCallLabels } from './types.js';

/**
 * gRPC metrics implementation
 */
export class GrpcMetricsImpl implements GrpcMetrics {
  public readonly meter: Meter;
  public readonly grpcCallsTotal;
  public readonly grpcCallDuration;
  public readonly grpcMessagesSent;
  public readonly grpcMessagesReceived;
  public readonly grpcActiveStreams;

  constructor(meter: Meter) {
    this.meter = meter;

    this.grpcCallsTotal = meter.createCounter('grpc_calls_total', {
      description: 'Total number of gRPC calls',
      unit: '1',
    });

    this.grpcCallDuration = meter.createHistogram('grpc_call_duration_ms', {
      description: 'gRPC call duration in milliseconds',
      unit: 'ms',
    });

    this.grpcMessagesSent = meter.createCounter('grpc_messages_sent_total', {
      description: 'Total number of gRPC messages sent',
      unit: '1',
    });

    this.grpcMessagesReceived = meter.createCounter('grpc_messages_received_total', {
      description: 'Total number of gRPC messages received',
      unit: '1',
    });

    this.grpcActiveStreams = meter.createUpDownCounter('grpc_active_streams', {
      description: 'Number of active gRPC streams',
      unit: '1',
    });
  }

  /**
   * Record gRPC call metrics
   */
  recordGrpcCall(service: string, method: string, status: string, duration: number): void {
    const labels: GrpcCallLabels = {
      service,
      method,
      status,
    };

    this.grpcCallsTotal.add(1, labels);
    this.grpcCallDuration.record(duration, labels);
  }

  /**
   * Record gRPC message sent
   */
  recordMessageSent(service: string, method: string): void {
    this.grpcMessagesSent.add(1, { service, method });
  }

  /**
   * Record gRPC message received
   */
  recordMessageReceived(service: string, method: string): void {
    this.grpcMessagesReceived.add(1, { service, method });
  }

  /**
   * Increment active streams
   */
  incrementActiveStreams(): void {
    this.grpcActiveStreams.add(1);
  }

  /**
   * Decrement active streams
   */
  decrementActiveStreams(): void {
    this.grpcActiveStreams.add(-1);
  }
}
