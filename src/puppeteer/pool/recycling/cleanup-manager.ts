/**
 * Browser cleanup and disposal operations
 * @module puppeteer/pool/recycling/cleanup-manager
 * @nist ac-12 "Session termination"
 * @nist sc-2 "Application partitioning"
 */

import { createLogger } from '../../../utils/logger.js';
import type { RecyclingCandidate, RecyclingEvent } from './types.js';
import { RecyclingReason, RecyclingStrategy } from './types.js';

const logger = createLogger('cleanup-manager');

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  browserId: string;
  success: boolean;
  executionTimeMs: number;
  errors?: string[];
}

/**
 * Browser cleanup manager
 * @nist ac-12 "Session termination"
 */
export class CleanupManager {
  /**
   * Execute cleanup for recycling candidates
   */
  async executeCleanup(
    candidates: RecyclingCandidate[],
    recycleCallback: (browserId: string) => Promise<void>,
    batchSize: number,
  ): Promise<RecyclingEvent[]> {
    const events: RecyclingEvent[] = [];

    // Filter and prioritize candidates
    const toRecycle = this.prioritizeCandidates(candidates, batchSize);

    logger.info(
      {
        totalCandidates: candidates.length,
        selectedForRecycling: toRecycle.length,
        batchSize,
      },
      'Starting browser cleanup execution',
    );

    // Execute recycling for each candidate
    for (const candidate of toRecycle) {
      const event = await this.recycleBrowser(candidate, recycleCallback);
      events.push(event);
    }

    return events;
  }

  /**
   * Execute cleanup for a single browser
   */
  async recycleBrowser(
    candidate: RecyclingCandidate,
    recycleCallback: (browserId: string) => Promise<void>,
  ): Promise<RecyclingEvent> {
    const startTime = Date.now();
    let success = false;

    try {
      await recycleCallback(candidate.browserId);
      success = true;

      logger.info(
        {
          browserId: candidate.browserId,
          reasons: candidate.reasons,
          score: candidate.score,
          executionTimeMs: Date.now() - startTime,
        },
        'Browser recycled successfully',
      );
    } catch (error) {
      logger.error(
        {
          browserId: candidate.browserId,
          error,
          reasons: candidate.reasons,
        },
        'Error recycling browser',
      );
    }

    return {
      browserId: candidate.browserId,
      reason: candidate.reasons[0] ?? RecyclingReason.MANUAL_TRIGGER,
      strategy: RecyclingStrategy.HYBRID, // Default strategy since instance doesn't have config
      score: candidate.score,
      timestamp: new Date(),
      success,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Prioritize candidates for recycling
   */
  prioritizeCandidates(
    candidates: RecyclingCandidate[],
    maxBatchSize: number,
  ): RecyclingCandidate[] {
    // Separate by urgency
    const critical = candidates.filter((c) => c.urgency === 'critical');
    const high = candidates.filter((c) => c.urgency === 'high');
    const medium = candidates.filter((c) => c.urgency === 'medium');

    const prioritized: RecyclingCandidate[] = [];

    // Always include critical candidates
    prioritized.push(...critical);

    // Add high priority candidates if space remains
    const remainingSpace = maxBatchSize - prioritized.length;
    if (remainingSpace > 0) {
      prioritized.push(...high.slice(0, remainingSpace));
    }

    // Add medium priority if still space
    const stillRemaining = maxBatchSize - prioritized.length;
    if (stillRemaining > 0) {
      prioritized.push(...medium.slice(0, stillRemaining));
    }

    logger.debug(
      {
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        selected: prioritized.length,
        maxBatchSize,
      },
      'Candidates prioritized for recycling',
    );

    return prioritized;
  }

  /**
   * Validate cleanup operation can proceed
   */
  validateCleanupOperation(
    candidates: RecyclingCandidate[],
    isInCooldown: boolean,
    isEnabled: boolean,
  ): { valid: boolean; reason?: string } {
    if (!isEnabled) {
      return { valid: false, reason: 'Recycling is disabled' };
    }

    if (candidates.length === 0) {
      return { valid: false, reason: 'No candidates for recycling' };
    }

    if (isInCooldown) {
      // Allow critical candidates even during cooldown
      const hasCritical = candidates.some((c) => c.urgency === 'critical');
      if (!hasCritical) {
        return { valid: false, reason: 'In cooldown period, no critical candidates' };
      }
    }

    return { valid: true };
  }

  /**
   * Prepare cleanup batch
   */
  prepareCleanupBatch(
    candidates: RecyclingCandidate[],
    batchRecyclingEnabled: boolean,
    maxBatchSize: number,
  ): RecyclingCandidate[] {
    if (!batchRecyclingEnabled) {
      // Only take the highest priority candidate
      return candidates.slice(0, 1);
    }

    return this.prioritizeCandidates(candidates, maxBatchSize);
  }
}
