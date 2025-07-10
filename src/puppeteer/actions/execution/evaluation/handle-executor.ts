/**
 * Handle execution strategy for page.evaluateHandle operations
 * @module puppeteer/actions/execution/evaluation/handle-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 * @nist sc-18 "Mobile code"
 */

import type { Page, JSHandle } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type {
  BaseEvaluationStrategy,
  CodeEvaluationConfig,
  SecurityValidationResult,
  EvaluationMetrics,
} from './types.js';
import { EVALUATION_TIMEOUTS } from './types.js';
import { createSecurityValidator } from './security-validator.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:handle-executor');

/**
 * Strategy for executing JavaScript handle evaluation
 * @nist ac-3 "Access enforcement"
 * @nist sc-18 "Mobile code"
 */
export class HandleExecutionStrategy implements BaseEvaluationStrategy {
  private readonly securityValidator = createSecurityValidator();
  private readonly activeHandles = new Map<string, JSHandle>();

  /**
   * Execute JavaScript handle evaluation
   * @param config - Code evaluation configuration
   * @param page - Puppeteer page instance
   * @param context - Action execution context
   * @returns Promise resolving to action result
   * @nist sc-18 "Mobile code"
   */
  async execute(
    config: CodeEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const metrics = this.createMetrics(config);
    
    try {
      // Validate configuration first
      const validationResult = this.validateConfig(config);
      if (!validationResult.isValid) {
        return this.createErrorResult(
          'evaluateHandle',
          validationResult.error ?? 'Handle validation failed',
          metrics,
          context,
        );
      }

      // Execute handle evaluation
      const handle = await this.executeHandleEvaluation(config, page, context);
      
      // Process successful result
      return await this.processSuccessfulHandle(handle, config, metrics, context);

    } catch (error) {
      return this.handleExecutionError(error, metrics, context);
    }
  }

  /**
   * Execute handle evaluation with timeout management
   * @param config - Evaluation configuration
   * @param page - Puppeteer page instance
   * @param context - Action context
   * @returns Promise resolving to JSHandle
   */
  private async executeHandleEvaluation(
    config: CodeEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<JSHandle> {
    logger.debug('Executing handle evaluation', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      codeLength: config.functionToEvaluate.length,
      argsCount: config.args?.length ?? 0,
    });

    const timeout = config.timeout ?? EVALUATION_TIMEOUTS.HANDLE_OPERATION;
    const originalTimeout = page.getDefaultTimeout();
    
    try {
      page.setDefaultTimeout(timeout);
      
      return await page.evaluateHandle(
        config.functionToEvaluate,
        ...(config.args ?? []),
      );
    } finally {
      page.setDefaultTimeout(originalTimeout);
    }
  }

