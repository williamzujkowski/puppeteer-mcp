# Browser Pool Optimization Guide

## Overview

The Browser Pool Optimization system provides advanced resource management, scaling algorithms, and
performance monitoring for the puppeteer-mcp browser pool. These features enable production-ready
browser automation with intelligent resource allocation, predictive scaling, and comprehensive
failure handling.

## Key Features

### 1. Adaptive Scaling

- **Predictive scaling** based on historical usage patterns
- **Multiple scaling strategies** (time-based, usage-based, health-based, resource-based, hybrid)
- **Circuit breaker integration** for failure resilience
- **Configurable thresholds** for scale-up/scale-down decisions

### 2. Advanced Resource Management

- **Real-time memory and CPU monitoring**
- **Intelligent browser recycling** based on resource usage
- **System-wide resource tracking** with alerting
- **Automatic garbage collection** and optimization

### 3. Performance Monitoring

- **Comprehensive metrics collection** (latency, throughput, error rates)
- **Anomaly detection** with configurable sensitivity
- **Performance trend analysis** and forecasting
- **Automated optimization recommendations**

### 4. Circuit Breaker Patterns

- **Failure isolation** to prevent cascading failures
- **Automatic recovery** with exponential backoff
- **Fallback mechanisms** for degraded performance
- **Configurable failure thresholds**

### 5. Health-Based Eviction

- **Intelligent browser lifecycle management**
- **Health score calculation** based on multiple factors
- **Batch recycling** with priority-based execution
- **Scheduled maintenance windows**

## Getting Started

### Basic Usage

```typescript
import { OptimizedBrowserPool } from './src/puppeteer/pool/browser-pool-optimized.js';

// Create an optimized browser pool
const pool = new OptimizedBrowserPool(
  {
    maxBrowsers: 10,
    maxPagesPerBrowser: 5,
    idleTimeout: 300000,
    healthCheckInterval: 30000,
  },
  {
    enabled: true,
    autoOptimization: true,
    optimizationInterval: 30000,
  },
);

// Initialize the pool
await pool.initialize();

// Use the pool normally
const browser = await pool.acquireBrowser('session-1');
const page = await pool.createPage(browser.id, 'session-1');

// Get optimization status
const status = pool.getOptimizationStatus();
console.log('Optimization enabled:', status.enabled);
console.log('Overall health:', status.overallHealth);
```

### Advanced Configuration

```typescript
import {
  OptimizedBrowserPool,
  DEFAULT_OPTIMIZATION_CONFIG,
} from './src/puppeteer/pool/browser-pool-optimized.js';

const pool = new OptimizedBrowserPool(
  {
    maxBrowsers: 20,
    maxPagesPerBrowser: 10,
    idleTimeout: 600000,
    healthCheckInterval: 15000,
  },
  {
    enabled: true,
    autoOptimization: true,
    optimizationInterval: 15000,

    // Scaling configuration
    scaling: {
      enabled: true,
      strategy: 'hybrid',
      minSize: 2,
      maxSize: 50,
      targetUtilization: 70,
      scaleUpThreshold: 85,
      scaleDownThreshold: 30,
      cooldownPeriod: 60000,
      enablePredictiveScaling: true,
      aggressiveScaling: true,
    },

    // Resource monitoring
    resourceMonitoring: {
      enabled: true,
      intervalMs: 10000,
      enableSystemMonitoring: true,
      enableBrowserMonitoring: true,
      enableGarbageCollection: true,
      thresholds: {
        memoryWarning: 500 * 1024 * 1024, // 500MB
        memoryCritical: 1000 * 1024 * 1024, // 1GB
        cpuWarning: 70,
        cpuCritical: 90,
      },
    },

    // Recycling configuration
    recycling: {
      enabled: true,
      strategy: 'hybrid',
      maxLifetimeMs: 4 * 60 * 60 * 1000, // 4 hours
      maxUseCount: 200,
      recyclingThreshold: 75,
      batchRecyclingEnabled: true,
      maxBatchSize: 5,
    },

    // Circuit breaker configuration
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      timeout: 30000,
      exponentialBackoff: true,
      maxTimeout: 300000,
    },

    // Performance monitoring
    performanceMonitoring: {
      enabled: true,
      collectionInterval: 5000,
      alertingEnabled: true,
      enableTrendAnalysis: true,
      enableAnomalyDetection: true,
      enablePerformanceOptimization: true,
    },
  },
);
```

