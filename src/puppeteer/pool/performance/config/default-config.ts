/**
 * Default performance monitoring configuration
 * @module puppeteer/pool/performance/config/default-config
 */

import type { PerformanceMonitoringConfig } from '../types/performance-monitor.types.js';

/**
 * Default performance monitoring configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  enabled: true,
  collectionInterval: 5000, // 5 seconds
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  alertingEnabled: true,
  alertThresholds: {
    latency: { warning: 1000, critical: 2000, emergency: 5000 },
    throughput: { warning: 10, critical: 5, emergency: 1 },
    error_rate: { warning: 5, critical: 10, emergency: 20 },
    resource_utilization: { warning: 70, critical: 85, emergency: 95 },
    availability: { warning: 95, critical: 90, emergency: 85 },
    response_time: { warning: 2000, critical: 5000, emergency: 10000 },
    queue_time: { warning: 5000, critical: 10000, emergency: 30000 },
    processing_time: { warning: 1000, critical: 3000, emergency: 8000 },
  },
  enableRealTimeAlerts: true,
  enableTrendAnalysis: true,
  enablePredictiveAnalysis: true,
  enableAnomalyDetection: true,
  anomalyDetectionSensitivity: 0.7,
  trendAnalysisWindow: 60 * 60 * 1000, // 1 hour
  predictionWindow: 30 * 60 * 1000, // 30 minutes
  enablePerformanceOptimization: true,
  autoOptimizationEnabled: false,
  optimizationThresholds: {
    maxLatency: 2000,
    maxErrorRate: 10,
    minThroughput: 5,
    maxResourceUtilization: 80,
  },
};
