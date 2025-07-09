/**
 * Error tracking storage implementations
 * @module core/errors/error-tracking-storage
 * @nist au-4 "Audit Storage Capacity"
 */

import { ErrorCategory, ErrorSeverity } from './error-context.js';
import {
  ErrorTrackingStorage,
  ErrorTrackingEntry,
  ErrorMetrics,
} from './error-tracking-interfaces.js';

/**
 * In-memory error tracking storage (for development/testing)
 */
export class InMemoryErrorTrackingStorage implements ErrorTrackingStorage {
  private entries: Map<string, ErrorTrackingEntry> = new Map();

  async store(entry: ErrorTrackingEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async get(id: string): Promise<ErrorTrackingEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByFingerprint(fingerprint: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.fingerprint === fingerprint && entry.timestamp >= cutoff);
  }

  async getMetrics(timeWindow: number): Promise<ErrorMetrics> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentEntries = Array.from(this.entries.values())
      .filter(entry => entry.timestamp >= cutoff);

    const byCategory: Record<ErrorCategory, number> = Object.values(ErrorCategory)
      .reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {} as Record<ErrorCategory, number>);

    const bySeverity: Record<ErrorSeverity, number> = Object.values(ErrorSeverity)
      .reduce((acc, sev) => ({ ...acc, [sev]: 0 }), {} as Record<ErrorSeverity, number>);

    const byErrorCode: Record<string, number> = {};
    const byTimeWindow: Record<string, number> = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let successfulRetries = 0;
    let totalRetries = 0;

    for (const entry of recentEntries) {
      byCategory[entry.error.category]++;
      bySeverity[entry.error.severity]++;
      byErrorCode[entry.error.errorCode] = (byErrorCode[entry.error.errorCode] ?? 0) + 1;

      const hourKey = new Date(entry.timestamp).toISOString().substring(0, 13);
      byTimeWindow[hourKey] = (byTimeWindow[hourKey] ?? 0) + 1;

      if (entry.resolved && entry.resolutionTime) {
        totalResolutionTime += entry.resolutionTime;
        resolvedCount++;
      }

      totalRetries += entry.retryAttempts;
      if (entry.successfulRetry) {
        successfulRetries++;
      }
    }

    const topErrors = Object.entries(byErrorCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([errorCode, count]) => {
        const lastEntry = recentEntries
          .filter(e => e.error.errorCode === errorCode)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        return {
          errorCode,
          count,
          lastOccurrence: lastEntry?.timestamp ?? new Date(),
        };
      });

    return {
      total: recentEntries.length,
      byCategory,
      bySeverity,
      byErrorCode,
      byTimeWindow,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      retrySuccessRate: totalRetries > 0 ? successfulRetries / totalRetries : 0,
      topErrors,
    };
  }

  async getByCategory(category: ErrorCategory, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.category === category && entry.timestamp >= cutoff);
  }

  async getBySeverity(severity: ErrorSeverity, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.severity === severity && entry.timestamp >= cutoff);
  }

  async getByErrorCode(errorCode: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.errorCode === errorCode && entry.timestamp >= cutoff);
  }

  async getByCorrelationGroup(group: string): Promise<ErrorTrackingEntry[]> {
    return Array.from(this.entries.values())
      .filter(entry => entry.correlationGroup === group);
  }

  async updateEntry(id: string, updates: Partial<ErrorTrackingEntry>): Promise<void> {
    const existing = this.entries.get(id);
    if (existing) {
      this.entries.set(id, { ...existing, ...updates });
    }
  }

  async cleanup(maxAge: number): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge * 60 * 1000);
    for (const [id, entry] of this.entries.entries()) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(id);
      }
    }
  }
}