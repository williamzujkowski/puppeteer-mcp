/**
 * Multi-Tab Workflow Example
 *
 * This example demonstrates:
 * - Managing multiple browser tabs simultaneously
 * - Coordinating actions between tabs
 * - Sharing data between contexts
 * - Handling tab lifecycle
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface Page {
  id: string;
  url: string;
  title: string;
}

interface Context {
  id: string;
  pages: Page[];
}

interface Session {
  id: string;
  contexts: Context[];
}

class MultiTabWorkflow {
  private sessionId: string | null = null;
  private contextId: string | null = null;
  private pages: Map<string, Page> = new Map();
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(): Promise<void> {
    // Create session
    const sessionResponse = await this.apiClient.post('/sessions', {
      capabilities: {
        acceptInsecureCerts: true,
        browserName: 'chrome',
      },
    });

    const session: Session = sessionResponse.data.data;
    this.sessionId = session.id;
    this.contextId = session.contexts[0].id;

    console.log(`Session created: ${this.sessionId}`);
    console.log(`Context ID: ${this.contextId}`);
  }

  async openNewTab(url: string, identifier: string): Promise<Page> {
    if (!this.sessionId || !this.contextId) {
      throw new Error('Session not initialized');
    }

    // Create new page in context
    const response = await this.apiClient.post(
      `/sessions/${this.sessionId}/contexts/${this.contextId}/pages`,
      { url },
    );

    const page: Page = response.data.data;
    this.pages.set(identifier, page);

    console.log(`Opened new tab '${identifier}': ${page.id} - ${url}`);
    return page;
  }

  async switchToTab(identifier: string): Promise<void> {
    const page = this.pages.get(identifier);
    if (!page) {
      throw new Error(`Tab '${identifier}' not found`);
    }

    // Set active page context
    await this.execute('evaluate', [`window.focus()`], page.id);
    console.log(`Switched to tab: ${identifier}`);
  }

  async executeInTab(identifier: string, script: string, args: any[] = []): Promise<any> {
    const page = this.pages.get(identifier);
    if (!page) {
      throw new Error(`Tab '${identifier}' not found`);
    }

    return this.execute(script, args, page.id);
  }

  async coordinatedAction(tabs: string[], action: (tabId: string) => Promise<void>): Promise<void> {
    console.log(`Executing coordinated action across ${tabs.length} tabs`);

    // Execute action in parallel across all tabs
    const promises = tabs.map(async (tabId) => {
      try {
        await action(tabId);
        console.log(`Action completed in tab: ${tabId}`);
      } catch (error) {
        console.error(`Action failed in tab ${tabId}:`, error);
        throw error;
      }
    });

    await Promise.all(promises);
  }

  async shareDataBetweenTabs(sourceTab: string, targetTab: string, dataKey: string): Promise<void> {
    // Extract data from source tab
    const data = await this.executeInTab(sourceTab, 'evaluate', [
      `
      // Extract specific data based on key
      (() => {
        switch('${dataKey}') {
          case 'cart':
            return JSON.stringify(window.localStorage.getItem('cart') || '[]');
          case 'auth':
            return JSON.stringify(window.localStorage.getItem('authToken') || '');
          case 'form':
            const formData = {};
            document.querySelectorAll('input, select, textarea').forEach(el => {
              formData[el.name || el.id] = el.value;
            });
            return JSON.stringify(formData);
          default:
            return '{}';
        }
      })()
    `,
    ]);

    // Inject data into target tab
    await this.executeInTab(targetTab, 'evaluate', [
      `
      // Inject data based on key
      (() => {
        const data = ${data};
        switch('${dataKey}') {
          case 'cart':
            window.localStorage.setItem('cart', JSON.parse(data));
            break;
          case 'auth':
            window.localStorage.setItem('authToken', JSON.parse(data));
            break;
          case 'form':
            const formData = JSON.parse(data);
            Object.entries(formData).forEach(([key, value]) => {
              const el = document.querySelector(\`[name="\${key}"], #\${key}\`);
              if (el) el.value = value;
            });
            break;
        }
      })()
    `,
    ]);

    console.log(`Shared ${dataKey} data from ${sourceTab} to ${targetTab}`);
  }

  async closeTab(identifier: string): Promise<void> {
    const page = this.pages.get(identifier);
    if (!page) {
      throw new Error(`Tab '${identifier}' not found`);
    }

    await this.apiClient.delete(
      `/sessions/${this.sessionId}/contexts/${this.contextId}/pages/${page.id}`,
    );

    this.pages.delete(identifier);
    console.log(`Closed tab: ${identifier}`);
  }

  async getAllTabInfo(): Promise<Map<string, any>> {
    const tabInfo = new Map<string, any>();

    for (const [identifier, page] of this.pages) {
      const info = await this.executeInTab(identifier, 'evaluate', [
        `
        ({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          hasActiveElement: document.activeElement !== document.body
        })
      `,
      ]);

      tabInfo.set(identifier, info);
    }

    return tabInfo;
  }

  private async execute(script: string, args: any[] = [], pageId?: string): Promise<any> {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    const context: any = {};
    if (pageId) {
      context.pageId = pageId;
    }

    const response = await this.apiClient.post(`/sessions/${this.sessionId}/execute`, {
      script,
      args,
      context,
    });

    return response.data.data.result;
  }

  async cleanup(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.apiClient.delete(`/sessions/${this.sessionId}`);
        console.log('Session cleaned up');
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }
}

// Example 1: E-commerce comparison shopping
async function comparisonShoppingExample() {
  const workflow = new MultiTabWorkflow();

  try {
    await workflow.initialize();

    // Open multiple shopping sites
    const sites = [
      { id: 'amazon', url: 'https://www.amazon.com/dp/B08N5WRWNW' },
      { id: 'bestbuy', url: 'https://www.bestbuy.com/site/echo-dot/6110029.p' },
      { id: 'target', url: 'https://www.target.com/p/echo-dot-4th-gen/-/A-82086441' },
    ];

    // Open all tabs
    for (const site of sites) {
      await workflow.openNewTab(site.url, site.id);
    }

    // Extract prices from all tabs simultaneously
    const prices = new Map<string, number>();

    await workflow.coordinatedAction(['amazon', 'bestbuy', 'target'], async (tabId) => {
      const priceText = await workflow.executeInTab(tabId, 'evaluate', [
        `
        // Site-specific price extraction
        (() => {
          switch('${tabId}') {
            case 'amazon':
              return document.querySelector('.a-price-whole')?.textContent || '0';
            case 'bestbuy':
              return document.querySelector('.pricing-price__regular-price')?.textContent || '0';
            case 'target':
              return document.querySelector('[data-test="product-price"]')?.textContent || '0';
            default:
              return '0';
          }
        })()
      `,
      ]);

      const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      prices.set(tabId, price);
    });

    // Find best price
    const bestDeal = Array.from(prices.entries()).sort((a, b) => a[1] - b[1])[0];

    console.log('Price Comparison:');
    prices.forEach((price, site) => {
      console.log(`${site}: $${price}`);
    });
    console.log(`Best deal: ${bestDeal[0]} at $${bestDeal[1]}`);
  } finally {
    await workflow.cleanup();
  }
}

// Example 2: Multi-step authentication flow
async function multiStepAuthExample() {
  const workflow = new MultiTabWorkflow();

  try {
    await workflow.initialize();

    // Step 1: Open login page
    await workflow.openNewTab('https://example.com/login', 'login');

    // Fill login form
    await workflow.executeInTab('login', 'type', ['#username', 'user@example.com']);
    await workflow.executeInTab('login', 'type', ['#password', 'password123']);
    await workflow.executeInTab('login', 'click', ['#login-button']);

    // Wait for redirect
    await workflow.executeInTab('login', 'waitForNavigation', [{ waitUntil: 'networkidle0' }]);

    // Step 2: Open 2FA page in new tab (simulating email link)
    await workflow.openNewTab('https://example.com/verify-2fa', '2fa');

    // Get 2FA code from email (simulated)
    const code = '123456';
    await workflow.executeInTab('2fa', 'type', ['#code', code]);
    await workflow.executeInTab('2fa', 'click', ['#verify-button']);

    // Step 3: Share auth token between tabs
    await workflow.shareDataBetweenTabs('2fa', 'login', 'auth');

    // Step 4: Access protected resource
    await workflow.openNewTab('https://example.com/dashboard', 'dashboard');

    console.log('Multi-step authentication completed successfully');
  } finally {
    await workflow.cleanup();
  }
}

// Example 3: Social media cross-posting
async function crossPostingExample() {
  const workflow = new MultiTabWorkflow();
  const postContent = 'Check out our new product launch! 🚀 #innovation #tech';

  try {
    await workflow.initialize();

    // Open social media platforms
    const platforms = ['twitter', 'linkedin', 'facebook'];
    for (const platform of platforms) {
      await workflow.openNewTab(`https://${platform}.com/compose`, platform);
    }

    // Post to all platforms simultaneously
    await workflow.coordinatedAction(platforms, async (platform) => {
      switch (platform) {
        case 'twitter':
          await workflow.executeInTab(platform, 'type', ['.tweet-compose', postContent]);
          await workflow.executeInTab(platform, 'click', ['button[data-testid="tweetButton"]']);
          break;

        case 'linkedin':
          await workflow.executeInTab(platform, 'type', [
            '.share-creation-state__text-editor',
            postContent,
          ]);
          await workflow.executeInTab(platform, 'click', ['.share-actions__primary-action']);
          break;

        case 'facebook':
          await workflow.executeInTab(platform, 'type', ['[role="textbox"]', postContent]);
          await workflow.executeInTab(platform, 'click', ['button[type="submit"]']);
          break;
      }
    });

    console.log('Cross-posted to all platforms successfully');

    // Get posting status from all tabs
    const statuses = await workflow.getAllTabInfo();
    console.log('Posting statuses:', statuses);
  } finally {
    await workflow.cleanup();
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('Multi-Tab Workflow Examples\n');

    try {
      console.log('1. Comparison Shopping Example');
      await comparisonShoppingExample();
      console.log('\n---\n');

      console.log('2. Multi-Step Authentication Example');
      await multiStepAuthExample();
      console.log('\n---\n');

      console.log('3. Cross-Posting Example');
      await crossPostingExample();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
