/**
 * MCP metrics module
 * @module telemetry/metrics/app-metrics/mcp-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { McpMetrics } from './types.js';

/**
 * MCP metrics implementation
 */
export class McpMetricsImpl implements McpMetrics {
  public readonly meter: Meter;
  public readonly mcpRequestsTotal;
  public readonly mcpRequestDuration;
  public readonly mcpActiveConnections;
  public readonly mcpToolCalls;
  public readonly mcpErrors;

  constructor(meter: Meter) {
    this.meter = meter;
    
    this.mcpRequestsTotal = meter.createCounter('mcp_requests_total', {
      description: 'Total number of MCP requests',
      unit: '1',
    });
    
    this.mcpRequestDuration = meter.createHistogram('mcp_request_duration_ms', {
      description: 'MCP request duration in milliseconds',
      unit: 'ms',
    });
    
    this.mcpActiveConnections = meter.createUpDownCounter('mcp_active_connections', {
      description: 'Number of active MCP connections',
      unit: '1',
    });
    
    this.mcpToolCalls = meter.createCounter('mcp_tool_calls_total', {
      description: 'Total number of MCP tool calls',
      unit: '1',
    });
    
    this.mcpErrors = meter.createCounter('mcp_errors_total', {
      description: 'Total number of MCP errors',
      unit: '1',
    });
  }

  /**
   * Record MCP request
   */
  recordMcpRequest(
    method: string,
    duration: number,
    success: boolean,
  ): void {
    const labels = {
      method,
      success: success.toString(),
    };
    
    this.mcpRequestsTotal.add(1, labels);
    this.mcpRequestDuration.record(duration, labels);
  }

  /**
   * Record MCP connection
   */
  recordMcpConnection(): void {
    this.mcpActiveConnections.add(1);
  }

  /**
   * Record MCP disconnection
   */
  recordMcpDisconnection(): void {
    this.mcpActiveConnections.add(-1);
  }

  /**
   * Record MCP tool call
   */
  recordMcpToolCall(
    toolName: string,
    duration: number,
    success: boolean,
  ): void {
    const labels = {
      tool_name: toolName,
      success: success.toString(),
    };
    
    this.mcpToolCalls.add(1, labels);
    
    // Also record duration for tool calls
    const toolCallDuration = this.meter.createHistogram('mcp_tool_call_duration_ms', {
      description: 'MCP tool call duration in milliseconds',
      unit: 'ms',
    });
    
    toolCallDuration.record(duration, labels);
  }

  /**
   * Record MCP error
   */
  recordMcpError(
    errorType: string,
    method: string,
    severity: string = 'error',
  ): void {
    this.mcpErrors.add(1, {
      error_type: errorType,
      method,
      severity,
    });
  }

  /**
   * Record MCP protocol event
   */
  recordMcpProtocolEvent(
    eventType: string,
    direction: 'inbound' | 'outbound',
  ): void {
    const protocolEventsCounter = this.meter.createCounter('mcp_protocol_events_total', {
      description: 'Total number of MCP protocol events',
      unit: '1',
    });
    
    protocolEventsCounter.add(1, {
      event_type: eventType,
      direction,
    });
  }
}