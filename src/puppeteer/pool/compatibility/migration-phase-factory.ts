/**
 * Factory for creating migration phases
 * @module puppeteer/pool/compatibility/migration-phase-factory
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { MigrationPhase } from './types.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { RecyclingStrategy } from '../browser-pool-recycler.js';

/**
 * Factory for creating standardized migration phases
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MigrationPhaseFactory {
  /**
   * Create performance monitoring phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createPerformanceMonitoringPhase(): MigrationPhase {
    return {
      phase: 1,
      name: 'Performance Monitoring',
      duration: '1-2 weeks',
      config: {
        enabled: true,
        autoOptimization: false,
        performanceMonitoring: {
          enabled: true,
          alertingEnabled: true,
          detailedLogging: false,
        },
      },
      rollbackPlan: 'Disable performance monitoring',
      successCriteria: [
        'Performance metrics collected successfully',
        'No performance degradation observed',
        'Alerts configured and functioning',
        'Baseline metrics established',
      ],
    };
  }

  /**
   * Create resource monitoring phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createResourceMonitoringPhase(): MigrationPhase {
    return {
      phase: 2,
      name: 'Resource Monitoring',
      duration: '1-2 weeks',
      config: {
        enabled: true,
        autoOptimization: false,
        performanceMonitoring: {
          enabled: true,
          alertingEnabled: true,
        },
        resourceMonitoring: {
          enabled: true,
          enableSystemMonitoring: true,
        },
      },
      rollbackPlan: 'Disable resource monitoring',
      successCriteria: [
        'Resource metrics collected successfully',
        'Memory and CPU usage monitored',
        'Resource alerts functioning',
        'Resource usage trends identified',
      ],
    };
  }

  /**
   * Create browser recycling phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createBrowserRecyclingPhase(targetConfig: Partial<OptimizationConfig>): MigrationPhase {
    return {
      phase: 3,
      name: 'Browser Recycling',
      duration: '2-3 weeks',
      config: {
        enabled: true,
        autoOptimization: false,
        performanceMonitoring: {
          enabled: true,
          alertingEnabled: true,
        },
        resourceMonitoring: {
          enabled: true,
          enableSystemMonitoring: true,
        },
        recycling: {
          enabled: true,
          strategy: targetConfig.recycling?.strategy ?? RecyclingStrategy.HYBRID,
        },
      },
      rollbackPlan: 'Disable browser recycling',
      successCriteria: [
        'Browser recycling working correctly',
        'No impact on browser availability',
        'Improved resource utilization',
        'Recycling metrics within expected ranges',
      ],
    };
  }

  /**
   * Create circuit breaker phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createCircuitBreakerPhase(): MigrationPhase {
    return {
      phase: 4,
      name: 'Circuit Breaker',
      duration: '1-2 weeks',
      config: {
        enabled: true,
        autoOptimization: false,
        performanceMonitoring: {
          enabled: true,
          alertingEnabled: true,
        },
        resourceMonitoring: {
          enabled: true,
          enableSystemMonitoring: true,
        },
        recycling: {
          enabled: true,
          strategy: RecyclingStrategy.HYBRID,
        },
        circuitBreaker: {
          enabled: true,
          errorThreshold: 10,
          resetTimeout: 30000,
        },
      },
      rollbackPlan: 'Disable circuit breaker',
      successCriteria: [
        'Circuit breaker preventing cascading failures',
        'Fallback mechanisms working',
        'Improved error handling',
        'Circuit breaker state transitions working correctly',
      ],
    };
  }

  /**
   * Create adaptive scaling phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createAdaptiveScalingPhase(targetConfig: Partial<OptimizationConfig>): MigrationPhase {
    return {
      phase: 5,
      name: 'Adaptive Scaling',
      duration: '2-4 weeks',
      config: {
        enabled: true,
        autoOptimization: false,
        performanceMonitoring: {
          enabled: true,
          alertingEnabled: true,
        },
        resourceMonitoring: {
          enabled: true,
          enableSystemMonitoring: true,
        },
        recycling: {
          enabled: true,
          strategy: RecyclingStrategy.HYBRID,
        },
        circuitBreaker: {
          enabled: true,
        },
        scaling: {
          enabled: true,
          ...(targetConfig.scaling ?? {}),
          enablePredictiveScaling: false, // Start with basic scaling
        },
      },
      rollbackPlan: 'Disable adaptive scaling',
      successCriteria: [
        'Scaling decisions are accurate',
        'Pool size optimized for load',
        'No scaling oscillation',
        'Scaling metrics within expected ranges',
      ],
    };
  }

  /**
   * Create auto-optimization phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createAutoOptimizationPhase(targetConfig: Partial<OptimizationConfig>): MigrationPhase {
    return {
      phase: 6,
      name: 'Auto-Optimization',
      duration: '2-3 weeks',
      config: {
        ...targetConfig,
        autoOptimization: true,
      },
      rollbackPlan: 'Disable auto-optimization',
      successCriteria: [
        'Auto-optimization improving performance',
        'Recommendations being applied correctly',
        'System stability maintained',
        'Optimization feedback loop working',
      ],
    };
  }
}
