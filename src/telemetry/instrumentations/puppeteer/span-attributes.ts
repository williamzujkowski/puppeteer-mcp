/**
 * Span attributes standardization and context enrichment
 * @module telemetry/instrumentations/puppeteer/span-attributes
 * @nist au-2 "Audit events"
 */

import type {
  BrowserSpanAttributes,
  PageSpanAttributes,
  NetworkSpanAttributes,
  BrowserOperation,
  PageOperation,
  NetworkOperation,
  GotoOptions,
  ScreenshotOptions,
  PdfOptions,
} from './types.js';

/**
 * Create standardized browser operation attributes
 */
export function createBrowserAttributes(
  operation: BrowserOperation,
  additional?: Partial<BrowserSpanAttributes>,
): BrowserSpanAttributes {
  return {
    'browser.type': 'chromium',
    'browser.operation': operation,
    ...additional,
  };
}

/**
 * Create standardized page operation attributes
 */
export function createPageAttributes(
  operation: PageOperation,
  additional?: Partial<PageSpanAttributes>,
): PageSpanAttributes {
  return {
    'browser.operation': operation,
    ...additional,
  };
}

/**
 * Create network operation attributes
 */
export function createNetworkAttributes(
  operation: NetworkOperation,
  method: string,
  url: string,
  additional?: Partial<NetworkSpanAttributes>,
): NetworkSpanAttributes {
  return {
    'network.operation': operation,
    'http.method': method,
    'http.url': url,
    ...additional,
  };
}

/**
 * Extract attributes from goto options
 */
export function extractGotoAttributes(
  url: string,
  options?: GotoOptions,
): Partial<PageSpanAttributes> {
  return {
    'http.url': url,
    'http.method': 'GET',
    'navigation.timeout': options?.timeout ?? 30000,
    'navigation.wait_until': options?.waitUntil ?? 'load',
  };
}

/**
 * Extract attributes from screenshot options
 */
export function extractScreenshotAttributes(
  options?: ScreenshotOptions,
): Partial<PageSpanAttributes> {
  return {
    'screenshot.format': options?.type ?? 'png',
    'screenshot.full_page': options?.fullPage ?? false,
    'screenshot.quality': options?.quality,
  };
}

/**
 * Extract attributes from PDF options
 */
export function extractPdfAttributes(options?: PdfOptions): Partial<PageSpanAttributes> {
  return {
    'pdf.format': options?.format ?? 'Letter',
    'pdf.landscape': options?.landscape ?? false,
  };
}

/**
 * Extract attributes from JavaScript evaluation
 */
export function extractEvaluationAttributes(
  pageFunction: any,
  args: any[],
): Partial<PageSpanAttributes> {
  return {
    'js.function.length': pageFunction.toString().length,
    'js.args.count': args.length,
  };
}

/**
 * Add response attributes to span
 */
export function addResponseAttributes(response: any): Partial<PageSpanAttributes> {
  if (!response) {
    return {};
  }

  return {
    'http.status_code': response.status(),
    'http.response.size': response.headers()['content-length'] ?? 0,
  };
}

/**
 * Add timing attributes to span
 */
export function addTimingAttributes(startTime: number, endTime?: number): Record<string, number> {
  const duration = endTime ? endTime - startTime : Date.now() - startTime;

  return {
    'timing.start': startTime,
    'timing.duration': duration,
  };
}

/**
 * Add error attributes to span
 */
export function addErrorAttributes(error: Error): Record<string, string> {
  return {
    'error.name': error.name,
    'error.message': error.message,
    'error.stack': error.stack ?? '',
  };
}

/**
 * Add page lifetime attributes
 */
export function addLifetimeAttributes(
  creationTime: number,
  closingTime?: number,
): Partial<PageSpanAttributes> {
  const lifetime = closingTime ? closingTime - creationTime : Date.now() - creationTime;

  return {
    'page.lifetime': lifetime,
  };
}

/**
 * Sanitize URL for telemetry (remove sensitive data)
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove password from URL if present
    urlObj.password = '';
    // Keep only essential query parameters
    const allowedParams = ['page', 'id', 'action'];
    const newSearchParams = new URLSearchParams();

    urlObj.searchParams.forEach((value, key) => {
      if (allowedParams.includes(key)) {
        newSearchParams.set(key, value);
      }
    });

    urlObj.search = newSearchParams.toString();
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return a safe version
    return url.split('?')[0]; // Remove query string
  }
}

/**
 * Create enriched attributes with context
 */
export function enrichAttributes(
  baseAttributes: Record<string, any>,
  context?: Record<string, any>,
): Record<string, any> {
  return {
    ...baseAttributes,
    'instrumentation.name': 'puppeteer',
    'instrumentation.version': '1.0.0',
    timestamp: Date.now(),
    ...context,
  };
}
