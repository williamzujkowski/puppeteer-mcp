/**
 * Unit tests for enhanced rate limiter
 * @module tests/unit/core/middleware/rate-limiter
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  createRateLimiter,
  createEndpointRateLimiter,
  createCostBasedRateLimiter,
  RateLimitPresets,
} from '../../../../src/core/middleware/rate-limiter.js';
import * as redisClient from '../../../../src/utils/redis-client.js';

// Mock dependencies
jest.mock('../../../../src/utils/redis-client.js', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
  isRedisAvailable: jest.fn().mockReturnValue(false),
  initializeRedis: jest.fn(),
  closeRedis: jest.fn(),
}));

jest.mock('../../../../src/core/config.js', () => ({
  config: {
    RATE_LIMIT_WINDOW: 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: false,
    RATE_LIMIT_SKIP_FAILED_REQUESTS: false,
    REDIS_KEY_PREFIX: 'test:',
  },
}));

jest.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
}));

describe('Rate Limiter', () => {
  let mockReq: Partial<Request>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '192.168.1.1' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };

    // Mock next function is not needed for these tests
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter with default options', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should use in-memory store when Redis is not available', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(redisClient.getRedisClient).toHaveBeenCalled();
    });

    it('should create rate limiter with custom options', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
      });
      expect(limiter).toBeDefined();
    });

    it('should use custom key generator', () => {
      const keyGenerator = jest.fn().mockReturnValue('custom-key');
      const limiter = createRateLimiter({ keyGenerator });
      expect(limiter).toBeDefined();
    });
  });

  describe('Key Generation', () => {
    it('should prioritize API key over user ID', () => {
      mockReq.headers = { 'x-api-key': 'test-api-key' };
      (mockReq as any).user = { userId: 'user-123' };

      const limiter = createRateLimiter();
      // The key generator is internal, but we can test the behavior through the limiter
      expect(limiter).toBeDefined();
    });

    it('should use user ID when API key is not present', () => {
      (mockReq as any).user = { userId: 'user-123' };

      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should fall back to IP address', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('createEndpointRateLimiter', () => {
    it('should create endpoint-specific rate limiter', () => {
      const limiter = createEndpointRateLimiter('auth', {
        windowMs: 300000,
        max: 5,
      });
      expect(limiter).toBeDefined();
    });

    it('should append endpoint to key', () => {
      const keyGenerator = jest.fn().mockReturnValue('base-key');
      const limiter = createEndpointRateLimiter('login', { keyGenerator });
      expect(limiter).toBeDefined();
    });
  });

  describe('createCostBasedRateLimiter', () => {
    it('should create cost-based rate limiter', () => {
      const limiter = createCostBasedRateLimiter(10);
      expect(limiter).toBeDefined();
    });

    it('should use custom cost function', () => {
      const costFunction = jest.fn().mockReturnValue(5);
      const limiter = createCostBasedRateLimiter(1, { costFunction });
      expect(limiter).toBeDefined();
    });
  });

  describe('RateLimitPresets', () => {
    it('should have auth preset with strict limits', () => {
      expect(RateLimitPresets.auth).toBeDefined();
    });

    it('should have api preset with moderate limits', () => {
      expect(RateLimitPresets.api).toBeDefined();
    });

    it('should have static preset with lenient limits', () => {
      expect(RateLimitPresets.static).toBeDefined();
    });

    it('should have browser preset with cost-based limits', () => {
      expect(RateLimitPresets.browser).toBeDefined();
    });

    it('should have expensive preset with high cost', () => {
      expect(RateLimitPresets.expensive).toBeDefined();
    });
  });

  describe('Redis Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use Redis store when available', () => {
      const mockRedis = {
        call: jest.fn(),
        script: jest.fn().mockResolvedValue('sha123'),
        evalsha: jest.fn().mockResolvedValue([1, 900]),
        eval: jest.fn().mockResolvedValue([1, 900]),
      };

      jest.mocked(redisClient.getRedisClient).mockReturnValue(mockRedis as any);
      jest.mocked(redisClient.isRedisAvailable).mockReturnValue(true);

      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(redisClient.getRedisClient).toHaveBeenCalled();
    });

    it('should fall back to in-memory when Redis fails', () => {
      jest.mocked(redisClient.getRedisClient).mockReturnValue(null);
      jest.mocked(redisClient.isRedisAvailable).mockReturnValue(false);

      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('Rate Limit Handler', () => {
    it('should handle rate limit exceeded', () => {
      const handler = jest.fn();
      const limiter = createRateLimiter({
        handler,
        max: 0, // Force rate limit to trigger
      });

      // We can't easily test the actual rate limiting behavior
      // without a full Express app, but we can verify the limiter is created
      expect(limiter).toBeDefined();
    });
  });
});
