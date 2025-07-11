/**
 * gRPC rate limiting interceptor
 * @module grpc/interceptors/rate-limit
 * @nist sc-5 "Denial of service protection"
 */

import { status } from '@grpc/grpc-js';
import { getRedisClient, isRedisAvailable } from '../../utils/redis-client.js';
import { logger } from '../../utils/logger.js';
import type { InterceptorFunction, ExtendedCall, GrpcCallback, NextFunction } from './types.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

/**
 * Simple in-memory rate limit store
 */
class InMemoryRateLimitStore {
  private counters = new Map<string, { count: number; resetTime: number }>();

  increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    return Promise.resolve(this.incrementSync(key, windowMs));
  }

  private incrementSync(key: string, windowMs: number): { count: number; ttl: number } {
    const now = Date.now();
    const resetTime = now + windowMs;

    const existing = this.counters.get(key);

    if (existing !== undefined && existing.resetTime > now) {
      existing.count++;
      return { count: existing.count, ttl: Math.ceil((existing.resetTime - now) / 1000) };
    } else {
      this.counters.set(key, { count: 1, resetTime });
      // Clean up old entries
      this.cleanup();
      return { count: 1, ttl: Math.ceil(windowMs / 1000) };
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.counters.entries()) {
      if (value.resetTime <= now) {
        this.counters.delete(key);
      }
    }
  }
}

const inMemoryStore = new InMemoryRateLimitStore();

/**
 * Check rate limit using Redis or in-memory store
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; count: number; ttl: number }> {
  const redisClient = getRedisClient();

  if (redisClient !== null && isRedisAvailable()) {
    try {
      // Use Redis INCR with expiration
      const fullKey = `${config.keyPrefix}:${key}`;
      const count = await redisClient.incr(fullKey);

      if (count === 1) {
        // First request in window, set expiration
        await redisClient.pexpire(fullKey, config.windowMs);
      }

      const ttl = await redisClient.ttl(fullKey);

      return {
        allowed: count <= config.maxRequests,
        count,
        ttl: ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000),
      };
    } catch (error) {
      logger.error({ error }, 'Redis rate limit error, falling back to in-memory');
      // Fall through to in-memory store
    }
  }

  // Use in-memory store
  const result = await inMemoryStore.increment(key, config.windowMs);
  return {
    allowed: result.count <= config.maxRequests,
    count: result.count,
    ttl: result.ttl,
  };
}

/**
 * Extract rate limit key from call
 */
function extractRateLimitKey(call: ExtendedCall): string {
  // Priority: API Key > Session ID > Peer IP
  const metadata = call.metadata;
  const apiKey = metadata.get('x-api-key')?.[0];
  if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
    const keyStr = String(apiKey);
    return `api:${keyStr}`;
  }

  const sessionId = metadata.get('x-session-id')?.[0];
  if (sessionId !== undefined && sessionId !== null && sessionId !== '') {
    const sessionStr = String(sessionId);
    return `session:${sessionStr}`;
  }

  // Fall back to peer address
  const peer = call.getPeer?.() ?? 'unknown';
  return `peer:${peer}`;
}

/**
 * Create gRPC rate limiting interceptor
 */
export function createRateLimitInterceptor(config?: Partial<RateLimitConfig>): InterceptorFunction {
  const rateLimitConfig: RateLimitConfig = {
    windowMs: config?.windowMs ?? 15 * 60 * 1000, // 15 minutes
    maxRequests: config?.maxRequests ?? 100,
    keyPrefix: config?.keyPrefix ?? 'grpc:rl',
  };

  return async (call: ExtendedCall, callback: GrpcCallback, next: NextFunction): Promise<void> => {
    const method = call.handler?.path ?? 'unknown';

    // Extract rate limit key
    const key = extractRateLimitKey(call);
    const fullKey = `${method}:${key}`;

    try {
      // Check rate limit
      const { allowed, count, ttl } = await checkRateLimit(fullKey, rateLimitConfig);

      if (!allowed) {
        logger.warn(
          {
            method,
            key,
            count,
            limit: rateLimitConfig.maxRequests,
          },
          'gRPC rate limit exceeded',
        );

        // Send error with retry information
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error: Error & { code?: status; metadata?: any } = new Error('Too many requests');
        error.code = status.RESOURCE_EXHAUSTED;
        error.metadata = call.metadata.clone().set('retry-after', ttl.toString());
        callback(error);
        return;
      }

      // Add rate limit headers to response metadata
      const responseMetadata = call.metadata.clone();
      responseMetadata.set('x-ratelimit-limit', rateLimitConfig.maxRequests.toString());
      responseMetadata.set(
        'x-ratelimit-remaining',
        Math.max(0, rateLimitConfig.maxRequests - count).toString(),
      );
      responseMetadata.set('x-ratelimit-reset', ttl.toString());

      // Send metadata with rate limit info
      call.sendMetadata(responseMetadata);

      // Continue with the call
      next(call, callback);
    } catch (error) {
      logger.error({ error, method, key }, 'Rate limit check failed');
      // Allow request on error to avoid blocking legitimate traffic
      next(call, callback);
    }
  };
}

/**
 * Method-specific rate limit configurations
 */
export const methodRateLimits: Record<string, Partial<RateLimitConfig>> = {
  // Strict limits for session creation
  '/puppeteer.SessionService/CreateSession': {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  },

  // Moderate limits for browser operations
  '/puppeteer.ContextService/CreateContext': {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  },

  // Higher limits for read operations
  '/puppeteer.SessionService/GetSession': {
    maxRequests: 200,
    windowMs: 15 * 60 * 1000,
  },
};

/**
 * Create method-specific rate limiter
 */
export function createMethodRateLimiter(method: string): InterceptorFunction {
  // Use switch statement to avoid object injection
  let methodConfig: Partial<RateLimitConfig> | undefined;

  switch (method) {
    case '/puppeteer.SessionService/CreateSession':
      methodConfig = methodRateLimits['/puppeteer.SessionService/CreateSession'];
      break;
    case '/puppeteer.ContextService/CreateContext':
      methodConfig = methodRateLimits['/puppeteer.ContextService/CreateContext'];
      break;
    case '/puppeteer.SessionService/GetSession':
      methodConfig = methodRateLimits['/puppeteer.SessionService/GetSession'];
      break;
    default:
      methodConfig = undefined;
  }

  if (methodConfig === undefined) {
    // Use default rate limiter
    return createRateLimitInterceptor();
  }

  return createRateLimitInterceptor({
    ...methodConfig,
    keyPrefix: `grpc:rl:${method}`,
  });
}
