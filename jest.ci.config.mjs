export default {
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
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Node',
      }
    }]
  },
};
