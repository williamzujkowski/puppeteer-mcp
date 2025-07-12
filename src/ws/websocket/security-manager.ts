/**
 * WebSocket security validation and rate limiting
 * @module ws/websocket/security-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { pino } from 'pino';
import { config } from '../../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { WebSocketRateLimitPresets } from '../rate-limiter.js';
import type {
  WSComponentDependencies,
  SecurityValidationOptions,
  ConnectionVerificationInfo,
  ConnectionVerificationCallback,
} from './types.js';

/**
 * Rate limiting state
 */
interface RateLimitState {
  connections: number;
  lastConnectionTime: number;
  messageCount: number;
  windowStart: number;
}

/**
 * Security validation and rate limiting manager
 * Handles connection verification, rate limiting, and security validation
 * @nist ac-3 "Access enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class SecurityManager {
  private logger: pino.Logger;
  private rateLimitState: Map<string, RateLimitState> = new Map();
  private rateLimiter = WebSocketRateLimitPresets.standard;
  private options: SecurityValidationOptions;

  constructor({ logger }: WSComponentDependencies, options: SecurityValidationOptions = {}) {
    this.logger = logger.child({ module: 'ws-security-manager' });
    this.options = {
      allowedOrigins: config.ALLOWED_ORIGINS
        ? Array.isArray(config.ALLOWED_ORIGINS)
          ? config.ALLOWED_ORIGINS
          : String(config.ALLOWED_ORIGINS)
              .split(',')
              .map((o) => o.trim())
        : [],
      maxPayloadSize: config.WS_MAX_PAYLOAD ?? 1024 * 1024, // 1MB
      requireSecure: config.NODE_ENV === 'production',
      ...options,
    };
  }

  /**
   * Verify client connection
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  verifyClient(info: ConnectionVerificationInfo, callback: ConnectionVerificationCallback): void {
    try {
      const clientIp = this.extractClientIp(info);

      // Log connection attempt
      void logSecurityEvent(SecurityEventType.CONNECTION_ATTEMPT, {
        resource: 'websocket',
        action: 'connect',
        result: 'success',
        metadata: {
          clientIp,
          origin: info.origin,
          secure: info.secure,
          userAgent: info.req.headers['user-agent'],
        },
      });

      // Check security requirements
      const securityCheck = this.performSecurityChecks(info, clientIp);
      if (!securityCheck.allowed) {
        this.logger.warn('Connection rejected', {
          clientIp,
          origin: info.origin,
          reason: securityCheck.reason,
        });

        void logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
          resource: 'websocket',
          action: 'connect',
          result: 'failure',
          metadata: {
            clientIp,
            origin: info.origin,
            reason: securityCheck.reason,
          },
        });

        callback(false, securityCheck.code, securityCheck.reason);
        return;
      }

      // Check rate limits
      const rateLimitKey = this.getRateLimitKey(clientIp, info);
      const rateLimitResult = this.checkRateLimit(rateLimitKey);

      if (!rateLimitResult.allowed) {
        this.logger.warn('Connection rate limited', {
          clientIp,
          rateLimitKey,
          reason: rateLimitResult.reason,
        });

        void logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
          resource: 'websocket',
          action: 'connect',
          result: 'failure',
          metadata: {
            clientIp,
            rateLimitKey,
            reason: rateLimitResult.reason,
          },
        });

        callback(false, 429, rateLimitResult.reason);
        return;
      }

      // Connection allowed
      void logSecurityEvent(SecurityEventType.ACCESS_GRANTED, {
        resource: 'websocket',
        action: 'connect',
        result: 'success',
        metadata: {
          clientIp,
          origin: info.origin,
          secure: info.secure,
        },
      });

      callback(true);
    } catch (error) {
      this.logger.error('Error in client verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        origin: info.origin,
      });

      void logSecurityEvent(SecurityEventType.ERROR, {
        resource: 'websocket',
        action: 'verify_client',
        result: 'failure',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          origin: info.origin,
        },
      });

      callback(false, 500, 'Internal server error');
    }
  }

  /**
   * Check if message should be rate limited
   * @nist ac-3 "Access enforcement"
   */
  async checkMessageRateLimit(rateLimitKey: string): Promise<boolean> {
    return this.rateLimiter.checkMessage(rateLimitKey);
  }

  /**
   * Handle connection close for rate limiting
   */
  async handleConnectionClose(rateLimitKey: string): Promise<void> {
    await this.rateLimiter.onConnectionClose(rateLimitKey);

    // Clean up our internal rate limit state
    const state = this.rateLimitState.get(rateLimitKey);
    if (state && state.connections > 0) {
      state.connections--;
      if (state.connections === 0) {
        this.rateLimitState.delete(rateLimitKey);
      }
    }
  }

  /**
   * Validate message payload size
   * @nist ac-3 "Access enforcement"
   */
  validatePayloadSize(payload: string | Buffer): boolean {
    const size = typeof payload === 'string' ? Buffer.byteLength(payload, 'utf8') : payload.length;
    return size <= this.options.maxPayloadSize!;
  }

  /**
   * Validate message format and structure
   */
  validateMessageStructure(message: unknown): { valid: boolean; error?: string } {
    try {
      if (typeof message !== 'object' || message === null) {
        return { valid: false, error: 'Message must be a JSON object' };
      }

      const msg = message as Record<string, unknown>;

      if (!msg.type || typeof msg.type !== 'string') {
        return { valid: false, error: 'Message must have a valid type field' };
      }

      if (msg.timestamp && typeof msg.timestamp !== 'string') {
        return { valid: false, error: 'Timestamp must be a string if provided' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid message structure',
      };
    }
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats(): {
    totalKeys: number;
    activeConnections: number;
    totalMessageCount: number;
  } {
    let activeConnections = 0;
    let totalMessageCount = 0;

    this.rateLimitState.forEach((state) => {
      activeConnections += state.connections;
      totalMessageCount += state.messageCount;
    });

    return {
      totalKeys: this.rateLimitState.size,
      activeConnections,
      totalMessageCount,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimitState(): number {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    let cleaned = 0;

    this.rateLimitState.forEach((state, key) => {
      if (now - state.windowStart > windowMs && state.connections === 0) {
        this.rateLimitState.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }

    return cleaned;
  }

  /**
   * Extract client IP address from connection info
   */
  private extractClientIp(info: ConnectionVerificationInfo): string {
    const forwarded = info.req.headers['x-forwarded-for'];
    if (forwarded) {
      if (Array.isArray(forwarded)) {
        return forwarded[0] ?? 'unknown';
      }
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return info.req.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Perform security checks on connection
   */
  private performSecurityChecks(
    info: ConnectionVerificationInfo,
    _clientIp: string,
  ): { allowed: boolean; reason?: string; code?: number } {
    // Check if secure connection is required
    if (this.options.requireSecure && !info.secure) {
      return {
        allowed: false,
        reason: 'Secure connection required',
        code: 403,
      };
    }

    // Check allowed origins
    if (this.options.allowedOrigins && this.options.allowedOrigins.length > 0) {
      const isOriginAllowed =
        this.options.allowedOrigins.includes('*') ||
        (info.origin && this.options.allowedOrigins.includes(info.origin)) ||
        // Allow undefined origin in test environments or when connecting from server-side clients
        (!info.origin && (config.NODE_ENV === 'test' || this.options.allowedOrigins.some(origin => 
          origin.includes('localhost') || origin.includes('127.0.0.1')
        )));

      if (!isOriginAllowed) {
        return {
          allowed: false,
          reason: `Origin not allowed: ${info.origin || 'undefined'}`,
          code: 403,
        };
      }
    }

    // Additional security checks could be added here
    // e.g., IP blacklisting, user agent validation, etc.

    return { allowed: true };
  }

  /**
   * Generate rate limit key for client
   */
  private getRateLimitKey(clientIp: string, _info: ConnectionVerificationInfo): string {
    // Use client IP as the primary rate limiting key
    // Could be enhanced to include user agent, origin, etc.
    return `ip:${clientIp}`;
  }

  /**
   * Check rate limit for connection
   */
  private checkRateLimit(rateLimitKey: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxConnections = 10; // Max connections per minute per IP

    let state = this.rateLimitState.get(rateLimitKey);

    if (!state) {
      state = {
        connections: 0,
        lastConnectionTime: now,
        messageCount: 0,
        windowStart: now,
      };
      this.rateLimitState.set(rateLimitKey, state);
    }

    // Reset window if expired
    if (now - state.windowStart > windowMs) {
      state.windowStart = now;
      state.messageCount = 0;
    }

    // Check connection rate limit
    if (state.connections >= maxConnections) {
      return {
        allowed: false,
        reason: 'Too many concurrent connections',
      };
    }

    // Allow connection and increment counter
    state.connections++;
    state.lastConnectionTime = now;

    return { allowed: true };
  }
}
