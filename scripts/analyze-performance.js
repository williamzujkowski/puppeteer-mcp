#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

// Parse command line arguments
const { values } = parseArgs({
  options: {
    baseline: {
      type: 'string',
      short: 'b',
      description: 'Path to baseline performance results JSON file'
    },
    current: {
      type: 'string',
      short: 'c',
      description: 'Path to current performance results JSON file'
    },
    output: {
      type: 'string',
      short: 'o',
      description: 'Path to output markdown report file'
    }
  }
});

// Validate required arguments
if (!values.baseline || !values.current || !values.output) {
  console.error('Error: Missing required arguments');
  console.error('Usage: node analyze-performance.js --baseline <file> --current <file> --output <file>');
  process.exit(1);
}

// Load JSON files
function loadJSON(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filepath}:`, error.message);
    process.exit(1);
  }
}

const baseline = loadJSON(values.baseline);
const current = loadJSON(values.current);

// Calculate percentage change
function calculateChange(baseValue, currentValue) {
  if (baseValue === 0) return currentValue === 0 ? 0 : 100;
  return ((currentValue - baseValue) / baseValue) * 100;
}

// Format duration for display
function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Format percentage with color coding
function formatPercentage(value, inverse = false) {
  const formatted = value > 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;
  const isImprovement = inverse ? value > 0 : value < 0;
  
  if (Math.abs(value) < 1) return formatted;
  if (isImprovement) return `🟢 ${formatted}`;
  return `🔴 ${formatted}`;
}

// Analyze test suite performance
function analyzeTestSuites(baseline, current) {
  const suiteMap = new Map();
  
  // Process baseline suites
  baseline.testResults?.forEach(suite => {
    suiteMap.set(suite.testFilePath, {
      baseline: {
        duration: suite.perfStats?.runtime || 0,
        tests: suite.numPassingTests || 0,
        failures: suite.numFailingTests || 0
      }
    });
  });
  
  // Process current suites
  current.testResults?.forEach(suite => {
    const key = suite.testFilePath;
    if (!suiteMap.has(key)) {
      suiteMap.set(key, { baseline: null });
    }
    suiteMap.get(key).current = {
      duration: suite.perfStats?.runtime || 0,
      tests: suite.numPassingTests || 0,
      failures: suite.numFailingTests || 0
    };
  });
  
  return suiteMap;
}

// Analyze overall metrics
function analyzeOverallMetrics(baseline, current) {
  const metrics = {
    totalDuration: {
      baseline: baseline.testResults?.reduce((sum, t) => sum + (t.perfStats?.runtime || 0), 0) || 0,
      current: current.testResults?.reduce((sum, t) => sum + (t.perfStats?.runtime || 0), 0) || 0
    },
    totalTests: {
      baseline: baseline.numTotalTests || 0,
      current: current.numTotalTests || 0
    },
    passingTests: {
      baseline: baseline.numPassedTests || 0,
      current: current.numPassedTests || 0
    },
    failingTests: {
      baseline: baseline.numFailedTests || 0,
      current: current.numFailedTests || 0
    },
    testSuites: {
      baseline: baseline.numTotalTestSuites || 0,
      current: current.numTotalTestSuites || 0
    },
    passingSuites: {
      baseline: baseline.numPassedTestSuites || 0,
      current: current.numPassedTestSuites || 0
    }
  };
  
  // Calculate changes
  Object.keys(metrics).forEach(key => {
    const metric = metrics[key];
    metric.change = calculateChange(metric.baseline, metric.current);
    metric.diff = metric.current - metric.baseline;
  });
  
  return metrics;
}

// Identify top changes
function identifyTopChanges(suiteMap, limit = 5) {
  const changes = [];
  
  suiteMap.forEach((data, filepath) => {
    if (data.baseline && data.current) {
      const change = calculateChange(data.baseline.duration, data.current.duration);
      changes.push({
        filepath: path.basename(filepath),
        baseline: data.baseline.duration,
        current: data.current.duration,
        change,
        diff: data.current.duration - data.baseline.duration
      });
    }
  });
  
  // Sort by absolute change
  changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  const improvements = changes.filter(c => c.change < -5).slice(0, limit);
  const regressions = changes.filter(c => c.change > 5).slice(0, limit);
  
  return { improvements, regressions };
}

// Calculate trend indicators
function calculateTrend(metrics) {
  const trends = {
    performance: 'stable',
    reliability: 'stable',
    coverage: 'stable'
  };
  
  // Performance trend based on duration
  if (metrics.totalDuration.change < -5) trends.performance = 'improving';
  else if (metrics.totalDuration.change > 5) trends.performance = 'degrading';
  
  // Reliability trend based on failures
  if (metrics.failingTests.diff < 0) trends.reliability = 'improving';
  else if (metrics.failingTests.diff > 0) trends.reliability = 'degrading';
  
  // Coverage trend based on test count
  if (metrics.totalTests.diff > 0) trends.coverage = 'expanding';
  else if (metrics.totalTests.diff < 0) trends.coverage = 'contracting';
  
  return trends;
}

// Generate markdown report
function generateReport(baseline, current, metrics, suiteMap, topChanges, trends) {
  const timestamp = new Date().toISOString();
  const baselineDate = baseline.startTime ? new Date(baseline.startTime).toISOString() : 'Unknown';
  const currentDate = current.startTime ? new Date(current.startTime).toISOString() : 'Unknown';
  
  let report = `# Performance Analysis Report

