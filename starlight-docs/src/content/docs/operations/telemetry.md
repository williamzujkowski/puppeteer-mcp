---
title: OpenTelemetry Integration
description: Comprehensive OpenTelemetry instrumentation for distributed tracing, performance monitoring, and observability in Puppeteer MCP
---

# OpenTelemetry Integration

This document describes the OpenTelemetry instrumentation added to puppeteer-mcp for distributed tracing and performance monitoring.

:::note[Production-Ready Observability]
Puppeteer MCP includes comprehensive OpenTelemetry instrumentation that provides enterprise-grade monitoring and observability out of the box.
:::

## Overview

The puppeteer-mcp project now includes comprehensive OpenTelemetry instrumentation that provides:

- **Distributed Tracing**: End-to-end visibility across all components
- **Performance Metrics**: Custom metrics for monitoring system health
- **Context Propagation**: Trace correlation across async operations
- **Log Correlation**: Automatic trace IDs in all logs
- **Multiple Exporters**: Support for Jaeger, Zipkin, and OTLP
- **Production-Ready**: Sampling strategies, health checks, and graceful shutdown

## Configuration

OpenTelemetry can be configured through environment variables:

### Basic Configuration

```bash
# Enable/disable telemetry (default: true)
TELEMETRY_ENABLED=true

# Service identification
TELEMETRY_SERVICE_NAME=puppeteer-mcp
TELEMETRY_SERVICE_VERSION=1.0.14
TELEMETRY_ENVIRONMENT=production
```

### Tracing Configuration

```bash
# Enable tracing (default: true)
TELEMETRY_TRACE_ENABLED=true

# Sampling rate (0.0-1.0, default: 0.1 = 10%)
TELEMETRY_TRACE_SAMPLING_RATE=0.1

# Trace exporter: otlp, jaeger, zipkin, console, none
TELEMETRY_TRACE_EXPORTER=otlp

# Exporter endpoints
TELEMETRY_TRACE_OTLP_ENDPOINT=http://localhost:4318/v1/traces
TELEMETRY_TRACE_JAEGER_ENDPOINT=http://localhost:14268/api/traces
TELEMETRY_TRACE_ZIPKIN_ENDPOINT=http://localhost:9411/api/v2/spans
```

### Metrics Configuration

```bash
# Enable metrics (default: true)
TELEMETRY_METRICS_ENABLED=true

# Metrics interval in ms (default: 60000 = 1 minute)
TELEMETRY_METRICS_INTERVAL=60000

# Metrics exporter: otlp, prometheus, console, none
TELEMETRY_METRICS_EXPORTER=otlp

# Exporter endpoints
TELEMETRY_METRICS_OTLP_ENDPOINT=http://localhost:4318/v1/metrics
TELEMETRY_METRICS_PROMETHEUS_PORT=9464
```

### Sampling Strategies

```bash
# Sampling strategy: always_on, always_off, trace_id_ratio, parent_based, adaptive
TELEMETRY_SAMPLING_STRATEGY=parent_based

# Adaptive sampling target rate (traces per second)
TELEMETRY_SAMPLING_ADAPTIVE_TARGET_RATE=100
```

### Instrumentation Control

```bash
# Enable/disable specific instrumentations
TELEMETRY_INSTRUMENT_HTTP=true
TELEMETRY_INSTRUMENT_EXPRESS=true
TELEMETRY_INSTRUMENT_GRPC=true
TELEMETRY_INSTRUMENT_REDIS=true
TELEMETRY_INSTRUMENT_WS=true
TELEMETRY_INSTRUMENT_PUPPETEER=true
```

### Debug Configuration

```bash
# Enable debug mode
TELEMETRY_DEBUG=false

# Telemetry log level: error, warn, info, debug, verbose
TELEMETRY_LOG_LEVEL=error
```

## Instrumented Components

### HTTP/Express

- Request/response tracing
- Route performance metrics
- Error tracking
- Request size metrics

### gRPC

- Call tracing
- Stream metrics
- Error rates
- Message counts

### WebSocket

- Connection lifecycle
- Message metrics
- Error tracking
- Active connection gauges

### Browser Automation (Puppeteer)

- Browser launch/close
- Page creation/navigation
- JavaScript execution
- Screenshot/PDF generation
- Resource usage metrics

### Session Management

- Session lifecycle
- Duration metrics
- Active session counts
- User activity tracking

### Authentication & Security

- Auth attempt tracking
- Security event correlation
- Rate limit monitoring
- CSRF validation

## Metrics

### HTTP Metrics

- `http_requests_total`: Total HTTP requests
- `http_request_duration_ms`: Request duration histogram
- `http_request_size_bytes`: Request size histogram
- `http_response_size_bytes`: Response size histogram
- `http_active_requests`: Active request gauge

### Browser Pool Metrics

- `browser_launched_total`: Total browsers launched
- `browser_closed_total`: Total browsers closed
- `browser_crashed_total`: Browser crash count
- `browser_launch_duration_ms`: Launch time histogram
- `browser_active`: Active browser gauge
- `page_created_total`: Total pages created
- `page_navigated_total`: Navigation count
- `pool_utilization_ratio`: Pool utilization (0-1)
- `pool_queue_length`: Waiting request count

