/**
 * Metrics routes for browser pool monitoring and performance analysis
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { SessionStore } from '../store/session-store.js';
import type { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { createAuthMiddleware } from '../auth/middleware.js';

// Extended metrics interface
interface ExtendedPoolMetrics {
  totalBrowsers: number;
  activeBrowsers: number;
  idleBrowsers: number;
  utilizationPercentage: number;
  queueLength: number;
  averagePageCreationTime: number;
  averageQueueWaitTime: number;
  errorRate: number;
  recoverySuccessRate: number;
  cpuUsage: number;
  memoryUsage: number;
  utilizationHistory: Array<{ timestamp: Date; value: number }>;
  errorHistory: Array<{ timestamp: Date; value: number }>;
  queueHistory: Array<{ timestamp: Date; value: number }>;
  totalBrowsersCreated: number;
  totalPagesCreated: number;
  totalErrors: number;
  totalRecoveries: number;
}

/**
 * Helper function to safely get extended metrics from browser pool
 */
function getExtendedMetrics(browserPool: BrowserPool): ExtendedPoolMetrics {
  return (browserPool as unknown as { getExtendedMetrics(): ExtendedPoolMetrics }).getExtendedMetrics();
}

/**
 * Creates detailed browser pool metrics response
 */
function createDetailedMetricsResponse(metrics: ExtendedPoolMetrics): unknown {
  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      pool: {
        total: metrics.totalBrowsers,
        active: metrics.activeBrowsers,
        idle: metrics.idleBrowsers,
        utilization: metrics.utilizationPercentage,
        queueLength: metrics.queueLength,
      },
      performance: {
        averagePageCreationTime: metrics.averagePageCreationTime,
        averageQueueWaitTime: metrics.averageQueueWaitTime,
        errorRate: metrics.errorRate,
        recoverySuccessRate: metrics.recoverySuccessRate,
      },
      resources: {
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
      },
      timeSeries: {
        utilization: metrics.utilizationHistory,
        errorRate: metrics.errorHistory,
        queueLength: metrics.queueHistory,
      },
      counters: {
        totalBrowsersCreated: metrics.totalBrowsersCreated,
        totalPagesCreated: metrics.totalPagesCreated,
        totalErrors: metrics.totalErrors,
        totalRecoveries: metrics.totalRecoveries,
      },
    },
  };
}

/**
 * Creates summary browser pool metrics response
 */
function createSummaryMetricsResponse(metrics: ExtendedPoolMetrics): unknown {
  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      browsers: {
        total: metrics.totalBrowsers,
        active: metrics.activeBrowsers,
        idle: metrics.idleBrowsers,
        utilization: `${metrics.utilizationPercentage.toFixed(1)}%`,
      },
      performance: {
        avgPageTime: `${metrics.averagePageCreationTime.toFixed(0)}ms`,
        avgQueueTime: `${metrics.averageQueueWaitTime.toFixed(0)}ms`,
        errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
      },
      health: {
        queueLength: metrics.queueLength,
        cpuUsage: `${metrics.cpuUsage.toFixed(1)}%`,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(0)}MB`,
      },
    },
  };
}

/**
 * Creates time-series metrics response
 */
function createTimeSeriesResponse(metrics: ExtendedPoolMetrics): unknown {
  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      utilization: metrics.utilizationHistory.map(point => ({
        timestamp: point.timestamp.toISOString(),
        value: point.value,
      })),
      errorRate: metrics.errorHistory.map(point => ({
        timestamp: point.timestamp.toISOString(),
        value: point.value,
      })),
      queueLength: metrics.queueHistory.map(point => ({
        timestamp: point.timestamp.toISOString(),
        value: point.value,
      })),
    },
  };
}

/**
 * Creates GET-only middleware restriction
 */
function createGetOnlyMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    next();
  };
}

/**
 * Creates detailed metrics route handler
 */
function createDetailedMetricsHandler(browserPool: BrowserPool) {
  return (req: Request, res: Response): void => {
    try {
      const metrics = getExtendedMetrics(browserPool);
      const response = createDetailedMetricsResponse(metrics);
      res.json(response);
    } catch {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to retrieve browser pool metrics',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Creates summary metrics route handler
 */
function createSummaryMetricsHandler(browserPool: BrowserPool) {
  return (req: Request, res: Response): void => {
    try {
      const metrics = getExtendedMetrics(browserPool);
      const response = createSummaryMetricsResponse(metrics);
      res.json(response);
    } catch {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to retrieve browser pool summary',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Creates time-series route handler
 */
function createTimeSeriesHandler(browserPool: BrowserPool) {
  return (req: Request, res: Response): void => {
    try {
      const metrics = getExtendedMetrics(browserPool);
      const response = createTimeSeriesResponse(metrics);
      res.json(response);
    } catch {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to retrieve time-series data',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Creates metrics router with authentication and monitoring endpoints
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export function createMetricsRoutes(sessionStore: SessionStore, browserPool: BrowserPool): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionStore);
  const restrictToGet = createGetOnlyMiddleware();

  // Route handlers
  const detailedHandler = createDetailedMetricsHandler(browserPool);
  const summaryHandler = createSummaryMetricsHandler(browserPool);
  const timeSeriesHandler = createTimeSeriesHandler(browserPool);

  // Define routes
  router.get('/browser-pool', authMiddleware, restrictToGet, detailedHandler);
  router.get('/browser-pool/summary', authMiddleware, restrictToGet, summaryHandler);
  router.get('/browser-pool/time-series', authMiddleware, restrictToGet, timeSeriesHandler);

  return router;
}