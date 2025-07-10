/**
 * Proxy Telemetry Metrics
 * @module telemetry/metrics/proxy
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { metrics } from '@opentelemetry/api';
import { ProxyManager } from '../../puppeteer/proxy/proxy-manager.js';
import { proxyMonitor } from '../../puppeteer/proxy/proxy-monitoring.js';

const meter = metrics.getMeter('puppeteer-mcp-proxy', '1.0.0');

// Create a proxy manager instance for telemetry (or import singleton if available)
const proxyManager = new ProxyManager();

/**
 * Proxy metrics
 * @nist au-3 "Content of audit records"
 */
export const proxyMetrics = {
  // Counters
  requestsTotal: meter.createCounter('proxy_requests_total', {
    description: 'Total number of proxy requests',
    unit: 'requests',
  }),

  errorsTotal: meter.createCounter('proxy_errors_total', {
    description: 'Total number of proxy errors',
    unit: 'errors',
  }),

  rotationsTotal: meter.createCounter('proxy_rotations_total', {
    description: 'Total number of proxy rotations',
    unit: 'rotations',
  }),

  healthChecksTotal: meter.createCounter('proxy_health_checks_total', {
    description: 'Total number of proxy health checks',
    unit: 'checks',
  }),

  failoversTotal: meter.createCounter('proxy_failovers_total', {
    description: 'Total number of proxy failovers',
    unit: 'failovers',
  }),

  // Histograms
  responseTime: meter.createHistogram('proxy_response_time', {
    description: 'Proxy response time distribution',
    unit: 'milliseconds',
  }),

  healthCheckDuration: meter.createHistogram('proxy_health_check_duration', {
    description: 'Proxy health check duration',
    unit: 'milliseconds',
  }),

  // Gauges (UpDownCounter)
  activeProxies: meter.createUpDownCounter('proxy_active_count', {
    description: 'Number of active proxies',
    unit: 'proxies',
  }),

  healthyProxies: meter.createUpDownCounter('proxy_healthy_count', {
    description: 'Number of healthy proxies',
    unit: 'proxies',
  }),

  activeContexts: meter.createUpDownCounter('proxy_active_contexts', {
    description: 'Number of contexts using proxies',
    unit: 'contexts',
  }),
};

/**
 * Record proxy request
 * @nist au-3 "Content of audit records"
 */
export function recordProxyRequest(
  proxyId: string,
  protocol: string,
  success: boolean,
  responseTime?: number,
): void {
  const labels = {
    proxy_id: proxyId,
    protocol,
    status: success ? 'success' : 'failure',
  };

  proxyMetrics.requestsTotal.add(1, labels);

  if (!success) {
    proxyMetrics.errorsTotal.add(1, { proxy_id: proxyId, protocol });
  }

  if (responseTime !== undefined) {
    proxyMetrics.responseTime.record(responseTime, labels);
  }
}

/**
 * Record proxy rotation
 * @nist au-3 "Content of audit records"
 */
export function recordProxyRotation(
  contextId: string,
  reason: 'scheduled' | 'error' | 'health' | 'manual',
  oldProxyId?: string,
  newProxyId?: string,
): void {
  proxyMetrics.rotationsTotal.add(1, {
    context_id: contextId,
    reason,
    old_proxy_id: oldProxyId || 'none',
    new_proxy_id: newProxyId || 'none',
  });
}

/**
 * Record proxy health check
 * @nist si-4 "Information system monitoring"
 */
export function recordProxyHealthCheck(
  proxyId: string,
  healthy: boolean,
  duration: number,
): void {
  proxyMetrics.healthChecksTotal.add(1, {
    proxy_id: proxyId,
    result: healthy ? 'healthy' : 'unhealthy',
  });

  proxyMetrics.healthCheckDuration.record(duration, {
    proxy_id: proxyId,
    result: healthy ? 'healthy' : 'unhealthy',
  });
}

/**
 * Record proxy failover
 * @nist si-4 "Information system monitoring"
 */
export function recordProxyFailover(
  contextId: string,
  failedProxyId: string,
  newProxyId: string,
): void {
  proxyMetrics.failoversTotal.add(1, {
    context_id: contextId,
    failed_proxy_id: failedProxyId,
    new_proxy_id: newProxyId,
  });
}

/**
 * Update active proxy count
 * @nist si-4 "Information system monitoring"
 */
export function updateActiveProxyCount(delta: number): void {
  proxyMetrics.activeProxies.add(delta);
}

/**
 * Update healthy proxy count
 * @nist si-4 "Information system monitoring"
 */
export function updateHealthyProxyCount(delta: number): void {
  proxyMetrics.healthyProxies.add(delta);
}

/**
 * Update active context count
 * @nist si-4 "Information system monitoring"
 */
export function updateActiveContextCount(delta: number): void {
  proxyMetrics.activeContexts.add(delta);
}

/**
 * Initialize proxy telemetry
 * @nist si-4 "Information system monitoring"
 */
export function initializeProxyTelemetry(): void {
  // Set up event listeners for proxy manager
  proxyManager.on('proxy:healthy', ({ proxyId, responseTime }: { proxyId: string; responseTime: number }) => {
    recordProxyHealthCheck(proxyId, true, responseTime);
    updateHealthyProxyCount(1);
  });

  proxyManager.on('proxy:unhealthy', ({ proxyId, error: _error }: { proxyId: string; error: any }) => {
    recordProxyHealthCheck(proxyId, false, 0);
    updateHealthyProxyCount(-1);
  });

  proxyManager.on('proxy:rotated', (event: any) => {
    recordProxyRotation(event.contextId, event.reason, event.oldProxyId, event.newProxyId);
  });

  proxyManager.on('proxy:failover', ({ contextId, failedProxyId, newProxyId }: { contextId: string; failedProxyId: string; newProxyId: string }) => {
    recordProxyFailover(contextId, failedProxyId, newProxyId);
  });

  // Set up periodic metrics collection
  setInterval(() => {
    const metrics = proxyManager.getMetrics();
    const healthStatuses = proxyManager.getHealthStatus();

    // Update gauge values - set absolute values for gauges
    proxyMetrics.activeProxies.add(metrics.proxies.length);

    const healthyCount = healthStatuses.filter((h: any) => h.healthy).length;
    proxyMetrics.healthyProxies.add(healthyCount);

    proxyMetrics.activeContexts.add(metrics.contexts.size);
  }, 60000); // Update every minute
}

/**
 * Export proxy metrics for collection
 * @nist au-3 "Content of audit records"
 */
export function getProxyMetricsSnapshot(): Record<string, any> {
  const managerMetrics = proxyManager.getMetrics();
  const healthStatuses = proxyManager.getHealthStatus();
  const monitorStatus = proxyMonitor.getStatus();

  return {
    proxies: {
      total: managerMetrics.proxies.length,
      healthy: healthStatuses.filter((h) => h.healthy).length,
      unhealthy: healthStatuses.filter((h) => !h.healthy).length,
    },
    contexts: {
      active: managerMetrics.contexts.size,
    },
    performance: {
      averageResponseTime: monitorStatus.currentMetrics.averageResponseTime,
      poolHealth: monitorStatus.currentMetrics.poolHealth,
      errorRate: monitorStatus.currentMetrics.totalErrorRate,
    },
    monitoring: {
      enabled: monitorStatus.running,
    },
  };
}