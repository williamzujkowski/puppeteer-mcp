#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively find all JSON files in a directory
 * @param {string} dir - Directory to search
 * @param {RegExp} pattern - Pattern to match filenames
 * @returns {string[]} Array of file paths
 */
function findJsonFiles(dir, pattern = /\.json$/i) {
  const results = [];
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        results.push(...findJsonFiles(filePath, pattern));
      } else if (pattern.test(file)) {
        results.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return results;
}

/**
 * Parse a test result JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {object|null} Parsed test result or null if invalid
 */
function parseTestResult(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Add source file information
    data._sourceFile = filePath;
    data._relativePath = path.relative(process.cwd(), filePath);
    
    return data;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract suite name from file path or test data
 * @param {object} testData - Test result data
 * @returns {string} Suite name
 */
function extractSuiteName(testData) {
  // Try to get suite name from various possible fields
  if (testData.suiteName) return testData.suiteName;
  if (testData.testSuite) return testData.testSuite;
  if (testData.suite) return testData.suite;
  if (testData.name) return testData.name;
  
  // Extract from file path
  const relativePath = testData._relativePath || '';
  const parts = relativePath.split(path.sep);
  
  // Look for common test directory patterns
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].match(/tests?|specs?|__tests__/i) && parts[i + 1]) {
      return parts[i + 1];
    }
  }
  
  // Use filename without extension as last resort
  return path.basename(testData._sourceFile || 'unknown', '.json');
}

/**
 * Aggregate test results from multiple sources
 * @param {object[]} results - Array of test results
 * @returns {object} Aggregated statistics
 */
function aggregateResults(results) {
  const aggregate = {
    totalSuites: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    totalDuration: 0,
    suites: {},
    failedTestDetails: [],
    performanceMetrics: {
      slowestTests: [],
      averageDuration: 0,
      medianDuration: 0
    }
  };
  
  const allTestDurations = [];
  
  results.forEach(result => {
    if (!result) return;
    
    const suiteName = extractSuiteName(result);
    
    // Initialize suite if not exists
    if (!aggregate.suites[suiteName]) {
      aggregate.suites[suiteName] = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        files: [],
        failedTests: []
      };
      aggregate.totalSuites++;
    }
    
    const suite = aggregate.suites[suiteName];
    suite.files.push(result._relativePath);
    
    // Handle different test result formats
    if (result.tests || result.testResults) {
      const tests = result.tests || result.testResults || [];
      
      tests.forEach(test => {
        aggregate.totalTests++;
        suite.total++;
        
        // Determine test status
        const status = test.status || test.state || 
                      (test.passed ? 'passed' : test.failed ? 'failed' : 'skipped');
        
        if (status === 'passed' || status === 'pass') {
          aggregate.passedTests++;
          suite.passed++;
        } else if (status === 'failed' || status === 'fail') {
          aggregate.failedTests++;
          suite.failed++;
          
          // Collect failed test details
          const failedDetail = {
            suite: suiteName,
            test: test.name || test.title || test.fullName || 'Unknown test',
            error: test.error || test.failureMessage || test.message || 'No error details',
            file: result._relativePath
          };
          
          aggregate.failedTestDetails.push(failedDetail);
          suite.failedTests.push(failedDetail);
        } else {
          aggregate.skippedTests++;
          suite.skipped++;
        }
        
        // Collect duration
        const duration = test.duration || test.time || 0;
        if (duration > 0) {
          allTestDurations.push({ name: test.name || test.title, duration, suite: suiteName });
          suite.duration += duration;
          aggregate.totalDuration += duration;
        }
      });
    } else if (result.numTotalTests !== undefined) {
      // Jest summary format
      aggregate.totalTests += result.numTotalTests || 0;
      aggregate.passedTests += result.numPassedTests || 0;
      aggregate.failedTests += result.numFailedTests || 0;
      aggregate.skippedTests += result.numPendingTests || result.numSkippedTests || 0;
      
      suite.total += result.numTotalTests || 0;
      suite.passed += result.numPassedTests || 0;
      suite.failed += result.numFailedTests || 0;
      suite.skipped += result.numPendingTests || result.numSkippedTests || 0;
      
      const duration = result.totalTime || result.duration || 0;
      suite.duration += duration;
      aggregate.totalDuration += duration;
    }
  });
  
  // Calculate performance metrics
  if (allTestDurations.length > 0) {
    // Sort by duration
    allTestDurations.sort((a, b) => b.duration - a.duration);
    
    // Get slowest tests
    aggregate.performanceMetrics.slowestTests = allTestDurations.slice(0, 10);
    
    // Calculate average
    const totalDuration = allTestDurations.reduce((sum, t) => sum + t.duration, 0);
    aggregate.performanceMetrics.averageDuration = totalDuration / allTestDurations.length;
    
    // Calculate median
    const mid = Math.floor(allTestDurations.length / 2);
    aggregate.performanceMetrics.medianDuration = allTestDurations.length % 2 === 0
      ? (allTestDurations[mid - 1].duration + allTestDurations[mid].duration) / 2
      : allTestDurations[mid].duration;
  }
  
  return aggregate;
}

/**
 * Format duration in milliseconds to human readable
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {string} Formatted percentage
 */
