#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { URL } from 'url';

const BASE_URL = 'https://williamzujkowski.github.io/puppeteer-mcp';

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
  '/reference/',
  '/reference/rest-api',
  '/reference/grpc-api',
  '/architecture/',
  '/architecture/overview',
  '/architecture/security',
  '/deployment/',
  '/deployment/npm-package',
  '/deployment/docker',
  '/development/',
  '/contributing/',
  '/troubleshooting',
];

class DocsVerifier {
  constructor() {
    this.browser = null;
    this.results = {
      totalPages: 0,
      successfulPages: 0,
      brokenLinks: [],
      pageErrors: [],
      contentIssues: [],
    };
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async verifyPage(path) {
    console.log(`\n📄 Checking page: ${path}`);
    this.results.totalPages++;

    const page = await this.browser.newPage();
    const url = `${BASE_URL}${path}`;

    try {
      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Check response status
      if (!response || !response.ok()) {
        this.results.pageErrors.push({
          page: path,
          error: `HTTP ${response?.status() || 'unknown'}`,
        });
        console.log(`  ❌ HTTP ${response?.status() || 'unknown'}`);
        await page.close();
        return;
      }

      // Check for 404 or error content
      const pageContent = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        const titleText = document.title.toLowerCase();
        return {
          title: document.title,
          has404:
            bodyText.includes('404') ||
            bodyText.includes('page not found') ||
            titleText.includes('404') ||
            titleText.includes('not found'),
          hasError: bodyText.includes('error') && bodyText.includes('failed'),
          linkCount: document.querySelectorAll('a[href]').length,
        };
      });

      if (pageContent.has404) {
        this.results.pageErrors.push({
          page: path,
          error: '404 - Page not found',
        });
        console.log('  ❌ 404 - Page not found');
        await page.close();
        return;
      }

      console.log(`  ✅ Page loaded successfully`);
      console.log(`     Title: ${pageContent.title}`);
      console.log(`     Links found: ${pageContent.linkCount}`);
      this.results.successfulPages++;

      // Get all internal links
      const links = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href]').forEach((link) => {
          const href = link.getAttribute('href');
          const text = link.innerText.trim();
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            links.push({
              href,
              text,
              isExternal: href.startsWith('http') && !href.includes('williamzujkowski.github.io'),
            });
          }
        });
        return links;
      });

      // Sample check of internal links (checking all would take too long)
      const internalLinks = links.filter(
        (l) => !l.isExternal && l.href.startsWith('/puppeteer-mcp/'),
      );
      const linksToCheck = internalLinks.slice(0, 3);

      for (const link of linksToCheck) {
        console.log(`     Checking link: ${link.href}`);
        const linkPage = await this.browser.newPage();
        try {
          const linkUrl = `https://williamzujkowski.github.io${link.href}`;
          const linkResponse = await linkPage.goto(linkUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          });

          if (!linkResponse || !linkResponse.ok()) {
            this.results.brokenLinks.push({
              fromPage: path,
              link: link.href,
              text: link.text,
              reason: `HTTP ${linkResponse?.status() || 'unknown'}`,
            });
            console.log(`       ❌ Broken: HTTP ${linkResponse?.status() || 'unknown'}`);
          } else {
            console.log(`       ✅ OK`);
          }
        } catch (error) {
          this.results.brokenLinks.push({
            fromPage: path,
            link: link.href,
            text: link.text,
            reason: error.message,
          });
          console.log(`       ❌ Error: ${error.message}`);
        } finally {
          await linkPage.close();
        }
      }
    } catch (error) {
      this.results.pageErrors.push({
        page: path,
        error: error.message,
      });
      console.log(`  ❌ Failed to verify: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
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
      this.results.pageErrors.forEach((error) => {
        console.log(`  - ${error.page}: ${error.error}`);
      });
    }

    if (this.results.brokenLinks.length > 0) {
      console.log(`\n🔗 Broken Links:`);
      this.results.brokenLinks.forEach((broken) => {
        console.log(`  - From: ${broken.fromPage}`);
        console.log(`    Link: ${broken.link} ("${broken.text}")`);
        console.log(`    Reason: ${broken.reason}`);
      });
    }

    const successRate = ((this.results.successfulPages / this.results.totalPages) * 100).toFixed(1);
    console.log(`\n✨ Success Rate: ${successRate}%`);

    if (this.results.pageErrors.length === 0 && this.results.brokenLinks.length === 0) {
      console.log('\n🎉 All documentation pages and sampled links are working correctly!');
    }
  }

  async run() {
    console.log('🚀 Starting Documentation Verification with Puppeteer...');
    console.log(`📍 Target: ${BASE_URL}`);

    try {
      await this.init();

      // Check main pages
      for (const page of PAGES_TO_CHECK) {
        await this.verifyPage(page);
      }

      this.printReport();
    } catch (error) {
      console.error('\n❌ Verification failed:', error.message);
    } finally {
      await this.close();
    }
  }
}

// Main execution
(async () => {
  const verifier = new DocsVerifier();
  await verifier.run();
})();