## Component Deep Dive

### Adaptive Scaling

The scaling system automatically adjusts pool size based on demand:

```typescript
import { BrowserPoolScaler, ScalingStrategy } from './src/puppeteer/pool/browser-pool-scaling.js';

const scaler = new BrowserPoolScaler({
  enabled: true,
  strategy: ScalingStrategy.HYBRID,
  minSize: 1,
  maxSize: 20,
  targetUtilization: 70,
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  cooldownPeriod: 60000,
  enablePredictiveScaling: true,
  predictionWindow: 300000,
  aggressiveScaling: false,
  maxScaleStep: 3,
});

// Listen for scaling events
scaler.on('scaling-action', (event) => {
  console.log(`Scaling action: ${event.decision}`);
  console.log(`From ${event.from} to ${event.to} browsers`);
});

// Manual scaling evaluation
const browsers = new Map(); // Your browser instances
const metrics = pool.getExtendedMetrics();
const options = { maxBrowsers: 20 };

const decision = scaler.evaluateScaling(metrics, browsers, options);
console.log('Scaling decision:', decision);
```

### Resource Management

Monitor and optimize resource usage:

```typescript
import { BrowserPoolResourceManager } from './src/puppeteer/pool/browser-pool-resource-manager.js';

const resourceManager = new BrowserPoolResourceManager({
  enabled: true,
  intervalMs: 10000,
  enableSystemMonitoring: true,
  enableBrowserMonitoring: true,
  enableGarbageCollection: true,
  thresholds: {
    memoryWarning: 500 * 1024 * 1024,
    memoryCritical: 1000 * 1024 * 1024,
    cpuWarning: 70,
    cpuCritical: 90,
  },
});

// Listen for resource alerts
resourceManager.on('resource-alert', (alert) => {
  console.log(`Resource alert: ${alert.type} - ${alert.level}`);
  console.log(`Current: ${alert.currentValue}, Threshold: ${alert.threshold}`);
  console.log(`Suggested action: ${alert.suggestedAction}`);
});

// Get system resources
const systemResources = resourceManager.getSystemResources();
console.log('Memory usage:', systemResources?.memoryUsagePercent);
console.log('CPU usage:', systemResources?.cpuUsagePercent);

// Get browser resources
const browserResources = resourceManager.getBrowserResources();
for (const [browserId, usage] of browserResources) {
  console.log(`Browser ${browserId}: ${usage.memoryUsage.rss / 1024 / 1024}MB`);
}
```

### Performance Monitoring

Track and analyze performance metrics:

```typescript
import {
  BrowserPoolPerformanceMonitor,
  PerformanceMetricType,
} from './src/puppeteer/pool/browser-pool-performance-monitor.js';

const performanceMonitor = new BrowserPoolPerformanceMonitor({
  enabled: true,
  collectionInterval: 5000,
  alertingEnabled: true,
  enableTrendAnalysis: true,
  enableAnomalyDetection: true,
  enablePerformanceOptimization: true,
});

// Record custom metrics
performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 1500, {
  operation: 'page_load',
  url: 'https://example.com',
});

// Listen for performance alerts
performanceMonitor.on('alert-created', (alert) => {
  console.log(`Performance alert: ${alert.type} - ${alert.level}`);
  console.log(`Value: ${alert.value}, Threshold: ${alert.threshold}`);
});

// Get performance summary
const summary = performanceMonitor.getPerformanceSummary();
console.log('Health score:', summary.healthScore);
console.log('Performance grade:', summary.performanceGrade);
console.log('Active alerts:', summary.alertsSummary.active);
```

### Circuit Breaker

Implement resilient failure handling:

```typescript
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
} from './src/puppeteer/pool/browser-pool-circuit-breaker.js';

const circuitBreakers = new CircuitBreakerRegistry({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  exponentialBackoff: true,
});

const browserAcquisitionCircuit = circuitBreakers.getCircuitBreaker('browser-acquisition');

// Execute operation with circuit breaker protection
const result = await browserAcquisitionCircuit.execute(
  async () => {
    // Your operation here
    return await pool.acquireBrowser('session-1');
  },
  async () => {
    // Fallback operation
    console.log('Using fallback browser acquisition');
    return await pool.getIdleBrowser();
  },
);

if (result.success) {
  const browser = result.result;
  console.log('Browser acquired:', browser.id);
} else {
  console.error('Browser acquisition failed:', result.error);
}
```

