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
    '^@grpc/(?!grpc-js)(.*)\\.js$': '<rootDir>/src/grpc/$1',
    '^@ws/(.*)\\.js$': '<rootDir>/src/ws/$1',
    '^@utils/(.*)\\.js$': '<rootDir>/src/utils/$1',
    '^@types/(.*)\\.js$': '<rootDir>/src/types/$1',
    // Then handle without .js extension
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@grpc/(?!grpc-js)(.*)$': '<rootDir>/src/grpc/$1',
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
    'node_modules/(?!(.*\\.mjs$))'
  ],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/grpc/generated/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/auth/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/utils/**/*.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/' // Temporarily disable integration tests
  ],
};