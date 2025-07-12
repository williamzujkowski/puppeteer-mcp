#!/usr/bin/env node

/**
 * Test script for check-performance-regression.js
 * Creates sample metric files and runs the regression checker
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample baseline metrics
const baselineMetrics = {
  navigation: {
    duration: 1500,
    responseTime: 250,
    loadTime: 1200
  },
  memory: {
    heapUsed: 52428800,  // 50 MB
    heapTotal: 104857600, // 100 MB
    rss: 157286400       // 150 MB
  },
  browser: {
    launchTime: 850,
    pageCreationTime: 120,
    screenshotTime: 450
  },
  api: {
    throughput: 1000,    // requests per second
    successRate: 99.5,   // percentage
    errorRate: 0.5       // percentage
  }
};

// Sample current metrics with some regressions
const currentMetricsWithRegression = {
  navigation: {
    duration: 1800,      // 20% slower - REGRESSION
    responseTime: 240,   // 4% faster - OK
    loadTime: 1100      // 8.3% faster - OK
  },
  memory: {
    heapUsed: 62914560,  // 60 MB - 20% increase - REGRESSION
    heapTotal: 104857600, // 100 MB - same
    rss: 146800640       // 140 MB - 6.7% decrease - OK
  },
  browser: {
    launchTime: 900,     // 5.9% slower - OK (under 10% threshold)
    pageCreationTime: 110, // 8.3% faster - OK
    screenshotTime: 480  // 6.7% slower - OK
  },
  api: {
    throughput: 1100,    // 10% increase - OK
    successRate: 97.0,   // 2.5% decrease - OK (under 10% threshold)
    errorRate: 3.0       // 500% increase - REGRESSION
  }
};

// Sample current metrics without regressions
const currentMetricsNoRegression = {
  navigation: {
    duration: 1400,      // 6.7% faster - OK
    responseTime: 240,   // 4% faster - OK
    loadTime: 1100      // 8.3% faster - OK
  },
  memory: {
    heapUsed: 54525952,  // 52 MB - 4% increase - OK
    heapTotal: 104857600, // 100 MB - same
    rss: 146800640       // 140 MB - 6.7% decrease - OK
  },
  browser: {
    launchTime: 800,     // 5.9% faster - OK
    pageCreationTime: 110, // 8.3% faster - OK
    screenshotTime: 430  // 4.4% faster - OK
  },
  api: {
    throughput: 1050,    // 5% increase - OK
    successRate: 98.5,   // 1% decrease - OK
    errorRate: 1.5       // 200% increase - OK (under 10% threshold for absolute value)
  }
};

async function runTest(testName, currentMetrics, expectedExitCode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running test: ${testName}`);
  console.log(`${'='.repeat(60)}\n`);

  // Create temporary files
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const baselineFile = path.join(tempDir, 'baseline.json');
  const currentFile = path.join(tempDir, 'current.json');

  fs.writeFileSync(baselineFile, JSON.stringify(baselineMetrics, null, 2));
  fs.writeFileSync(currentFile, JSON.stringify(currentMetrics, null, 2));

  // Run the regression checker
  return new Promise((resolve) => {
    const child = spawn('node', [
      path.join(__dirname, 'check-performance-regression.js'),
      '--baseline', baselineFile,
      '--current', currentFile,
      '--threshold', '10'
    ], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      // Clean up temp files
      fs.unlinkSync(baselineFile);
      fs.unlinkSync(currentFile);
      
      console.log(`\nTest "${testName}" completed with exit code: ${code}`);
      console.log(`Expected exit code: ${expectedExitCode}`);
      console.log(`Result: ${code === expectedExitCode ? '✅ PASS' : '❌ FAIL'}`);
      
      resolve(code === expectedExitCode);
    });
  });
}

async function main() {
  console.log('Performance Regression Checker - Test Suite');
  console.log('==========================================\n');

  const results = [];

  // Test 1: Should detect regressions
  results.push(await runTest(
    'Detect Regressions',
    currentMetricsWithRegression,
    1 // Should exit with code 1 (failure)
  ));

  // Test 2: Should pass when no regressions
  results.push(await runTest(
    'No Regressions',
    currentMetricsNoRegression,
    0 // Should exit with code 0 (success)
  ));

  // Clean up temp directory
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r).length}`);
  console.log(`Failed: ${results.filter(r => !r).length}`);
  console.log(`\nOverall: ${results.every(r => r) ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

main().catch(console.error);