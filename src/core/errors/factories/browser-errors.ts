/**
 * Browser automation error factories
 * @module core/errors/factories/browser-errors
 * @nist si-11 "Error handling"
 */

import { BrowserDomainError } from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Parameters for browser action timeout errors
 */
interface ActionTimeoutParams {
  action: string;
  selector: string;
  timeout: number;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Browser automation error factory methods
 */
export const browserErrors = {
  pageNotFound: (
    pageId: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: `Browser page not found: ${pageId}`,
      errorCode: 'BROWSER_PAGE_NOT_FOUND',
      browserInfo: { pageId, action: 'page_lookup' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),

  elementNotFound: (
    selector: string,
    pageId: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: `Element not found: ${selector}`,
      errorCode: 'BROWSER_ELEMENT_NOT_FOUND',
      browserInfo: { selector, pageId, action: 'element_lookup' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),

  navigationFailed: (
    url: string,
    _error: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: `Navigation failed to: ${url}`,
      errorCode: 'BROWSER_NAVIGATION_FAILED',
      browserInfo: { url, action: 'navigation' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),

  actionTimeout: (params: ActionTimeoutParams): BrowserDomainError =>
    new BrowserDomainError({
      message: `Browser action timed out: ${params.action} on ${params.selector}`,
      errorCode: 'BROWSER_ACTION_TIMEOUT',
      browserInfo: { action: params.action, selector: params.selector },
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      sessionId: params.context?.sessionId ?? params.defaultContext?.sessionId,
    }),

  poolExhausted: (
    _poolSize: number,
    _activeConnections: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: 'Browser pool exhausted - no available browsers',
      errorCode: 'BROWSER_POOL_EXHAUSTED',
      browserInfo: { action: 'pool_allocation' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),

  browserCrashed: (
    browserId: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: 'Browser instance crashed unexpectedly',
      errorCode: 'BROWSER_CRASHED',
      browserInfo: { browserId, action: 'browser_operation' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),

  evaluationFailed: (
    _script: string,
    _error: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BrowserDomainError =>
    new BrowserDomainError({
      message: 'JavaScript evaluation failed',
      errorCode: 'BROWSER_EVALUATION_FAILED',
      browserInfo: { action: 'evaluation' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      sessionId: context?.sessionId ?? defaultContext?.sessionId,
    }),
};
