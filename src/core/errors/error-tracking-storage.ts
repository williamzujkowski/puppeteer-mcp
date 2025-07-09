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

  private updateMetricsForEntry(
    entry: ErrorTrackingEntry,
    metrics: {
      byCategory: Map<ErrorCategory, number>;
      bySeverity: Map<ErrorSeverity, number>;
      byErrorCode: Map<string, number>;
      byTimeWindow: Map<string, number>;
    }
  ): void {
    const category = entry.error.category;
    const severity = entry.error.severity;
    const errorCode = entry.error.errorCode;
    
    // Safe increment for category
    const categoryCount = metrics.byCategory.get(category) ?? 0;
    metrics.byCategory.set(category, categoryCount + 1);
    
    // Safe increment for severity
    const severityCount = metrics.bySeverity.get(severity) ?? 0;
    metrics.bySeverity.set(severity, severityCount + 1);
    
    // Safe increment for error code
    const currentErrorCount = metrics.byErrorCode.get(errorCode) ?? 0;
    metrics.byErrorCode.set(errorCode, currentErrorCount + 1);

    // Safe increment for time window
    const hourKey = new Date(entry.timestamp).toISOString().substring(0, 13);
    const currentWindowCount = metrics.byTimeWindow.get(hourKey) ?? 0;
    metrics.byTimeWindow.set(hourKey, currentWindowCount + 1);
  }

  store(entry: ErrorTrackingEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  get(id: string): Promise<ErrorTrackingEntry | null> {
    return Promise.resolve(this.entries.get(id) ?? null);
  }

  getByFingerprint(fingerprint: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const result = Array.from(this.entries.values())
      .filter(entry => entry.fingerprint === fingerprint && entry.timestamp >= cutoff);
    return Promise.resolve(result);
  }

  getMetrics(timeWindow: number): Promise<ErrorMetrics> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentEntries = Array.from(this.entries.values())
      .filter(entry => entry.timestamp >= cutoff);

    const byCategoryMap = new Map<ErrorCategory, number>();
    const bySeverityMap = new Map<ErrorSeverity, number>();
    const byErrorCodeMap = new Map<string, number>();
    const byTimeWindowMap = new Map<string, number>();

    // Initialize category and severity maps
    Object.values(ErrorCategory).forEach(cat => byCategoryMap.set(cat, 0));
    Object.values(ErrorSeverity).forEach(sev => bySeverityMap.set(sev, 0));

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let successfulRetries = 0;
    let totalRetries = 0;

    const metricsData = {
      byCategory: byCategoryMap,
      bySeverity: bySeverityMap,
      byErrorCode: byErrorCodeMap,
      byTimeWindow: byTimeWindowMap,
    };

    for (const entry of recentEntries) {
      this.updateMetricsForEntry(entry, metricsData);
      
      if (entry.resolved === true && typeof entry.resolutionTime === 'number') {
        totalResolutionTime += entry.resolutionTime;
        resolvedCount++;
      }

      totalRetries += entry.retryAttempts;
      if (entry.successfulRetry === true) {
        successfulRetries++;
      }
    }

    // Convert Maps back to Records
    const byCategory = Object.fromEntries(byCategoryMap) as Record<ErrorCategory, number>;
    const bySeverity = Object.fromEntries(bySeverityMap) as Record<ErrorSeverity, number>;
    const byErrorCode = Object.fromEntries(byErrorCodeMap) as Record<string, number>;
    const byTimeWindow = Object.fromEntries(byTimeWindowMap) as Record<string, number>;

    const topErrors = Array.from(byErrorCodeMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([errorCode, count]) => {
        const filteredEntries = recentEntries
          .filter(e => e.error.errorCode === errorCode);
        const sortedEntries = filteredEntries
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const lastEntry = sortedEntries[0];
        return {
          errorCode,
          count,
          lastOccurrence: lastEntry?.timestamp ?? new Date(),
        };
      });

    const metrics = {
      total: recentEntries.length,
      byCategory,
      bySeverity,
      byErrorCode,
      byTimeWindow,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      retrySuccessRate: totalRetries > 0 ? successfulRetries / totalRetries : 0,
      topErrors,
    };
    return Promise.resolve(metrics);
  }

  getByCategory(category: ErrorCategory, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const result = Array.from(this.entries.values())
      .filter(entry => entry.error.category === category && entry.timestamp >= cutoff);
    return Promise.resolve(result);
  }

  getBySeverity(severity: ErrorSeverity, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const result = Array.from(this.entries.values())
      .filter(entry => entry.error.severity === severity && entry.timestamp >= cutoff);
    return Promise.resolve(result);
  }

  getByErrorCode(errorCode: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const result = Array.from(this.entries.values())
      .filter(entry => entry.error.errorCode === errorCode && entry.timestamp >= cutoff);
    return Promise.resolve(result);
  }

  getByCorrelationGroup(group: string): Promise<ErrorTrackingEntry[]> {
    const result = Array.from(this.entries.values())
      .filter(entry => entry.correlationGroup === group);
    return Promise.resolve(result);
  }

  updateEntry(id: string, updates: Partial<ErrorTrackingEntry>): Promise<void> {
    const existing = this.entries.get(id);
    if (existing !== undefined) {
      this.entries.set(id, { ...existing, ...updates });
    }
    return Promise.resolve();
  }

  cleanup(maxAge: number): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge * 60 * 1000);
    const entriesToDelete: string[] = [];
    
    this.entries.forEach((entry, id) => {
      if (entry.timestamp < cutoff) {
        entriesToDelete.push(id);
      }
    });
    
    entriesToDelete.forEach(id => {
      this.entries.delete(id);
    });
    
    return Promise.resolve();
  }
}