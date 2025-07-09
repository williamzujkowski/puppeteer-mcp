/**
 * Migration planning logic
 * @module puppeteer/pool/compatibility/migration-planner
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../../utils/logger.js';
import type { MigrationPlan, MigrationPhase, UsageStatistics } from './types.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { MigrationPhaseFactory } from './migration-phase-factory.js';

const logger = createLogger('migration-planner');

/**
 * Migration planner for gradual adoption
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MigrationPlanner {
  /**
   * Generate migration plan
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateMigrationPlan(
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): MigrationPlan {
    const phases = MigrationPlanner.generateMigrationPhases(currentUsage, targetConfig);
    const totalDuration = MigrationPlanner.calculateTotalDuration(phases);
    const riskMitigation = MigrationPlanner.generateRiskMitigation();

    logger.info(
      {
        phasesCount: phases.length,
        totalDuration,
        riskMitigationCount: riskMitigation.length,
      },
      'Migration plan generated',
    );

    return {
      phases,
      totalDuration,
      riskMitigation,
    };
  }

  /**
   * Generate migration phases based on usage and target configuration
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static generateMigrationPhases(
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): MigrationPhase[] {
    const phases: MigrationPhase[] = [];

    // Always include performance monitoring first
    phases.push(MigrationPhaseFactory.createPerformanceMonitoringPhase());

    // Conditionally add other phases
    MigrationPlanner.addResourceMonitoringPhase(phases, currentUsage, targetConfig);
    MigrationPlanner.addBrowserRecyclingPhase(phases, targetConfig);
    MigrationPlanner.addCircuitBreakerPhase(phases, currentUsage, targetConfig);
    MigrationPlanner.addAdaptiveScalingPhase(phases, currentUsage, targetConfig);
    MigrationPlanner.addAutoOptimizationPhase(phases, targetConfig);

    // Renumber phases
    return phases.map((phase, index) => ({
      ...phase,
      phase: index + 1,
    }));
  }

  /**
   * Add resource monitoring phase if needed
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static addResourceMonitoringPhase(
    phases: MigrationPhase[],
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): void {
    if (currentUsage.resourceUsage > 60 || targetConfig.resourceMonitoring?.enabled) {
      phases.push(MigrationPhaseFactory.createResourceMonitoringPhase());
    }
  }

  /**
   * Add browser recycling phase
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static addBrowserRecyclingPhase(
    phases: MigrationPhase[],
    targetConfig: Partial<OptimizationConfig>,
  ): void {
    phases.push(MigrationPhaseFactory.createBrowserRecyclingPhase(targetConfig));
  }

  /**
   * Add circuit breaker phase if needed
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static addCircuitBreakerPhase(
    phases: MigrationPhase[],
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): void {
    if (currentUsage.errorRate > 2 || targetConfig.circuitBreaker?.enabled) {
      phases.push(MigrationPhaseFactory.createCircuitBreakerPhase());
    }
  }

  /**
   * Add adaptive scaling phase if needed
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static addAdaptiveScalingPhase(
    phases: MigrationPhase[],
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): void {
    if (currentUsage.peakPoolSize > 10 || targetConfig.scaling?.enabled) {
      phases.push(MigrationPhaseFactory.createAdaptiveScalingPhase(targetConfig));
    }
  }

  /**
   * Add auto-optimization phase if desired
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static addAutoOptimizationPhase(
    phases: MigrationPhase[],
    targetConfig: Partial<OptimizationConfig>,
  ): void {
    if (targetConfig.autoOptimization) {
      phases.push(MigrationPhaseFactory.createAutoOptimizationPhase(targetConfig));
    }
  }

  /**
   * Calculate total migration duration
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static calculateTotalDuration(phases: MigrationPhase[]): string {
    if (phases.length === 0) return '0 weeks';

    const minWeeks = phases.reduce((sum, phase) => {
      // eslint-disable-next-line security/detect-unsafe-regex
      const match = phase.duration.match(/^(\d{1,2})(?:-(\d{1,2}))?\s*weeks?$/);
      return sum + (match ? parseInt(match[1], 10) : 1);
    }, 0);

    const maxWeeks = phases.reduce((sum, phase) => {
      const match = phase.duration.match(/^(\d{1,2})-(\d{1,2})\s*weeks?$/);
      if (match) {
        return sum + parseInt(match[2], 10);
      }
      const singleMatch = phase.duration.match(/^(\d{1,2})\s*weeks?$/);
      return sum + (singleMatch ? parseInt(singleMatch[1], 10) : 1);
    }, 0);

    return minWeeks === maxWeeks ? `${minWeeks} weeks` : `${minWeeks}-${maxWeeks} weeks`;
  }

  /**
   * Generate risk mitigation strategies
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  private static generateRiskMitigation(): string[] {
    return [
      'Implement comprehensive monitoring before enabling features',
      'Use gradual rollout with fallback mechanisms',
      'Monitor key metrics during each phase',
      'Implement automated rollback triggers',
      'Maintain legacy fallback options',
      'Conduct thorough testing in staging environment',
      'Create detailed rollback procedures for each phase',
      'Establish success criteria before proceeding to next phase',
      'Monitor system health continuously during migration',
      'Maintain backup configurations for quick rollback',
    ];
  }

  /**
   * Generate custom migration plan based on specific requirements
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateCustomMigrationPlan(
    phases: Partial<MigrationPhase>[],
    additionalRiskMitigation: string[] = [],
  ): MigrationPlan {
    const completedPhases = phases.map((phase, index) => ({
      phase: index + 1,
      name: phase.name ?? `Phase ${index + 1}`,
      duration: phase.duration ?? '1-2 weeks',
      config: phase.config ?? {},
      rollbackPlan: phase.rollbackPlan ?? 'Rollback to previous configuration',
      successCriteria: phase.successCriteria ?? ['Phase completed successfully'],
    }));

    const totalDuration = MigrationPlanner.calculateTotalDuration(completedPhases);
    const riskMitigation = [
      ...MigrationPlanner.generateRiskMitigation(),
      ...additionalRiskMitigation,
    ];

    return {
      phases: completedPhases,
      totalDuration,
      riskMitigation,
    };
  }
}
