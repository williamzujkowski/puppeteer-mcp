/**
 * Proxy Usage Examples for MCP
 * @module mcp/examples/proxy-usage
 * @description Examples of using proxy configuration with MCP browser automation
 */

/* eslint-disable no-console, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing, no-promise-executor-return */

import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StdioTransport } from '../transport/stdio.js';
import type { CreateBrowserContextArgs } from '../types/tool-types.js';

/**
 * Example 1: Basic HTTP Proxy Configuration
 */
async function basicProxyExample(mcpClient: MCPClient): Promise<void> {
  console.log('=== Basic HTTP Proxy Example ===');

  // Create a browser context with a simple HTTP proxy
  const contextArgs: CreateBrowserContextArgs = {
    sessionId: 'proxy-demo-session',
    name: 'basic-proxy-context',
    options: {
      proxy: {
        enabled: true,
        config: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080,
          bypass: ['localhost', '127.0.0.1', '*.internal.com'],
        },
      },
    },
  };

  const contextResult = await mcpClient.callTool('createBrowserContext', contextArgs);
  console.log('Context created:', contextResult.content[0].text);

  // Navigate to a page through the proxy
  const navigationResult = await mcpClient.callTool('executeInContext', {
    sessionId: 'proxy-demo-session',
    contextId: JSON.parse(contextResult.content[0].text).contextId,
    command: 'navigateTo',
    parameters: {
      url: 'https://httpbin.org/ip',
      waitFor: 'networkidle0',
    },
  });

  console.log('Navigation result:', navigationResult.content[0].text);
}

/**
 * Example 2: Authenticated SOCKS5 Proxy
 */
async function authenticatedProxyExample(mcpClient: MCPClient): Promise<void> {
  console.log('=== Authenticated SOCKS5 Proxy Example ===');

  const contextArgs: CreateBrowserContextArgs = {
    sessionId: 'auth-proxy-session',
    name: 'socks5-proxy-context',
    options: {
      proxy: {
        enabled: true,
        config: {
          protocol: 'socks5',
          host: 'socks5.provider.com',
          port: 1080,
          auth: {
            username: process.env.PROXY_USERNAME ?? 'user',
            password: process.env.PROXY_PASSWORD ?? 'pass',
          },
          bypass: ['*.local', '10.*', '192.168.*'],
        },
      },
    },
  };

  const contextResult = await mcpClient.callTool('createBrowserContext', contextArgs);
  console.log('SOCKS5 context created:', contextResult.content[0].text);

  // Get page content through SOCKS proxy
  const contentResult = await mcpClient.callTool('executeInContext', {
    sessionId: 'auth-proxy-session',
    contextId: JSON.parse(contextResult.content[0].text).contextId,
    command: 'evaluateExpression',
    parameters: {
      expression: 'document.body.innerText',
      waitFor: 'load',
    },
  });

  console.log('Page content:', contentResult.content[0].text);
}

/**
 * Example 3: Proxy Pool with Rotation
 */
