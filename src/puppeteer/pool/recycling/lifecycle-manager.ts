/**
 * Browser lifecycle state management
 * @module puppeteer/pool/recycling/lifecycle-manager
 * @nist ac-12 "Session termination"
 */

import { createLogger } from '../../../utils/logger.js';
import type { RecyclingCandidate } from './types.js';
import { RecyclingReason } from './types.js';

const logger = createLogger('lifecycle-manager');

/**
 * Browser lifecycle state
 */
export enum BrowserLifecycleState {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  RECYCLING = 'recycling',
  DISPOSED = 'disposed',
}

/**
 * Lifecycle transition event
 */
export interface LifecycleTransition {
  browserId: string;
  fromState: BrowserLifecycleState;
  toState: BrowserLifecycleState;
  reason: string;
  timestamp: Date;
}

/**
 * Browser lifecycle manager
 * @nist ac-12 "Session termination"
 */
export class BrowserLifecycleManager {
  private browserStates: Map<string, BrowserLifecycleState> = new Map();
  private transitions: LifecycleTransition[] = [];
  private readonly maxTransitionHistory = 1000;

  /**
   * Get browser state
   */
  getBrowserState(browserId: string): BrowserLifecycleState {
    return this.browserStates.get(browserId) ?? BrowserLifecycleState.HEALTHY;
  }

  /**
   * Update browser state based on candidate evaluation
   */
  updateBrowserState(candidate: RecyclingCandidate): void {
    const currentState = this.getBrowserState(candidate.browserId);
    let newState = currentState;

    // Determine new state based on urgency and score
    if (candidate.urgency === 'critical' || candidate.score >= 95) {
      newState = BrowserLifecycleState.CRITICAL;
    } else if (candidate.urgency === 'high' || candidate.score >= 80) {
      newState = BrowserLifecycleState.DEGRADED;
    } else {
      newState = BrowserLifecycleState.HEALTHY;
    }

    if (currentState !== newState) {
      this.transitionState(
        candidate.browserId,
        currentState,
        newState,
        this.getTransitionReason(candidate.reasons)
      );
    }
  }

  /**
   * Mark browser as recycling
   */
  markAsRecycling(browserId: string): void {
    const currentState = this.getBrowserState(browserId);
    this.transitionState(
      browserId,
      currentState,
      BrowserLifecycleState.RECYCLING,
      'Browser marked for recycling'
    );
  }

  /**
   * Mark browser as disposed
   */
  markAsDisposed(browserId: string): void {
    const currentState = this.getBrowserState(browserId);
    this.transitionState(
      browserId,
      currentState,
      BrowserLifecycleState.DISPOSED,
      'Browser disposed'
    );
    
    // Clean up state after disposal
    this.browserStates.delete(browserId);
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats(): {
    healthy: number;
    degraded: number;
    critical: number;
    recycling: number;
    totalTransitions: number;
    recentTransitions: LifecycleTransition[];
  } {
    const stats = {
      healthy: 0,
      degraded: 0,
      critical: 0,
      recycling: 0,
      totalTransitions: this.transitions.length,
      recentTransitions: this.transitions.slice(-10),
    };

    for (const state of this.browserStates.values()) {
      switch (state) {
        case BrowserLifecycleState.HEALTHY:
          stats.healthy++;
          break;
        case BrowserLifecycleState.DEGRADED:
          stats.degraded++;
          break;
        case BrowserLifecycleState.CRITICAL:
          stats.critical++;
          break;
        case BrowserLifecycleState.RECYCLING:
          stats.recycling++;
          break;
      }
    }

    return stats;
  }

  /**
   * Determine urgency based on state
   */
  determineUrgency(
    score: number,
    reasons: RecyclingReason[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const criticalReasons = [
      RecyclingReason.MEMORY_PRESSURE,
      RecyclingReason.CPU_PRESSURE,
      RecyclingReason.CONNECTION_OVERLOAD,
    ];

    if (reasons.some(r => criticalReasons.includes(r)) || score >= 95) {
      return 'critical';
    }

    if (score >= 85) {
      return 'high';
    }

    if (score >= 75) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Estimate impact of recycling
   */
  estimateImpact(
    score: number,
    reasons: RecyclingReason[]
  ): 'minimal' | 'moderate' | 'significant' | 'severe' {
    const severeReasons = [
      RecyclingReason.MEMORY_PRESSURE,
      RecyclingReason.CPU_PRESSURE,
    ];

    if (reasons.some(r => severeReasons.includes(r))) {
      return 'severe';
    }

    if (score >= 90) {
      return 'significant';
    }

    if (score >= 80) {
      return 'moderate';
    }

    return 'minimal';
  }

  /**
   * Get recommended action based on score and urgency
   */
  getRecommendedAction(
    score: number,
    urgency: string
  ): 'recycle' | 'monitor' | 'optimize' {
    if (urgency === 'critical' || score >= 90) {
      return 'recycle';
    }

    if (score >= 80) {
      return 'optimize';
    }

    return 'monitor';
  }

  /**
   * Transition browser state
   * @private
   */
  private transitionState(
    browserId: string,
    fromState: BrowserLifecycleState,
    toState: BrowserLifecycleState,
    reason: string
  ): void {
    this.browserStates.set(browserId, toState);

    const transition: LifecycleTransition = {
      browserId,
      fromState,
      toState,
      reason,
      timestamp: new Date(),
    };

    this.transitions.push(transition);

    // Maintain maximum history size
    if (this.transitions.length > this.maxTransitionHistory) {
      this.transitions.shift();
    }

    logger.info(
      {
        browserId,
        fromState,
        toState,
        reason,
      },
      'Browser lifecycle state transitioned'
    );
  }

  /**
   * Get transition reason from recycling reasons
   * @private
   */
  private getTransitionReason(reasons: RecyclingReason[]): string {
    if (reasons.length === 0) {
      return 'No specific reason';
    }

    return reasons
      .map(r => r.replace(/_/g, ' ').toLowerCase())
      .join(', ');
  }
}