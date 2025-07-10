/**
 * Injection execution strategy for script and CSS injection operations
 * @module puppeteer/actions/execution/evaluation/injection-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 * @nist sc-18 "Mobile code"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type {
  BaseEvaluationStrategy,
  InjectionConfig,
  SecurityValidationResult,
  EvaluationMetrics,
} from './types.js';
import { EVALUATION_TIMEOUTS } from './types.js';
import { createSecurityValidator } from './security-validator.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:injection-executor');

/**
 * Strategy for executing content injection (scripts and CSS)
 * @nist ac-3 "Access enforcement"
 * @nist sc-18 "Mobile code"
 */
export class InjectionExecutionStrategy implements BaseEvaluationStrategy {
  private readonly securityValidator = createSecurityValidator();

  /**
   * Execute content injection
   * @param config - Injection configuration
   * @param page - Puppeteer page instance
   * @param context - Action execution context
   * @returns Promise resolving to action result
   * @nist sc-18 "Mobile code"
   */
  async execute(
    config: InjectionConfig,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const metrics = this.createMetrics(config);
    
    try {
      logger.debug('Executing content injection', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        contentLength: config.content.length,
        injectionType: config.type,
      });

      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.isValid) {
        return this.createErrorResult(
          `inject${config.type.charAt(0).toUpperCase() + config.type.slice(1)}`,
          validationResult.error ?? 'Content validation failed',
          metrics,
          context,
        );
      }

      // Check if content needs preprocessing
      let processedContent = config.content;
      if (this.shouldPreprocessContent(config.content, config.type)) {
        processedContent = this.preprocessContent(config.content, config.type);
      }
      
      // Setup timeout
      const timeout = this.getTimeoutForType(config.type);
      const originalTimeout = page.getDefaultTimeout();
      
      let injectionResult: { url?: string } | undefined;
      try {
        page.setDefaultTimeout(timeout);
        
        // Execute injection based on type
        if (config.type === 'script') {
          injectionResult = await this.injectScript(processedContent, page);
        } else if (config.type === 'css') {
          injectionResult = await this.injectCSS(processedContent, page);
        } else {
          throw new Error(`Unsupported injection type: ${String(config.type)}`);
        }
      } finally {
        // Always restore original timeout
        page.setDefaultTimeout(originalTimeout);
      }
      
      // Validate injection result
      if (!this.validateInjectionResult(injectionResult || {}, config.type)) {
        logger.warn('Injection result validation failed', {
          sessionId: context.sessionId,
          injectionType: config.type,
        });
      }

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;

      const actionType = `inject${config.type.charAt(0).toUpperCase()}${config.type.slice(1)}` as const;

