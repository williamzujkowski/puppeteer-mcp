#!/usr/bin/env node

import fetch from 'node-fetch';
import { URL } from 'url';

const BASE_URL = 'https://williamzujkowski.github.io/puppeteer-mcp';
const API_BASE = 'http://localhost:8443/api/v1';
const AUTH_TOKEN = process.env.PUPPETEER_API_KEY || 'test-api-key';

// List of main documentation pages to check
const PAGES_TO_CHECK = [
  '/',
  '/quickstart/',
  '/quickstart/installation',
  '/quickstart/first-steps',
  '/quickstart/claude-desktop',
  '/quickstart/configuration',
  '/guides/',
  '/guides/browser-automation',
  '/guides/api-integration',
  '/guides/mcp-usage-examples',
  '/guides/advanced-scenarios',
  '/reference/',
  '/reference/rest-api',
  '/reference/grpc-api',
  '/reference/websocket-api',
  '/reference/mcp-tools',
  '/reference/puppeteer-actions',
  '/architecture/',
  '/architecture/overview',
  '/architecture/session-management',
  '/architecture/security',
  '/architecture/mcp-integration-plan',
  '/deployment/',
  '/deployment/npm-package',
  '/deployment/docker',
  '/deployment/production',
  '/deployment/scaling',
  '/development/',
  '/development/workflow',
  '/development/standards',
  '/development/testing',
  '/contributing/',
  '/contributing/code-of-conduct',
  '/project/roadmap',
  '/quick-reference/',
  '/quick-reference/api-cheatsheet',
  '/quick-reference/common-patterns',
  '/quick-reference/env-vars',
  '/quick-reference/error-codes',
  '/quick-reference/mcp-tools-summary',
  '/troubleshooting',
  '/ai/routing-patterns',
  '/lessons/implementation',
  '/lessons/project-planning'
];

class DocsVerifier {
  constructor() {
    this.sessionId = null;
    this.results = {
      totalPages: 0,
      successfulPages: 0,
      brokenLinks: [],
      pageErrors: [],
      contentIssues: []
    };
  }