### Session Metrics

- `session_created_total`: Sessions created
- `session_destroyed_total`: Sessions destroyed
- `session_duration_seconds`: Session lifetime histogram
- `session_active`: Active session gauge

### Error Metrics

- `errors_total`: Total errors by type
- `unhandled_exceptions_total`: Unhandled exceptions
- `validation_errors_total`: Validation failures

## Trace Correlation

All logs automatically include trace context:

```json
{
  "level": "info",
  "msg": "Processing request",
  "requestId": "abc123",
  "traceId": "32digithexstring",
  "spanId": "16digithexstring",
  "userId": "user123"
}
```

## Health Monitoring

### Telemetry Health Endpoint

```bash
GET /health/telemetry
```

Response:

```json
{
  "status": "healthy",
  "telemetry": {
    "initialized": true,
    "enabled": true,
    "status": "healthy",
    "components": {
      "tracing": {
        "enabled": true,
        "healthy": true,
        "exporter": "otlp",
        "samplingRate": 0.1
      },
      "metrics": {
        "enabled": true,
        "healthy": true,
        "exporter": "otlp",
        "exportInterval": 60000
      },
      "exporters": {
        "traces": true,
        "metrics": true,
        "errors": []
      },
      "resource": {
        "healthy": true,
        "warnings": [],
        "attributes": {
          "service.name": "puppeteer-mcp",
          "service.version": "1.0.14"
        }
      }
    },
    "errors": [],
    "warnings": [],
    "lastCheck": "2025-01-09T12:00:00Z"
  }
}
```

## Deployment Examples

### Docker Compose with Jaeger

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    image: puppeteer-mcp:latest
    environment:
      - TELEMETRY_ENABLED=true
      - TELEMETRY_TRACE_EXPORTER=jaeger
      - TELEMETRY_TRACE_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - TELEMETRY_METRICS_EXPORTER=prometheus
    ports:
      - '8443:8443'
      - '9464:9464' # Prometheus metrics
    depends_on:
      - jaeger

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - '16686:16686' # Jaeger UI
      - '14268:14268' # Jaeger collector
```

### Kubernetes with OpenTelemetry Collector

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: puppeteer-mcp-config
data:
  TELEMETRY_ENABLED: 'true'
  TELEMETRY_TRACE_EXPORTER: 'otlp'
  TELEMETRY_TRACE_OTLP_ENDPOINT: 'http://otel-collector:4318/v1/traces'
  TELEMETRY_METRICS_EXPORTER: 'otlp'
  TELEMETRY_METRICS_OTLP_ENDPOINT: 'http://otel-collector:4318/v1/metrics'
  TELEMETRY_SAMPLING_STRATEGY: 'adaptive'
  TELEMETRY_SAMPLING_ADAPTIVE_TARGET_RATE: '100'
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-mcp
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: puppeteer-mcp
          image: puppeteer-mcp:latest
          envFrom:
            - configMapRef:
                name: puppeteer-mcp-config
```

## Performance Considerations

:::tip[Optimization Best Practices]
1. **Sampling**: Use appropriate sampling rates to balance visibility and overhead
2. **Batch Processing**: Traces and metrics are batched before export
3. **Async Export**: Telemetry export doesn't block application code
4. **Resource Detection**: Automatic detection can be disabled if not needed
5. **Selective Instrumentation**: Disable unused instrumentations
:::

## Troubleshooting

### Debug Mode

Enable debug logging for telemetry:

```bash
TELEMETRY_DEBUG=true
TELEMETRY_LOG_LEVEL=debug
```

### Common Issues

1. **High Memory Usage**: Reduce `TELEMETRY_EXPORT_MAX_QUEUE_SIZE`
2. **Missing Traces**: Check exporter endpoints and network connectivity
3. **Performance Impact**: Lower sampling rate or disable unused instrumentations
4. **Export Failures**: Check `/health/telemetry` endpoint for errors

## Security Considerations

:::caution[Security Best Practices]
1. **Sensitive Data**: Telemetry automatically excludes sensitive fields
2. **PII Protection**: User IDs are included but PII is not exported
3. **Network Security**: Use TLS for exporter endpoints in production
4. **Access Control**: Protect telemetry endpoints with authentication
:::

## Testing

Run telemetry tests:

```bash
npm test -- tests/telemetry/
```

## Migration Guide

For existing deployments:

1. Telemetry is enabled by default but can be disabled
2. No breaking changes to existing APIs
3. Logs now include trace correlation automatically
4. Existing metrics remain available at `/metrics`
5. New telemetry metrics available via configured exporter

## Related Documentation

- [Operations Guide](/operations/) for operational procedures
- [Performance Testing](/testing/performance-testing) for monitoring performance
- [Security Testing](/testing/security-testing) for security monitoring
- [Architecture Overview](/architecture/) for system design context

## External Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [OTLP Specification](https://opentelemetry.io/docs/reference/specification/protocol/otlp/)

## Conclusion

OpenTelemetry integration provides comprehensive observability for Puppeteer MCP deployments. The instrumentation is production-ready with minimal performance impact and extensive configuration options to match your specific monitoring needs.