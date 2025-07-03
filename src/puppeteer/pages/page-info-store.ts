/**
 * Page Information Store for Puppeteer Integration
 * @module puppeteer/pages/page-info-store
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist sc-2 "Application partitioning"
 */

import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';

/**
 * Page info store interface
 */
export interface PageInfoStore {
  create(pageInfo: Omit<PageInfo, 'id' | 'createdAt' | 'lastActivityAt'>): Promise<PageInfo>;
  get(pageId: string): Promise<PageInfo | undefined>;
  update(pageId: string, updates: Partial<PageInfo>): Promise<PageInfo>;
  delete(pageId: string): Promise<boolean>;
  listByContext(contextId: string): Promise<PageInfo[]>;
  listBySession(sessionId: string): Promise<PageInfo[]>;
  listByBrowser(browserId: string): Promise<PageInfo[]>;
  listAll(): Promise<PageInfo[]>;
  touchActivity(pageId: string): Promise<void>;
  updateState(pageId: string, state: PageInfo['state']): Promise<void>;
  updateUrl(pageId: string, url: string): Promise<void>;
  updateTitle(pageId: string, title: string): Promise<void>;
  addNavigationHistory(pageId: string, url: string): Promise<void>;
  incrementErrorCount(pageId: string): Promise<void>;
  clear(): Promise<void>;
  cleanup(predicate: (pageInfo: PageInfo) => boolean): Promise<number>;
}

// Note: These interfaces can be used in the future if needed for more complex mapping logic

/**
 * In-memory page information store implementation
 * @nist ac-3 "Access enforcement"
 * @nist sc-2 "Application partitioning"
 */
export class InMemoryPageInfoStore implements PageInfoStore {
  private pages: Map<string, PageInfo> = new Map();
  private contextToPages: Map<string, Set<string>> = new Map();
  private sessionToPages: Map<string, Set<string>> = new Map();
  private browserToPages: Map<string, Set<string>> = new Map();

  /**
   * Create a new page info record
   * @nist au-3 "Content of audit records"
   */
  async create(pageData: Omit<PageInfo, 'id' | 'createdAt' | 'lastActivityAt'>): Promise<PageInfo> {
    const pageInfo: PageInfo = {
      ...pageData,
      id: uuidv4(),
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.pages.set(pageInfo.id, pageInfo);

    // Update mappings
    this.addToMapping(this.contextToPages, pageInfo.contextId, pageInfo.id);
    this.addToMapping(this.sessionToPages, pageInfo.sessionId, pageInfo.id);
    this.addToMapping(this.browserToPages, pageInfo.browserId, pageInfo.id);

    await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
      resource: `page:${pageInfo.id}`,
      action: 'create',
      result: 'success',
      metadata: {
        contextId: pageInfo.contextId,
        sessionId: pageInfo.sessionId,
        browserId: pageInfo.browserId,
        url: pageInfo.url,
      },
    });