### Browser Recycling

Implement intelligent browser lifecycle management:

```typescript
import {
  BrowserPoolRecycler,
  RecyclingStrategy,
} from './src/puppeteer/pool/browser-pool-recycler.js';

const recycler = new BrowserPoolRecycler({
  enabled: true,
  strategy: RecyclingStrategy.HYBRID,
  maxLifetimeMs: 2 * 60 * 60 * 1000, // 2 hours
  maxUseCount: 100,
  recyclingThreshold: 80,
  batchRecyclingEnabled: true,
  maxBatchSize: 3,
});

// Listen for recycling events
recycler.on('browsers-recycled', (events) => {
  console.log(`Recycled ${events.length} browsers`);
  events.forEach((event) => {
    console.log(`- ${event.browserId}: ${event.reason}`);
  });
});

// Evaluate browsers for recycling
const browsers = new Map(); // Your browser instances
const resourceUsage = new Map(); // Resource usage data

const candidates = recycler.evaluateBrowsers(browsers, resourceUsage);
console.log(`Found ${candidates.length} recycling candidates`);

// Execute recycling
const events = await recycler.executeRecycling(candidates, async (browserId) => {
  await pool.recycleBrowser(browserId);
});
```

## Monitoring and Observability

### Metrics Collection

The optimization system provides comprehensive metrics:

```typescript
// Get extended metrics with optimization data
const metrics = pool.getExtendedMetrics();

console.log('Pool metrics:');
console.log('- Total browsers:', metrics.totalBrowsers);
console.log('- Utilization:', metrics.utilizationPercentage);
console.log('- Queue length:', metrics.queue.queueLength);
console.log('- Error rate:', metrics.errors.errorRate);

console.log('Optimization metrics:');
console.log('- Scaling enabled:', metrics.optimization.scaling.enabled);
console.log('- Resource monitoring:', metrics.optimization.resourceMonitoring.enabled);
console.log('- Active alerts:', metrics.optimization.resourceMonitoring.activeAlerts.length);
```

### Health Monitoring

Monitor the overall health of the system:

```typescript
const status = pool.getOptimizationStatus();

console.log('Optimization status:');
console.log('- Overall health:', status.overallHealth);
console.log('- Scaling active:', status.scalingActive);
console.log('- Resource monitoring active:', status.resourceMonitoringActive);
console.log('- Recycling active:', status.recyclingActive);
console.log('- Circuit breaker active:', status.circuitBreakerActive);
console.log('- Performance monitoring active:', status.performanceMonitoringActive);
console.log('- Optimization actions:', status.optimizationActions);

console.log('Recommendations:');
status.recommendations.forEach((rec) => {
  console.log(`- [${rec.priority}] ${rec.description}`);
});
```

### Event Handling

Listen to optimization events for custom handling:

```typescript
// Scaling events
pool.on('optimization-scaling-action', (event) => {
  console.log(`Scaling: ${event.decision} from ${event.from} to ${event.to}`);
});

// Resource alerts
pool.on('optimization-resource-alert', (alert) => {
  console.log(`Resource alert: ${alert.type} - ${alert.level}`);

  // Custom alert handling
  if (alert.level === 'critical') {
    // Trigger emergency procedures
    notifyOpsTeam(alert);
  }
});

// Performance alerts
pool.on('optimization-performance-alert', (alert) => {
  console.log(`Performance alert: ${alert.type} - ${alert.level}`);

  // Custom performance handling
  if (alert.type === 'error_rate' && alert.level === 'critical') {
    // Trigger circuit breaker
    pool.forceCircuitBreakerOpen('browser-acquisition');
  }
});

// Browser recycling
pool.on('optimization-browsers-recycled', (events) => {
  console.log(`Recycled ${events.length} browsers`);
  events.forEach((event) => {
    logBrowserRecycling(event.browserId, event.reason);
  });
});

// Optimization recommendations
pool.on('optimization-recommendation', (recommendation) => {
  console.log(`New recommendation: ${recommendation.title}`);
  console.log(`Priority: ${recommendation.priority}`);
  console.log(`Impact: ${recommendation.impact}`);

  // Auto-apply high-priority recommendations
  if (recommendation.priority === 'high') {
    applyOptimizationRecommendation(recommendation);
  }
});
```

