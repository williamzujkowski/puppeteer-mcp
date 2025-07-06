#!/usr/bin/env node
/**
 * Master Test Runner for Error Handling Tests
 * Runs all error handling test suites and generates comprehensive report
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suites to run
const TEST_SUITES = [
  {
    name: 'Invalid URLs',
    file: 'test-invalid-urls.js',
    description: 'Tests handling of malformed URLs, non-existent domains, and protocol errors'
  },
  {
    name: 'Timeout Scenarios',
    file: 'test-timeout-scenarios.js',
    description: 'Tests navigation, element wait, and script execution timeouts'
  },
  {
    name: 'Network Errors',
    file: 'test-network-errors.js',
    description: 'Tests offline scenarios, DNS failures, and connection refused errors'
  },
  {
    name: 'JavaScript Errors',
    file: 'test-javascript-errors.js',
    description: 'Tests handling of JavaScript errors, console errors, and unhandled rejections'
  },
  {
    name: 'Invalid Selectors',
    file: 'test-invalid-selectors.js',
    description: 'Tests invalid CSS/XPath selectors and element not found scenarios'
  },
  {
    name: 'Concurrent Operations',
    file: 'test-concurrent-operations.js',
    description: 'Tests concurrent operation conflicts and race conditions'
  }
];

// Helper to run a test suite
async function runTestSuite(suite) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Running: ${suite.name}`);
  console.log(`Description: ${suite.description}`);
  console.log('='.repeat(70));
  
  const startTime = Date.now();
  const result = {
    suite: suite.name,
    file: suite.file,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: 0,
    exitCode: null,
    output: [],
    error: null,
    summary: null
  };

  return new Promise((resolve) => {
    const testPath = path.join(__dirname, suite.file);
    const child = spawn('node', [testPath], {
      env: { ...process.env, NODE_ENV: 'test' }
    });

    child.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      result.output.push({ type: 'stdout', data: output });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);
      result.output.push({ type: 'stderr', data: output });
    });

    child.on('close', (code) => {
      result.exitCode = code;
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - startTime;
      
      // Extract summary from output
      const outputText = result.output.map(o => o.data).join('');
      const summaryMatch = outputText.match(/Total Tests: (\d+)\s+Passed: (\d+).*Failed: (\d+)/);
      if (summaryMatch) {
        result.summary = {
          total: parseInt(summaryMatch[1]),
          passed: parseInt(summaryMatch[2]),
          failed: parseInt(summaryMatch[3])
        };
      }
      
      resolve(result);
    });

    child.on('error', (error) => {
      result.error = error.message;
      resolve(result);
    });
  });
}

// Generate comprehensive report
function generateReport(results) {
  const report = {
    title: 'Puppeteer-MCP Error Handling Test Report',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    summary: {
      totalSuites: results.length,
      passedSuites: results.filter(r => r.exitCode === 0).length,
      failedSuites: results.filter(r => r.exitCode !== 0).length,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    },
    suites: results,
    vulnerabilities: [],
    recommendations: []
  };

  // Aggregate test counts
  results.forEach(result => {
    if (result.summary) {
      report.summary.totalTests += result.summary.total;
      report.summary.totalPassed += result.summary.passed;
      report.summary.totalFailed += result.summary.failed;
    }
  });

  // Analyze for vulnerabilities
  results.forEach(result => {
    const output = result.output.map(o => o.data).join('');
    
    // Check for unhandled errors
    if (output.includes('UNEXPECTED_SUCCESS')) {
      report.vulnerabilities.push({
        suite: result.suite,
        type: 'Unhandled Invalid Input',
        severity: 'High',
        description: 'Invalid input was accepted when it should have been rejected'
      });
    }
    
    // Check for timeout issues
    if (output.includes('timeout') && output.includes('FAILED')) {
      report.vulnerabilities.push({
        suite: result.suite,
        type: 'Timeout Handling',
        severity: 'Medium',
        description: 'Timeout errors not properly handled'
      });
    }
    
    // Check for resource leaks
    if (output.includes('resource') && output.includes('cleanup') && output.includes('failed')) {
      report.vulnerabilities.push({
        suite: result.suite,
        type: 'Resource Leak',
        severity: 'High',
        description: 'Resources not properly cleaned up after errors'
      });
    }
  });

  // Generate recommendations
  if (report.summary.totalFailed > 0) {
    report.recommendations.push({
      priority: 'High',
      category: 'Error Handling',
      recommendation: `Fix ${report.summary.totalFailed} failing error handling tests before production deployment`
    });
  }

  if (report.vulnerabilities.length > 0) {
    report.recommendations.push({
      priority: 'Critical',
      category: 'Security',
      recommendation: `Address ${report.vulnerabilities.length} identified vulnerabilities immediately`
    });
  }

  const passRate = (report.summary.totalPassed / report.summary.totalTests * 100).toFixed(1);
  if (passRate < 95) {
    report.recommendations.push({
      priority: 'High',
      category: 'Stability',
      recommendation: `Improve error handling coverage - current pass rate is ${passRate}%`
    });
  }

  // Add specific recommendations based on patterns
  const highSeverityVulns = report.vulnerabilities.filter(v => v.severity === 'High');
  if (highSeverityVulns.length > 0) {
    report.recommendations.push({
      priority: 'Critical',
      category: 'Input Validation',
      recommendation: 'Implement stricter input validation for URLs, selectors, and user-provided data'
    });
  }

  return report;
}

// Generate markdown report
function generateMarkdownReport(report) {
  let md = `# Puppeteer-MCP Error Handling Test Report

Generated: ${new Date(report.timestamp).toLocaleString()}

## Executive Summary

- **Total Test Suites**: ${report.summary.totalSuites}
- **Passed Suites**: ${report.summary.passedSuites}
- **Failed Suites**: ${report.summary.failedSuites}
- **Total Tests**: ${report.summary.totalTests}
- **Tests Passed**: ${report.summary.totalPassed} (${(report.summary.totalPassed/report.summary.totalTests*100).toFixed(1)}%)
- **Tests Failed**: ${report.summary.totalFailed}
- **Total Duration**: ${(report.summary.totalDuration/1000).toFixed(1)}s

## Test Suite Results

| Suite | Tests | Passed | Failed | Duration | Status |
|-------|-------|--------|--------|----------|---------|
`;

  report.suites.forEach(suite => {
    const status = suite.exitCode === 0 ? '✅ PASS' : '❌ FAIL';
    const tests = suite.summary?.total || 'N/A';
    const passed = suite.summary?.passed || 'N/A';
    const failed = suite.summary?.failed || 'N/A';
    const duration = (suite.duration/1000).toFixed(1) + 's';
    
    md += `| ${suite.suite} | ${tests} | ${passed} | ${failed} | ${duration} | ${status} |\n`;
  });

  if (report.vulnerabilities.length > 0) {
    md += `\n## 🚨 Vulnerabilities Detected\n\n`;
    md += `Found ${report.vulnerabilities.length} potential vulnerabilities:\n\n`;
    
    report.vulnerabilities.forEach((vuln, i) => {
      md += `### ${i + 1}. ${vuln.type} (${vuln.severity})\n`;
      md += `- **Suite**: ${vuln.suite}\n`;
      md += `- **Description**: ${vuln.description}\n\n`;
    });
  }

  if (report.recommendations.length > 0) {
    md += `\n## 📋 Recommendations\n\n`;
    
    const criticalRecs = report.recommendations.filter(r => r.priority === 'Critical');
    const highRecs = report.recommendations.filter(r => r.priority === 'High');
    const mediumRecs = report.recommendations.filter(r => r.priority === 'Medium');
    
    if (criticalRecs.length > 0) {
      md += `### 🔴 Critical Priority\n\n`;
      criticalRecs.forEach(rec => {
        md += `- **${rec.category}**: ${rec.recommendation}\n`;
      });
    }
    
    if (highRecs.length > 0) {
      md += `\n### 🟡 High Priority\n\n`;
      highRecs.forEach(rec => {
        md += `- **${rec.category}**: ${rec.recommendation}\n`;
      });
    }
    
    if (mediumRecs.length > 0) {
      md += `\n### 🟢 Medium Priority\n\n`;
      mediumRecs.forEach(rec => {
        md += `- **${rec.category}**: ${rec.recommendation}\n`;
      });
    }
  }

  md += `\n## Error Categories Tested\n\n`;
  md += `1. **Invalid URLs**: Malformed URLs, non-existent domains, protocol errors\n`;
  md += `2. **Timeouts**: Navigation, element wait, script execution timeouts\n`;
  md += `3. **Network Errors**: DNS failures, connection refused, certificate errors\n`;
  md += `4. **JavaScript Errors**: Syntax errors, runtime errors, unhandled rejections\n`;
  md += `5. **Selector Errors**: Invalid CSS/XPath, element not found\n`;
  md += `6. **Concurrent Operations**: Race conditions, resource contention\n`;

  md += `\n## Environment\n\n`;
  md += `- **Node Version**: ${report.environment.node}\n`;
  md += `- **Platform**: ${report.environment.platform}\n`;
  md += `- **Architecture**: ${report.environment.arch}\n`;

  return md;
}

// Main execution
async function main() {
  console.log('🚀 Starting Comprehensive Error Handling Tests\n');
  console.log('This will test various error scenarios to ensure production stability.\n');
  
  const allResults = [];
  
  // Check if server is running
  try {
    const healthCheck = await fetch('http://localhost:3000/health');
    if (!healthCheck.ok) {
      throw new Error('Server health check failed');
    }
  } catch (error) {
    console.error('❌ Error: Puppeteer-MCP server is not running on http://localhost:3000');
    console.error('Please start the server first with: npm run dev');
    process.exit(1);
  }

  // Run all test suites
  for (const suite of TEST_SUITES) {
    const result = await runTestSuite(suite);
    allResults.push(result);
    
    // Brief pause between suites
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate report
  console.log('\n\n📊 Generating Comprehensive Report...\n');
  const report = generateReport(allResults);
  
  // Save JSON report
  const jsonPath = path.join(__dirname, 'results', `comprehensive-error-report-${Date.now()}.json`);
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  
  // Save Markdown report
  const markdownReport = generateMarkdownReport(report);
  const mdPath = path.join(__dirname, 'ERROR_HANDLING_REPORT.md');
  await fs.writeFile(mdPath, markdownReport);
  
  // Print summary
  console.log('='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Test Suites: ${report.summary.totalSuites}`);
  console.log(`Passed Suites: ${report.summary.passedSuites}`);
  console.log(`Failed Suites: ${report.summary.failedSuites}`);
  console.log(`Total Tests Run: ${report.summary.totalTests}`);
  console.log(`Tests Passed: ${report.summary.totalPassed} (${(report.summary.totalPassed/report.summary.totalTests*100).toFixed(1)}%)`);
  console.log(`Tests Failed: ${report.summary.totalFailed}`);
  console.log(`Total Duration: ${(report.summary.totalDuration/1000).toFixed(1)}s`);
  
  if (report.vulnerabilities.length > 0) {
    console.log(`\n🚨 VULNERABILITIES: ${report.vulnerabilities.length} potential issues found`);
    report.vulnerabilities.forEach(v => {
      console.log(`   - ${v.type} (${v.severity}): ${v.suite}`);
    });
  }
  
  console.log(`\n📄 Reports saved to:`);
  console.log(`   - JSON: ${jsonPath}`);
  console.log(`   - Markdown: ${mdPath}`);
  
  // Exit with appropriate code
  const exitCode = report.summary.failedSuites > 0 || report.vulnerabilities.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});