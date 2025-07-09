/**
 * Browser Pool Event Logger
 * Handles security logging and event emissions for browser pool operations
 * @module puppeteer/pool/browser-pool-event-logger
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Event emission function type
 */
export type EventEmitter = (event: string, data: any) => void;

/**
 * Browser Pool Event Logger
 * Centralizes all security logging and event emission for browser pool operations
 */
export class BrowserPoolEventLogger {
  constructor(
    private browsers: Map<string, InternalBrowserInstance>,
    private options: BrowserPoolOptions,
    private emitEvent: EventEmitter,
  ) {}

  /**
   * Log browser acquisition events
   * @nist au-3 "Content of audit records"
   */
  async logBrowserAcquisition(
    success: boolean,
    sessionId: string,
    browserId?: string,
    error?: Error,
  ): Promise<void> {
    if (success && browserId) {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
        resource: `browser:${browserId}`,
        action: 'acquire',
        result: 'success',
        metadata: {
          sessionId,
          browserId,
          poolSize: this.browsers.size,
          maxBrowsers: this.options.maxBrowsers,
          utilization: (this.browsers.size / this.options.maxBrowsers) * 100,
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
        resource: 'browser_pool',
        action: 'acquire',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          sessionId,
          poolSize: this.browsers.size,
          maxBrowsers: this.options.maxBrowsers,
        },
      });
    }
  }

  /**
   * Log browser release events
   * @nist ac-12 "Session termination"
   */
  async logBrowserRelease(
    success: boolean,
    browserId: string,
    sessionId: string,
    error?: Error,
  ): Promise<void> {
    const browser = this.browsers.get(browserId);

    if (success) {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_DESTROYED, {
        resource: `browser:${browserId}`,
        action: 'release',
        result: 'success',
        metadata: {
          sessionId,
          browserId,
          pageCount: browser?.pageCount ?? 0,
          lifetime: browser ? Date.now() - browser.createdAt.getTime() : 0,
          poolSize: this.browsers.size,
        },
      });
      this.emitEvent('browser:released', { browserId });
    } else {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_DESTROYED, {
        resource: `browser:${browserId}`,
        action: 'release',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          sessionId,
          browserId,
        },
      });
    }
  }

  /**
   * Log browser creation events
   * @nist au-3 "Content of audit records"
   */
  async logBrowserCreation(
    success: boolean,
    browserId?: string,
    creationTime?: number,
    error?: Error,
  ): Promise<void> {
    if (success && browserId && creationTime !== undefined) {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
        resource: `browser:${browserId}`,
        action: 'launch',
        result: 'success',
        metadata: {
          browserId,
          creationTime,
          poolSize: this.browsers.size,
          maxBrowsers: this.options.maxBrowsers,
          headless: this.options.launchOptions?.headless ?? true,
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.BROWSER_INSTANCE_CREATED, {
        resource: 'browser_pool',
        action: 'launch',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          creationTime: creationTime ?? 0,
          poolSize: this.browsers.size,
        },
      });
    }
  }

  /**
   * Log browser recovery events
   * @nist si-4 "Information system monitoring"
   */
  async logBrowserRecovery(success: boolean, browserId: string, error?: Error): Promise<void> {
    if (success) {
      await logSecurityEvent(SecurityEventType.BROWSER_CRASH, {
        resource: `browser:${browserId}`,
        action: 'recover',
        result: 'success',
        metadata: {
          browserId,
          recoveryMethod: 'restart',
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.BROWSER_CRASH, {
        resource: `browser:${browserId}`,
        action: 'recover',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          browserId,
          recoveryMethod: 'restart',
        },
      });
    }
  }

  /**
   * Log page creation events
   * @nist ac-4 "Information flow enforcement"
   */
  async logPageCreation(
    success: boolean,
    browserId: string,
    sessionId: string,
    duration: number,
    error?: Error,
  ): Promise<void> {
    if (success) {
      await logSecurityEvent(SecurityEventType.PAGE_NAVIGATION, {
        resource: `browser:${browserId}`,
        action: 'create_page',
        result: 'success',
        metadata: {
          browserId,
          sessionId,
          pageCreationTime: duration,
          browserPageCount: this.browsers.get(browserId)?.pageCount ?? 0,
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.PAGE_NAVIGATION, {
        resource: `browser:${browserId}`,
        action: 'create_page',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          browserId,
          sessionId,
          creationTime: duration,
        },
      });
    }
  }

  /**
   * Log page closure events
   */
  async logPageClosure(
    success: boolean,
    browserId: string,
    sessionId: string,
    duration: number,
    initialPageCount: number,
    error?: Error,
  ): Promise<void> {
    if (success) {
      await logSecurityEvent(SecurityEventType.PAGE_NAVIGATION, {
        resource: `browser:${browserId}`,
        action: 'close_page',
        result: 'success',
        metadata: {
          browserId,
          sessionId,
          pageDestructionTime: duration,
          initialPageCount,
          finalPageCount: this.browsers.get(browserId)?.pageCount ?? 0,
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.PAGE_NAVIGATION, {
        resource: `browser:${browserId}`,
        action: 'close_page',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          browserId,
          sessionId,
          destructionTime: duration,
          initialPageCount,
        },
      });
    }
  }

  /**
   * Log pool initialization
   * @nist ac-3 "Access enforcement"
   */
  async logPoolInitialization(): Promise<void> {
    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'browser_pool',
      action: 'initialize',
      result: 'success',
      metadata: {
        maxBrowsers: this.options.maxBrowsers,
        maxPagesPerBrowser: this.options.maxPagesPerBrowser,
        idleTimeout: this.options.idleTimeout,
        healthCheckInterval: this.options.healthCheckInterval,
        headless: this.options.launchOptions?.headless ?? true,
      },
    });
  }

  /**
   * Log pool shutdown
   * @nist ac-12 "Session termination"
   */
  async logPoolShutdown(success: boolean, error?: Error): Promise<void> {
    if (success) {
      await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
        resource: 'browser_pool',
        action: 'shutdown',
        result: 'success',
        metadata: {
          browsersShutdown: this.browsers.size,
          gracefulShutdown: true,
        },
      });
    } else {
      await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
        resource: 'browser_pool',
        action: 'shutdown',
        result: 'failure',
        reason: error?.message ?? 'Unknown error',
        metadata: {
          browsersRemaining: this.browsers.size,
        },
      });
    }
  }

  /**
   * Log configuration changes
   * @nist cm-7 "Least functionality"
   */
  async logConfigurationChange(
    oldOptions: BrowserPoolOptions,
    newOptions: BrowserPoolOptions,
    changes: string[],
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.CONFIG_CHANGE, {
      resource: 'browser_pool',
      action: 'configure',
      result: 'success',
      metadata: {
        oldMaxBrowsers: oldOptions.maxBrowsers,
        newMaxBrowsers: newOptions.maxBrowsers,
        oldIdleTimeout: oldOptions.idleTimeout,
        newIdleTimeout: newOptions.idleTimeout,
        oldHealthCheckInterval: oldOptions.healthCheckInterval,
        newHealthCheckInterval: newOptions.healthCheckInterval,
        changes,
      },
    });
  }

  /**
   * Emit browser releasing event
   */
  emitBrowserReleasing(browserId: string, sessionId: string, reason: string): void {
    this.emitEvent('browser:releasing', { browserId, sessionId, reason });
  }
}