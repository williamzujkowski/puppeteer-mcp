/**
 * Browser Context Proxy Integration
 * @module puppeteer/proxy/proxy-context-integration
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { Browser, BrowserContext, BrowserContextOptions } from 'puppeteer';
import type { ContextProxyConfig, ProxyConfig } from '../types/proxy.js';
import { formatProxyUrl } from '../types/proxy.js';
import { proxyManager } from './proxy-manager-extended.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { AppError } from '../../core/errors/app-error.js';
import { validateContextProxyConfig } from './proxy-validation.js';

const logger = createLogger('proxy-context-integration');

/**
 * Extended browser context options with proxy support
 * @nist ac-4 "Information flow enforcement"
 */
export interface ProxyBrowserContextOptions extends BrowserContextOptions {
  proxyConfig?: ContextProxyConfig;
  contextId?: string;
}

/**
 * Browser context with proxy metadata
 */
export interface ProxyBrowserContext {
  context: BrowserContext;
  proxyId?: string;
  proxyUrl?: string;
  contextId: string;
}

/**
 * Create a browser context with proxy configuration
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export async function createProxyBrowserContext(
  browser: Browser,
  options: ProxyBrowserContextOptions = {},
): Promise<ProxyBrowserContext> {
  const contextId = options.contextId || `context-${Date.now()}`;
  let proxyId: string | undefined;
  let proxyUrl: string | undefined;

  try {
    // Validate proxy configuration if provided
    if (options.proxyConfig) {
      const validation = await validateContextProxyConfig(options.proxyConfig);
      if (!validation.valid) {
        throw new AppError(
          `Invalid proxy configuration: ${validation.errors.join(', ')}`,
          400,
        );
      }
    }

    // Prepare context options
    const contextOptions: BrowserContextOptions = {
      ...options,
      // Remove our custom property
      ...{ proxyConfig: undefined, contextId: undefined },
    };

    // Get proxy configuration if enabled
    if (options.proxyConfig?.enabled) {
      const proxyInfo = await proxyManager.getProxyForContext(contextId, options.proxyConfig);
      
      if (proxyInfo) {
        proxyId = proxyInfo.proxyId;
        proxyUrl = proxyInfo.url;

        // Set proxy server in context options
        contextOptions.proxyServer = proxyUrl;

        logger.info({
          msg: 'Creating browser context with proxy',
          contextId,
          proxyId,
          proxyProtocol: proxyUrl ? proxyUrl.split('://')[0] : undefined,
        });
      }
    }

    // Create the browser context
    const context = await browser.createBrowserContext(contextOptions);

    // Set up proxy error handling
    if (proxyId && options.proxyConfig) {
      setupProxyErrorHandling(context, contextId, proxyId, options.proxyConfig);
    }

    // Log successful context creation
    await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
      resource: `context:${contextId}`,
      action: 'create',
      result: 'success',
      metadata: {
        hasProxy: !!proxyId,
        proxyId,
        permissions: (contextOptions as any).permissions,
      },
    });

    logger.info({
      msg: 'Browser context created successfully',
      contextId,
      hasProxy: !!proxyId,
    });

    return {
      context,
      proxyId,
      proxyUrl,
      contextId,
    };
  } catch (error) {
    // Log context creation failure
    await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
      resource: `context:${contextId}`,
      action: 'create',
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        hasProxy: !!proxyId,
        proxyId,
      },
    });

    logger.error({
      msg: 'Failed to create browser context',
      contextId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Set up proxy error handling for a browser context
 * @private
 * @nist si-4 "Information system monitoring"
 */
function setupProxyErrorHandling(
  context: BrowserContext,
  contextId: string,
  proxyId: string,
  config: ContextProxyConfig,
): void {
  // Monitor page creation to set up error handlers
  context.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const page = await target.page();
      if (!page) return;

      // Set up request failure monitoring
      page.on('requestfailed', async (request) => {
        const failure = request.failure();
        if (failure && isProxyError(failure.errorText)) {
          logger.warn({
            msg: 'Proxy-related request failure',
            contextId,
            proxyId,
            url: request.url(),
            error: failure.errorText,
          });

          // Report error to proxy manager
          await proxyManager.handleProxyError(
            contextId,
            proxyId,
            new Error(failure.errorText),
            config,
          );
        }
      });

      // Set up response monitoring for proxy errors
      page.on('response', async (response) => {
        if (response.status() === 407) {
          // Proxy Authentication Required
          logger.error({
            msg: 'Proxy authentication failure',
            contextId,
            proxyId,
            url: response.url(),
          });

          await proxyManager.handleProxyError(
            contextId,
            proxyId,
            new Error('Proxy authentication required'),
            config,
          );
        } else if (response.status() >= 200 && response.status() < 300) {
          // Successful response through proxy
          const timing = response.timing();
          if (timing) {
            await proxyManager.handleProxySuccess(
              contextId,
              proxyId,
              timing.requestTime || 0
            );
          }
        }
      });
    }
  });
}

