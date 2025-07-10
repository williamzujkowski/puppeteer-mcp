/**
 * Base wait strategy abstract class
 * @module puppeteer/actions/execution/wait/base-strategy
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import type { WaitCondition, WaitConditionConfig } from '../types.js';
import type { WaitStrategy, WaitResult } from './types.js';
import { createLogger } from '../../../../utils/logger.js';
import { sanitizeSelector } from '../../validation.js';

/**
 * Abstract base class for wait strategies
 * @nist ac-3 "Access enforcement"
 */
export abstract class BaseWaitStrategy implements WaitStrategy {
  protected readonly logger;

  constructor(protected readonly type: WaitCondition) {
    this.logger = createLogger(`puppeteer:wait:${type}`);
  }

  /**
   * Get the wait type this strategy handles
   */
  getType(): WaitCondition {
    return this.type;
  }

  /**
   * Execute the wait strategy
   */
  async execute(
    page: Page,
    config: WaitConditionConfig,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // Validate configuration
      if (!this.validate(config)) {
        throw new Error(`Invalid configuration for ${this.type} wait strategy`);
      }

      this.logger.debug('Executing wait strategy', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        type: this.type,
        config: this.sanitizeConfig(config),
      });

      // Execute the specific wait implementation
      const result = await this.executeWait(page, config);
      const duration = Date.now() - startTime;

      this.logger.info('Wait strategy completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        type: this.type,
        success: result.success,
        condition: result.condition,
        duration,
      });

      return this.createSuccessResult(result, config, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Wait strategy failed';

      this.logger.error('Wait strategy failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        type: this.type,
        error: errorMessage,
        duration,
      });

      return this.createErrorResult(errorMessage, config, duration);
    }
  }

  /**
   * Execute the specific wait implementation
   * @param page - Page instance
   * @param config - Wait configuration
   * @returns Wait result
   */
  protected abstract executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult>;

  /**
   * Validate the configuration for this strategy
   * @param config - Wait configuration
   * @returns true if valid
   */
  abstract validate(config: WaitConditionConfig): boolean;

  /**
   * Sanitize configuration for logging
   * @param config - Wait configuration
   * @returns Sanitized configuration
   */
  protected sanitizeConfig(config: WaitConditionConfig): Record<string, unknown> {
    return {
      type: config.type,
      selector: config.selector ? sanitizeSelector(config.selector) : undefined,
      duration: config.duration,
      visible: config.visible,
      hidden: config.hidden,
      hasFunction: !!config.functionToEvaluate,
    };
  }

  /**
   * Create success result
   * @param result - Wait result
   * @param config - Wait configuration
   * @param duration - Execution duration
   * @returns Action result
   */
  protected createSuccessResult(
    result: WaitResult,
    config: WaitConditionConfig,
    duration: number,
  ): ActionResult {
    return {
      success: true,
      actionType: 'wait',
      data: {
        waitType: this.type,
        condition: result.condition,
        actualDuration: result.actualDuration,
        ...this.getSuccessData(config, result),
      },
      duration,
      timestamp: new Date(),
      metadata: this.getMetadata(config),
    };
  }

  /**
   * Create error result
   * @param error - Error message
   * @param config - Wait configuration
   * @param duration - Execution duration
   * @returns Action result
   */
  protected createErrorResult(
    error: string,
    config: WaitConditionConfig,
    duration: number,
  ): ActionResult {
    return {
      success: false,
      actionType: 'wait',
      error,
      duration,
      timestamp: new Date(),
      metadata: {
        waitType: this.type,
        ...this.getMetadata(config),
      },
    };
  }

  /**
   * Get additional success data for result
   * @param config - Wait configuration
   * @param result - Wait result
   * @returns Additional data
   */
  protected getSuccessData(
    config: WaitConditionConfig,
    result: WaitResult,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    
    if (config.selector) {
      data.selector = sanitizeSelector(config.selector);
    }
    
    if (result.details) {
      Object.assign(data, result.details);
    }
    
    return data;
  }

  /**
   * Get metadata for result
   * @param config - Wait configuration
   * @returns Metadata
   */
  protected getMetadata(config: WaitConditionConfig): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    
    if (config.selector) {
      metadata.originalSelector = config.selector;
    }
    
    if (config.duration) {
      metadata.requestedDuration = config.duration;
    }
    
    return metadata;
  }
}