## Configuration Reference

### Scaling Configuration

```typescript
interface ScalingStrategy {
  enabled: boolean; // Enable adaptive scaling
  minSize: number; // Minimum pool size
  maxSize: number; // Maximum pool size
  targetUtilization: number; // Target utilization percentage (0-100)
  scaleUpThreshold: number; // Scale up threshold percentage (0-100)
  scaleDownThreshold: number; // Scale down threshold percentage (0-100)
  cooldownPeriod: number; // Cool-down period between scaling actions (ms)
  enablePredictiveScaling: boolean; // Enable predictive scaling
  predictionWindow: number; // Historical data window for predictions (ms)
  aggressiveScaling: boolean; // Aggressive scaling under high load
  maxScaleStep: number; // Maximum scaling step size
}
```

### Resource Monitoring Configuration

```typescript
interface ResourceMonitoringConfig {
  enabled: boolean; // Enable resource monitoring
  intervalMs: number; // Monitoring interval (ms)
  enableSystemMonitoring: boolean; // Enable system-wide monitoring
  enableBrowserMonitoring: boolean; // Enable per-browser monitoring
  enableGarbageCollection: boolean; // Enable automatic garbage collection
  gcTriggerThreshold: number; // GC trigger threshold (0-100)
  enableMemoryOptimization: boolean; // Enable memory optimization
  enableCpuOptimization: boolean; // Enable CPU optimization
  thresholds: {
    memoryWarning: number; // Memory warning threshold (bytes)
    memoryCritical: number; // Memory critical threshold (bytes)
    cpuWarning: number; // CPU warning threshold (%)
    cpuCritical: number; // CPU critical threshold (%)
    connectionWarning: number; // Connection warning threshold
    connectionCritical: number; // Connection critical threshold
    handleWarning: number; // Handle warning threshold
    handleCritical: number; // Handle critical threshold
  };
}
```

### Recycling Configuration

```typescript
interface RecyclingConfig {
  enabled: boolean; // Enable browser recycling
  strategy: RecyclingStrategy; // Recycling strategy
  maxLifetimeMs: number; // Maximum browser lifetime (ms)
  maxIdleTimeMs: number; // Maximum idle time (ms)
  maxUseCount: number; // Maximum use count
  maxPageCount: number; // Maximum page count
  recyclingThreshold: number; // Recycling threshold (0-100)
  batchRecyclingEnabled: boolean; // Enable batch recycling
  maxBatchSize: number; // Maximum batch size
  recyclingCooldownMs: number; // Recycling cooldown (ms)
  scheduledMaintenanceEnabled: boolean; // Enable scheduled maintenance
  maintenanceInterval: number; // Maintenance interval (ms)
  maintenanceWindowStart: number; // Maintenance window start (hour)
  maintenanceWindowEnd: number; // Maintenance window end (hour)
}
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  enabled: boolean; // Enable circuit breaker
  failureThreshold: number; // Failure threshold to open circuit
  successThreshold: number; // Success threshold to close circuit
  timeWindow: number; // Time window for failure counting (ms)
  timeout: number; // Timeout before trying half-open (ms)
  exponentialBackoff: boolean; // Enable exponential backoff
  maxTimeout: number; // Maximum timeout (ms)
  backoffMultiplier: number; // Backoff multiplier
  minimumThroughput: number; // Minimum requests before circuit can open
}
```

### Performance Monitoring Configuration

```typescript
interface PerformanceMonitoringConfig {
  enabled: boolean; // Enable performance monitoring
  collectionInterval: number; // Collection interval (ms)
  retentionPeriod: number; // Data retention period (ms)
  alertingEnabled: boolean; // Enable alerting
  enableRealTimeAlerts: boolean; // Enable real-time alerts
  enableTrendAnalysis: boolean; // Enable trend analysis
  enableAnomalyDetection: boolean; // Enable anomaly detection
  anomalyDetectionSensitivity: number; // Anomaly detection sensitivity (0-1)
  enablePerformanceOptimization: boolean; // Enable performance optimization
  autoOptimizationEnabled: boolean; // Enable auto-optimization
}
```