function percentage(value, total) {
  if (total === 0) return '0.00%';
  return `${((value / total) * 100).toFixed(2)}%`;
}

/**
 * Generate markdown report
 * @param {object} aggregate - Aggregated test results
 * @returns {string} Markdown report
 */
function generateMarkdownReport(aggregate) {
  const report = [];
  
  // Header
  report.push('# Test Results Aggregation Report');
  report.push(`\n_Generated on ${new Date().toISOString()}_\n`);
  
  // Overall Summary
  report.push('## Overall Summary\n');
  report.push('| Metric | Value |');
  report.push('|--------|-------|');
  report.push(`| Total Test Suites | ${aggregate.totalSuites} |`);
  report.push(`| Total Tests | ${aggregate.totalTests} |`);
  report.push(`| Passed | ${aggregate.passedTests} (${percentage(aggregate.passedTests, aggregate.totalTests)}) |`);
  report.push(`| Failed | ${aggregate.failedTests} (${percentage(aggregate.failedTests, aggregate.totalTests)}) |`);
  report.push(`| Skipped | ${aggregate.skippedTests} (${percentage(aggregate.skippedTests, aggregate.totalTests)}) |`);
  report.push(`| Total Duration | ${formatDuration(aggregate.totalDuration)} |`);
  report.push(`| Pass Rate | ${percentage(aggregate.passedTests, aggregate.totalTests - aggregate.skippedTests)} |`);
  
  // Per-Suite Breakdown
  report.push('\n## Per-Suite Breakdown\n');
  report.push('| Suite | Total | Passed | Failed | Skipped | Duration | Pass Rate |');
  report.push('|-------|-------|--------|--------|---------|----------|-----------|');
  
  Object.entries(aggregate.suites)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([suiteName, suite]) => {
      const passRate = percentage(suite.passed, suite.total - suite.skipped);
      report.push(`| ${suiteName} | ${suite.total} | ${suite.passed} | ${suite.failed} | ${suite.skipped} | ${formatDuration(suite.duration)} | ${passRate} |`);
    });
  
  // Failed Tests Details
  if (aggregate.failedTests > 0) {
    report.push('\n## Failed Test Details\n');
    
    Object.entries(aggregate.suites).forEach(([suiteName, suite]) => {
      if (suite.failedTests.length > 0) {
        report.push(`\n### ${suiteName}\n`);
        
        suite.failedTests.forEach((test, index) => {
          report.push(`${index + 1}. **${test.test}**`);
          report.push(`   - File: \`${test.file}\``);
          report.push(`   - Error: ${test.error}`);
          report.push('');
        });
      }
    });
  }
  
  // Performance Metrics
  report.push('\n## Performance Metrics\n');
  
  if (aggregate.performanceMetrics.slowestTests.length > 0) {
    report.push('### Summary Statistics\n');
    report.push(`- **Average Test Duration**: ${formatDuration(aggregate.performanceMetrics.averageDuration)}`);
    report.push(`- **Median Test Duration**: ${formatDuration(aggregate.performanceMetrics.medianDuration)}`);
    
    report.push('\n### Top 10 Slowest Tests\n');
    report.push('| # | Test Name | Suite | Duration |');
    report.push('|---|-----------|-------|----------|');
    
    aggregate.performanceMetrics.slowestTests.forEach((test, index) => {
      report.push(`| ${index + 1} | ${test.name} | ${test.suite} | ${formatDuration(test.duration)} |`);
    });
  } else {
    report.push('_No performance metrics available_');
  }
  
  // File List
  report.push('\n## Processed Files\n');
  Object.entries(aggregate.suites).forEach(([suiteName, suite]) => {
    report.push(`\n### ${suiteName}`);
    suite.files.forEach(file => {
      report.push(`- \`${file}\``);
    });
  });
  
  return report.join('\n');
}

/**
 * Main function
 */
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: aggregate-test-results.js <directory>');
    console.error('');
    console.error('Aggregates test results from JSON files in the specified directory');
    console.error('and generates a comprehensive markdown report.');
    process.exit(1);
  }
  
  const targetDir = path.resolve(args[0]);
  
  // Check if directory exists
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory '${targetDir}' does not exist`);
    process.exit(1);
  }
  
  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: '${targetDir}' is not a directory`);
    process.exit(1);
  }
  
  console.error(`Searching for test results in: ${targetDir}`);
  
  // Find all JSON files
  const jsonFiles = findJsonFiles(targetDir);
  console.error(`Found ${jsonFiles.length} JSON files`);
  
  if (jsonFiles.length === 0) {
    console.error('No JSON files found in the specified directory');
    process.exit(1);
  }
  
  // Parse test results
  const results = jsonFiles.map(parseTestResult).filter(Boolean);
  console.error(`Successfully parsed ${results.length} test result files`);
  
  if (results.length === 0) {
    console.error('No valid test results found');
    process.exit(1);
  }
  
  // Aggregate results
  const aggregate = aggregateResults(results);
  
  // Generate report
  const report = generateMarkdownReport(aggregate);
  
  // Output to stdout
  console.log(report);
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  findJsonFiles,
  parseTestResult,
  aggregateResults,
  generateMarkdownReport
};