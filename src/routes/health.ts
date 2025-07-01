/**
 * Health check router
 * @module routes/health
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Health check response schema
const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number().positive(),
  environment: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Create router
export const healthRouter = Router();

// Middleware to restrict to GET methods only
const restrictToGet = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  next();
};

// Apply method restriction to all routes
healthRouter.all('*', restrictToGet);

/**
 * GET /health
 * Basic health check endpoint
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? 'development',
    version: process.env.npm_package_version ?? '0.1.0',
  };

  res.json(response);
});

/**
 * GET /health/live
 * Kubernetes liveness probe endpoint
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /health/ready
 * Kubernetes readiness probe endpoint
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
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
