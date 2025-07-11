/**
 * Extended Proxy Manager with Additional Methods
 * @module puppeteer/proxy/proxy-manager-extended
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 */

import { ProxyManager } from './manager/index.js';
import type { ContextProxyConfig, ProxyMetrics, ProxyHealthStatus } from '../types/proxy.js';
import { formatProxyUrl } from '../types/proxy.js';

/**
 * Extended proxy manager with additional methods for compatibility
 */
export class ExtendedProxyManager extends ProxyManager {
  private contextProxyMap = new Map<string, string>();

  /**
   * Get proxy for a specific context
   */
  async getProxyForContext(
    contextId: string,
    _config: ContextProxyConfig,
  ): Promise<{ proxyId: string; url: string } | null> {
    const proxy = await this.getProxyForUrl('', contextId);
    if (!proxy) {
      return null;
    }

    const proxyId = `proxy-${proxy.host}:${proxy.port}`;
    const url = formatProxyUrl(proxy);

    // Store context-proxy mapping
    this.contextProxyMap.set(contextId, proxyId);

    return { proxyId, url };
  }

  /**
   * Clean up context resources
   */
  async cleanupContext(contextId: string): Promise<void> {
    this.contextProxyMap.delete(contextId);
  }

  /**
   * Get metrics (stub implementation)
   */
  getMetrics(): {
    proxies: ProxyMetrics[];
    contexts: Map<string, string>;
  } {
    // Return empty metrics structure
    return {
      proxies: [],
      contexts: this.contextProxyMap,
    };
  }

  /**
   * Get health status (stub implementation)
   */
  getHealthStatus(): ProxyHealthStatus[] {
    // Return empty health status array
    return [];
  }

  /**
   * Check if URL should use proxy
   */
  shouldUseProxy(_url: string, contextId: string): boolean {
    // Simple implementation - use proxy if context has one assigned
    return this.contextProxyMap.has(contextId);
  }

  /**
   * Handle proxy error (wrapper for recordProxyFailure)
   */
  async handleProxyError(
    _contextId: string,
    proxyId: string,
    error: Error,
    _config: ContextProxyConfig,
  ): Promise<void> {
    this.recordProxyFailure(proxyId, error.message);
  }

  /**
   * Handle proxy success (wrapper for recordProxySuccess)
   */
  async handleProxySuccess(
    _contextId: string,
    proxyId: string,
    responseTime: number,
  ): Promise<void> {
    this.recordProxySuccess(proxyId, responseTime);
  }
}

/**
 * Singleton extended proxy manager instance
 */
export const proxyManager = new ExtendedProxyManager();
