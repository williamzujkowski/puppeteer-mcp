/**
 * Proxy Health Checker
 * @module puppeteer/proxy/proxy-health-checker
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import fetch from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ProxyConfig, ProxyHealthStatus } from '../types/proxy.js';
import { formatProxyUrl } from '../types/proxy.js';
import { createLogger } from '../../utils/logger.js';
import { performance } from 'perf_hooks';

const logger = createLogger('proxy-health-checker');

/**
 * Health check options
 * @nist si-4 "Information system monitoring"
 */
interface HealthCheckOptions {
  timeout?: number;
  testUrl?: string;
  maxConcurrent?: number;
}

/**
 * Proxy health checker implementation
 * @nist si-4 "Information system monitoring"
 */
export class ProxyHealthChecker {
  private defaultOptions: Required<HealthCheckOptions> = {
    timeout: 30000, // 30 seconds
    testUrl: 'https://www.google.com',
    maxConcurrent: 3,
  };

  /**
   * Check health of a single proxy
   * @nist si-4 "Information system monitoring"
   */
  async checkProxy(
    proxyId: string,
    config: ProxyConfig,
    options?: HealthCheckOptions,
  ): Promise<ProxyHealthStatus> {
    const opts = { ...this.defaultOptions, ...options };
    const status: ProxyHealthStatus = {
      proxyId,
      healthy: false,
      lastChecked: new Date(),
      errorCount: 0,
      successCount: 0,
      consecutiveFailures: 0,
    };

    try {
      const startTime = performance.now();
      const proxyUrl = formatProxyUrl(config);
      
      // Create appropriate agent based on proxy protocol
      const agent = this.createProxyAgent(proxyUrl, config);

      // Perform health check request
      const response = await fetch(opts.testUrl, {
        agent,
        timeout: opts.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        status.healthy = true;
        status.responseTime = responseTime;
        status.successCount = 1;

        logger.debug({
          msg: 'Proxy health check passed',
          proxyId,
          responseTime,
          statusCode: response.status,
        });
      } else {
        status.lastError = `HTTP ${response.status}: ${response.statusText}`;
        status.errorCount = 1;
        status.consecutiveFailures = 1;

        logger.warn({
          msg: 'Proxy health check failed',
          proxyId,
          statusCode: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      status.errorCount = 1;
      status.consecutiveFailures = 1;
      status.lastError = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: 'Proxy health check error',
        proxyId,
        error: status.lastError,
      });
    }

    return status;
  }

  /**
   * Check health of multiple proxies concurrently
   * @nist si-4 "Information system monitoring"
   */
  async checkMultiple(
    proxies: Array<{ id: string; config: ProxyConfig }>,
    options?: HealthCheckOptions,
  ): Promise<ProxyHealthStatus[]> {
    const opts = { ...this.defaultOptions, ...options };
    const results: ProxyHealthStatus[] = [];

    // Process in batches to limit concurrent requests
    for (let i = 0; i < proxies.length; i += opts.maxConcurrent) {
      const batch = proxies.slice(i, i + opts.maxConcurrent);
      const batchPromises = batch.map((proxy) => this.checkProxy(proxy.id, proxy.config, options));

      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          results.push((result as PromiseFulfilledResult<ProxyHealthStatus>).value);
        } else {
          // Create failed status for rejected promise
          const rejectedResult = result as PromiseRejectedResult;
          results.push({
            proxyId: batch[j].id,
            healthy: false,
            lastChecked: new Date(),
            errorCount: 1,
            successCount: 0,
            consecutiveFailures: 1,
            lastError: rejectedResult.reason instanceof Error ? rejectedResult.reason.message : 'Check failed',
          });
        }
      }
    }

    logger.info({
      msg: 'Bulk proxy health check completed',
      total: proxies.length,
      healthy: results.filter((r) => r.healthy).length,
      unhealthy: results.filter((r) => !r.healthy).length,
    });

    return results;
  }

  /**
   * Create proxy agent based on protocol
   * @private
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private createProxyAgent(proxyUrl: string, config: ProxyConfig): any {
    switch (config.protocol) {
      case 'socks4':
      case 'socks5':
        return new SocksProxyAgent(proxyUrl, {
          timeout: config.connectionTimeout,
          rejectUnauthorized: config.rejectUnauthorized,
        });

      case 'http':
      case 'https':
      default:
        return new HttpsProxyAgent(proxyUrl, {
          timeout: config.connectionTimeout,
          rejectUnauthorized: config.rejectUnauthorized,
        });
    }
  }

  /**
   * Perform continuous health monitoring
   * @nist si-4 "Information system monitoring"
   */
  async monitorProxy(
    proxyId: string,
    config: ProxyConfig,
    callback: (status: ProxyHealthStatus) => void,
    interval: number = 300000, // 5 minutes
  ): Promise<() => void> {
    const check = async () => {
      const status = await this.checkProxy(proxyId, config);
      callback(status);
    };

    // Initial check
    await check();

    // Set up interval
    const intervalId = setInterval(check, interval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Validate proxy configuration
   * @nist cm-6 "Configuration settings"
   */
  async validateProxyConfig(config: ProxyConfig): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic validation
    if (!config.host) {
      errors.push('Proxy host is required');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Invalid proxy port');
    }

    if (config.auth) {
      if (!config.auth.username || !config.auth.password) {
        errors.push('Proxy authentication requires both username and password');
      }
    }

    // Test connectivity if no basic errors
    if (errors.length === 0) {
      try {
        const status = await this.checkProxy('validation', config, {
          timeout: 10000, // Quick timeout for validation
        });

        if (!status.healthy) {
          errors.push(`Proxy connectivity test failed: ${status.lastError}`);
        }
      } catch (error) {
        errors.push(`Proxy validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get recommended health check interval based on proxy performance
   * @nist si-4 "Information system monitoring"
   */
  getRecommendedCheckInterval(
    recentStatuses: ProxyHealthStatus[],
  ): number {
    if (recentStatuses.length === 0) {
      return 300000; // Default 5 minutes
    }

    // Calculate failure rate
    const failureRate = recentStatuses.filter((s) => !s.healthy).length / recentStatuses.length;

    // Adjust interval based on failure rate
    if (failureRate > 0.5) {
      return 60000; // 1 minute for unstable proxies
    } else if (failureRate > 0.2) {
      return 180000; // 3 minutes for somewhat unstable
    } else if (failureRate > 0.1) {
      return 300000; // 5 minutes for mostly stable
    } else {
      return 600000; // 10 minutes for very stable
    }
  }
}