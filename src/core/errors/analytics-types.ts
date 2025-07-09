/**
 * Analytics and statistics types for the error system
 * @module core/errors/analytics-types
 */

import { ErrorCategory, ErrorSeverity } from './error-context.js';
import { ErrorTrackingEntry } from './error-tracking.js';

/**
 * Error statistics type
 */
export interface ErrorStatistics {
  total: number;
  operational: number;
  nonOperational: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byStatusCode: Record<number, number>;
  averageResolutionTime: number;
  mostCommonErrors: Array<{
    errorCode: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Error correlation type
 */
export interface ErrorCorrelation {
  id: string;
  pattern: string;
  errors: ErrorTrackingEntry[];
  startTime: Date;
  endTime: Date;
  affectedUsers: string[];
  affectedSessions: string[];
  commonContext: Record<string, unknown>;
}

/**
 * Error trend analysis type
 */
export interface ErrorTrendAnalysis {
  period: {
    start: Date;
    end: Date;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  dataPoints: Array<{
    timestamp: Date;
    count: number;
    category: ErrorCategory;
  }>;
  predictions: Array<{
    timestamp: Date;
    predictedCount: number;
    confidence: number;
  }>;
}

/**
 * Error health assessment type
 */
export interface ErrorHealthAssessment {
  score: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high';
    action: string;
    description: string;
    expectedImpact: string;
  }>;
}

/**
 * Error aggregation type
 */
export interface ErrorAggregation {
  timeWindow: {
    start: Date;
    end: Date;
  };
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  metrics: {
    total: number;
    unique: number;
    resolved: number;
    unresolved: number;
    avgResolutionTime: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byStatusCode: Record<number, number>;
  };
  trends: {
    errorRate: number; // errors per unit time
    resolutionRate: number; // percentage
    escalationRate: number; // percentage
  };
}

/**
 * Error system metrics type
 */
export interface ErrorSystemMetrics {
  uptime: number;
  performance: {
    averageHandlingTime: number;
    peakHandlingTime: number;
    throughput: number; // errors per second
    memoryUsage: number;
    cpuUsage: number;
  };
  statistics: ErrorStatistics;
  health: ErrorHealthAssessment;
  plugins: Array<{
    name: string;
    status: 'active' | 'inactive' | 'error';
    metrics: Record<string, unknown>;
  }>;
}

/**
 * Error audit log entry type
 */
export interface ErrorAuditLogEntry {
  timestamp: Date;
  eventType: 'error_occurred' | 'error_resolved' | 'error_escalated' | 'error_pattern_detected';
  errorId: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  details: Record<string, unknown>;
  actions: Array<{
    type: 'automatic' | 'manual';
    action: string;
    result: 'success' | 'failure';
    timestamp: Date;
    details?: Record<string, unknown>;
  }>;
}
