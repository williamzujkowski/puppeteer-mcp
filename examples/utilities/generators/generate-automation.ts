#!/usr/bin/env node

/**
 * Automation Code Generator
 * 
 * Generates boilerplate code for new automations
 * Usage: npm run generate:automation -- --name MyAutomation --type scraper
 */

import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';

interface GeneratorOptions {
  name: string;
  type: 'scraper' | 'form' | 'monitor' | 'test';
  output?: string;
  typescript?: boolean;
}

const templates = {
  scraper: `/**
 * {{name}} - Web Scraper Automation
 * Generated on {{date}}
 */

import { BaseAutomation } from '../base';
import { AutomationResult, ScraperParams } from '../../types';
import { logger } from '../../utils/logger';

export interface {{name}}Params extends ScraperParams {
  // Add your custom parameters here
}

export class {{name}} extends BaseAutomation {
  async run(params: {{name}}Params): Promise<AutomationResult> {
    const { url, selectors = {} } = params;
    logger.info('Starting {{name}}', { url });
    
    const session = await this.createSession();
    
    try {
      // Navigate to the target URL
      await this.navigate(session.id, url);
      
      // Wait for content to load
      await this.waitForSelector(session.id, selectors.container || 'body');
      
      // Extract data
      const data = await this.evaluate(session.id, \`
        // Your extraction logic here
        const items = Array.from(document.querySelectorAll('\${selectors.item || ".item"}'));
        return items.map(item => ({
          title: item.querySelector('\${selectors.title || ".title"}')?.textContent?.trim(),
          description: item.querySelector('\${selectors.description || ".description"}')?.textContent?.trim(),
          // Add more fields as needed
        }));
      \`);
      
      logger.info('Data extracted', { count: data.length });
      
      return {
        success: true,
        data: {
          items: data,
          extractedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('{{name}} failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await this.cleanup(session.id);
    }
  }
}`,

  form: `/**
 * {{name}} - Form Automation
 * Generated on {{date}}
 */

import { BaseAutomation } from '../base';
import { AutomationResult, FormParams } from '../../types';
import { logger } from '../../utils/logger';

export interface {{name}}Params extends FormParams {
  formData: Record<string, any>;
  // Add your custom parameters here
}

export class {{name}} extends BaseAutomation {
  async run(params: {{name}}Params): Promise<AutomationResult> {
    const { url, formData, submitButton = 'button[type="submit"]' } = params;
    logger.info('Starting {{name}}', { url });
    
    const session = await this.createSession();
    
    try {
      // Navigate to the form page
      await this.navigate(session.id, url);
      
      // Wait for form to load
      await this.waitForSelector(session.id, 'form');
      
      // Fill form fields
      for (const [field, value] of Object.entries(formData)) {
        const selector = \`[name="\${field}"], #\${field}\`;
        
        if (typeof value === 'boolean') {
          // Handle checkboxes
          await this.setCheckbox(session.id, selector, value);
        } else if (Array.isArray(value)) {
          // Handle multi-select
          await this.selectMultiple(session.id, selector, value);
        } else {
          // Handle text inputs and selects
          await this.type(session.id, selector, String(value));
        }
        
        logger.debug('Field filled', { field, value });
      }
      
      // Take screenshot before submission
      const screenshotBefore = await this.screenshot(session.id, { fullPage: true });
      
      // Submit the form
      await this.click(session.id, submitButton);
      
      // Wait for response
      await this.waitForNavigation(session.id);
      
      // Check for success/error messages
      const result = await this.evaluate(session.id, \`
        const success = document.querySelector('.success-message, .alert-success');
        const error = document.querySelector('.error-message, .alert-danger');
        
        return {
          success: !!success,
          message: (success || error)?.textContent?.trim() || 'Form submitted'
        };
      \`);
      
      logger.info('Form submission completed', result);
      
      return {
        success: result.success,
        data: {
          ...result,
          screenshotBefore
        }
      };
      
    } catch (error) {
      logger.error('{{name}} failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await this.cleanup(session.id);
    }
  }
}`,

  monitor: `/**
 * {{name}} - Monitoring Automation
 * Generated on {{date}}
 */

import { BaseAutomation } from '../base';
import { AutomationResult, MonitorParams } from '../../types';
import { logger } from '../../utils/logger';

export interface {{name}}Params extends MonitorParams {
  interval?: number;
  duration?: number;
  // Add your custom parameters here
}

export interface {{name}}Metrics {
  timestamp: string;
  // Define your metrics here
  responseTime?: number;
  elementCount?: number;
  customMetric?: any;
}

export class {{name}} extends BaseAutomation {
  private metrics: {{name}}Metrics[] = [];
  
  async run(params: {{name}}Params): Promise<AutomationResult> {
    const { 
      url, 
      interval = 5000, 
      duration = 60000,
      checks = {}
    } = params;
    
    logger.info('Starting {{name}}', { url, interval, duration });
    
    const session = await this.createSession();
    const startTime = Date.now();
    
    try {
      // Navigate to the target URL
      await this.navigate(session.id, url);
      
      // Monitor loop
      while (Date.now() - startTime < duration) {
        const checkStart = Date.now();
        
        // Collect metrics
        const metric = await this.collectMetrics(session.id);
        this.metrics.push(metric);
        
        // Run health checks
        const healthStatus = await this.runHealthChecks(session.id, checks);
        
        logger.info('Metric collected', { metric, healthStatus });
        
        // Alert on issues
        if (!healthStatus.healthy) {
          await this.sendAlert(healthStatus);
        }
        
        // Wait for next interval
        const elapsed = Date.now() - checkStart;
        const waitTime = Math.max(0, interval - elapsed);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Generate report
      const report = this.generateReport();
      
      return {
        success: true,
        data: {
          metrics: this.metrics,
          report,
          monitoringDuration: Date.now() - startTime
        }
      };
      
    } catch (error) {
      logger.error('{{name}} failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await this.cleanup(session.id);
    }
  }
  
  private async collectMetrics(sessionId: string): Promise<{{name}}Metrics> {
    const metrics = await this.evaluate(sessionId, \`
      ({
        responseTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        elementCount: document.querySelectorAll('*').length,
        // Add your custom metrics here
      })
    \`);
    
    return {
      timestamp: new Date().toISOString(),
      ...metrics
    };
  }
  
  private async runHealthChecks(sessionId: string, checks: any): Promise<any> {
    // Implement your health checks
    return {
      healthy: true,
      checks: []
    };
  }
  
  private async sendAlert(status: any): Promise<void> {
    // Implement alerting logic
    logger.warn('Health check failed', status);
  }
  
  private generateReport(): any {
    // Generate summary report from metrics
    return {
      totalChecks: this.metrics.length,
      averageResponseTime: this.metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / this.metrics.length,
      // Add more report data
    };
  }
}`,

  test: `/**
 * {{name}} - Test Automation
 * Generated on {{date}}
 */

import { BaseAutomation } from '../base';
import { AutomationResult, TestParams } from '../../types';
import { logger } from '../../utils/logger';

export interface {{name}}Params extends TestParams {
  testCases: TestCase[];
  // Add your custom parameters here
}

export interface TestCase {
  name: string;
  url: string;
  actions: TestAction[];
  assertions: TestAssertion[];
}

export interface TestAction {
  type: 'click' | 'type' | 'select' | 'navigate';
  selector?: string;
  value?: any;
}

export interface TestAssertion {
  type: 'exists' | 'text' | 'value' | 'visible';
  selector: string;
  expected?: any;
}

export interface TestResult {
  testCase: string;
  passed: boolean;
  duration: number;
  failures: string[];
  screenshot?: string;
}

export class {{name}} extends BaseAutomation {
  async run(params: {{name}}Params): Promise<AutomationResult> {
    const { testCases } = params;
    logger.info('Starting {{name}}', { testCount: testCases.length });
    
    const results: TestResult[] = [];
    const session = await this.createSession();
    
    try {
      for (const testCase of testCases) {
        const result = await this.runTestCase(session.id, testCase);
        results.push(result);
        
        logger.info('Test case completed', {
          name: testCase.name,
          passed: result.passed
        });
      }
      
      // Generate test report
      const report = this.generateTestReport(results);
      
      return {
        success: report.allPassed,
        data: {
          results,
          report,
          executedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('{{name}} failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await this.cleanup(session.id);
    }
  }
  
  private async runTestCase(sessionId: string, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const failures: string[] = [];
    
    try {
      // Navigate to test URL
      await this.navigate(sessionId, testCase.url);
      
      // Execute actions
      for (const action of testCase.actions) {
        await this.executeAction(sessionId, action);
      }
      
      // Run assertions
      for (const assertion of testCase.assertions) {
        const passed = await this.runAssertion(sessionId, assertion);
        if (!passed) {
          failures.push(\`Assertion failed: \${assertion.type} on \${assertion.selector}\`);
        }
      }
      
      // Take screenshot
      const screenshot = await this.screenshot(sessionId, { fullPage: true });
      
      return {
        testCase: testCase.name,
        passed: failures.length === 0,
        duration: Date.now() - startTime,
        failures,
        screenshot
      };
      
    } catch (error) {
      return {
        testCase: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  private async executeAction(sessionId: string, action: TestAction): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.click(sessionId, action.selector!);
        break;
      case 'type':
        await this.type(sessionId, action.selector!, action.value);
        break;
      case 'select':
        await this.select(sessionId, action.selector!, action.value);
        break;
      case 'navigate':
        await this.navigate(sessionId, action.value);
        break;
    }
  }
  
  private async runAssertion(sessionId: string, assertion: TestAssertion): Promise<boolean> {
    try {
      switch (assertion.type) {
        case 'exists':
          return await this.exists(sessionId, assertion.selector);
        case 'visible':
          return await this.isVisible(sessionId, assertion.selector);
        case 'text':
          const text = await this.getText(sessionId, assertion.selector);
          return text === assertion.expected;
        case 'value':
          const value = await this.getValue(sessionId, assertion.selector);
          return value === assertion.expected;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }
  
  private generateTestReport(results: TestResult[]): any {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    
    return {
      totalTests: results.length,
      passed,
      failed,
      allPassed: failed === 0,
      successRate: (passed / results.length) * 100,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }
}`
};

