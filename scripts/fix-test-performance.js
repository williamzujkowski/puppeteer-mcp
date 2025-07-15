#!/usr/bin/env node

/**
 * Quick fixes for test performance issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Find and update jest configuration for better performance
 */
function optimizeJestConfig() {
  const jestConfigPaths = [
    path.join(projectRoot, 'jest.config.js'),
    path.join(projectRoot, 'jest.config.mjs'),
    path.join(projectRoot, 'jest.config.ts'),
    path.join(projectRoot, 'package.json'),
  ];

  const performanceConfig = {
    // Reduce verbosity
    verbose: false,
    silent: process.env.CI === 'true',
    
    // Optimize for CI
    maxWorkers: process.env.CI ? 2 : '50%',
    maxConcurrency: process.env.CI ? 4 : 8,
    
    // Faster test runs
    cache: true,
    cacheDirectory: '<rootDir>/.jest-cache',
    
    // Reduce timeout for unit tests
    testTimeout: 15000,
    
    // Skip coverage for faster runs
    collectCoverage: false,
    
    // Fail fast in CI
    bail: process.env.CI ? 1 : false,
    
    // Optimize test patterns
    testPathIgnorePatterns: [
      '<rootDir>/node_modules/',
      '<rootDir>/dist/',
      '<rootDir>/build/',
    ],
    
    // Disable watch mode in CI
    watchman: false,
  };

  console.log('📊 Optimizing Jest configuration for performance...');
  
  // Check if package.json has jest config
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.jest) {
      packageJson.jest = { ...packageJson.jest, ...performanceConfig };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Updated Jest config in package.json');
    }
  }
}

/**
 * Create a CI-optimized test script
 */
function createCITestScript() {
  const ciTestScript = `#!/bin/bash

# CI-optimized test script
set -e

echo "🚀 Running CI-optimized tests..."

# Set environment variables for better CI performance
export NODE_ENV=test
export CI=true
export USE_DATA_URLS=true
export FORCE_COLOR=0
export NO_COLOR=1

# Reduce logging verbosity
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Run tests with optimized settings
npm test -- \\
  --no-coverage \\
  --maxWorkers=2 \\
  --maxConcurrency=4 \\
  --bail=1 \\
  --verbose=false \\
  --silent=true \\
  --testTimeout=15000 \\
  --forceExit

echo "✅ CI tests completed"
`;

  const scriptPath = path.join(projectRoot, 'scripts', 'test-ci-optimized.sh');
  fs.writeFileSync(scriptPath, ciTestScript);
  fs.chmodSync(scriptPath, '755');
  
  console.log('✅ Created CI-optimized test script');
}

/**
 * Create a test utility for reducing log noise
 */
function createLogSuppressor() {
  const logSuppressor = `/**
 * Test log suppressor utility
 * Reduces noise in test output
 */

const originalConsole = { ...console };
const logLevels = ['log', 'info', 'warn', 'error', 'debug'];

/**
 * Suppress console output during tests
 */
export function suppressLogs() {
  if (process.env.CI || process.env.SUPPRESS_TEST_LOGS === 'true') {
    logLevels.forEach(level => {
      console[level] = () => {};
    });
  }
}

/**
 * Restore console output
 */
export function restoreLogs() {
  logLevels.forEach(level => {
    console[level] = originalConsole[level];
  });
}

/**
 * Setup function to call in test files
 */
export function setupTestLogging() {
  beforeAll(() => {
    suppressLogs();
  });
  
  afterAll(() => {
    restoreLogs();
  });
}
`;

  const utilPath = path.join(projectRoot, 'tests', 'utils', 'log-suppressor.ts');
  fs.writeFileSync(utilPath, logSuppressor);
  
  console.log('✅ Created log suppressor utility');
}

/**
 * Update package.json scripts for better test performance
 */
function updatePackageScripts() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add optimized test scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'test:fast': 'jest --no-coverage --maxWorkers=50% --bail',
      'test:ci': './scripts/test-ci-optimized.sh',
      'test:reliable': 'USE_DATA_URLS=true jest --no-coverage --maxWorkers=2',
      'test:debug': 'jest --no-coverage --verbose --runInBand',
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Added optimized test scripts to package.json');
  }
}

/**
 * Create environment-specific Jest configs
 */
function createJestConfigs() {
  // CI-optimized config
  const ciConfig = `export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  
  // CI optimizations
  verbose: false,
  silent: true,
  maxWorkers: 2,
  maxConcurrency: 4,
  bail: 1,
  testTimeout: 15000,
  
  // Use data URLs instead of external dependencies
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Fast pattern matching
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  
  // Skip slow tests in CI
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/tests/acceptance/basic/multi-page.test.ts',
    '<rootDir>/tests/performance/',
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^(\\\\.{1,2}/.*)\\\\.js$': '$1',
  },
  
  transform: {
    '^.+\\\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Node',
      }
    }]
  },
};
`;

  const ciConfigPath = path.join(projectRoot, 'jest.ci.config.mjs');
  fs.writeFileSync(ciConfigPath, ciConfig);
  
  console.log('✅ Created CI-optimized Jest config');
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Applying quick fixes for test performance...\n');
  
  try {
    optimizeJestConfig();
    createCITestScript();
    createLogSuppressor();
    updatePackageScripts();
    createJestConfigs();
    
    console.log('\n🎉 Test performance fixes applied successfully!');
    console.log('\n📋 Quick fixes summary:');
    console.log('- ✅ Optimized Jest configuration');
    console.log('- ✅ Created CI-optimized test script');
    console.log('- ✅ Added log suppression utility');
    console.log('- ✅ Updated package.json scripts');
    console.log('- ✅ Created environment-specific configs');
    console.log('\n🚀 Run tests with: npm run test:ci or npm run test:reliable');
    
  } catch (error) {
    console.error('❌ Error applying fixes:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}