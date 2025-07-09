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
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      `Browser page not found: ${pageId}`,
      'BROWSER_PAGE_NOT_FOUND',
      { pageId, action: 'page_lookup' },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),

  elementNotFound: (
    selector: string,
    pageId: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      `Element not found: ${selector}`,
      'BROWSER_ELEMENT_NOT_FOUND',
      { selector, pageId, action: 'element_lookup' },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),

  navigationFailed: (
    url: string,
    error: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      `Navigation failed to: ${url}`,
      'BROWSER_NAVIGATION_FAILED',
      { url, action: 'navigation', error },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),

  actionTimeout: (params: ActionTimeoutParams): BrowserDomainError =>
    new BrowserDomainError(
      `Browser action timed out: ${params.action} on ${params.selector}`,
      'BROWSER_ACTION_TIMEOUT',
      { action: params.action, selector: params.selector, timeout: params.timeout },
      params.context?.requestId ?? params.defaultContext?.requestId,
      params.context?.sessionId ?? params.defaultContext?.sessionId
    ),

  poolExhausted: (
    poolSize: number,
    activeConnections: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      'Browser pool exhausted - no available browsers',
      'BROWSER_POOL_EXHAUSTED',
      { action: 'pool_allocation', poolSize, activeConnections },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),

  browserCrashed: (
    browserId: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      'Browser instance crashed unexpectedly',
      'BROWSER_CRASHED',
      { browserId, action: 'browser_operation' },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),

  evaluationFailed: (
    script: string,
    error: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BrowserDomainError =>
    new BrowserDomainError(
      'JavaScript evaluation failed',
      'BROWSER_EVALUATION_FAILED',
      { action: 'evaluation', script, error },
      context?.requestId ?? defaultContext?.requestId,
      context?.sessionId ?? defaultContext?.sessionId
    ),
};