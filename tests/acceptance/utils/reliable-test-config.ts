/**
 * Reliable test configuration using data URLs
 * Eliminates external dependencies for more reliable CI testing
 */

import { TestDataUrls } from '../../utils/test-data-urls.js';

export interface TestConfig {
  timeout: number;
  retries: number;
  headless: boolean;
  slowMo: number;
  viewport: {
    width: number;
    height: number;
  };
}

export interface TestTargets {
  ecommerce: {
    sauceDemo: string;
    automationPractice: string;
  };
  apis: {
    httpbin: string;
    jsonplaceholder: string;
    reqres: string;
    worldbank: string;
  };
  testing: {
    theInternet: string;
    uiPlayground: string;
    testPages: string;
    demoQA: string;
  };
  realWorld: {
    hackerNews: string;
    reactDemo: string;
    angularDemo: string;
  };
}

export const TEST_CONFIG: TestConfig = {
  timeout: Number(process.env.ACCEPTANCE_TEST_TIMEOUT) || 30000,
  retries: Number(process.env.ACCEPTANCE_TEST_RETRIES) || 2,
  headless: process.env.ACCEPTANCE_TEST_HEADLESS !== 'false',
  slowMo: Number(process.env.ACCEPTANCE_TEST_SLOW_MO) || 0,
  viewport: {
    width: 1920,
    height: 1080,
  },
};

// Use data URLs for reliable testing without external dependencies
export const RELIABLE_TEST_TARGETS: TestTargets = {
  ecommerce: {
    // Replace saucedemo with local login page
    sauceDemo: TestDataUrls.loginPage(),
    // Replace automation practice with product page
    automationPractice: TestDataUrls.productPage(),
  },
  apis: {
    // For API tests, use mock JSON responses
    httpbin: createJsonDataUrl({ 
      origin: '127.0.0.1',
      url: 'http://localhost/get',
      args: {},
      headers: {}
    }),
    jsonplaceholder: createJsonDataUrl([
      { id: 1, title: 'Test Post 1', body: 'This is a test post', userId: 1 },
      { id: 2, title: 'Test Post 2', body: 'Another test post', userId: 1 }
    ]),
    reqres: createJsonDataUrl({
      data: [
        { id: 1, email: 'test1@example.com', first_name: 'John', last_name: 'Doe' },
        { id: 2, email: 'test2@example.com', first_name: 'Jane', last_name: 'Smith' }
      ]
    }),
    worldbank: createJsonDataUrl({
      countries: [
        { id: 'USA', name: 'United States' },
        { id: 'GBR', name: 'United Kingdom' }
      ]
    }),
  },
  testing: {
    // Replace the-internet with basic test page
    theInternet: TestDataUrls.basicPage('The Internet'),
    // UI playground with form page
    uiPlayground: TestDataUrls.formPage(),
    // Test pages with dynamic content
    testPages: TestDataUrls.dynamicPage(),
    // Demo QA with table page
    demoQA: TestDataUrls.tablePage(),
  },
  realWorld: {
    // Simple news page simulation
    hackerNews: createNewsPage(),
    // React demo with gallery
    reactDemo: TestDataUrls.galleryPage(),
    // Angular demo with modal
    angularDemo: TestDataUrls.modalPage(),
  },
};

/**
 * Create a data URL for JSON responses
 */
function createJsonDataUrl(data: any): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify(data))}`;
}

/**
 * Create a simple news page
 */
function createNewsPage(): string {
  return `data:text/html,<!DOCTYPE html>
  <html>
  <head>
    <title>Test News</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .article { margin: 20px 0; padding: 10px; border-bottom: 1px solid #ccc; }
      .title { font-size: 18px; font-weight: bold; }
      .meta { color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Test News Site</h1>
    <div class="article">
      <div class="title">Test Article 1</div>
      <div class="meta">Posted by user1 | 10 points | 5 comments</div>
    </div>
    <div class="article">
      <div class="title">Test Article 2</div>
      <div class="meta">Posted by user2 | 25 points | 12 comments</div>
    </div>
    <div class="article">
      <div class="title">Test Article 3</div>
      <div class="meta">Posted by user3 | 42 points | 18 comments</div>
    </div>
  </body>
  </html>`;
}

// Test credentials remain the same
export const TEST_CREDENTIALS = {
  sauceDemo: {
    standard: { username: 'standard_user', password: 'secret_sauce' },
    locked: { username: 'locked_out_user', password: 'secret_sauce' },
    problem: { username: 'problem_user', password: 'secret_sauce' },
    performance: { username: 'performance_glitch_user', password: 'secret_sauce' },
  },
};

// User agents remain the same
export const TEST_USER_AGENTS = {
  chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  testing: 'puppeteer-mcp-acceptance-test/1.0.14',
};

/**
 * Helper to switch between external and data URLs based on environment
 */
export function getTestTargets(): TestTargets {
  // Use data URLs in CI environment or when specified
  if (process.env.CI || process.env.USE_DATA_URLS === 'true') {
    return RELIABLE_TEST_TARGETS;
  }
  
  // Otherwise, import and use the original external URLs
  // This allows developers to test against real sites locally if needed
  try {
    const { TEST_TARGETS } = require('./test-config.js');
    return TEST_TARGETS;
  } catch {
    // Fallback to reliable targets if original config unavailable
    return RELIABLE_TEST_TARGETS;
  }
}