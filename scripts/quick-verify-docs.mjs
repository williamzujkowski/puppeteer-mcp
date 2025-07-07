#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://williamzujkowski.github.io/puppeteer-mcp';

// All pages that should exist
const ALL_PAGES = [
  // Main
  '/',
  // Quickstart
  '/quickstart/',
  '/quickstart/installation',
  '/quickstart/first-steps', 
  '/quickstart/claude-desktop',
  '/quickstart/configuration',
  // Guides
  '/guides/',
  '/guides/browser-automation',
  '/guides/api-integration',
  '/guides/mcp-usage-examples',
  '/guides/advanced-scenarios',
  // Reference
  '/reference/',
  '/reference/rest-api',
  '/reference/grpc-api',
  '/reference/websocket-api',
  '/reference/mcp-tools',
  '/reference/puppeteer-actions',
  '/reference/api-quick-reference',
  // Architecture
  '/architecture/',
  '/architecture/overview',
  '/architecture/session-management',
  '/architecture/security',
  '/architecture/mcp-integration-plan',
  // Deployment
  '/deployment/',
  '/deployment/npm-package',
  '/deployment/docker',
  '/deployment/production',
  '/deployment/scaling',
  // Development
  '/development/',
  '/development/workflow',
  '/development/standards',
  '/development/testing',
  // Contributing
  '/contributing/',
  '/contributing/code-of-conduct',
  // Project
  '/project/roadmap',
  // Quick Reference
  '/quick-reference/',
  '/quick-reference/api-cheatsheet',
  '/quick-reference/common-patterns',
  '/quick-reference/env-vars',
  '/quick-reference/error-codes',
  '/quick-reference/mcp-tools-summary',
  // Other
  '/troubleshooting',
  '/ai/routing-patterns',
  '/lessons/implementation',
  '/lessons/project-planning'
];

async function verifyDocs() {
  console.log('🚀 Quick Documentation Check...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    success: [],
    notFound: [],
    error: []
  };

  for (const path of ALL_PAGES) {
    const url = `${BASE_URL}${path}`;
    const page = await browser.newPage();
    
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      const title = await page.title();
      
      if (!response || !response.ok() || title.toLowerCase().includes('404') || title.toLowerCase().includes('not found')) {
        results.notFound.push(path);
        console.log(`❌ ${path} - 404 Not Found`);
      } else {
        results.success.push(path);
        console.log(`✅ ${path} - ${title}`);
      }
    } catch (error) {
      results.error.push({ path, error: error.message });
      console.log(`❌ ${path} - Error: ${error.message}`);
    }
    
    await page.close();
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${results.success.length}/${ALL_PAGES.length}`);
  console.log(`❌ Not Found: ${results.notFound.length}`);
  console.log(`⚠️  Errors: ${results.error.length}`);
  
  if (results.notFound.length > 0) {
    console.log('\n404 Pages:');
    results.notFound.forEach(p => console.log(`  - ${p}`));
  }
  
  if (results.error.length > 0) {
    console.log('\nErrors:');
    results.error.forEach(e => console.log(`  - ${e.path}: ${e.error}`));
  }
}

verifyDocs().catch(console.error);