async function proxyPoolExample(mcpClient: MCPClient): Promise<void> {
  console.log('=== Proxy Pool with Rotation Example ===');

  const contextArgs: CreateBrowserContextArgs = {
    sessionId: 'pool-session',
    name: 'rotating-proxy-context',
    options: {
      proxy: {
        enabled: true,
        pool: {
          proxies: [
            {
              protocol: 'http',
              host: 'proxy1.pool.com',
              port: 8080,
              auth: {
                username: 'user1',
                password: 'pass1',
              },
              bypass: [],
              priority: 100, // Higher priority
            },
            {
              protocol: 'http',
              host: 'proxy2.pool.com',
              port: 8080,
              auth: {
                username: 'user2',
                password: 'pass2',
              },
              bypass: [],
              priority: 80,
            },
            {
              protocol: 'socks5',
              host: 'socks.pool.com',
              port: 1080,
              bypass: [],
              priority: 60,
            },
          ],
          strategy: 'priority', // Will prefer higher priority proxies
          healthCheckEnabled: true,
          healthCheckInterval: 300000, // 5 minutes
          failoverEnabled: true,
          failoverThreshold: 3,
        },
        rotateOnError: true,
        rotateOnInterval: true,
        rotationInterval: 600000, // Rotate every 10 minutes
      },
    },
  };

  const contextResult = await mcpClient.callTool('createBrowserContext', contextArgs);
  const context = JSON.parse(contextResult.content[0].text);
  console.log('Pool context created:', context);
  console.log('Using proxy:', context.proxyId);

  // Perform multiple requests - proxy will rotate automatically
  for (let i = 0; i < 5; i++) {
    const result = await mcpClient.callTool('executeInContext', {
      sessionId: 'pool-session',
      contextId: context.contextId,
      command: 'navigateTo',
      parameters: {
        url: `https://httpbin.org/headers`,
        waitFor: 'networkidle0',
      },
    });

    console.log(`Request ${i + 1} completed`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Example 4: Geo-targeted Browsing
 */
async function geoTargetedExample(mcpClient: MCPClient) {
  console.log('=== Geo-targeted Browsing Example ===');

  // US-based proxy for accessing US-only content
  const usContextArgs: CreateBrowserContextArgs = {
    sessionId: 'geo-session',
    name: 'us-browser',
    options: {
      proxy: {
        enabled: true,
        config: {
          protocol: 'http',
          host: 'us-east.proxy-provider.com',
          port: 8080,
          auth: {
            username: process.env.GEO_PROXY_USER || 'geouser',
            password: process.env.GEO_PROXY_PASS || 'geopass',
          },
          bypass: [],
          name: 'US-East-Proxy',
          tags: ['us', 'east', 'geo'],
        },
      },
    },
  };

  const contextResult = await mcpClient.callTool('createBrowserContext', usContextArgs);
  console.log('US proxy context created');

  // Check location through proxy
  const locationResult = await mcpClient.callTool('executeInContext', {
    sessionId: 'geo-session',
    contextId: JSON.parse(contextResult.content[0].text).contextId,
    command: 'navigateTo',
    parameters: {
      url: 'https://ipapi.co/json/',
      waitFor: 'networkidle0',
    },
  });

  const locationData = await mcpClient.callTool('executeInContext', {
    sessionId: 'geo-session',
    contextId: JSON.parse(contextResult.content[0].text).contextId,
    command: 'evaluateExpression',
    parameters: {
      expression: 'JSON.parse(document.body.innerText)',
    },
  });

  console.log('Location through proxy:', locationData.content[0].text);
}

/**
 * Example 5: Web Scraping with Failover
 */
async function webScrapingExample(mcpClient: MCPClient) {
  console.log('=== Web Scraping with Failover Example ===');

  const contextArgs: CreateBrowserContextArgs = {
    sessionId: 'scraping-session',
    name: 'scraper-context',
    options: {
      proxy: {
        enabled: true,
        pool: {
          proxies: [
            // Multiple residential proxies for scraping
            {
              protocol: 'http',
              host: 'residential1.proxy.com',
              port: 8080,
              auth: { username: 'scraper', password: 'pass1' },
              bypass: [],
              maxRetries: 2,
              connectionTimeout: 10000,
            },
            {
              protocol: 'http',
              host: 'residential2.proxy.com',
              port: 8080,
              auth: { username: 'scraper', password: 'pass2' },
              bypass: [],
              maxRetries: 2,
              connectionTimeout: 10000,
            },
            {
              protocol: 'http',
              host: 'residential3.proxy.com',
              port: 8080,
              auth: { username: 'scraper', password: 'pass3' },
              bypass: [],
              maxRetries: 2,
              connectionTimeout: 10000,
            },
          ],
          strategy: 'least-used', // Distribute load evenly
          healthCheckEnabled: true,
          failoverEnabled: true,
          failoverThreshold: 2, // Failover quickly on errors
        },
        rotateOnError: true,
        rotateOnInterval: true,
        rotationInterval: 300000, // 5 minutes
      },
      viewport: {
        width: 1920,
        height: 1080,
      },
    },
  };

  const contextResult = await mcpClient.callTool('createBrowserContext', contextArgs);
  const context = JSON.parse(contextResult.content[0].text);
  console.log('Scraping context created with proxy pool');

  // Scrape multiple pages
  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
  ];

  for (const url of urls) {
    try {
      // Navigate to page
      await mcpClient.callTool('executeInContext', {
        sessionId: 'scraping-session',
        contextId: context.contextId,
        command: 'navigateTo',
        parameters: {
          url,
          waitFor: 'domcontentloaded',
          timeout: 30000,
        },
      });

      // Extract data
      const data = await mcpClient.callTool('executeInContext', {
        sessionId: 'scraping-session',
        contextId: context.contextId,
        command: 'evaluateExpression',
        parameters: {
          expression: `
            ({
              title: document.title,
              url: window.location.href,
              content: document.querySelector('main')?.innerText || '',
              links: Array.from(document.querySelectorAll('a')).map(a => a.href)
            })
          `,
        },
      });

      console.log(`Scraped ${url}:`, data.content[0].text);

      // Add delay to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      // Proxy will automatically rotate on error due to rotateOnError setting
    }
  }

  // Clean up
  await mcpClient.callTool('closeBrowserContext', {
    sessionId: 'scraping-session',
    contextId: context.contextId,
  });
}

/**
 * Main function to run all examples
 */
export async function runProxyExamples() {
  console.log('Starting Proxy Usage Examples...\n');

  // Initialize MCP client
  const transport = new StdioTransport({
    command: 'node',
    args: ['dist/mcp/start-mcp.js'],
  });

  const mcpClient = new MCPClient({
    name: 'proxy-examples',
    version: '1.0.0',
  });

  await mcpClient.connect(transport);

  try {
    // Create a session first
    const sessionResult = await mcpClient.callTool('createSession', {
      username: 'demo-user',
      password: 'demo-pass',
      duration: 3600000, // 1 hour
    });

    const session = JSON.parse(sessionResult.content[0].text);
    console.log('Session created:', session.sessionId);

    // Run examples
    await basicProxyExample(mcpClient);
    console.log('\n---\n');

    await authenticatedProxyExample(mcpClient);
    console.log('\n---\n');

    await proxyPoolExample(mcpClient);
    console.log('\n---\n');

    await geoTargetedExample(mcpClient);
    console.log('\n---\n');

    await webScrapingExample(mcpClient);

    // Clean up session
    await mcpClient.callTool('deleteSession', {
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    await mcpClient.close();
  }
}

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProxyExamples().catch(console.error);
}
