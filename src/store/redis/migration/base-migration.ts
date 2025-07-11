/**
 * Base migration class using Template Method pattern
 * @module store/redis/migration/base-migration
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { StoreLogger } from '../types.js';
import type { MigrationContext, MigrationResult } from './types.js';

/**
 * Abstract base class for migration operations
 * Implements Template Method pattern for consistent migration workflow
 */
export abstract class BaseMigration<TOptions, TResult extends MigrationResult> {
  protected logger: StoreLogger;
  protected context?: MigrationContext;

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Template method for executing migration
   */
  async execute(options: TOptions): Promise<TResult> {
    const startTime = new Date();
    this.context = this.createContext(options, startTime);

    try {
      // Step 1: Pre-migration validation
      this.logger.info({ operation: this.context.operation }, 'Starting migration operation');
      const validationResult = await this.validate(options);
      if (!validationResult.valid) {
        return this.createErrorResult(validationResult.errors);
      }

      // Step 2: Pre-migration hook
      await this.preMigration(options);

      // Step 3: Execute migration
      const result = await this.performMigration(options);

      // Step 4: Post-migration hook
      await this.postMigration(options, result);

      // Step 5: Log completion
      const duration = Date.now() - startTime.getTime();
      this.logger.info(
        {
          operation: this.context.operation,
          duration,
          success: result.success,
        },
        'Migration operation completed',
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        {
          operation: this.context?.operation,
          error,
        },
        'Migration operation failed',
      );

      return this.createErrorResult([errorMessage]);
    }
  }

  /**
   * Create migration context
   */
  protected abstract createContext(options: TOptions, startTime: Date): MigrationContext;

  /**
   * Validate migration prerequisites
   */
  protected abstract validate(options: TOptions): Promise<{ valid: boolean; errors: string[] }>;

  /**
   * Pre-migration hook for setup
   */
  protected abstract preMigration(options: TOptions): Promise<void>;

  /**
   * Perform the actual migration
   */
  protected abstract performMigration(options: TOptions): Promise<TResult>;

  /**
   * Post-migration hook for cleanup
   */
  protected abstract postMigration(options: TOptions, result: TResult): Promise<void>;

  /**
   * Create error result
   */
  protected abstract createErrorResult(errors: string[]): TResult;

  /**
   * Helper method to batch process items
   */
  protected async processBatch<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
    progressCallback?: (processed: number, total: number) => void,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);

      if (progressCallback && i % (batchSize * 10) === 0) {
        progressCallback(i + batch.length, items.length);
      }
    }
  }
}
