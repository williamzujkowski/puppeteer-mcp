/**
 * Enhanced rate limiting middleware with Redis support
 * @module core/middleware/rate-limiter
 * @nist sc-5 "Denial of service protection"
 * @nist ac-7 "Unsuccessful logon attempts"
 */

import rateLimit, {
  Options as RateLimitOptions,
  RateLimitRequestHandler,
} from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import { config } from '../config.js';
import { logger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { getRedisClient, isRedisAvailable } from '../../utils/redis-client.js';
import { RateLimitError } from '../errors.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  costFunction?: (req: Request) => number;
}

/**
 * Create key generator that considers user/API key
 */
function createKeyGenerator(prefix: string): (req: Request) => string {
  return (req: Request) => {
    // Priority: API Key > User ID > IP Address
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== undefined && apiKey !== '') {
      const key = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      return `${prefix}:api:${key}`;
    }

    const user = (req as { user?: { userId?: string } }).user;
    if (user?.userId !== undefined && user.userId !== '') {
      return `${prefix}:user:${user.userId}`;
    }

    // Fall back to IP address
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return `${prefix}:ip:${ip}`;
  };
}

/**
 * Create rate limit handler
 */
function createRateLimitHandler(message?: string): (req: Request, res: Response) => void {
  return (req: Request, res: Response) => {
    const key = createKeyGenerator('rate-limit')(req);

    // Log security event
    void logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
      resource: req.path,
      action: req.method,
      result: 'failure' as const,
      metadata: {
        ip: req.ip,
        key,
        userAgent: req.headers['user-agent'],
      },
    });

    // Send error response
    const error = new RateLimitError(message ?? 'Too many requests, please try again later');
    res.status(error.statusCode).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
        retryAfter: res.getHeader('Retry-After'),
      },
    });
  };
}

/**
 * Create Redis store for rate limiting
 */
function createRedisStore(redisClient: unknown): RedisStore | null {
  try {
    // RedisStore expects a specific sendCommand method
    const redisAdapter = {
      // eslint-disable-next-line @typescript-eslint/require-await
      sendCommand: async (...args: unknown[]) => {
        // Handle different command formats
        if (args[0] === 'SCRIPT' && args[1] === 'LOAD') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          return (redisClient as any).script('LOAD', args[2]);
        }
        if (args[0] === 'EVALSHA') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          return (redisClient as any).evalsha(args[1], args[2], ...args.slice(3));
        }
        if (args[0] === 'EVAL') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          return (redisClient as any).eval(args[1], args[2], ...args.slice(3));
        }
        // Default case
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
        return (redisClient as any)[String(args[0]).toLowerCase()](...args.slice(1));
      },
    };

    return new RedisStore({
      sendCommand: redisAdapter.sendCommand,
      prefix: 'rl:',
    });
  } catch (error) {
    logger.error(
      { error },
      'Failed to create Redis store for rate limiting, falling back to in-memory',
    );
    return null;
  }
}

/**
 * Create rate limiter with Redis support
 */
// eslint-disable-next-line complexity
export function createRateLimiter(options: RateLimitConfig = {}): RateLimitRequestHandler {
  const redisClient = getRedisClient();

  const baseOptions: Partial<RateLimitOptions> = {
    windowMs: options.windowMs ?? config.RATE_LIMIT_WINDOW,
    max: options.max ?? config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator ?? createKeyGenerator('rate-limit'),
    handler: options.handler ?? createRateLimitHandler(),
    skipSuccessfulRequests:
      options.skipSuccessfulRequests ?? config.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
    skipFailedRequests: options.skipFailedRequests ?? config.RATE_LIMIT_SKIP_FAILED_REQUESTS,
  };

  // Use Redis store if available
  if (redisClient !== null && isRedisAvailable()) {
    logger.info('Using Redis store for rate limiting');

    const redisStore = createRedisStore(redisClient);
    if (redisStore !== null) {
      return rateLimit({
        ...baseOptions,
        store: redisStore,
      } as RateLimitOptions);
    }
  }

  logger.info('Using in-memory store for rate limiting');
  return rateLimit(baseOptions as RateLimitOptions);
}

/**
 * Create endpoint-specific rate limiter
 */
export function createEndpointRateLimiter(
  endpoint: string,
  options: RateLimitConfig = {},
): RateLimitRequestHandler {
  return createRateLimiter({
    ...options,
    keyGenerator: (req) => {
      const baseKey = options.keyGenerator
        ? options.keyGenerator(req)
        : createKeyGenerator(`rate-limit:${endpoint}`)(req);
      return `${baseKey}:${endpoint}`;
    },
  });
}

/**
 * Create cost-based rate limiter for resource-intensive operations
 */
export function createCostBasedRateLimiter(
  baseCost: number = 1,
  options: RateLimitConfig = {},
): RateLimitRequestHandler {
  const costFunction = options.costFunction ?? (() => baseCost);

  return createRateLimiter({
    ...options,
    // express-rate-limit doesn't support async max function
    // Instead, we'll use the key generator to include cost information
    keyGenerator: (req) => {
      const baseKey = options.keyGenerator
        ? options.keyGenerator(req)
        : createKeyGenerator('rate-limit')(req);
      const cost = costFunction(req);
      return `${baseKey}:cost:${cost}`;
    },
    max: options.max ?? config.RATE_LIMIT_MAX_REQUESTS,
  });
}

/**
 * Rate limiting presets
 */
export const RateLimitPresets = {
  // Strict rate limiting for authentication endpoints
  auth: createEndpointRateLimiter('auth', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    skipSuccessfulRequests: false,
  }),

  // Moderate rate limiting for API endpoints
  api: createEndpointRateLimiter('api', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  }),

  // Lenient rate limiting for static resources
  static: createEndpointRateLimiter('static', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
  }),

  // Cost-based rate limiting for browser operations
  browser: createCostBasedRateLimiter(10, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 "cost units" per window
  }),

  // Strict rate limiting for expensive operations
  expensive: createCostBasedRateLimiter(25, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 "cost units" per window
  }),
};
