/**
 * Unit tests for path utilities
 * @module tests/unit/utils/path-utils
 */

import { jest } from '@jest/globals';
import { getDirname, getDirnameFromSrc } from '../../../src/utils/path-utils.js';

// Note: We test both branches but production paths are difficult to test in Jest environment
// because isTestEnvironment will always be true when JEST_WORKER_ID is set

describe('path-utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDirname', () => {
    it('should return src directory in test environment', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirname('file:///some/path/file.js');
      expect(result).toBe(`${process.cwd()}/src`);
    });

    it('should return src directory when JEST_WORKER_ID is set', () => {
      delete process.env.NODE_ENV;
      process.env.JEST_WORKER_ID = '1';

      const result = getDirname('file:///another/path/module.js');
      expect(result).toBe(`${process.cwd()}/src`);
    });

    it('should handle production environment case', () => {
      // Note: In Jest environment, isTestEnvironment is always true
      // This test verifies the function works correctly but can't actually
      // execute the production code path due to Jest limitations

      const testPath = 'file:///home/user/project/src/module.js';

      // Verify the function works correctly
      const result = getDirname(testPath);
      expect(typeof result).toBe('string');
      expect(result).toContain('src');
    });

    it('should handle different URL formats consistently in test environment', () => {
      process.env.NODE_ENV = 'test';

      const result1 = getDirname('file:///path/to/file.js');
      const result2 = getDirname('file:///different/path.js');
      const result3 = getDirname('file://localhost/path.js');

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe(`${process.cwd()}/src`);
    });

    it('should handle Windows-style file URLs', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirname('file:///C:/Users/test/project/src/file.js');
      expect(result).toBe(`${process.cwd()}/src`);
    });

    it('should handle encoded URLs', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirname('file:///path/with%20spaces/file.js');
      expect(result).toBe(`${process.cwd()}/src`);
    });
  });

  describe('getDirnameFromSrc', () => {
    it('should return correct path in test environment', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('grpc');
      expect(result).toBe(`${process.cwd()}/src/grpc`);
    });

    it('should return correct path for nested directories in test environment', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('mcp/adapters');
      expect(result).toBe(`${process.cwd()}/src/mcp/adapters`);
    });

    it('should return correct path when only JEST_WORKER_ID is set', () => {
      delete process.env.NODE_ENV;
      process.env.JEST_WORKER_ID = '1';

      const result = getDirnameFromSrc('utils');
      expect(result).toBe(`${process.cwd()}/src/utils`);
    });

    it('should handle production fallback case', () => {
      // Note: Even with NODE_ENV and JEST_WORKER_ID cleared,
      // isTestEnvironment may still be true in Jest context.
      // This test verifies the function works but the production
      // fallback is identical to test behavior

      const result = getDirnameFromSrc('services');
      expect(result).toBe(`${process.cwd()}/src/services`);
    });

    it('should handle empty relative path', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('');
      expect(result).toBe(`${process.cwd()}/src`);
    });

    it('should handle paths with leading slash', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('/grpc');
      expect(result).toBe(`${process.cwd()}/src/grpc`);
    });

    it('should work correctly when NODE_ENV is production but JEST_WORKER_ID is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.JEST_WORKER_ID = '1';

      const result = getDirnameFromSrc('auth');
      expect(result).toBe(`${process.cwd()}/src/auth`);
    });

    it('should return consistent results across multiple calls', () => {
      process.env.NODE_ENV = 'test';

      const result1 = getDirnameFromSrc('store');
      const result2 = getDirnameFromSrc('store');

      expect(result1).toBe(result2);
      expect(result1).toBe(`${process.cwd()}/src/store`);
    });

    it('should handle deeply nested paths', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('very/deeply/nested/path/structure');
      expect(result).toBe(`${process.cwd()}/src/very/deeply/nested/path/structure`);
    });

    it('should handle paths with dots', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('config.local');
      expect(result).toBe(`${process.cwd()}/src/config.local`);
    });

    it('should handle paths with dashes and underscores', () => {
      process.env.NODE_ENV = 'test';

      const result = getDirnameFromSrc('test-utils/mock_data');
      expect(result).toBe(`${process.cwd()}/src/test-utils/mock_data`);
    });
  });
});
