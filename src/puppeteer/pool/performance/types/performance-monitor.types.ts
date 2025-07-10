/**
 * Performance monitoring types and interfaces
 * @module puppeteer/pool/performance/types
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

/**
 * Performance metric types
 */
export enum PerformanceMetricType {
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  RESOURCE_UTILIZATION = 'resource_utilization',
  AVAILABILITY = 'availability',
  RESPONSE_TIME = 'response_time',
  QUEUE_TIME = 'queue_time',
  PROCESSING_TIME = 'processing_time',
}

/**
 * Performance alert levels
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  enabled: boolean;
  collectionInterval: number;
  retentionPeriod: number;
  alertingEnabled: boolean;
  detailedLogging?: boolean;
  alertThresholds: {
    [key in PerformanceMetricType]: {
      warning: number;
      critical: number;
      emergency: number;
    };
  };
  enableRealTimeAlerts: boolean;
  enableTrendAnalysis: boolean;
  enablePredictiveAnalysis: boolean;
  enableAnomalyDetection: boolean;
  anomalyDetectionSensitivity: number;
  trendAnalysisWindow: number;
  predictionWindow: number;
  enablePerformanceOptimization: boolean;
  autoOptimizationEnabled: boolean;
  optimizationThresholds: {
    maxLatency: number;
    maxErrorRate: number;
    minThroughput: number;
    maxResourceUtilization: number;
  };
}

/**
 * Performance data point
 */
export interface PerformanceDataPoint {
  timestamp: Date;
  type: PerformanceMetricType;
  value: number;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
  source?: string;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  level: AlertLevel;
  type: PerformanceMetricType;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  duration?: number;
}

/**
 * Performance trend
 */
export interface PerformanceTrend {
  type: PerformanceMetricType;
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  confidence: number;
  dataPoints: number;
  timespan: number;
  forecast?: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
}

/**
 * Performance anomaly
 */
export interface PerformanceAnomaly {
  id: string;
  type: PerformanceMetricType;
  timestamp: Date;
  value: number;
  expected: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  impactEstimate: string;
  recommendation: string;
}

/**
 * Performance optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'scaling' | 'recycling' | 'configuration' | 'resource_management';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  expectedImprovement: number;
  confidence: number;
  timestamp: Date;
  applied: boolean;
  appliedAt?: Date;
  result?: {
    successful: boolean;
    actualImprovement: number;
    notes: string;
  };
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  metrics: {
    [key in PerformanceMetricType]: {
      current: number;
      average: number;
      min: number;
      max: number;
      percentile95: number;
      percentile99: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
  };
  alertsSummary: {
    total: number;
    byLevel: Record<AlertLevel, number>;
    active: number;
    resolved: number;
  };
  anomalies: {
    total: number;
    bySeverity: Record<'low' | 'medium' | 'high', number>;
  };
  recommendations: {
    total: number;
    byPriority: Record<'low' | 'medium' | 'high' | 'critical', number>;
    applied: number;
  };
  healthScore: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Time range for filtering data
 */
export interface TimeRange {
  start: Date;
  end: Date;
}