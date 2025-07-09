/**
 * Browser pool scaling types and interfaces
 * @module puppeteer/pool/scaling/types
 * @nist cm-2 "Baseline configuration"
 * @nist si-4 "Information system monitoring"
 */

/**
 * Scaling strategy configuration
 * @nist cm-2 "Baseline configuration"
 */
export interface BrowserPoolScalingStrategy {
  minSize: number;
  maxSize: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  maxScaleStep: number;
  aggressiveScaling: boolean;
  memoryThreshold: number;
  cpuThreshold: number;
}

/**
 * Scaling trend analysis
 */
export type ScalingTrend = 'stable' | 'increasing' | 'decreasing' | 'volatile';

/**
 * Scaling decision types
 */
export enum ScalingDecision {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  MAINTAIN = 'maintain',
  EMERGENCY_SCALE_UP = 'emergency_scale_up',
  FORCE_SCALE_DOWN = 'force_scale_down',
}

/**
 * Scaling event
 * @nist au-3 "Content of audit records"
 */
export interface ScalingEvent {
  timestamp: Date;
  decision: ScalingDecision;
  previousSize: number;
  newSize: number;
  metrics: ScalingMetrics;
  reason: string;
  confidence: number;
}

/**
 * Scaling metrics
 * @nist si-4 "Information system monitoring"
 */
export interface ScalingMetrics {
  currentSize: number;
  targetSize: number;
  utilization: number;
  queueLength: number;
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  memoryPressure: number;
  cpuPressure: number;
  trend: ScalingTrend;
}

/**
 * Scaling decision result
 */
export interface ScalingDecisionResult {
  decision: ScalingDecision;
  targetSize: number;
  reason: string;
  confidence: number;
}

/**
 * Default scaling strategies
 */
export const DEFAULT_STRATEGIES = {
  conservative: {
    minSize: 1,
    maxSize: 5,
    targetUtilization: 70,
    scaleUpThreshold: 80,
    scaleDownThreshold: 40,
    cooldownPeriod: 300000, // 5 minutes
    maxScaleStep: 1,
    aggressiveScaling: false,
    memoryThreshold: 85,
    cpuThreshold: 85,
  },
  balanced: {
    minSize: 2,
    maxSize: 10,
    targetUtilization: 75,
    scaleUpThreshold: 85,
    scaleDownThreshold: 30,
    cooldownPeriod: 180000, // 3 minutes
    maxScaleStep: 2,
    aggressiveScaling: false,
    memoryThreshold: 90,
    cpuThreshold: 90,
  },
  aggressive: {
    minSize: 3,
    maxSize: 20,
    targetUtilization: 80,
    scaleUpThreshold: 90,
    scaleDownThreshold: 20,
    cooldownPeriod: 60000, // 1 minute
    maxScaleStep: 5,
    aggressiveScaling: true,
    memoryThreshold: 95,
    cpuThreshold: 95,
  },
} as const;