## Best Practices

### 1. Resource Management

- **Monitor memory usage** regularly and set appropriate thresholds
- **Enable garbage collection** for long-running processes
- **Use resource-based recycling** for memory-intensive workloads
- **Configure appropriate limits** for browser lifetime and usage

### 2. Scaling Configuration

- **Set realistic thresholds** based on your workload patterns
- **Enable predictive scaling** for variable workloads
- **Use aggressive scaling** sparingly to avoid oscillation
- **Monitor scaling actions** and adjust thresholds accordingly

### 3. Performance Optimization

- **Enable all monitoring features** in production
- **Set up alerting** for critical metrics
- **Review recommendations** regularly
- **Implement custom metrics** for domain-specific monitoring

### 4. Circuit Breaker Usage

- **Configure appropriate thresholds** for your failure tolerance
- **Implement meaningful fallbacks** for degraded scenarios
- **Monitor circuit breaker state** and adjust configuration
- **Use multiple circuit breakers** for different operation types

### 5. Recycling Strategy

- **Choose the right strategy** for your use case
- **Configure appropriate thresholds** for your workload
- **Enable batch recycling** for better performance
- **Monitor recycling events** and adjust configuration

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check resource monitoring alerts
   - Verify garbage collection is enabled
   - Adjust memory thresholds
   - Consider more aggressive recycling

2. **Scaling Oscillation**
   - Increase cooldown period
   - Adjust scale up/down thresholds
   - Review predictive scaling configuration
   - Monitor scaling decision confidence

3. **Circuit Breaker Stuck Open**
   - Check failure threshold configuration
   - Verify timeout settings
   - Review exponential backoff settings
   - Implement proper fallback mechanisms

4. **Performance Degradation**
   - Check performance monitoring alerts
   - Review resource usage patterns
   - Analyze trend data
   - Implement recommended optimizations

### Debugging Tools

```typescript
// Enable debug logging
process.env.DEBUG = 'browser-pool-*';

// Get detailed metrics
const metrics = pool.getExtendedMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Get optimization status
const status = pool.getOptimizationStatus();
console.log('Optimization status:', status);

// Force optimization check
await pool.forceOptimizationCheck();

// Get circuit breaker status
const circuitBreakers = pool.getCircuitBreakerStatus();
console.log('Circuit breakers:', circuitBreakers);
```

## Migration Guide

### From Standard Browser Pool

To migrate from the standard browser pool to the optimized version:

1. **Update imports:**

   ```typescript
   // Before
   import { BrowserPool } from './src/puppeteer/pool/browser-pool.js';

   // After
   import { OptimizedBrowserPool } from './src/puppeteer/pool/browser-pool-optimized.js';
   ```

2. **Update initialization:**

   ```typescript
   // Before
   const pool = new BrowserPool(options);

   // After
   const pool = new OptimizedBrowserPool(options, {
     enabled: true,
     autoOptimization: true,
   });
   ```

3. **Add monitoring:**

   ```typescript
   // Add event listeners for optimization events
   pool.on('optimization-scaling-action', handleScalingAction);
   pool.on('optimization-resource-alert', handleResourceAlert);
   ```

4. **Configure optimization features:**
   ```typescript
   await pool.updateOptimizationConfig({
     scaling: { enabled: true, strategy: 'hybrid' },
     resourceMonitoring: { enabled: true },
     recycling: { enabled: true },
     circuitBreaker: { enabled: true },
     performanceMonitoring: { enabled: true },
   });
   ```

## Security Considerations

- **Resource monitoring** may expose system information
- **Performance metrics** should be properly secured
- **Circuit breaker events** may indicate system vulnerabilities
- **Optimization recommendations** should be reviewed before auto-application

## Performance Impact

- **Memory overhead:** ~5-10MB per browser instance
- **CPU overhead:** ~1-3% additional CPU usage
- **Network overhead:** Minimal (local monitoring only)
- **Storage overhead:** Configurable retention periods

## Conclusion

The Browser Pool Optimization system provides enterprise-grade resource management, scaling, and
monitoring capabilities. By following this guide and implementing the recommended configurations,
you can achieve optimal performance, reliability, and observability for your browser automation
workloads.

For additional support and advanced configuration options, refer to the API documentation and source
code comments.
