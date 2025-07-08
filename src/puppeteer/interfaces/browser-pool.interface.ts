/**
 * Browser Pool Interface for Puppeteer Integration
 * Manages browser instances with resource pooling and lifecycle management
 */

import { Browser, LaunchOptions, Page } from 'puppeteer';

/**
 * Browser pool configuration options
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-2 "Application partitioning"
 */
export interface BrowserPoolOptions {
  /** Maximum number of browser instances in the pool */
  maxBrowsers: number;

  /** Maximum pages per browser instance */
  maxPagesPerBrowser: number;

  /** Browser launch options */
  launchOptions: LaunchOptions;

  /** Timeout for idle browsers before cleanup (ms) */
  idleTimeout: number;

  /** Browser health check interval (ms) */
  healthCheckInterval: number;

  /** Enable browser instance recycling after N uses */
  recycleAfterUses?: number;

  /** Enable request interception for security */
  enableRequestInterception?: boolean;

  /** Custom user data directory for isolation */
  userDataDir?: string;

  /** Timeout for browser acquisition requests (ms) */
  acquisitionTimeout?: number;
}

/**
 * Metrics for monitoring browser pool health
 */
export interface PoolMetrics {
  /** Total number of browsers in pool */
  totalBrowsers: number;

  /** Number of active browsers */
  activeBrowsers: number;

  /** Number of idle browsers */
  idleBrowsers: number;

  /** Total pages across all browsers */
  totalPages: number;

  /** Number of active pages */
  activePages: number;

  /** Browser creation count */
  browsersCreated: number;

  /** Browser destruction count */
  browsersDestroyed: number;

  /** Average browser lifetime (ms) */
  avgBrowserLifetime: number;

  /** Pool utilization percentage */
  utilizationPercentage: number;

  /** Last health check timestamp */
  lastHealthCheck: Date;
}

/**
 * Browser instance metadata
 */
export interface BrowserInstance {
  /** Unique identifier for the browser */
  id: string;

  /** Puppeteer browser instance */
  browser: Browser;

  /** Creation timestamp */
  createdAt: Date;

  /** Last used timestamp */
  lastUsedAt: Date;

  /** Number of times this browser has been used */
  useCount: number;

  /** Current number of pages */
  pageCount: number;

  /** Browser process PID */
  pid?: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Browser pool interface for managing Puppeteer browser instances
 * @nist ac-3 "Access enforcement"
 * @nist au-9 "Protection of audit information"
 */
export interface BrowserPool {
  /**
   * Initialize the browser pool
   * @nist ac-2 "Account management"
   */
  initialize(): Promise<void>;

  /**
   * Acquire a browser instance from the pool
   * @param sessionId - Session identifier for tracking
   * @returns Browser instance
   * @nist ia-2 "Identification and authentication"
   */
  acquireBrowser(sessionId: string): Promise<BrowserInstance>;

  /**
   * Release a browser back to the pool
   * @param browserId - Browser instance ID
   * @param sessionId - Session identifier
   */
  releaseBrowser(browserId: string, sessionId: string): Promise<void>;

  /**
   * Create a new page in a browser
   * @param browserId - Browser instance ID
   * @param sessionId - Session identifier
   * @returns New page instance
   * @nist ac-4 "Information flow enforcement"
   */
  createPage(browserId: string, sessionId: string): Promise<Page>;

  /**
   * Close a page in a browser
   * @param browserId - Browser instance ID
   * @param sessionId - Session identifier
   */
  closePage(browserId: string, sessionId: string): Promise<void>;

  /**
   * Get current pool metrics
   * @returns Pool metrics snapshot
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(): PoolMetrics;

  /**
   * Perform health check on all browsers
   * @returns Health check results
   * @nist si-4 "Information system monitoring"
   */
  healthCheck(): Promise<Map<string, boolean>>;

  /**
   * Recycle a browser instance
   * @param browserId - Browser instance ID
   */
  recycleBrowser(browserId: string): Promise<void>;

  /**
   * Shutdown the browser pool
   * @param force - Force immediate shutdown
   * @nist ac-12 "Session termination"
   */
  shutdown(force?: boolean): Promise<void>;

  /**
   * Set pool configuration
   * @param options - Partial configuration to update
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void;

  /**
   * Get browser instance by ID
   * @param browserId - Browser instance ID
   * @returns Browser instance or undefined
   */
  getBrowser(browserId: string): BrowserInstance | undefined;

  /**
   * List all browser instances
   * @returns Array of browser instances
   */
  listBrowsers(): BrowserInstance[];

  /**
   * Clean up idle browsers
   * @returns Number of browsers cleaned up
   */
  cleanupIdle(): Promise<number>;
}
