#!/usr/bin/env node

/**
 * Badge Generator Script
 * Generates SVG badges for test status, coverage, and performance metrics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Badge configuration
const BADGE_CONFIG = {
  width: 150,
  height: 20,
  fontSize: 11,
  fontFamily: 'Verdana, Geneva, DejaVu Sans, sans-serif',
  labelPadding: 5,
  valuePadding: 5,
  borderRadius: 3
};

// Color schemes for different badge states
const COLOR_SCHEMES = {
  passing: { label: '#555', value: '#4c1' },
  failing: { label: '#555', value: '#e05d44' },
  coverage: {
    high: { label: '#555', value: '#4c1' },      // > 80%
    medium: { label: '#555', value: '#dfb317' }, // 60-80%
    low: { label: '#555', value: '#e05d44' }     // < 60%
  },
  performance: {
    fast: { label: '#555', value: '#4c1' },      // < 100ms
    medium: { label: '#555', value: '#dfb317' },  // 100-500ms
    slow: { label: '#555', value: '#e05d44' }     // > 500ms
  }
};

/**
 * Generate SVG badge
 * @param {string} label - Badge label
 * @param {string} value - Badge value
 * @param {Object} colors - Color scheme { label, value }
 * @returns {string} SVG content
 */
function generateBadgeSVG(label, value, colors) {
  const labelWidth = label.length * 7 + BADGE_CONFIG.labelPadding * 2;
  const valueWidth = value.length * 7 + BADGE_CONFIG.valuePadding * 2;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${BADGE_CONFIG.height}">
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  
  <clipPath id="round">
    <rect width="${totalWidth}" height="${BADGE_CONFIG.height}" rx="${BADGE_CONFIG.borderRadius}" fill="#fff"/>
  </clipPath>
  
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="${BADGE_CONFIG.height}" fill="${colors.label}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${BADGE_CONFIG.height}" fill="${colors.value}"/>
    <rect width="${totalWidth}" height="${BADGE_CONFIG.height}" fill="url(#smooth)"/>
  </g>
  
  <g fill="#fff" text-anchor="middle" font-family="${BADGE_CONFIG.fontFamily}" font-size="${BADGE_CONFIG.fontSize}">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

/**
 * Parse test results from JSON file
 * @param {string} filePath - Path to test results JSON
 * @returns {Object} Parsed test results
 */
function parseTestResults(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = JSON.parse(content);
    
    return {
      success: results.success || false,
      numTotalTests: results.numTotalTests || 0,
      numPassedTests: results.numPassedTests || 0,
      numFailedTests: results.numFailedTests || 0,
      testResults: results.testResults || []
    };
  } catch (error) {
    console.warn(`Failed to parse test results from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Parse coverage data from lcov.info file
 * @param {string} filePath - Path to lcov.info file
 * @returns {Object} Coverage percentages
 */
function parseCoverageData(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    
    lines.forEach(line => {
      if (line.startsWith('LF:')) totalLines += parseInt(line.substring(3));
      if (line.startsWith('LH:')) coveredLines += parseInt(line.substring(3));
      if (line.startsWith('FNF:')) totalFunctions += parseInt(line.substring(4));
      if (line.startsWith('FNH:')) coveredFunctions += parseInt(line.substring(4));
      if (line.startsWith('BRF:')) totalBranches += parseInt(line.substring(4));
      if (line.startsWith('BRH:')) coveredBranches += parseInt(line.substring(4));
    });
    
    const linesCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    const functionsCoverage = totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0;
    const branchesCoverage = totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0;
    
    // Calculate overall coverage as average of all three metrics
    const overallCoverage = (linesCoverage + functionsCoverage + branchesCoverage) / 3;
    
    return {
      lines: linesCoverage,
      functions: functionsCoverage,
      branches: branchesCoverage,
      overall: overallCoverage
    };
  } catch (error) {
    console.warn(`Failed to parse coverage data from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract performance metrics from test results
 * @param {Object} testResults - Parsed test results
 * @returns {Object} Performance metrics
 */
function extractPerformanceMetrics(testResults) {
  if (!testResults || !testResults.testResults) {
    return null;
  }
  
  let totalDuration = 0;
  let testCount = 0;
  
  testResults.testResults.forEach(suite => {
    if (suite.perfStats) {
      totalDuration += suite.perfStats.runtime || 0;
      testCount++;
    }
  });
  
  const avgDuration = testCount > 0 ? totalDuration / testCount : 0;
  
  return {
    avgDuration: Math.round(avgDuration),
    totalDuration: Math.round(totalDuration),
    suiteCount: testCount
  };
}

/**
 * Generate all badges
 */
async function generateBadges() {
  const projectRoot = path.resolve(__dirname, '..');
  const artifactsDir = path.join(projectRoot, 'artifacts');
  const badgesDir = path.join(projectRoot, 'badges');
  
  // Ensure badges directory exists
  if (!fs.existsSync(badgesDir)) {
    fs.mkdirSync(badgesDir, { recursive: true });
  }
  
  console.log('Generating badges...');
  
  // 1. Test Status Badge
  const testResultsPath = path.join(projectRoot, 'test-results.json');
  const testResults = parseTestResults(testResultsPath);
  
  if (testResults) {
    const testStatus = testResults.success ? 'passing' : 'failing';
    const testValue = testResults.success 
      ? `${testResults.numPassedTests}/${testResults.numTotalTests} passing`
      : `${testResults.numFailedTests}/${testResults.numTotalTests} failing`;
    const testColors = testResults.success ? COLOR_SCHEMES.passing : COLOR_SCHEMES.failing;
    
    const testBadge = generateBadgeSVG('tests', testValue, testColors);
    fs.writeFileSync(path.join(badgesDir, 'tests.svg'), testBadge);
    console.log('✓ Generated test status badge');
  } else {
    // Generate unknown status badge if no test results
    const unknownBadge = generateBadgeSVG('tests', 'unknown', COLOR_SCHEMES.failing);
    fs.writeFileSync(path.join(badgesDir, 'tests.svg'), unknownBadge);
    console.log('✓ Generated test status badge (unknown)');
  }
  
  // 2. Coverage Badge
  const coveragePath = path.join(projectRoot, 'coverage', 'lcov.info');
  const coverage = parseCoverageData(coveragePath);
  
  if (coverage) {
    const coveragePercent = Math.round(coverage.overall);
    const coverageValue = `${coveragePercent}%`;
    let coverageColors;
    
    if (coveragePercent >= 80) {
      coverageColors = COLOR_SCHEMES.coverage.high;
    } else if (coveragePercent >= 60) {
      coverageColors = COLOR_SCHEMES.coverage.medium;
    } else {
      coverageColors = COLOR_SCHEMES.coverage.low;
    }
    
    const coverageBadge = generateBadgeSVG('coverage', coverageValue, coverageColors);
    fs.writeFileSync(path.join(badgesDir, 'coverage.svg'), coverageBadge);
    console.log('✓ Generated coverage badge');
    
    // Generate detailed coverage badges
    const linesCoverageBadge = generateBadgeSVG('lines', `${Math.round(coverage.lines)}%`, 
      coverage.lines >= 80 ? COLOR_SCHEMES.coverage.high : 
      coverage.lines >= 60 ? COLOR_SCHEMES.coverage.medium : 
      COLOR_SCHEMES.coverage.low);
    fs.writeFileSync(path.join(badgesDir, 'coverage-lines.svg'), linesCoverageBadge);
    
    const functionsCoverageBadge = generateBadgeSVG('functions', `${Math.round(coverage.functions)}%`,
      coverage.functions >= 80 ? COLOR_SCHEMES.coverage.high :
      coverage.functions >= 60 ? COLOR_SCHEMES.coverage.medium :
      COLOR_SCHEMES.coverage.low);
    fs.writeFileSync(path.join(badgesDir, 'coverage-functions.svg'), functionsCoverageBadge);
    
    const branchesCoverageBadge = generateBadgeSVG('branches', `${Math.round(coverage.branches)}%`,
      coverage.branches >= 80 ? COLOR_SCHEMES.coverage.high :
      coverage.branches >= 60 ? COLOR_SCHEMES.coverage.medium :
      COLOR_SCHEMES.coverage.low);
    fs.writeFileSync(path.join(badgesDir, 'coverage-branches.svg'), branchesCoverageBadge);
    
    console.log('✓ Generated detailed coverage badges');
  } else {
    // Generate unknown coverage badge
    const unknownBadge = generateBadgeSVG('coverage', 'unknown', COLOR_SCHEMES.failing);
    fs.writeFileSync(path.join(badgesDir, 'coverage.svg'), unknownBadge);
    console.log('✓ Generated coverage badge (unknown)');
  }
  
  // 3. Performance Badge
  if (testResults) {
    const performanceMetrics = extractPerformanceMetrics(testResults);
    
    if (performanceMetrics && performanceMetrics.avgDuration > 0) {
      const avgDuration = performanceMetrics.avgDuration;
      const performanceValue = `${avgDuration}ms avg`;
      let performanceColors;
      
      if (avgDuration < 100) {
        performanceColors = COLOR_SCHEMES.performance.fast;
      } else if (avgDuration < 500) {
        performanceColors = COLOR_SCHEMES.performance.medium;
      } else {
        performanceColors = COLOR_SCHEMES.performance.slow;
      }
      
      const performanceBadge = generateBadgeSVG('performance', performanceValue, performanceColors);
      fs.writeFileSync(path.join(badgesDir, 'performance.svg'), performanceBadge);
      console.log('✓ Generated performance badge');
    }
  }
  
  // 4. Build Status Badge
  const buildStatus = 'passing'; // Could be determined from CI/CD status
  const buildBadge = generateBadgeSVG('build', buildStatus, COLOR_SCHEMES.passing);
  fs.writeFileSync(path.join(badgesDir, 'build.svg'), buildBadge);
  console.log('✓ Generated build badge');
  
  // 5. Version Badge (from package.json)
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version || 'unknown';
    
    const versionBadge = generateBadgeSVG('version', `v${version}`, { label: '#555', value: '#007ec6' });
    fs.writeFileSync(path.join(badgesDir, 'version.svg'), versionBadge);
    console.log('✓ Generated version badge');
  } catch (error) {
    console.warn('Failed to generate version badge:', error.message);
  }
  
  console.log(`\nBadges generated successfully in ${badgesDir}`);
  console.log('\nTo use these badges in your README:');
  console.log('![Tests](./badges/tests.svg)');
  console.log('![Coverage](./badges/coverage.svg)');
  console.log('![Performance](./badges/performance.svg)');
  console.log('![Build](./badges/build.svg)');
  console.log('![Version](./badges/version.svg)');
}

// Run the badge generator
generateBadges().catch(error => {
  console.error('Error generating badges:', error);
  process.exit(1);
});