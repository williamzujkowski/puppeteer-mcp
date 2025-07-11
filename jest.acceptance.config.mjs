/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/tests/acceptance/**/*.+(ts|tsx|js)',
    '**/tests/acceptance/**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/grpc/generated/**',
  ],
  coverageDirectory: '<rootDir>/coverage/acceptance',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000, // Longer timeout for acceptance tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Acceptance test specific settings
  maxWorkers: 2, // Limit parallelism for external dependencies
  bail: false, // Don't stop on first failure - run all tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true, // Force exit after tests complete
};
