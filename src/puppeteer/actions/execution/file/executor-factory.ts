/**
 * Factory for creating file operation executors
 * @module puppeteer/actions/execution/file/executor-factory
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { FileOperationExecutor } from './file-executor-types.js';
import { UploadExecutor } from './upload-executor.js';
import { DownloadExecutor } from './download-executor.js';
import { CookieExecutor } from './cookie-executor.js';
import { FileValidator } from './file-validator.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:executor-factory');

/**
 * Executor factory configuration
 */
export interface ExecutorFactoryConfig {
  /** File validator instance */
  validator?: FileValidator;
  /** Download timeout in milliseconds */
  downloadTimeout?: number;
  /** Custom executors */
  customExecutors?: Map<string, FileOperationExecutor>;
}

/**
 * Factory for creating file operation executors
 * @nist ac-3 "Access enforcement"
 */
export class ExecutorFactory {
  private readonly executors: Map<string, FileOperationExecutor>;
  private readonly validator: FileValidator;

  constructor(config?: ExecutorFactoryConfig) {
    this.validator = config?.validator ?? new FileValidator();
    this.executors = new Map<string, FileOperationExecutor>();

    // Initialize default executors
    this.initializeDefaultExecutors(config);

    // Add custom executors if provided
    if (config?.customExecutors) {
      for (const [type, executor] of config.customExecutors) {
        this.registerExecutor(type, executor);
      }
    }
  }

  /**
   * Initialize default executors
   * @param config - Factory configuration
   */
  private initializeDefaultExecutors(config?: ExecutorFactoryConfig): void {
    // Upload executor
    const uploadExecutor = new UploadExecutor(this.validator);
    this.executors.set(uploadExecutor.getSupportedType(), uploadExecutor);

    // Download executor
    const downloadExecutor = new DownloadExecutor(
      this.validator,
      config?.downloadTimeout,
    );
    this.executors.set(downloadExecutor.getSupportedType(), downloadExecutor);

    // Cookie executor
    const cookieExecutor = new CookieExecutor();
    this.executors.set(cookieExecutor.getSupportedType(), cookieExecutor);

    logger.debug('Default executors initialized', {
      types: Array.from(this.executors.keys()),
    });
  }

  /**
   * Get executor for action type
   * @param actionType - Action type
   * @returns Executor instance or undefined
   */
  getExecutor(actionType: string): FileOperationExecutor | undefined {
    const executor = this.executors.get(actionType);
    
    if (!executor) {
      logger.warn('No executor found for action type', { actionType });
    }

    return executor;
  }

  /**
   * Create executor for action type
   * @param actionType - Action type
   * @returns Executor instance
   * @throws Error if no executor found
   */
  createExecutor(actionType: string): FileOperationExecutor {
    const executor = this.getExecutor(actionType);
    
    if (!executor) {
      throw new Error(`No executor registered for action type: ${actionType}`);
    }

    return executor;
  }

  /**
   * Register custom executor
   * @param actionType - Action type
   * @param executor - Executor instance
   */
  registerExecutor(actionType: string, executor: FileOperationExecutor): void {
    if (this.executors.has(actionType)) {
      logger.warn('Overriding existing executor', { actionType });
    }

    this.executors.set(actionType, executor);
    
    logger.info('Executor registered', { 
      actionType,
      executorType: executor.constructor.name,
    });
  }

  /**
   * Unregister executor
   * @param actionType - Action type
   * @returns True if executor was removed
   */
  unregisterExecutor(actionType: string): boolean {
    const removed = this.executors.delete(actionType);
    
    if (removed) {
      logger.info('Executor unregistered', { actionType });
    }

    return removed;
  }

  /**
   * Get all supported action types
   * @returns Array of action types
   */
  getSupportedTypes(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isSupported(actionType: string): boolean {
    return this.executors.has(actionType);
  }

  /**
   * Get validator instance
   * @returns File validator
   */
  getValidator(): FileValidator {
    return this.validator;
  }

  /**
   * Create a new factory with custom configuration
   * @param config - Factory configuration
   * @returns New factory instance
   */
  static create(config?: ExecutorFactoryConfig): ExecutorFactory {
    return new ExecutorFactory(config);
  }

  /**
   * Create a factory with only specific executors
   * @param types - Action types to include
   * @param config - Factory configuration
   * @returns New factory instance
   */
  static createWithTypes(
    types: string[],
    config?: ExecutorFactoryConfig,
  ): ExecutorFactory {
    const factory = new ExecutorFactory(config);
    
    // Remove executors not in the types list
    const supportedTypes = factory.getSupportedTypes();
    for (const type of supportedTypes) {
      if (!types.includes(type)) {
        factory.unregisterExecutor(type);
      }
    }

    return factory;
  }
}