# Browser Pool Metrics Module

This module provides a comprehensive metrics collection and reporting system for the browser pool,
following SOLID principles and design patterns.

## Architecture Overview

The metrics system is built using several design patterns:

### 1. **Observer Pattern**

- `BaseMetricCollector` implements the subject interface
- Collectors notify observers of metric events
- Enables real-time metric monitoring and alerting

### 2. **Strategy Pattern**

- Different metric collectors (`PerformanceMetricsCollector`, `QueueMetricsCollector`, etc.)
- Each implements specific metric collection strategies
- Easy to add new metric types

### 3. **Factory Pattern**

- `MetricsFactory` creates metric collectors
- Centralized collector creation with configuration

### 4. **Facade Pattern**

- `MetricsAggregator` provides a simplified interface
- Combines all collectors into a unified API
- `BrowserPoolMetrics` maintains backward compatibility

## Module Structure

```
metrics/
├── types.ts                  # Shared types and interfaces
├── base-collector.ts         # Base collector with observer pattern
├── performance-collector.ts  # Performance metrics (page operations, health checks)
├── queue-collector.ts        # Queue metrics (wait times, queue length)
├── error-collector.ts        # Error tracking and recovery metrics
├── resource-collector.ts     # Resource utilization (CPU, memory)
├── metrics-aggregator.ts     # Combines all collectors
├── metrics-factory.ts        # Factory for creating collectors
├── metrics-reporter.ts       # Export metrics in various formats
├── pool-metrics-utils.ts     # Utility functions
└── index.ts                  # Module exports
```

## Key Features

### Metric Collection

- **Performance Metrics**: Page creation/destruction times, browser lifetimes, health checks
- **Queue Metrics**: Queue length, wait times, throughput
- **Error Metrics**: Error rates, recovery success/failure, error types
- **Resource Metrics**: CPU and memory usage per browser, total utilization

### Time Series Data

- Rolling windows for historical data
- Configurable retention periods
- Efficient memory usage with automatic cleanup

### Reporting Formats

- **JSON**: Full metrics with optional time series
- **CSV**: Tabular format for analysis
- **Prometheus**: Compatible with monitoring systems
- **Summary**: Human-readable text format

### Real-time Monitoring

- Event-based notifications via observer pattern
- Metric thresholds and anomaly detection ready
- Integration points for alerting systems

## Usage Examples

### Basic Usage

```typescript
import { BrowserPoolMetrics } from './browser-pool-metrics.js';

const metrics = new BrowserPoolMetrics();

// Record operations
metrics.recordBrowserCreated('browser-1', 100);
metrics.recordPageCreation(50);
metrics.recordError('TimeoutError', 'browser-1');

// Get metrics
const report = metrics.getMetrics(browsers, maxBrowsers);
```

### Advanced Usage with Direct Collectors

```typescript
import { MetricsAggregator, MetricsReporter, ReportFormat } from './metrics/index.js';

const aggregator = new MetricsAggregator();
const reporter = new MetricsReporter({ format: ReportFormat.PROMETHEUS });

// Access individual collectors
const collectors = aggregator.getCollectors();
collectors.performance.recordHealthCheck(10, true);
collectors.resources.updateResourceUsage('browser-1', 25.5, 1024000);

// Generate report
const metrics = aggregator.getMetrics(browsers, maxBrowsers);
console.log(reporter.generateReport(metrics));
```

### Custom Observers

```typescript
import { MetricObserver, MetricEvent } from './metrics/types.js';

class AlertingObserver implements MetricObserver {
  update(event: MetricEvent): void {
    if (event.type === MetricEventType.ERROR_OCCURRED) {
      // Send alert
    }
  }
}

const observer = new AlertingObserver();
aggregator.getCollectors().errors.attach(observer);
```

## Configuration

Collectors can be configured with:

- `windowSize`: Time window for rolling metrics (default: 1 hour)
- `maxDataPoints`: Maximum time series points (default: 60)
- `maxArraySize`: Maximum array size for simple metrics (default: 100)

```typescript
const collector = new PerformanceMetricsCollector({
  windowSize: 3600000, // 1 hour
  maxDataPoints: 120, // 2 hours of minute data
  maxArraySize: 200, // Keep last 200 operations
});
```

## Security Compliance

All modules include NIST security control annotations:

- **AU-3**: Content of audit records
- **AU-4**: Audit storage capacity
- **AU-5**: Response to audit processing failures
- **AU-6**: Audit review, analysis, and reporting
- **AU-7**: Audit reduction and report generation
- **SI-4**: Information system monitoring

## Performance Considerations

- Efficient memory usage with automatic cleanup
- O(1) metric recording operations
- Configurable retention periods
- Lazy calculation of aggregated metrics
- No blocking operations

## Future Enhancements

The modular architecture supports easy addition of:

- Machine learning-based anomaly detection
- Predictive scaling based on metrics
- Custom metric types via plugin system
- Integration with external monitoring systems
- Advanced visualization capabilities