Generated: ${timestamp}

## Executive Summary

- **Baseline**: ${baselineDate}
- **Current**: ${currentDate}
- **Overall Performance Change**: ${formatPercentage(metrics.totalDuration.change)}

### Key Findings

`;

  // Add key findings based on metrics
  if (Math.abs(metrics.totalDuration.change) > 10) {
    report += `- Total test duration ${metrics.totalDuration.change < 0 ? 'improved' : 'regressed'} by ${Math.abs(metrics.totalDuration.change).toFixed(2)}%\n`;
  }
  
  if (metrics.failingTests.diff !== 0) {
    report += `- Failing tests ${metrics.failingTests.diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(metrics.failingTests.diff)}\n`;
  }
  
  if (metrics.totalTests.diff !== 0) {
    report += `- Total test count ${metrics.totalTests.diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(metrics.totalTests.diff)}\n`;
  }

  report += `
## Overall Metrics

| Metric | Baseline | Current | Change | Trend |
|--------|----------|---------|--------|-------|
| Total Duration | ${formatDuration(metrics.totalDuration.baseline)} | ${formatDuration(metrics.totalDuration.current)} | ${formatPercentage(metrics.totalDuration.change)} | ${trends.performance} |
| Total Tests | ${metrics.totalTests.baseline} | ${metrics.totalTests.current} | ${metrics.totalTests.diff > 0 ? '+' : ''}${metrics.totalTests.diff} | ${trends.coverage} |
| Passing Tests | ${metrics.passingTests.baseline} | ${metrics.passingTests.current} | ${metrics.passingTests.diff > 0 ? '+' : ''}${metrics.passingTests.diff} | - |
| Failing Tests | ${metrics.failingTests.baseline} | ${metrics.failingTests.current} | ${metrics.failingTests.diff > 0 ? '+' : ''}${metrics.failingTests.diff} | ${trends.reliability} |
| Test Suites | ${metrics.testSuites.baseline} | ${metrics.testSuites.current} | ${metrics.testSuites.diff > 0 ? '+' : ''}${metrics.testSuites.diff} | - |
| Passing Suites | ${metrics.passingSuites.baseline} | ${metrics.passingSuites.current} | ${metrics.passingSuites.diff > 0 ? '+' : ''}${metrics.passingSuites.diff} | - |

## Performance Analysis

### Top Improvements
`;

  if (topChanges.improvements.length > 0) {
    report += `