      logger.info('Content injection completed successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        duration: metrics.duration,
        injectionType: config.type,
        contentLength: config.content.length,
      });

      return {
        success: true,
        actionType,
        data: {
          injectionType: config.type,
          contentLength: config.content.length,
          injected: true,
          url: injectionResult?.url,
        },
        duration: metrics.duration,
        timestamp: new Date(),
        metadata: {
          contentLength: config.content.length,
          injectionType: config.type,
          executionTime: metrics.duration,
        },
      };

    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = false;

      const errorMessage = error instanceof Error ? error.message : 'Content injection failed';
      const actionType = `inject${config.type.charAt(0).toUpperCase()}${config.type.slice(1)}` as const;
      
      logger.error('Content injection failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration: metrics.duration,
        injectionType: config.type,
      });

      return this.createErrorResult(actionType, errorMessage, metrics, context);
    }
  }

  /**
   * Validate injection configuration
   * @param config - Configuration to validate
   * @returns Security validation result
   * @nist si-10 "Information input validation"
   */
  validateConfig(config: InjectionConfig): SecurityValidationResult {
    // Validate based on content type
    if (config.type === 'script') {
      return this.securityValidator.validateJavaScript(config.content);
    } else if (config.type === 'css') {
      return this.securityValidator.validateCSS(config.content);
    } else {
      return {
        isValid: false,
        error: `Unsupported injection type: ${String(config.type)}`,
        issues: [{
          type: 'dangerous_pattern',
          message: `Invalid injection type: ${String(config.type)}`,
          severity: 'high',
        }],
      };
    }
  }

  /**
   * Get supported evaluation types
   * @returns Array of supported types
   */
  getSupportedTypes(): string[] {
    return ['injectScript', 'injectCSS', 'inject'];
  }

  /**
   * Inject JavaScript code into the page
   * @param script - JavaScript code to inject
   * @param page - Puppeteer page instance
   * @returns Injection result with optional URL
   * @nist sc-18 "Mobile code"
   */
  private async injectScript(script: string, page: Page): Promise<{ url?: string }> {
    try {
      // Add script tag to the page
      const scriptHandle = await page.addScriptTag({ 
        content: script 
      });

      // Try to get the URL if available
      let url: string | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        url = await scriptHandle.evaluate((el: HTMLScriptElement) => el.src ?? undefined);
      } catch {
        // URL might not be available for inline scripts
        url = undefined;
      }

      // Dispose of the handle to avoid memory leaks
      await scriptHandle.dispose().catch(() => {
        // Ignore disposal errors
      });

      return { url };
    } catch (error) {
      logger.error('Failed to inject script', {
        error: error instanceof Error ? error.message : String(error),
        scriptLength: script.length,
      });
      throw error;
    }
  }

  /**
   * Inject CSS code into the page
   * @param css - CSS code to inject
   * @param page - Puppeteer page instance
   * @returns Injection result with optional URL
   * @nist sc-18 "Mobile code"
   */
  private async injectCSS(css: string, page: Page): Promise<{ url?: string }> {
    try {
      // Add style tag to the page
      const styleHandle = await page.addStyleTag({ 
        content: css 
      });

      // Try to get the URL if available
      let url: string | undefined;
      try {
        url = await styleHandle.evaluate((el: Element) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return el instanceof HTMLLinkElement ? el.href : undefined;
        });
      } catch {
        // URL might not be available for inline styles
        url = undefined;
      }

      // Dispose of the handle to avoid memory leaks
      await styleHandle.dispose().catch(() => {
        // Ignore disposal errors
      });

      return { url };
    } catch (error) {
      logger.error('Failed to inject CSS', {
        error: error instanceof Error ? error.message : String(error),
        cssLength: css.length,
      });
      throw error;
    }
  }

  /**
   * Get appropriate timeout for injection type
   * @param type - Injection type
   * @returns Timeout in milliseconds
   */
  private getTimeoutForType(type: string): number {
    switch (type) {
      case 'script':
        return EVALUATION_TIMEOUTS.SCRIPT_INJECTION;
      case 'css':
        return EVALUATION_TIMEOUTS.CSS_INJECTION;
      default:
        return EVALUATION_TIMEOUTS.DEFAULT;
    }
  }

  /**
   * Create metrics object for tracking
   * @param config - Configuration being executed
   * @returns Metrics object
   */
  private createMetrics(config: InjectionConfig): EvaluationMetrics {
    return {
      startTime: Date.now(),
      codeSize: config.content.length,
      argumentCount: 0, // Injection doesn't use arguments
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

  /**
   * Check if content should be preprocessed
   * @param content - Content to check
   * @param type - Content type
   * @returns True if preprocessing is needed
   */
  private shouldPreprocessContent(content: string, _type: string): boolean {
    // Check for templating or dynamic content that might need preprocessing
    const templatePatterns = [
      /\{\{.*\}\}/,  // Handlebars/Mustache
      /\$\{.*\}/,    // Template literals
      /@\w+/,       // Angular-style directives
    ];

    return templatePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Preprocess content before injection (if needed)
   * @param content - Content to preprocess
   * @param type - Content type
   * @returns Preprocessed content
   */
  private preprocessContent(content: string, _type: string): string {
    // For security, we don't actually process templates
    // Instead, we strip potentially dangerous template syntax
    let processed = content;

    // Remove template literals for security
    processed = processed.replace(/\$\{[^}]*\}/g, '""');
    
    // Remove other template syntax
    processed = processed.replace(/\{\{[^}]*\}\}/g, '""');
    processed = processed.replace(/@\w+[^;]*/g, '');

    return processed;
  }

  /**
   * Validate injection result
   * @param result - Result to validate
   * @param expectedType - Expected injection type
   * @returns True if result is valid
   */
  private validateInjectionResult(result: { url?: string }, _expectedType: string): boolean {
    // Basic validation of injection result
    if (typeof result !== 'object' || result === null) {
      return false;
    }

    // URL should be string if present
    if (result.url !== undefined && typeof result.url !== 'string') {
      return false;
    }

    return true;
  }
}

/**
 * Create a new injection execution strategy
 * @returns Injection execution strategy instance
 * @nist ac-3 "Access enforcement"
 */
export function createInjectionExecutionStrategy(): InjectionExecutionStrategy {
  return new InjectionExecutionStrategy();
}