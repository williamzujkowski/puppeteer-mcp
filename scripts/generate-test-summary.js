#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a markdown summary from Jest test results JSON
 */
function generateTestSummary(jsonFilePath) {
  try {
    // Read and parse the Jest results file
    const rawData = fs.readFileSync(jsonFilePath, 'utf8');
    const testResults = JSON.parse(rawData);

    // Extract summary data
    const totalTests = testResults.numTotalTests || 0;
    const passedTests = testResults.numPassedTests || 0;
    const failedTests = testResults.numFailedTests || 0;
    const skippedTests = testResults.numPendingTests || 0;
    const totalTestSuites = testResults.numTotalTestSuites || 0;
    const passedTestSuites = testResults.numPassedTestSuites || 0;
    const failedTestSuites = testResults.numFailedTestSuites || 0;
    
    // Calculate metrics
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0;
    const startTime = testResults.startTime;
    const endTime = startTime + (testResults.testResults?.reduce((acc, suite) => 
      acc + (suite.perfStats?.runtime || 0), 0) || 0);
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Generate markdown output
    let markdown = '# Jest Test Results Summary\n\n';
    
    // Add timestamp
    markdown += `**Generated**: ${new Date().toISOString()}\n\n`;
    
    // Test overview
    markdown += '## Test Overview\n\n';
    markdown += '| Metric | Value |\n';
    markdown += '|--------|-------|\n';
    markdown += `| Total Tests | ${totalTests} |\n`;
    markdown += `| Passed | ✅ ${passedTests} |\n`;
    markdown += `| Failed | ❌ ${failedTests} |\n`;
    markdown += `| Skipped | ⏭️ ${skippedTests} |\n`;
    markdown += `| Success Rate | ${successRate}% |\n`;
    markdown += `| Duration | ${duration}s |\n\n`;

    // Test suite summary
    markdown += '## Test Suite Summary\n\n';
    markdown += '| Metric | Value |\n';
    markdown += '|--------|-------|\n';
    markdown += `| Total Test Suites | ${totalTestSuites} |\n`;
    markdown += `| Passed Suites | ${passedTestSuites} |\n`;
    markdown += `| Failed Suites | ${failedTestSuites} |\n\n`;

    // Failed tests details
    if (failedTests > 0) {
      markdown += '## Failed Tests\n\n';
      
      testResults.testResults?.forEach(suite => {
        if (suite.testResults) {
          const failedTestsInSuite = suite.testResults.filter(test => 
            test.status === 'failed'
          );
          
          if (failedTestsInSuite.length > 0) {
            const suiteName = path.relative(process.cwd(), suite.testFilePath || suite.name);
            markdown += `### ${suiteName}\n\n`;
            
            failedTestsInSuite.forEach(test => {
              markdown += `#### ❌ ${test.fullName || test.title}\n\n`;
              
              if (test.failureMessages && test.failureMessages.length > 0) {
                markdown += '**Error Message:**\n```\n';
                markdown += test.failureMessages.join('\n\n');
                markdown += '\n```\n\n';
              }
              
              if (test.duration) {
                markdown += `**Duration:** ${test.duration}ms\n\n`;
              }
            });
          }
        }
      });
    } else {
      markdown += '## Failed Tests\n\n';
      markdown += '🎉 No failed tests!\n\n';
    }

    // Test performance
    markdown += '## Test Performance\n\n';
    markdown += '### Slowest Test Suites\n\n';
    
    const sortedSuites = (testResults.testResults || [])
      .filter(suite => suite.perfStats?.runtime)
      .sort((a, b) => (b.perfStats?.runtime || 0) - (a.perfStats?.runtime || 0))
      .slice(0, 5);
    
    if (sortedSuites.length > 0) {
      markdown += '| Test Suite | Duration |\n';
      markdown += '|------------|----------|\n';
      
      sortedSuites.forEach(suite => {
        const suiteName = path.basename(suite.testFilePath || suite.name);
        const duration = ((suite.perfStats?.runtime || 0) / 1000).toFixed(2);
        markdown += `| ${suiteName} | ${duration}s |\n`;
      });
      markdown += '\n';
    }

    // Coverage summary (if available)
    if (testResults.coverageMap || testResults.coverage) {
      markdown += '## Coverage Summary\n\n';
      markdown += '*Coverage data available but not fully parsed in this summary.*\n\n';
    }

    // Footer
    markdown += '---\n';
    markdown += `*Report generated from: ${path.basename(jsonFilePath)}*\n`;

    return markdown;
  } catch (error) {
    throw new Error(`Failed to generate test summary: ${error.message}`);
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node generate-test-summary.js <jest-results.json>');
    console.error('\nExample:');
    console.error('  node generate-test-summary.js test-results.json');
    process.exit(1);
  }

  const jsonFilePath = args[0];
  
  // Check if file exists
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`Error: File not found: ${jsonFilePath}`);
    process.exit(1);
  }

  try {
    const summary = generateTestSummary(jsonFilePath);
    console.log(summary);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateTestSummary };