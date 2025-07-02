/**
 * Page Manager Interface for Puppeteer Integration
 * Manages page lifecycle and context-to-page mapping
 */

import type { Page, Viewport, Cookie } from 'puppeteer';

/**
 * HTTP headers type
 */
export type Headers = Record<string, string>;

/**
 * Page configuration options
 */
export interface PageOptions {
  /** Page viewport configuration */
  viewport?: Viewport;
  
  /** Default navigation timeout (ms) */
  defaultTimeout?: number;
  
  /** Default navigation wait until */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  
  /** User agent string */
  userAgent?: string;
  
  /** Extra HTTP headers */
  extraHeaders?: Headers;
  
  /** Enable JavaScript */
  javaScriptEnabled?: boolean;
  
  /** Enable images */
  imagesEnabled?: boolean;
  
  /** Enable CSS */
  cssEnabled?: boolean;
  
  /** Bypass CSP */
  bypassCSP?: boolean;
  
  /** Ignore HTTPS errors */
  ignoreHTTPSErrors?: boolean;
  
  /** Offline mode */
  offline?: boolean;
  
  /** Cache enabled */
  cacheEnabled?: boolean;
  
  /** Initial cookies */
  cookies?: Cookie[];
}

/**
 * Page information and metadata
 */
export interface PageInfo {
  /** Unique page identifier */
  id: string;
  
  /** Associated context ID */
  contextId: string;
  
  /** Associated session ID */
  sessionId: string;
  
  /** Browser instance ID */
  browserId: string;
  
  /** Current URL */
  url: string;
  
  /** Page title */
  title: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last activity timestamp */
  lastActivityAt: Date;
  
  /** Page state */
  state: 'active' | 'idle' | 'navigating' | 'closed';
  
  /** Navigation history */
  navigationHistory: string[];
  
  /** Error count */
  errorCount: number;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Navigation options
 */
export interface NavigationOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Wait until specific event */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  
  /** Referrer URL */
  referer?: string;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Image type */
  type?: 'png' | 'jpeg' | 'webp';
  
  /** Quality (0-100, jpeg/webp only) */
  quality?: number;
  
  /** Full page screenshot */
  fullPage?: boolean;
  
  /** Clip region */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Omit background */
  omitBackground?: boolean;
  
  /** Encoding */
  encoding?: 'base64' | 'binary';
}

/**
 * Page manager interface for managing Puppeteer pages
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export interface PageManager {
  /**
   * Create a new page for a context
   * @param contextId - Context identifier
   * @param sessionId - Session identifier
   * @param browserId - Browser instance ID
   * @param options - Page configuration options
   * @returns Page info
   * @nist ac-2 "Account management"
   */
  createPage(
    contextId: string,
    sessionId: string,
    browserId: string,
    options?: PageOptions
  ): Promise<PageInfo>;
  
  /**
   * Get page by ID
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @returns Page instance or undefined
   * @nist ac-3 "Access enforcement"
   */
  getPage(pageId: string, sessionId: string): Promise<Page | undefined>;
  
  /**
   * Get page info
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @returns Page information
   */
  getPageInfo(pageId: string, sessionId: string): Promise<PageInfo | undefined>;
  
  /**
   * List pages for a context
   * @param contextId - Context identifier
   * @param sessionId - Session identifier for validation
   * @returns Array of page info
   */
  listPagesForContext(contextId: string, sessionId: string): Promise<PageInfo[]>;
  
  /**
   * List all pages for a session
   * @param sessionId - Session identifier
   * @returns Array of page info
   */
  listPagesForSession(sessionId: string): Promise<PageInfo[]>;
  
  /**
   * Navigate to URL
   * @param pageId - Page identifier
   * @param url - Target URL
   * @param sessionId - Session identifier for validation
   * @param options - Navigation options
   * @nist ac-4 "Information flow enforcement"
   */
  navigateTo(
    pageId: string,
    url: string,
    sessionId: string,
    options?: NavigationOptions
  ): Promise<void>;
  
  /**
   * Close a page
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @nist ac-12 "Session termination"
   */
  closePage(pageId: string, sessionId: string): Promise<void>;
  
  /**
   * Close all pages for a context
   * @param contextId - Context identifier
   */
  closePagesForContext(contextId: string): Promise<void>;
  
  /**
   * Close all pages for a session
   * @param sessionId - Session identifier
   */
  closePagesForSession(sessionId: string): Promise<void>;
  
  /**
   * Update page options
   * @param pageId - Page identifier
   * @param options - Page options to update
   * @param sessionId - Session identifier for validation
   */
  updatePageOptions(
    pageId: string,
    options: Partial<PageOptions>,
    sessionId: string
  ): Promise<void>;
  
  /**
   * Take screenshot of a page
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @param options - Screenshot options
   * @returns Screenshot data
   */
  takeScreenshot(
    pageId: string,
    sessionId: string,
    options?: ScreenshotOptions
  ): Promise<Buffer | string>;
  
  /**
   * Get page metrics
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @returns Page performance metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getPageMetrics(pageId: string, sessionId: string): Promise<Record<string, unknown>>;
  
  /**
   * Set page cookies
   * @param pageId - Page identifier
   * @param cookies - Cookies to set
   * @param sessionId - Session identifier for validation
   */
  setCookies(pageId: string, cookies: Cookie[], sessionId: string): Promise<void>;
  
  /**
   * Get page cookies
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @returns Current cookies
   */
  getCookies(pageId: string, sessionId: string): Promise<Cookie[]>;
  
  /**
   * Clear page data
   * @param pageId - Page identifier
   * @param sessionId - Session identifier for validation
   * @param options - What to clear
   */
  clearPageData(
    pageId: string,
    sessionId: string,
    options?: {
      cookies?: boolean;
      cache?: boolean;
      localStorage?: boolean;
      sessionStorage?: boolean;
    }
  ): Promise<void>;
  
  /**
   * Check if page is active
   * @param pageId - Page identifier
   * @returns True if page is active
   */
  isPageActive(pageId: string): Promise<boolean>;
  
  /**
   * Clean up idle pages
   * @param idleTimeout - Idle timeout in milliseconds
   * @returns Number of pages cleaned up
   */
  cleanupIdlePages(idleTimeout: number): Promise<number>;
}