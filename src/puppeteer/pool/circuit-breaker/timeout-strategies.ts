/**
 * Timeout strategy implementations
 * @module puppeteer/pool/circuit-breaker/timeout-strategies
 * @nist si-4 "Information system monitoring"
 */

import { ITimeoutStrategy } from './timeout-manager.js';

/**
 * Fixed timeout strategy
 */
export class FixedTimeoutStrategy implements ITimeoutStrategy {
  calculateTimeout(_attempt: number, baseTimeout: number): number {
    return baseTimeout;
  }

  reset(): void {
    // No state to reset
  }
}

/**
 * Exponential backoff timeout strategy
 */
export class ExponentialBackoffStrategy implements ITimeoutStrategy {
  constructor(
    private multiplier: number = 2,
    private maxTimeout: number = 300000, // 5 minutes
  ) {}

  calculateTimeout(attempt: number, baseTimeout: number): number {
    const timeout = baseTimeout * Math.pow(this.multiplier, attempt - 1);
    return Math.min(timeout, this.maxTimeout);
  }

  reset(): void {
    // No state to reset
  }
}

/**
 * Linear backoff timeout strategy
 */
export class LinearBackoffStrategy implements ITimeoutStrategy {
  constructor(
    private increment: number = 10000, // 10 seconds
    private maxTimeout: number = 300000, // 5 minutes
  ) {}

  calculateTimeout(attempt: number, baseTimeout: number): number {
    const timeout = baseTimeout + this.increment * (attempt - 1);
    return Math.min(timeout, this.maxTimeout);
  }

  reset(): void {
    // No state to reset
  }
}

/**
 * Jittered exponential backoff strategy
 */
export class JitteredBackoffStrategy implements ITimeoutStrategy {
  constructor(
    private multiplier: number = 2,
    private maxTimeout: number = 300000, // 5 minutes
    private jitterFactor: number = 0.1, // 10% jitter
  ) {}

  calculateTimeout(attempt: number, baseTimeout: number): number {
    const exponentialTimeout = baseTimeout * Math.pow(this.multiplier, attempt - 1);
    const jitter = exponentialTimeout * this.jitterFactor * (Math.random() - 0.5) * 2;
    const timeout = exponentialTimeout + jitter;
    return Math.min(Math.max(timeout, baseTimeout), this.maxTimeout);
  }

  reset(): void {
    // No state to reset
  }
}

/**
 * Fibonacci backoff strategy
 */
export class FibonacciBackoffStrategy implements ITimeoutStrategy {
  private fibCache: Map<number, number> = new Map([
    [0, 0],
    [1, 1],
  ]);

  constructor(
    private multiplier: number = 1000, // 1 second base
    private maxTimeout: number = 300000, // 5 minutes
  ) {}

  calculateTimeout(attempt: number, baseTimeout: number): number {
    const fibValue = this.fibonacci(attempt);
    const timeout = baseTimeout + fibValue * this.multiplier;
    return Math.min(timeout, this.maxTimeout);
  }

  private fibonacci(n: number): number {
    if (this.fibCache.has(n)) {
      return this.fibCache.get(n)!;
    }

    const value = this.fibonacci(n - 1) + this.fibonacci(n - 2);
    this.fibCache.set(n, value);
    return value;
  }

  reset(): void {
    // Keep first two values, clear the rest
    this.fibCache = new Map([
      [0, 0],
      [1, 1],
    ]);
  }
}

/**
 * Decorrelated jitter backoff strategy
 * Based on AWS best practices for exponential backoff
 */
export class DecorrelatedJitterStrategy implements ITimeoutStrategy {
  private lastTimeout: number = 0;

  constructor(
    private maxTimeout: number = 300000, // 5 minutes
    _baseTimeout: number = 1000, // 1 second
  ) {}

  calculateTimeout(attempt: number, baseTimeout: number): number {
    if (attempt === 1) {
      this.lastTimeout = baseTimeout;
      return baseTimeout;
    }

    const temp = Math.min(this.maxTimeout, this.lastTimeout * 3);
    this.lastTimeout = temp / 2 + Math.random() * (temp / 2);
    return Math.floor(this.lastTimeout);
  }

  reset(): void {
    this.lastTimeout = 0;
  }
}
