/**
 * Proxy manager types and interfaces
 * @module puppeteer/proxy/manager/types
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type {
  ProxyConfig,
  ProxyHealthStatus,
  ProxyMetrics,
  ProxyRotationEvent,
} from '../../types/proxy.js';

/**
 * Proxy instance with metadata
 * @nist ac-4 "Information flow enforcement"
 */
export interface ProxyInstance {
  id: string;
  config: ProxyConfig;
  health: ProxyHealthStatus;
  metrics: ProxyMetrics;
  url: string;
  lastRotation?: Date;
}

/**
 * Proxy manager events
 * @nist au-3 "Content of audit records"
 */
export interface ProxyManagerEvents {
  'proxy:healthy': { proxyId: string; responseTime: number };
  'proxy:unhealthy': { proxyId: string; error: string };
  'proxy:rotated': ProxyRotationEvent;
  'proxy:failover': { contextId: string; failedProxyId: string; newProxyId: string };
  'health:check:complete': { healthy: number; unhealthy: number; total: number };
}

/**
 * Proxy manager state
 */
export interface ProxyManagerState {
  proxies: Map<string, ProxyInstance>;
  contextProxies: Map<string, string>;
  healthChecker?: any; // Avoid circular dependency
  rotationTimers: Map<string, NodeJS.Timeout>;
  healthCheckInterval?: NodeJS.Timeout;
}

/**
 * Proxy selection strategy
 */
export type ProxySelectionStrategy = 'round-robin' | 'least-used' | 'best-health' | 'random' | 'priority' | 'health-based';

/**
 * Pool selection options
 */
export interface PoolSelectionOptions {
  strategy?: ProxySelectionStrategy;
  excludeProxyIds?: string[];
  requireHealthy?: boolean;
}