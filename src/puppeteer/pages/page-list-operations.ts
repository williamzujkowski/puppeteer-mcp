/**
 * Page list operations
 * @module puppeteer/pages/page-list-operations
 * @nist ac-3 "Access enforcement"
 */

import { AppError } from '../../core/errors/app-error.js';
import { contextStore } from '../../store/context-store.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

/**
 * List pages for session
 * @nist ac-3 "Access enforcement"
 */

export async function listPagesForSession(
  sessionId: string,
  pageStore: PageInfoStore,
): Promise<PageInfo[]> {
  return pageStore.listBySession(sessionId);
}

/**
 * List pages for context
 * @nist ac-3 "Access enforcement"
 */
export async function listPagesForContext(
  contextId: string,
  sessionId: string,
  pageStore: PageInfoStore,
): Promise<PageInfo[]> {
  // Verify context belongs to session
  const context = await contextStore.get(contextId);
  if (!context) {
    throw new AppError('Context not found', 404);
  }

  if (context.sessionId !== sessionId) {
    throw new AppError('Unauthorized access to context', 403);
  }

  return pageStore.listByContext(contextId);
}
