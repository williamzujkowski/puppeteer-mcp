/**
 * WebSocket rate limiting
 * @module ws/rate-limiter
 * @nist sc-5 "Denial of service protection"
 */

import { WebSocket } from 'ws';
import { getRedisClient, isRedisAvailable } from '../utils/redis-client.js';
import { logger } from '../utils/logger.js';

interface ConnectionRateLimitConfig {
  windowMs: number;
  maxConnections: number;
  keyPrefix: string;
}

interface MessageRateLimitConfig {
  windowMs: number;
  maxMessages: number;
  keyPrefix: string;
}

/**
 * In-memory rate limit store for WebSocket
 */
class WebSocketRateLimitStore {
  private connectionCounts = new Map<string, { count: number; resetTime: number }>();
  private messageCounts = new Map<string, { count: number; resetTime: number }>();

  checkConnectionLimit(key: string, config: ConnectionRateLimitConfig): Promise<boolean> {
    return Promise.resolve(this.checkConnectionLimitSync(key, config));
  }

  private checkConnectionLimitSync(key: string, config: ConnectionRateLimitConfig): boolean {
    const now = Date.now();
    const resetTime = now + config.windowMs;

    const existing = this.connectionCounts.get(key);

    if (existing !== undefined && existing.resetTime > now) {
      if (existing.count >= config.maxConnections) {
        return false;
      }
      existing.count++;
    } else {
      this.connectionCounts.set(key, { count: 1, resetTime });
      this.cleanupConnections();
    }

    return true;
  }

  checkMessageLimit(key: string, config: MessageRateLimitConfig): Promise<boolean> {
    return Promise.resolve(this.checkMessageLimitSync(key, config));
  }

  private checkMessageLimitSync(key: string, config: MessageRateLimitConfig): boolean {
    const now = Date.now();
    const resetTime = now + config.windowMs;

    const existing = this.messageCounts.get(key);

    if (existing !== undefined && existing.resetTime > now) {
      if (existing.count >= config.maxMessages) {
        return false;
      }
      existing.count++;
    } else {
      this.messageCounts.set(key, { count: 1, resetTime });
      this.cleanupMessages();
    }

    return true;
  }

  decrementConnection(key: string): void {
    const existing = this.connectionCounts.get(key);
    if (existing !== undefined && existing.count > 0) {
      existing.count--;
    }
  }

  private cleanupConnections(): void {
    const now = Date.now();
    for (const [key, value] of this.connectionCounts.entries()) {
      if (value.resetTime <= now) {
        this.connectionCounts.delete(key);
      }
    }
  }

  private cleanupMessages(): void {
    const now = Date.now();
    for (const [key, value] of this.messageCounts.entries()) {
      if (value.resetTime <= now) {
        this.messageCounts.delete(key);
      }
    }
  }
}

const inMemoryStore = new WebSocketRateLimitStore();

/**
 * Check connection rate limit
 */
export async function checkConnectionRateLimit(
  key: string,
  config: ConnectionRateLimitConfig,
): Promise<boolean> {
  const redisClient = getRedisClient();

  if (redisClient !== null && isRedisAvailable()) {
    try {
      const fullKey = `${config.keyPrefix}:conn:${key}`;
      const count = await redisClient.incr(fullKey);

      if (count === 1) {
        await redisClient.pexpire(fullKey, config.windowMs);
      }

      if (count > config.maxConnections) {
        // Decrement to not count rejected connection
        await redisClient.decr(fullKey);
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, 'Redis connection rate limit error');
    }
  }

  return inMemoryStore.checkConnectionLimit(key, config);
}

/**
 * Check message rate limit
 */
export async function checkMessageRateLimit(
  key: string,
  config: MessageRateLimitConfig,
): Promise<boolean> {
  const redisClient = getRedisClient();

  if (redisClient !== null && isRedisAvailable()) {
    try {
      const fullKey = `${config.keyPrefix}:msg:${key}`;
      const count = await redisClient.incr(fullKey);

      if (count === 1) {
        await redisClient.pexpire(fullKey, config.windowMs);
      }

      return count <= config.maxMessages;
    } catch (error) {
      logger.error({ error }, 'Redis message rate limit error');
    }
  }

  return inMemoryStore.checkMessageLimit(key, config);
}

