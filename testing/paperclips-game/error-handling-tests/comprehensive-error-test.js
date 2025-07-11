#!/usr/bin/env node

/**
 * Comprehensive Error Handling Test
 * Tests various error scenarios directly using Puppeteer
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_DIR = path.join(__dirname, 'results');

// Test URLs
const TEST_URLS = {
  valid: [
    'https://williamzujkowski.github.io/paperclips/index2.html',
    'https://williamzujkowski.github.io/',
  ],
  invalid: [
    'htp://invalid-protocol',
    'https://this-domain-definitely-does-not-exist-12345.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'about:blank',
  ],
  timeout: ['https://httpstat.us/200?sleep=60000'],
};

// Test scenarios
const ERROR_TESTS = {
  navigation: {
    name: 'Navigation Errors',
    tests: [
      {
        name: 'Invalid Protocol',
        url: 'htp://invalid-protocol',
        expectedError: /Protocol error|ERR_UNKNOWN_URL_SCHEME/,
      },
      {
        name: 'Non-existent Domain',
        url: 'https://this-domain-definitely-does-not-exist-' + Date.now() + '.com',
        expectedError: /ERR_NAME_NOT_RESOLVED|net::ERR_NAME_NOT_RESOLVED|getaddrinfo/,
      },
      {
        name: 'Security Protocol',
        url: 'javascript:alert(1)',
        expectedError: /Protocol error|ERR_ABORTED|ERR_UNKNOWN_URL_SCHEME/,
      },
      {
        name: 'File Protocol',
        url: 'file:///etc/passwd',
        expectedError: /Protocol error|ERR_ABORTED|ERR_ACCESS_DENIED|ERR_UNKNOWN_URL_SCHEME/,
      },
      {
        name: 'About Blank',
        url: 'about:blank',
        expectedError: null, // This should succeed
      },
    ],
  },
  timeout: {
    name: 'Timeout Handling',
    tests: [
      {
        name: 'Navigation Timeout',
        url: 'https://httpstat.us/200?sleep=60000',
        timeout: 5000,
        expectedError: /TimeoutError|Navigation timeout|Timeout/,
      },
    ],
  },
  javascript: {
    name: 'JavaScript Errors',
    tests: [
      {
        name: 'Syntax Error',
        script: 'const x = {;',
        expectedError: /SyntaxError|Unexpected token/,
      },
      {
        name: 'Reference Error',
        script: 'nonExistentVariable.doSomething()',
        expectedError: /ReferenceError|is not defined/,
      },
      {
        name: 'Type Error',
        script: 'null.toString()',
        expectedError: /TypeError|Cannot read/,
      },
    ],
  },
  selectors: {
    name: 'Selector Errors',
    tests: [
      {
        name: 'Invalid CSS Selector',
        selector: 'div[class="test"',
        expectedError: /Failed to execute.*querySelector|Invalid selector/,
      },
      {
        name: 'Non-existent Element',
        selector: '#this-element-definitely-does-not-exist-12345',
        timeout: 1000,
        expectedError: /Waiting.*failed|timeout/,
      },
    ],
  },
};

class ErrorHandlingTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
      },
      categories: {},
      tests: [],
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[34m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    };

    const color = colors[type] || colors.info;
    console.log(`${color}${message}${colors.reset}`);
  }

  async ensureResultsDirectory() {
    try {
      await fs.mkdir(RESULTS_DIR, { recursive: true });
    } catch (error) {
      this.log(`Failed to create results directory: ${error.message}`, 'error');
    }
  }

  async testNavigationError(browser, test) {
    const result = {
      category: 'navigation',
      name: test.name,
      url: test.url,
      passed: false,
      error: null,
      duration: 0,
    };

    const startTime = Date.now();
    const page = await browser.newPage();

    try {
      await page.goto(test.url, {
        waitUntil: 'networkidle2',
        timeout: test.timeout || 30000,
      });

      // If we expected an error but didn't get one
      if (test.expectedError) {
        result.error = 'Expected error but navigation succeeded';
      } else {
        result.passed = true;
      }
    } catch (error) {
      result.error = error.message;

      if (test.expectedError) {
        if (test.expectedError.test(error.message)) {
          result.passed = true;
          result.expectedErrorCaught = true;
        } else {
          result.error = `Unexpected error: ${error.message}. Expected: ${test.expectedError}`;
        }
      }
    } finally {
      result.duration = Date.now() - startTime;
      await page.close();
    }

    return result;
  }

  async testTimeoutError(browser, test) {
    const result = {
      category: 'timeout',
      name: test.name,
      url: test.url,
      timeout: test.timeout,
      passed: false,
      error: null,
      duration: 0,
    };

    const startTime = Date.now();
    const page = await browser.newPage();

    try {
      await page.goto(test.url, {
        waitUntil: 'networkidle2',
        timeout: test.timeout,
      });

      result.error = 'Expected timeout but navigation succeeded';
    } catch (error) {
      result.error = error.message;

      if (test.expectedError && test.expectedError.test(error.message)) {
        result.passed = true;
        result.expectedErrorCaught = true;
      }
    } finally {
      result.duration = Date.now() - startTime;
      await page.close();
    }

    return result;
  }

  async testJavaScriptError(browser, test) {
    const result = {
      category: 'javascript',
      name: test.name,
      script: test.script,
      passed: false,
      error: null,
      duration: 0,
    };

    const startTime = Date.now();
    const page = await browser.newPage();

    try {
      // Navigate to a valid page first
      await page.goto('https://williamzujkowski.github.io/', { waitUntil: 'domcontentloaded' });

      // Try to evaluate the script
      await page.evaluate(test.script);

      result.error = 'Expected error but script executed successfully';
    } catch (error) {
      result.error = error.message;

      if (test.expectedError && test.expectedError.test(error.message)) {
        result.passed = true;
        result.expectedErrorCaught = true;
      }
    } finally {
      result.duration = Date.now() - startTime;
      await page.close();
    }

    return result;
  }

  async testSelectorError(browser, test) {
    const result = {
      category: 'selectors',
      name: test.name,
      selector: test.selector,
      passed: false,
      error: null,
      duration: 0,
    };

    const startTime = Date.now();
    const page = await browser.newPage();

    try {
      // Navigate to a valid page first
      await page.goto('https://williamzujkowski.github.io/', { waitUntil: 'domcontentloaded' });

      if (test.timeout) {
        // Test waiting for element with timeout
        await page.waitForSelector(test.selector, { timeout: test.timeout });
      } else {
        // Test immediate selector query
        await page.$(test.selector);
      }

      // If we expected an error but didn't get one
      if (test.expectedError) {
        result.error = 'Expected error but selector operation succeeded';
      } else {
        result.passed = true;
      }
    } catch (error) {
      result.error = error.message;

      if (test.expectedError && test.expectedError.test(error.message)) {
        result.passed = true;
        result.expectedErrorCaught = true;
      }
    } finally {
      result.duration = Date.now() - startTime;
      await page.close();
    }

    return result;
  }

  async runTests() {
    this.log('🚀 Starting Comprehensive Error Handling Tests', 'info');
    this.log('='.repeat(60), 'info');

    await this.ensureResultsDirectory();

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      // Test each category
      for (const [categoryKey, category] of Object.entries(ERROR_TESTS)) {
        this.log(`\n📋 Testing ${category.name}`, 'info');
        this.log('-'.repeat(40), 'info');

        this.results.categories[categoryKey] = {
          name: category.name,
          total: category.tests.length,
          passed: 0,
          failed: 0,
          tests: [],
        };

        for (const test of category.tests) {
          process.stdout.write(`Testing ${test.name}...`);

          let result;
          switch (categoryKey) {
            case 'navigation':
              result = await this.testNavigationError(browser, test);
              break;
            case 'timeout':
              result = await this.testTimeoutError(browser, test);
              break;
            case 'javascript':
              result = await this.testJavaScriptError(browser, test);
              break;
            case 'selectors':
              result = await this.testSelectorError(browser, test);
              break;
          }

          this.results.tests.push(result);
          this.results.summary.total++;

          if (result.passed) {
            this.results.summary.passed++;
            this.results.categories[categoryKey].passed++;
            console.log(` ✅ PASSED${result.expectedErrorCaught ? ' (error caught)' : ''}`);
            if (result.expectedErrorCaught) {
              console.log(`   └─ Error: ${result.error}`);
            }
          } else {
            this.results.summary.failed++;
            this.results.categories[categoryKey].failed++;
            console.log(` ❌ FAILED`);
            console.log(`   └─ Error: ${result.error}`);
          }

          this.results.categories[categoryKey].tests.push(result);
        }
      }

      // Generate reports
      await this.generateReports();

      this.log('\n📊 Test Summary', 'info');
      this.log('='.repeat(60), 'info');
      this.log(`Total Tests: ${this.results.summary.total}`, 'info');
      this.log(
        `Passed: ${this.results.summary.passed} (${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%)`,
        'success',
      );
      this.log(
        `Failed: ${this.results.summary.failed}`,
        this.results.summary.failed > 0 ? 'error' : 'info',
      );
    } catch (error) {
      this.log(`Test suite error: ${error.message}`, 'error');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async generateReports() {
    const timestamp = Date.now();

    // JSON report
    const jsonPath = path.join(RESULTS_DIR, `error-handling-report-${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));

    // Markdown report
    const mdPath = path.join(RESULTS_DIR, 'ERROR_HANDLING_COMPREHENSIVE_REPORT.md');
    const mdContent = this.generateMarkdownReport();
    await fs.writeFile(mdPath, mdContent);

    this.log(`\n📄 Reports saved to:`, 'info');
    this.log(`   - JSON: ${jsonPath}`, 'info');
    this.log(`   - Markdown: ${mdPath}`, 'info');
  }

  generateMarkdownReport() {
    const { timestamp, summary, categories, tests } = this.results;

    let md = `# Comprehensive Error Handling Test Report

Generated: ${timestamp}

## Summary

- **Total Tests**: ${summary.total}
- **Passed**: ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)
- **Failed**: ${summary.failed}

## Test Categories

`;

    for (const [key, category] of Object.entries(categories)) {
      md += `### ${category.name}

- Tests: ${category.total}
- Passed: ${category.passed}
- Failed: ${category.failed}

| Test | Result | Duration | Error |
|------|--------|----------|-------|
`;

      for (const test of category.tests) {
        const status = test.passed ? '✅' : '❌';
        const error = test.error ? test.error.substring(0, 50) + '...' : '-';
        md += `| ${test.name} | ${status} | ${test.duration}ms | ${error} |\n`;
      }

      md += '\n';
    }

    md += `## Key Findings

1. **Navigation Error Handling**: ${categories.navigation.passed}/${categories.navigation.total} tests passed
2. **Timeout Handling**: ${categories.timeout.passed}/${categories.timeout.total} tests passed
3. **JavaScript Error Handling**: ${categories.javascript.passed}/${categories.javascript.total} tests passed
4. **Selector Error Handling**: ${categories.selectors.passed}/${categories.selectors.total} tests passed

## Recommendations

`;

    if (summary.failed === 0) {
      md +=
        '✅ All error handling tests passed! The platform demonstrates robust error handling.\n';
    } else {
      md += '⚠️ Some error handling tests failed. Review the following:\n\n';

      for (const test of tests) {
        if (!test.passed && !test.expectedErrorCaught) {
          md += `- **${test.name}**: ${test.error}\n`;
        }
      }
    }

    return md;
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ErrorHandlingTester();
  tester.runTests().catch(console.error);
}

export default ErrorHandlingTester;
