/**
 * Health check router
 * @module routes/health
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { BrowserPool } from '../puppeteer/pool/browser-pool.js';

// Health check response type
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

// Extended health response with pool metrics
export interface ExtendedHealthResponse extends HealthResponse {
  browserPool?: {
    total: number;
    active: number;
    idle: number;
    utilization: number;
  };
}

// Create router factory
export function createHealthRouter(browserPool?: BrowserPool): Router {
  const router = Router();

  // Middleware to restrict to GET methods only
  const restrictToGet = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    next();
  };

  // Apply method restriction to all routes
  router.all('/*splat', restrictToGet);

  /**
   * GET /health
   * Basic health check endpoint
   */
  router.get('/', (_req: Request, res: Response) => {
    const response: ExtendedHealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.1.0',
    };

    // Add browser pool metrics if available
    if (browserPool) {
      try {
        const metrics = browserPool.getMetrics();
        response.browserPool = {
          total: metrics.totalBrowsers,
          active: metrics.activeBrowsers,
          idle: metrics.idleBrowsers,
          utilization: metrics.utilizationPercentage,
        };
      } catch {
        // Ignore errors in health check
      }
    }

    res.json(response);
  });

  /**
   * GET /health/live
   * Kubernetes liveness probe endpoint
   */
  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'alive' });
  });

  /**
   * GET /health/ready
   * Kubernetes readiness probe endpoint
   */
  router.get('/ready', (_req: Request, res: Response) => {
    // Add checks for external dependencies (database, redis, etc.)
    const checks = {
      server: true,
      // database: await checkDatabase(),
      // redis: await checkRedis(),
    };

    const allHealthy = Object.values(checks).every((check) => check === true);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not ready',
      checks,
    });
  });

  return router;
}

// Export for backward compatibility
export const healthRouter = createHealthRouter();