/**
 * Check if an error is proxy-related
 * @private
 */
function isProxyError(errorText: string): boolean {
  const proxyErrors = [
    'ERR_PROXY_CONNECTION_FAILED',
    'ERR_TUNNEL_CONNECTION_FAILED',
    'ERR_PROXY_AUTH_UNSUPPORTED',
    'ERR_SOCKS_CONNECTION_FAILED',
    'ERR_PROXY_CERTIFICATE_INVALID',
    'ERR_PROXY_BYPASS_RACE',
  ];

  return proxyErrors.some((err) => errorText.includes(err));
}

/**
 * Update proxy for an existing browser context
 * @nist ac-4 "Information flow enforcement"
 */
export async function updateContextProxy(
  contextId: string,
  newProxyConfig: ContextProxyConfig,
): Promise<{ proxyId?: string; proxyUrl?: string }> {
  try {
    // Validate new proxy configuration
    const validation = await validateContextProxyConfig(newProxyConfig);
    if (!validation.valid) {
      throw new AppError(
        `Invalid proxy configuration: ${validation.errors.join(', ')}`,
        400,
      );
    }

    // Note: Puppeteer doesn't support changing proxy of existing context
    // This would require creating a new context
    logger.warn({
      msg: 'Proxy update requested for existing context',
      contextId,
      note: 'Proxy changes require context recreation',
    });

    // Get new proxy configuration
    if (newProxyConfig.enabled) {
      const proxyInfo = await proxyManager.getProxyForContext(contextId, newProxyConfig);
      
      if (proxyInfo) {
        logger.info({
          msg: 'New proxy assigned to context',
          contextId,
          proxyId: proxyInfo.proxyId,
        });

        return {
          proxyId: proxyInfo.proxyId,
          proxyUrl: proxyInfo.url,
        };
      }
    }

    return {};
  } catch (error) {
    logger.error({
      msg: 'Failed to update context proxy',
      contextId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Clean up proxy resources for a context
 * @nist ac-12 "Session termination"
 */
export async function cleanupContextProxy(contextId: string): Promise<void> {
  try {
    await proxyManager.cleanupContext(contextId);

    logger.info({
      msg: 'Context proxy cleanup completed',
      contextId,
    });

    await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_DESTROYED, {
      resource: `context:${contextId}`,
      action: 'cleanup',
      result: 'success',
    });
  } catch (error) {
    logger.error({
      msg: 'Context proxy cleanup failed',
      contextId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get proxy metrics for a context
 * @nist au-3 "Content of audit records"
 */
export function getContextProxyMetrics(contextId: string): {
  proxyId?: string;
  metrics?: any;
} {
  const allMetrics = proxyManager.getMetrics();
  const proxyId = allMetrics.contexts.get(contextId);

  if (!proxyId) {
    return {};
  }

  const proxyMetrics = allMetrics.proxies.find((p) => p.proxyId === proxyId);

  return {
    proxyId,
    metrics: proxyMetrics,
  };
}

/**
 * Validate if a URL should use proxy for a context
 * @nist ac-4 "Information flow enforcement"
 */
export function shouldUseProxyForUrl(url: string, contextId: string): boolean {
  return proxyManager.shouldUseProxy(url, contextId);
}

/**
 * Format proxy configuration for Puppeteer
 * @nist cm-6 "Configuration settings"
 */
export function formatProxyForPuppeteer(config: ProxyConfig): string {
  // Puppeteer expects proxy URL in specific format
  let url = formatProxyUrl(config);

  // Handle SOCKS proxies - Puppeteer expects socks5:// for both socks4 and socks5
  if (config.protocol === 'socks4' || config.protocol === 'socks5') {
    url = url.replace(/^socks[45]:\/\//, 'socks5://');
  }

  return url;
}