  /**
   * Process successful handle evaluation result
   * @param handle - JSHandle from evaluation
   * @param config - Original configuration
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Promise resolving to action result
   */
  private async processSuccessfulHandle(
    handle: JSHandle,
    config: CodeEvaluationConfig,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): Promise<ActionResult> {
    try {
      const handleInfo = await this.analyzeHandle(handle);
      const handleId = this.generateHandleId(context);
      this.activeHandles.set(handleId, handle);

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;

      logger.info('Handle evaluation completed successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        duration: metrics.duration,
        handleType: handleInfo.type,
        isElement: handleInfo.isElement,
        handleId,
      });

      return {
        success: true,
        actionType: 'evaluateHandle',
        data: {
          handleId,
          handleType: handleInfo.type,
          isElement: handleInfo.isElement,
          isArray: handleInfo.isArray,
          elementTag: handleInfo.elementTag,
          argsCount: config.args?.length ?? 0,
          codeLength: config.functionToEvaluate.length,
        },
        duration: metrics.duration,
        timestamp: new Date(),
        metadata: {
          functionLength: config.functionToEvaluate.length,
          hasArgs: (config.args?.length ?? 0) > 0,
          executionTime: metrics.duration,
          handleInfo,
        },
      };
    } catch (error) {
      // Cleanup handle on processing error
      await this.safeDisposeHandle(handle, context.sessionId);
      throw error;
    }
  }

  /**
   * Handle execution error with cleanup
   * @param error - Error that occurred
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Error action result
   */
  private handleExecutionError(
    error: unknown,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): ActionResult {
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.success = false;

    const errorMessage = error instanceof Error ? error.message : 'Handle evaluation failed';
    
    logger.error('Handle evaluation failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration: metrics.duration,
    });

    return this.createErrorResult('evaluateHandle', errorMessage, metrics, context);
  }

  /**
   * Safely dispose of a handle with error handling
   * @param handle - Handle to dispose
   * @param sessionId - Session ID for logging
   */
  private async safeDisposeHandle(handle: JSHandle, sessionId: string): Promise<void> {
    try {
      await handle.dispose();
    } catch (disposeError) {
      logger.warn('Failed to dispose handle after error', {
        sessionId,
        error: disposeError instanceof Error ? disposeError.message : String(disposeError),
      });
    }
  }

  /**
   * Validate handle evaluation configuration
   * @param config - Configuration to validate
   * @returns Security validation result
   * @nist si-10 "Information input validation"
   */
  validateConfig(config: CodeEvaluationConfig): SecurityValidationResult {
    // Use the same validation as code execution
    return this.securityValidator.validateJavaScript(config.functionToEvaluate);
  }

  /**
   * Get supported evaluation types
   * @returns Array of supported types
   */
  getSupportedTypes(): string[] {
    return ['evaluateHandle', 'handle'];
  }

  /**
   * Analyze a JSHandle to extract useful information
   * @param handle - JSHandle to analyze
   * @returns Handle information object
   */
  private async analyzeHandle(handle: JSHandle): Promise<{
    type: string;
    isElement: boolean;
    isArray: boolean;
    elementTag?: string;
    properties?: string[];
  }> {
    try {
      // Get basic type information
      const type = await handle.evaluate((obj: unknown) => typeof obj);
      
      // Check if it's an Element
      const isElement = await handle.evaluate((obj: unknown) => {
        return typeof obj === 'object' && obj !== null && 'nodeType' in obj && 
               Object.prototype.hasOwnProperty.call(obj, 'nodeType') &&
               (obj as { nodeType: unknown }).nodeType === 1;
      }).catch(() => false);

      // Check if it's an Array
      const isArray = await handle.evaluate((obj: unknown) => Array.isArray(obj)).catch(() => false);

      let elementTag: string | undefined;
      if (isElement) {
        elementTag = await handle.evaluate((el: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return el instanceof Element ? el.tagName.toLowerCase() : undefined;
        }).catch(() => undefined);
      }

      // Get property names (limited for security)
      const properties = await this.getHandleProperties(handle);

      return {
        type,
        isElement,
        isArray,
        elementTag,
        properties,
      };
    } catch (error) {
      logger.warn('Failed to analyze handle', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        type: 'unknown',
        isElement: false,
        isArray: false,
      };
    }
  }

  /**
   * Get property names from a handle (limited for security)
   * @param handle - JSHandle to inspect
   * @returns Array of property names
   */
  private async getHandleProperties(handle: JSHandle): Promise<string[]> {
    try {
      // Only get enumerable properties for security
      const properties = await handle.evaluate((obj: unknown) => {
        if (obj === null || typeof obj !== 'object') {
          return [];
        }
        
        // Limit to 20 properties for performance and security
        return Object.keys(obj).slice(0, 20);
      });

      return Array.isArray(properties) ? properties : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate unique handle ID
   * @param context - Action context
   * @returns Unique handle identifier
   */
  private generateHandleId(context: ActionContext): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `handle_${context.sessionId}_${timestamp}_${random}`;
  }

  /**
   * Cleanup handle by ID
   * @param handleId - Handle identifier to cleanup
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupHandle(handleId: string): Promise<void> {
    const handle = this.activeHandles.get(handleId);
    if (handle) {
      try {
        await handle.dispose();
        this.activeHandles.delete(handleId);
        logger.debug('Handle cleaned up successfully', { handleId });
      } catch (error) {
        logger.warn('Failed to cleanup handle', {
          handleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Cleanup all handles for a session
   * @param sessionId - Session ID to cleanup handles for
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupSessionHandles(sessionId: string): Promise<void> {
    const sessionHandles = Array.from(this.activeHandles.entries())
      .filter(([handleId, _]) => handleId.includes(sessionId));

    const cleanupPromises = sessionHandles.map(async ([handleId, handle]) => {
      try {
        await handle.dispose();
        this.activeHandles.delete(handleId);
      } catch (error) {
        logger.warn('Failed to cleanup session handle', {
          sessionId,
          handleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(cleanupPromises);
    logger.debug('Session handles cleaned up', {
      sessionId,
      cleanedCount: sessionHandles.length,
    });
  }

  /**
   * Get active handle count for monitoring
   * @returns Number of active handles
   */
  getActiveHandleCount(): number {
    return this.activeHandles.size;
  }

  /**
   * Create metrics object for tracking
   * @param config - Configuration being executed
   * @returns Metrics object
   */
  private createMetrics(config: CodeEvaluationConfig): EvaluationMetrics {
    return {
      startTime: Date.now(),
      codeSize: config.functionToEvaluate.length,
      argumentCount: config.args?.length ?? 0,
      success: false,
    };
  }

  /**
   * Create standardized error result
   * @param actionType - Type of action that failed
   * @param errorMessage - Error message
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Error action result
   */
  private createErrorResult(
    actionType: string,
    errorMessage: string,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): ActionResult {
    return {
      success: false,
      actionType,
      error: errorMessage,
      duration: metrics.duration ?? (Date.now() - metrics.startTime),
      timestamp: new Date(),
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        codeSize: metrics.codeSize,
        argumentCount: metrics.argumentCount,
      },
    };
  }
}

/**
 * Create a new handle execution strategy
 * @returns Handle execution strategy instance
 * @nist ac-3 "Access enforcement"
 */
export function createHandleExecutionStrategy(): HandleExecutionStrategy {
  return new HandleExecutionStrategy();
}