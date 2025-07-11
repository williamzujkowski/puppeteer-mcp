/**
 * Browser evaluation engine for recycling decisions
 * @module puppeteer/pool/recycling/evaluation-engine
 * @nist ac-12 "Session termination"
 */

import { createLogger } from '../../../utils/logger.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';
import type { BrowserResourceUsage } from '../browser-pool-resource-manager.js';
import type { RecyclingCandidate, RecyclingConfig } from './types.js';
import type { BrowserHealthChecker } from './health-checker.js';
import type { ResourceAnalyzer } from './resource-analyzer.js';
import type { StrategyManager } from './strategy-manager.js';
import type { BrowserLifecycleManager } from './lifecycle-manager.js';

const logger = createLogger('evaluation-engine');

/**
 * Browser evaluation engine
 * @nist ac-12 "Session termination"
 */
export interface EvaluationDependencies {
  healthChecker: BrowserHealthChecker;
  resourceAnalyzer: ResourceAnalyzer;
  strategyManager: StrategyManager;
  lifecycleManager: BrowserLifecycleManager;
  getConfig: () => RecyclingConfig;
}

export class EvaluationEngine {
  private healthChecker: BrowserHealthChecker;
  private resourceAnalyzer: ResourceAnalyzer;
  private strategyManager: StrategyManager;
  private lifecycleManager: BrowserLifecycleManager;
  private getConfig: () => RecyclingConfig;

  constructor(deps: EvaluationDependencies) {
    this.healthChecker = deps.healthChecker;
    this.resourceAnalyzer = deps.resourceAnalyzer;
    this.strategyManager = deps.strategyManager;
    this.lifecycleManager = deps.lifecycleManager;
    this.getConfig = deps.getConfig;
  }

  /**
   * Evaluate browsers for recycling
   */
  evaluateBrowsers(
    browsers: Map<string, InternalBrowserInstance>,
    resourceUsage: Map<string, BrowserResourceUsage>,
    recyclingThreshold: number,
  ): RecyclingCandidate[] {
    const candidates: RecyclingCandidate[] = [];

    for (const [browserId, instance] of browsers) {
      const candidate = this.evaluateBrowser(
        instance,
        resourceUsage.get(browserId),
        recyclingThreshold,
      );
      if (candidate.score >= recyclingThreshold) {
        candidates.push(candidate);
      }
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    logger.debug(
      {
        totalBrowsers: browsers.size,
        candidates: candidates.length,
        highPriority: candidates.filter((c) => c.urgency === 'critical' || c.urgency === 'high')
          .length,
      },
      'Browser recycling evaluation completed',
    );

    return candidates;
  }

  /**
   * Evaluate a single browser for recycling
   */
  evaluateBrowser(
    instance: InternalBrowserInstance,
    resourceUsage: BrowserResourceUsage | undefined,
    _recyclingThreshold: number,
  ): RecyclingCandidate {
    const browserId = instance.id;

    // Get health metrics
    const healthMetrics = this.healthChecker.getHealthMetrics(browserId);
    const healthScore = healthMetrics?.overallHealth ?? 100;
    const errorRate = healthMetrics?.failureRate ?? 0;

    // Extract candidate metrics
    const metrics = this.resourceAnalyzer.extractCandidateMetrics(
      instance,
      resourceUsage,
      healthScore,
      errorRate,
    );

    // Calculate idle time
    const idleTimeMs = this.resourceAnalyzer.calculateIdleTime(instance);

    // Calculate score based on strategy
    const config = this.getConfig();
    const strategyResult = this.strategyManager.calculateScore(
      { ...metrics, idleTimeMs },
      config.strategy,
      config,
    );

    // Determine urgency and impact
    const urgency = this.lifecycleManager.determineUrgency(
      strategyResult.score,
      strategyResult.reasons,
    );
    const estimatedImpact = this.lifecycleManager.estimateImpact(
      strategyResult.score,
      strategyResult.reasons,
    );
    const recommendedAction = this.lifecycleManager.getRecommendedAction(
      strategyResult.score,
      urgency,
    );

    const candidate: RecyclingCandidate = {
      browserId,
      instance,
      score: strategyResult.score,
      reasons: strategyResult.reasons,
      urgency,
      estimatedImpact,
      recommendedAction,
      metrics,
    };

    // Update lifecycle state
    this.lifecycleManager.updateBrowserState(candidate);

    return candidate;
  }
}
