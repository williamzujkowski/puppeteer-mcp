# Health Monitoring Module

This module provides a modular, extensible health monitoring system for WebSocket servers using
Strategy, Observer, and Chain of Responsibility patterns.

## Architecture

### Components

1. **HealthMonitorCoordinator** - Main coordinator that orchestrates all health monitoring
   activities
2. **StrategyManager** - Manages health check strategies (Strategy pattern)
3. **HealthEventManager** - Manages health event observers (Observer pattern)
4. **MetricsCollector** - Collects and manages health metrics
5. **Recovery Actions** - Chain of Responsibility pattern for recovery actions

### Health Check Strategies

- **MemoryCheckStrategy** - Monitors memory usage and heap utilization
- **ConnectionCheckStrategy** - Monitors connection counts, turnover, and authentication ratios
- **PerformanceCheckStrategy** - Monitors response times, error rates, and uptime

### Recovery Actions

- **CleanupRecoveryAction** - Performs cleanup operations (stale connections, rate limits, etc.)
- **ConnectionLimitRecoveryAction** - Handles connection limit issues by closing excess connections

## Usage

```typescript
import { HealthMonitorCoordinator } from './health/index.js';
import type { HealthObserver } from './health/types.js';

// Create health monitor
const healthMonitor = new HealthMonitorCoordinator(
  { logger },
  {
    heartbeatInterval: 30000,
    connectionTimeout: 60000,
    maxStaleAge: 300000,
  },
);

// Add custom observer
const customObserver: HealthObserver = {
  onHealthEvent(event) {
    console.log('Health event:', event);
  },
};
healthMonitor.getEventManager().registerObserver(customObserver);

// Start monitoring
healthMonitor.start({
  connectionManager,
  securityManager,
  eventHandler,
  logger,
});

// Record metrics
healthMonitor.recordMessageProcessed(responseTime);
healthMonitor.recordError(error);
healthMonitor.recordConnection('connected');

// Get health status
const status = await healthMonitor.getHealthStatus(context);
```

## Extending

### Adding Custom Health Check Strategy

```typescript
import { HealthCheckStrategy, type HealthCheckStrategyResult } from './strategies/base.js';

export class CustomHealthCheck extends HealthCheckStrategy {
  async check(
    context: HealthCheckContext,
    metrics: HealthMetrics,
  ): Promise<HealthCheckStrategyResult> {
    const issues = [];

    // Perform custom health checks
    if (someCondition) {
      issues.push({
        severity: 'high',
        message: 'Custom issue detected',
        recommendation: 'Fix the issue',
      });
    }

    return {
      passed: issues.filter((i) => i.severity === 'critical').length === 0,
      issues,
    };
  }
}

// Add to strategy manager
healthMonitor.getStrategyManager().addStrategy(
  new CustomHealthCheck({
    name: 'custom-check',
    priority: 4,
    enabled: true,
  }),
);
```

### Adding Custom Recovery Action

```typescript
import { RecoveryAction } from './recovery/base.js';

export class CustomRecoveryAction extends RecoveryAction {
  protected canHandle(context: RecoveryContext): boolean {
    return context.issues.some((issue) => issue.includes('custom'));
  }

  protected async execute(context: RecoveryContext): Promise<RecoveryActionResult> {
    // Perform recovery actions
    return {
      success: true,
      message: 'Custom recovery completed',
      actionsExecuted: ['custom action'],
    };
  }
}
```

## Module Structure

```
health/
├── index.ts                    # Main exports
├── types.ts                    # Type definitions
├── health-monitor-coordinator.ts # Main coordinator
├── strategy-manager.ts         # Strategy management
├── health-event-manager.ts     # Event management
├── metrics-collector.ts        # Metrics collection
├── strategies/                 # Health check strategies
│   ├── base.ts
│   ├── memory-check.ts
│   ├── connection-check.ts
│   └── performance-check.ts
└── recovery/                   # Recovery actions
    ├── base.ts
    ├── cleanup-action.ts
    └── connection-limit-action.ts
```
