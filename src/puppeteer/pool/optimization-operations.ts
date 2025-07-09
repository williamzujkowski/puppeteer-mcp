/**
 * Enhanced browser operations with optimization features
 * @module puppeteer/pool/optimization-operations
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-5 "Response to audit processing failures"
 */

import type { Page } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { CircuitBreakerRegistry } from './browser-pool-circuit-breaker.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import { PerformanceMetricType } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';

const logger = createLogger('optimization-operations');

/**
 * Enhanced browser operations with circuit breaker protection and optimization
 */
export class OptimizationOperations {
  constructor(
    private circuitBreakers: CircuitBreakerRegistry,
    private performanceMonitor: BrowserPoolPerformanceMonitor,
    private resourceManager: BrowserPoolResourceManager,
    private optimizationEnabled: boolean
  ) {}

  /**
   * Enhanced browser acquisition with circuit breaker protection
   * @nist ac-3 "Access enforcement"
   * @nist au-5 "Response to audit processing failures"
   */
  async acquireBrowser(
    sessionId: string,
    baseBrowserAcquisition: (sessionId: string) => Promise<BrowserInstance>,
    getExtendedMetrics: () => ExtendedPoolMetrics
  ): Promise<BrowserInstance> {
    if (!this.optimizationEnabled) {
      return baseBrowserAcquisition(sessionId);
    }

    const circuitBreaker = this.circuitBreakers.getCircuitBreaker('browser-acquisition');
    
    return circuitBreaker.execute(
      async () => {
        const startTime = Date.now();
        const browser = await baseBrowserAcquisition(sessionId);
        const executionTime = Date.now() - startTime;

        // Record performance metrics
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.LATENCY,
          executionTime,
          { operation: 'acquire_browser', sessionId }
        );

        return browser;
      },
      async () => {
        // Fallback: try to get any available browser
        const metrics = getExtendedMetrics();
        if (metrics.idleBrowsers > 0) {
          return baseBrowserAcquisition(sessionId);
        }
        throw new Error('No browsers available and circuit breaker is open');
      },
      `browser-acquisition-${sessionId}`
    ).then(result => {
      if (result.success && result.result) {
        return result.result;
      }
      throw result.error || new Error('Browser acquisition failed');
    });
  }

  /**
   * Enhanced browser release with optimization
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(
    browserId: string,
    sessionId: string,
    baseReleaseBrowser: (browserId: string, sessionId: string) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      await baseReleaseBrowser(browserId, sessionId);
      
      if (this.optimizationEnabled) {
        const executionTime = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.PROCESSING_TIME,
          executionTime,
          { operation: 'release_browser', sessionId, browserId }
        );
      }
    } catch (error) {
      if (this.optimizationEnabled) {
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.ERROR_RATE,
          1,
          { operation: 'release_browser', sessionId, browserId, error: error.message }
        );
      }
      throw error;
    }
  }

  /**
   * Enhanced page creation with optimization
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(
    browserId: string,
    sessionId: string,
    baseCreatePage: (browserId: string, sessionId: string) => Promise<Page>,
    getBrowser: (browserId: string) => any
  ): Promise<Page> {
    if (!this.optimizationEnabled) {
      return baseCreatePage(browserId, sessionId);
    }

    const circuitBreaker = this.circuitBreakers.getCircuitBreaker('page-creation');
    
    return circuitBreaker.execute(
      async () => {
        const startTime = Date.now();
        const page = await baseCreatePage(browserId, sessionId);
        const executionTime = Date.now() - startTime;

        // Record performance metrics
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.RESPONSE_TIME,
          executionTime,
          { operation: 'create_page', sessionId, browserId }
        );

        // Apply resource optimizations
        const browserInstance = getBrowser(browserId);
        if (browserInstance) {
          await this.resourceManager.optimizeBrowser(browserInstance.browser, browserInstance);
        }

        return page;
      },
      undefined,
      `page-creation-${browserId}-${sessionId}`
    ).then(result => {
      if (result.success && result.result) {
        return result.result;
      }
      throw result.error || new Error('Page creation failed');
    });
  }
}