  async createSession() {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseUrl: BASE_URL
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      console.log('✅ Created browser session:', this.sessionId);
    } catch (error) {
      console.error('❌ Failed to create session:', error.message);
      throw error;
    }
  }

  async navigateToPage(path) {
    const url = `${BASE_URL}${path}`;
    try {
      const response = await fetch(`${API_BASE}/sessions/${this.sessionId}/navigate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`Navigation failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Failed to navigate to ${url}:`, error.message);
      throw error;
    }
  }

  async getPageContent() {
    try {
      const response = await fetch(`${API_BASE}/sessions/${this.sessionId}/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expression: `
            (() => {
              const results = {
                title: document.title,
                url: window.location.href,
                links: [],
                has404: false,
                hasError: false,
                errorText: ''
              };
              
              // Check for 404 or error pages
              const bodyText = document.body.innerText.toLowerCase();
              if (bodyText.includes('404') || bodyText.includes('page not found')) {
                results.has404 = true;
              }
              
              if (bodyText.includes('error') && bodyText.includes('failed')) {
                results.hasError = true;
                results.errorText = document.querySelector('.error-message')?.innerText || '';
              }
              
              // Get all links
              const links = document.querySelectorAll('a[href]');
              links.forEach(link => {
                const href = link.getAttribute('href');
                const text = link.innerText.trim();
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  results.links.push({
                    href,
                    text,
                    isExternal: href.startsWith('http') && !href.includes('williamzujkowski.github.io')
                  });
                }
              });
              
              return results;
            })()
          `
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get page content: ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('❌ Failed to get page content:', error.message);
      throw error;
    }
  }

  async checkLink(link, fromPage) {
    try {
      let checkUrl = link.href;
      
      // Convert relative links to absolute
      if (!link.href.startsWith('http')) {
        if (link.href.startsWith('/')) {
          checkUrl = `https://williamzujkowski.github.io${link.href}`;
        } else {
          const basePath = fromPage.substring(0, fromPage.lastIndexOf('/'));
          checkUrl = `${BASE_URL}${basePath}/${link.href}`;
        }
      }

      // For internal links, navigate and check
      if (!link.isExternal && checkUrl.includes('williamzujkowski.github.io')) {
        const path = new URL(checkUrl).pathname.replace('/puppeteer-mcp', '');
        await this.navigateToPage(path);
        
        // Wait a bit for page to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const content = await this.getPageContent();
        
        if (content.has404 || content.hasError) {
          return {
            success: false,
            reason: content.has404 ? '404 Page Not Found' : content.errorText
          };
        }
        
        return { success: true };
      }
      
      // For external links, just log them
      return { success: true, external: true };
    } catch (error) {
      return {
        success: false,
        reason: error.message
      };
    }
  }

  async verifyPage(path) {
    console.log(`\n📄 Checking page: ${path}`);
    this.results.totalPages++;

    try {
      await this.navigateToPage(path);
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const content = await this.getPageContent();
      
      // Check if page loaded successfully
      if (content.has404) {
        this.results.pageErrors.push({
          page: path,
          error: '404 - Page not found'
        });
        console.log('  ❌ 404 - Page not found');
        return;
      }

      if (content.hasError) {
        this.results.pageErrors.push({
          page: path,
          error: content.errorText
        });
        console.log(`  ❌ Error: ${content.errorText}`);
        return;
      }

      console.log(`  ✅ Page loaded successfully (${content.links.length} links found)`);
      this.results.successfulPages++;

      // Check a sample of links (checking all would take too long)
      const linksToCheck = content.links.filter(l => !l.isExternal).slice(0, 5);
      
      for (const link of linksToCheck) {
        const result = await this.checkLink(link, path);
        if (!result.success) {
          this.results.brokenLinks.push({
            fromPage: path,
            link: link.href,
            text: link.text,
            reason: result.reason
          });
          console.log(`  ❌ Broken link: ${link.href} - ${result.reason}`);
        }
      }

    } catch (error) {
      this.results.pageErrors.push({
        page: path,
        error: error.message
      });
      console.log(`  ❌ Failed to verify: ${error.message}`);
    }
  }

  async closeSession() {
    if (!this.sessionId) return;

    try {
      await fetch(`${API_BASE}/sessions/${this.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      console.log('✅ Closed browser session');
    } catch (error) {
      console.error('❌ Failed to close session:', error.message);
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DOCUMENTATION VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Summary:`);
    console.log(`  Total pages checked: ${this.results.totalPages}`);
    console.log(`  Successful pages: ${this.results.successfulPages}`);
    console.log(`  Pages with errors: ${this.results.pageErrors.length}`);
    console.log(`  Broken links found: ${this.results.brokenLinks.length}`);
    
    if (this.results.pageErrors.length > 0) {
      console.log(`\n❌ Page Errors:`);
      this.results.pageErrors.forEach(error => {
        console.log(`  - ${error.page}: ${error.error}`);
      });
    }
    
    if (this.results.brokenLinks.length > 0) {
      console.log(`\n🔗 Broken Links:`);
      this.results.brokenLinks.forEach(broken => {
        console.log(`  - From: ${broken.fromPage}`);
        console.log(`    Link: ${broken.link} ("${broken.text}")`);
        console.log(`    Reason: ${broken.reason}`);
      });
    }
    
    const successRate = (this.results.successfulPages / this.results.totalPages * 100).toFixed(1);
    console.log(`\n✨ Success Rate: ${successRate}%`);
    
    if (this.results.pageErrors.length === 0 && this.results.brokenLinks.length === 0) {
      console.log('\n🎉 All documentation pages and links are working correctly!');
    }
  }

  async run() {
    console.log('🚀 Starting Puppeteer MCP Documentation Verification...');
    console.log(`📍 Target: ${BASE_URL}`);
    
    try {
      await this.createSession();
      
      // Check main pages
      for (const page of PAGES_TO_CHECK) {
        await this.verifyPage(page);
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      this.printReport();
      
    } catch (error) {
      console.error('\n❌ Verification failed:', error.message);
    } finally {
      await this.closeSession();
    }
  }
}

// Check if puppeteer-mcp server is running
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:8443/health');
    if (!response.ok) {
      throw new Error('Server not responding');
    }
    return true;
  } catch (error) {
    console.error('❌ Puppeteer MCP server is not running!');
    console.log('💡 Please start the server with: puppeteer-mcp');
    return false;
  }
}

// Main execution
(async () => {
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }

  const verifier = new DocsVerifier();
  await verifier.run();
})();