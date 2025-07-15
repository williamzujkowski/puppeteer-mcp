/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock ESM packages to avoid import issues
    'node-fetch': '<rootDir>/tests/__mocks__/node-fetch.js',
    'socks-proxy-agent': '<rootDir>/tests/__mocks__/socks-proxy-agent.js',
    'https-proxy-agent': '<rootDir>/tests/__mocks__/https-proxy-agent.js',
    // Handle .js extensions first for path aliases
    '^@core/(.*)\\.js$': '<rootDir>/src/core/$1',
    '^@store/(.*)\\.js$': '<rootDir>/src/store/$1',
    '^@auth/(.*)\\.js$': '<rootDir>/src/auth/$1',
    '^@routes/(.*)\\.js$': '<rootDir>/src/routes/$1',
    '^@grpc/(?!grpc-js|proto-loader)(.*)\\.js$': '<rootDir>/src/grpc/$1',
    '^@ws/(.*)\\.js$': '<rootDir>/src/ws/$1',
    '^@utils/(.*)\\.js$': '<rootDir>/src/utils/$1',
    '^@types/(.*)\\.js$': '<rootDir>/src/types/$1',
    // Then handle without .js extension
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@grpc/(?!grpc-js|proto-loader)(.*)$': '<rootDir>/src/grpc/$1',
    '^@ws/(.*)$': '<rootDir>/src/ws/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2020',
          module: 'ES2022',
          moduleResolution: 'node',
          allowJs: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill|https-proxy-agent|socks-proxy-agent|@types/))'
  ],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/functional/**/*.+(ts|tsx|js)'],
  // Disable coverage collection for functional tests to avoid conflicts with Puppeteer
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: process.env.CI === 'true' ? 120000 : 60000, // 2 minutes for CI, 1 minute locally for Puppeteer tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.ts'],
  maxWorkers: process.env.CI === 'true' ? 1 : 2, // Single worker in CI to reduce resource contention
  // Optimize test execution for stability
  bail: process.env.CI === 'true' ? 5 : false, // Stop after 5 failures in CI to save time
  forceExit: true, // Force exit to prevent hanging processes
  detectOpenHandles: process.env.CI !== 'true', // Only detect open handles locally to avoid CI noise
  verbose: process.env.CI === 'true', // More verbose output in CI for debugging
};