async function generateAutomation(options: GeneratorOptions) {
  const { name, type, output = './src/automations', typescript = true } = options;
  
  // Validate name
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    throw new Error('Name must be in PascalCase (e.g., MyAutomation)');
  }
  
  // Get template
  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown automation type: ${type}`);
  }
  
  // Replace placeholders
  const code = template
    .replace(/{{name}}/g, name)
    .replace(/{{date}}/g, new Date().toISOString().split('T')[0]);
  
  // Create output directory
  await fs.mkdir(output, { recursive: true });
  
  // Generate filename
  const filename = name
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .slice(1) + (typescript ? '.ts' : '.js');
  
  const filepath = path.join(output, filename);
  
  // Check if file exists
  try {
    await fs.access(filepath);
    throw new Error(`File already exists: ${filepath}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }
  
  // Write file
  await fs.writeFile(filepath, code);
  
  console.log(`✅ Generated ${type} automation: ${filepath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Edit ${filepath} to customize your automation`);
  console.log(`2. Import and use it in your main application`);
  console.log(`3. Run tests to ensure it works correctly`);
}

// CLI setup
program
  .name('generate-automation')
  .description('Generate boilerplate code for Puppeteer MCP automations')
  .requiredOption('-n, --name <name>', 'Automation class name (PascalCase)')
  .requiredOption('-t, --type <type>', 'Automation type (scraper|form|monitor|test)')
  .option('-o, --output <path>', 'Output directory', './src/automations')
  .option('--js', 'Generate JavaScript instead of TypeScript')
  .action(async (options) => {
    try {
      await generateAutomation({
        name: options.name,
        type: options.type,
        output: options.output,
        typescript: !options.js
      });
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

export { generateAutomation };