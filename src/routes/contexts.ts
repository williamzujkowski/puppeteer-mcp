/**
 * Browser contexts API routes
 * @module routes/contexts
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { Router } from 'express';
import { SessionStore } from '../store/session-store.interface.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { ContextHandlers } from './context-handlers.js';

/**
 * Create context routes
 * @nist ac-3 "Access enforcement"
 */
export const createContextRoutes = (sessionStore: SessionStore): Router => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionStore);
  const handlers = new ContextHandlers();

  /**
   * Create a new browser context
   * POST /v1/contexts
   * @nist au-2 "Audit events"
   */
  router.post('/', authMiddleware, handlers.createContext);

  /**
   * Get all contexts for current user
   * GET /v1/contexts
   * @nist au-2 "Audit events"
   */
  router.get('/', authMiddleware, handlers.listContexts);

  /**
   * Get a specific context
   * GET /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.get('/:contextId', authMiddleware, handlers.getContext);

  /**
   * Update a context configuration
   * PATCH /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.patch('/:contextId', authMiddleware, handlers.updateContext);

  /**
   * Delete a context
   * DELETE /v1/contexts/:contextId
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.delete('/:contextId', authMiddleware, handlers.deleteContext);

  /**
   * Execute action in a context
   * POST /v1/contexts/:contextId/execute
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.post('/:contextId/execute', authMiddleware, handlers.executeAction);

  /**
   * Get context metrics
   * GET /v1/contexts/:contextId/metrics
   * @nist au-2 "Audit events"
   */
  router.get('/:contextId/metrics', authMiddleware, handlers.getMetrics);

  return router;
};