| Test Suite | Baseline | Current | Change |
|------------|----------|---------|--------|
`;
    topChanges.improvements.forEach(item => {
      report += `| ${item.filepath} | ${formatDuration(item.baseline)} | ${formatDuration(item.current)} | ${formatPercentage(item.change)} |\n`;
    });
  } else {
    report += '\nNo significant improvements detected (threshold: >5% improvement).\n';
  }

  report += `
### Top Regressions
`;

  if (topChanges.regressions.length > 0) {
    report += `
| Test Suite | Baseline | Current | Change |
|------------|----------|---------|--------|
`;
    topChanges.regressions.forEach(item => {
      report += `| ${item.filepath} | ${formatDuration(item.baseline)} | ${formatDuration(item.current)} | ${formatPercentage(item.change)} |\n`;
    });
  } else {
    report += '\nNo significant regressions detected (threshold: >5% regression).\n';
  }

  report += `
## Trend Analysis

### Performance Trends

- **Overall Performance**: ${trends.performance === 'improving' ? '📈 Improving' : trends.performance === 'degrading' ? '📉 Degrading' : '➡️ Stable'}
- **Test Reliability**: ${trends.reliability === 'improving' ? '📈 Improving' : trends.reliability === 'degrading' ? '📉 Degrading' : '➡️ Stable'}
- **Test Coverage**: ${trends.coverage === 'expanding' ? '📈 Expanding' : trends.coverage === 'contracting' ? '📉 Contracting' : '➡️ Stable'}

### Detailed Suite Comparison

<details>
<summary>Click to expand full suite comparison</summary>

| Test Suite | Baseline Duration | Current Duration | Change |
|------------|-------------------|------------------|--------|
`;

  // Add all suite comparisons
  const allSuites = [];
  suiteMap.forEach((data, filepath) => {
    if (data.baseline && data.current) {
      allSuites.push({
        name: path.basename(filepath),
        baseline: data.baseline.duration,
        current: data.current.duration,
        change: calculateChange(data.baseline.duration, data.current.duration)
      });
    }
  });
  
  // Sort by suite name
  allSuites.sort((a, b) => a.name.localeCompare(b.name));
  
  allSuites.forEach(suite => {
    report += `| ${suite.name} | ${formatDuration(suite.baseline)} | ${formatDuration(suite.current)} | ${formatPercentage(suite.change)} |\n`;
  });

  report += `
</details>

## Recommendations

`;

  // Generate recommendations based on analysis
  if (trends.performance === 'degrading') {
    report += '- ⚠️ **Performance Degradation**: Investigate test suites with significant regressions\n';
  }
  
  if (trends.reliability === 'degrading') {
    report += '- ⚠️ **Reliability Issues**: Address newly failing tests before they impact development\n';
  }
  
  if (topChanges.regressions.length > 3) {
    report += '- ⚠️ **Multiple Regressions**: Consider reviewing recent changes that may have impacted performance\n';
  }
  
  if (trends.performance === 'improving' && trends.reliability === 'improving') {
    report += '- ✅ **Positive Trends**: Performance and reliability are both improving\n';
  }

  report += `
---

*Generated by Performance Analysis Tool*
`;

  return report;
}

// Main analysis
console.log('Analyzing performance metrics...');

const metrics = analyzeOverallMetrics(baseline, current);
const suiteMap = analyzeTestSuites(baseline, current);
const topChanges = identifyTopChanges(suiteMap);
const trends = calculateTrend(metrics);

const report = generateReport(baseline, current, metrics, suiteMap, topChanges, trends);

// Write report
try {
  fs.writeFileSync(values.output, report);
  console.log(`✅ Performance analysis complete. Report saved to: ${values.output}`);
  
  // Print summary to console
  console.log('\nSummary:');
  console.log(`- Overall Performance Change: ${formatPercentage(metrics.totalDuration.change)}`);
  console.log(`- Improvements: ${topChanges.improvements.length} suites`);
  console.log(`- Regressions: ${topChanges.regressions.length} suites`);
  
  if (topChanges.regressions.length > 0) {
    process.exit(1); // Exit with error if regressions detected
  }
} catch (error) {
  console.error('Error writing report:', error.message);
  process.exit(1);
}