/**
 * Decrement connection count on disconnect
 */
export async function decrementConnectionCount(
  key: string,
  config: ConnectionRateLimitConfig,
): Promise<void> {
  const redisClient = getRedisClient();

  if (redisClient !== null && isRedisAvailable()) {
    try {
      const fullKey = `${config.keyPrefix}:conn:${key}`;
      await redisClient.decr(fullKey);
    } catch (error) {
      logger.error({ error }, 'Redis decrement connection error');
    }
  } else {
    inMemoryStore.decrementConnection(key);
  }
}

/**
 * WebSocket rate limiter class
 */
export class WebSocketRateLimiter {
  private connectionConfig: ConnectionRateLimitConfig;
  private messageConfig: MessageRateLimitConfig;

  // eslint-disable-next-line complexity
  constructor(
    connectionConfig?: Partial<ConnectionRateLimitConfig>,
    messageConfig?: Partial<MessageRateLimitConfig>,
  ) {
    this.connectionConfig = {
      windowMs: connectionConfig?.windowMs ?? 60 * 1000, // 1 minute
      maxConnections: connectionConfig?.maxConnections ?? 10,
      keyPrefix: connectionConfig?.keyPrefix ?? 'ws:rl',
    };

    this.messageConfig = {
      windowMs: messageConfig?.windowMs ?? 60 * 1000, // 1 minute
      maxMessages: messageConfig?.maxMessages ?? 100,
      keyPrefix: messageConfig?.keyPrefix ?? 'ws:rl',
    };
  }

  /**
   * Check if connection is allowed
   */
  async checkConnection(key: string): Promise<boolean> {
    return checkConnectionRateLimit(key, this.connectionConfig);
  }

  /**
   * Check if message is allowed
   */
  async checkMessage(key: string): Promise<boolean> {
    return checkMessageRateLimit(key, this.messageConfig);
  }

  /**
   * Handle connection close
   */
  async onConnectionClose(key: string): Promise<void> {
    await decrementConnectionCount(key, this.connectionConfig);
  }

  /**
   * Extract rate limit key from WebSocket
   */
  // eslint-disable-next-line complexity
  extractKey(ws: WebSocket, request?: unknown): string {
    // Check for API key in headers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = (request as any)?.headers?.['x-api-key'];
    if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
      return `api:${apiKey}`;
    }

    // Check for session ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionId = (ws as any).sessionId;
    if (sessionId !== undefined && sessionId !== null && sessionId !== '') {
      return `session:${sessionId}`;
    }

    // Fall back to IP address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = (request as any)?.socket?.remoteAddress ?? 'unknown';
    return `ip:${ip}`;
  }
}

/**
 * Create WebSocket rate limiter middleware
 */
export function createWebSocketRateLimiter(options?: {
  connection?: Partial<ConnectionRateLimitConfig>;
  message?: Partial<MessageRateLimitConfig>;
}): WebSocketRateLimiter {
  return new WebSocketRateLimiter(options?.connection, options?.message);
}

/**
 * Rate limiting presets for WebSocket
 */
export const WebSocketRateLimitPresets = {
  // Standard rate limiting
  standard: createWebSocketRateLimiter({
    connection: {
      windowMs: 60 * 1000, // 1 minute
      maxConnections: 10,
    },
    message: {
      windowMs: 60 * 1000, // 1 minute
      maxMessages: 100,
    },
  }),

  // Strict rate limiting for anonymous users
  strict: createWebSocketRateLimiter({
    connection: {
      windowMs: 60 * 1000, // 1 minute
      maxConnections: 3,
    },
    message: {
      windowMs: 60 * 1000, // 1 minute
      maxMessages: 30,
    },
  }),

  // Lenient rate limiting for authenticated users
  lenient: createWebSocketRateLimiter({
    connection: {
      windowMs: 60 * 1000, // 1 minute
      maxConnections: 20,
    },
    message: {
      windowMs: 60 * 1000, // 1 minute
      maxMessages: 500,
    },
  }),
};