    return pageInfo;
  }

  /**
   * Get page info by ID
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async get(pageId: string): Promise<PageInfo | undefined> {
    return this.pages.get(pageId);
  }

  /**
   * Update page info
   * @nist au-3 "Content of audit records"
   */
  async update(pageId: string, updates: Partial<PageInfo>): Promise<PageInfo> {
    const pageInfo = this.pages.get(pageId);
    if (!pageInfo) {
      throw new AppError('Page not found', 404);
    }

    // Don't allow updating certain fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt, ...allowedUpdates } = updates;

    const updatedPageInfo = {
      ...pageInfo,
      ...allowedUpdates,
      // Only update lastActivityAt if not explicitly provided in updates
      lastActivityAt: allowedUpdates.lastActivityAt ?? new Date(),
    };

    this.pages.set(pageId, updatedPageInfo);

    await logSecurityEvent(SecurityEventType.RESOURCE_UPDATED, {
      resource: `page:${pageId}`,
      action: 'update',
      result: 'success',
      metadata: {
        updatedFields: Object.keys(allowedUpdates),
        contextId: pageInfo.contextId,
      },
    });

    return updatedPageInfo;
  }

  /**
   * Delete page info
   * @nist au-3 "Content of audit records"
   */
  async delete(pageId: string): Promise<boolean> {
    const pageInfo = this.pages.get(pageId);
    if (!pageInfo) {
      return false;
    }

    this.pages.delete(pageId);

    // Update mappings
    this.removeFromMapping(this.contextToPages, pageInfo.contextId, pageId);
    this.removeFromMapping(this.sessionToPages, pageInfo.sessionId, pageId);
    this.removeFromMapping(this.browserToPages, pageInfo.browserId, pageId);

    await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
      resource: `page:${pageId}`,
      action: 'delete',
      result: 'success',
      metadata: {
        contextId: pageInfo.contextId,
        sessionId: pageInfo.sessionId,
      },
    });

    return true;
  }

  /**
   * List pages by context ID
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async listByContext(contextId: string): Promise<PageInfo[]> {
    const pageIds = this.contextToPages.get(contextId) ?? new Set();
    return Array.from(pageIds)
      .map((id) => this.pages.get(id))
      .filter((page): page is PageInfo => page !== undefined);
  }

  /**
   * List pages by session ID
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async listBySession(sessionId: string): Promise<PageInfo[]> {
    const pageIds = this.sessionToPages.get(sessionId) ?? new Set();
    return Array.from(pageIds)
      .map((id) => this.pages.get(id))
      .filter((page): page is PageInfo => page !== undefined);
  }

  /**
   * List pages by browser ID
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async listByBrowser(browserId: string): Promise<PageInfo[]> {
    const pageIds = this.browserToPages.get(browserId) ?? new Set();
    return Array.from(pageIds)
      .map((id) => this.pages.get(id))
      .filter((page): page is PageInfo => page !== undefined);
  }

  /**
   * Update page activity timestamp
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async touchActivity(pageId: string): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.lastActivityAt = new Date();
    }
  }

  /**
   * Update page state
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async updateState(pageId: string, state: PageInfo['state']): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.state = state;
      pageInfo.lastActivityAt = new Date();
    }
  }

  /**
   * Update page URL
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async updateUrl(pageId: string, url: string): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.url = url;
      pageInfo.lastActivityAt = new Date();
    }
  }

  /**
   * Update page title
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async updateTitle(pageId: string, title: string): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.title = title;
      pageInfo.lastActivityAt = new Date();
    }
  }

  /**
   * Add URL to navigation history
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async addNavigationHistory(pageId: string, url: string): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.navigationHistory.push(url);
      pageInfo.lastActivityAt = new Date();

      // Keep only last 50 entries to prevent memory bloat
      if (pageInfo.navigationHistory.length > 50) {
        pageInfo.navigationHistory = pageInfo.navigationHistory.slice(-50);
      }
    }
  }

  /**
   * Increment error count
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async incrementErrorCount(pageId: string): Promise<void> {
    const pageInfo = this.pages.get(pageId);
    if (pageInfo) {
      pageInfo.errorCount++;
      pageInfo.lastActivityAt = new Date();
    }
  }

  /**
   * List all pages
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async listAll(): Promise<PageInfo[]> {
    return Array.from(this.pages.values());
  }

  /**
   * Clear all page info
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  async clear(): Promise<void> {
    this.pages.clear();
    this.contextToPages.clear();
    this.sessionToPages.clear();
    this.browserToPages.clear();
  }

  /**
   * Cleanup pages matching predicate
   */
  async cleanup(predicate: (pageInfo: PageInfo) => boolean): Promise<number> {
    let cleaned = 0;

    for (const [pageId, pageInfo] of this.pages) {
      if (predicate(pageInfo)) {
        await this.delete(pageId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Add page ID to mapping
   * @private
   */
  private addToMapping(mapping: Map<string, Set<string>>, key: string, pageId: string): void {
    if (!mapping.has(key)) {
      mapping.set(key, new Set());
    }
    const pageSet = mapping.get(key);
    if (pageSet) {
      pageSet.add(pageId);
    }
  }

  /**
   * Remove page ID from mapping
   * @private
   */
  private removeFromMapping(mapping: Map<string, Set<string>>, key: string, pageId: string): void {
    const pageSet = mapping.get(key);
    if (pageSet) {
      pageSet.delete(pageId);
      if (pageSet.size === 0) {
        mapping.delete(key);
      }
    }
  }
}

/**
 * Singleton instance of page info store
 */
export const pageInfoStore = new InMemoryPageInfoStore();
