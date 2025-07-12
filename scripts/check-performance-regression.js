#!/usr/bin/env node

/**
 * Performance Regression Check Script
 * 
 * Compares current performance metrics against baseline to detect regressions.
 * Used in CI/CD pipelines to prevent performance degradation.
 * 
 * Usage:
 *   node check-performance-regression.js --baseline <path> --current <path> [--threshold <percent>]
 * 
 * Exit codes:
 *   0 - No regressions found
 *   1 - Regressions detected or error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    baseline: null,
    current: null,
    threshold: 10 // Default 10% regression threshold
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--baseline':
        parsed.baseline = args[++i];
        break;
      case '--current':
        parsed.current = args[++i];
        break;
      case '--threshold':
        parsed.threshold = parseFloat(args[++i]);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return parsed;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Performance Regression Check

Usage:
  node check-performance-regression.js --baseline <path> --current <path> [--threshold <percent>]

Options:
  --baseline   Path to baseline performance metrics JSON file (required)
  --current    Path to current performance metrics JSON file (required)
  --threshold  Regression threshold percentage (default: 10)
  --help, -h   Show this help message

Examples:
  node check-performance-regression.js --baseline baseline.json --current current.json
  node check-performance-regression.js --baseline baseline.json --current current.json --threshold 5

Exit Codes:
  0 - No regressions found
  1 - Regressions detected or error
  `);
}

/**
 * Load and parse JSON file
 */
function loadMetrics(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const content = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading ${filePath}: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Calculate percentage change between baseline and current
 */
function calculateChange(baseline, current) {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / baseline) * 100;
}

/**
 * Format a number with appropriate precision
 */
function formatNumber(num) {
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(2);
}

/**
 * Format percentage with sign
 */
function formatPercentage(percentage) {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

/**
 * Get color based on percentage change and metric type
 */
function getChangeColor(percentage, metricType) {
  // For metrics where lower is better (time, memory, etc.)
  const lowerIsBetter = [
    'duration', 'time', 'memory', 'cpu', 'latency', 
    'responseTime', 'loadTime', 'renderTime', 'gcTime',
    'heapUsed', 'heapTotal', 'rss', 'external'
  ];
  
  const isLowerBetter = lowerIsBetter.some(term => 
    metricType.toLowerCase().includes(term.toLowerCase())
  );
  
  if (isLowerBetter) {
    return percentage < 0 ? colors.green : percentage > 0 ? colors.red : colors.gray;
  } else {
    // For metrics where higher is better (throughput, success rate, etc.)
    return percentage > 0 ? colors.green : percentage < 0 ? colors.red : colors.gray;
  }
}

/**
 * Check if a metric has regressed beyond threshold
 */
function hasRegressed(baseline, current, threshold, metricType) {
  const change = calculateChange(baseline, current);
  
  // Determine if this metric type should decrease (lower is better)
  const lowerIsBetter = [
    'duration', 'time', 'memory', 'cpu', 'latency', 
    'responseTime', 'loadTime', 'renderTime', 'gcTime',
    'heapUsed', 'heapTotal', 'rss', 'external'
  ].some(term => metricType.toLowerCase().includes(term.toLowerCase()));
  
  if (lowerIsBetter) {
    // Regression is when value increases beyond threshold
    return change > threshold;
  } else {
    // Regression is when value decreases beyond threshold
    return change < -threshold;
  }
}

/**
 * Compare metrics recursively
 */
function compareMetrics(baseline, current, threshold, path = '') {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    regressions: []
  };

  function traverse(baseObj, currObj, currentPath) {
    for (const key in baseObj) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;
      const baseValue = baseObj[key];
      const currValue = currObj?.[key];

      // Skip if current doesn't have this metric
      if (currValue === undefined) {
        console.log(`${colors.yellow}⚠  Skipping ${fullPath}: Not found in current metrics${colors.reset}`);
        continue;
      }

      // Handle nested objects
      if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
        traverse(baseValue, currValue, fullPath);
        continue;
      }

      // Skip non-numeric values
      if (typeof baseValue !== 'number' || typeof currValue !== 'number') {
        continue;
      }

      results.total++;
      const change = calculateChange(baseValue, currValue);
      const regressed = hasRegressed(baseValue, currValue, threshold, fullPath);
      const color = getChangeColor(change, fullPath);
      
      if (regressed) {
        results.failed++;
        results.regressions.push({
          metric: fullPath,
          baseline: baseValue,
          current: currValue,
          change: change
        });
        console.log(
          `${colors.red}✗ ${fullPath}: ${formatNumber(baseValue)} → ${formatNumber(currValue)} ` +
          `(${formatPercentage(change)}) - REGRESSION${colors.reset}`
        );
      } else {
        results.passed++;
        console.log(
          `${colors.green}✓ ${fullPath}: ${formatNumber(baseValue)} → ${formatNumber(currValue)} ` +
          `(${color}${formatPercentage(change)}${colors.reset})${colors.reset}`
        );
      }
    }
  }

  traverse(baseline, current, path);
  return results;
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.blue}Performance Regression Check${colors.reset}\n`);

  // Parse arguments
  const args = parseArgs();
  
  if (!args.baseline || !args.current) {
    console.error(`${colors.red}Error: --baseline and --current are required${colors.reset}`);
    showHelp();
    process.exit(1);
  }

  console.log(`Baseline: ${args.baseline}`);
  console.log(`Current:  ${args.current}`);
  console.log(`Threshold: ${args.threshold}%\n`);

  // Load metrics
  const baseline = loadMetrics(args.baseline);
  const current = loadMetrics(args.current);

  // Compare metrics
  console.log(`${colors.blue}Comparing metrics...${colors.reset}\n`);
  const results = compareMetrics(baseline, current, args.threshold);

  // Print summary
  console.log(`\n${colors.blue}Summary${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Total metrics checked: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  if (results.failed > 0) {
    console.log(`\n${colors.red}Performance regressions detected!${colors.reset}`);
    console.log(`\nRegressed metrics:`);
    results.regressions.forEach(reg => {
      console.log(
        `  ${colors.red}• ${reg.metric}: ${formatNumber(reg.baseline)} → ${formatNumber(reg.current)} ` +
        `(${formatPercentage(reg.change)})${colors.reset}`
      );
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}No performance regressions detected!${colors.reset}`);
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  parseArgs,
  loadMetrics,
  calculateChange,
  hasRegressed,
  compareMetrics
};