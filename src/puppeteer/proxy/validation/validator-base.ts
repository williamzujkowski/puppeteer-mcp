/**
 * Base validator classes and interfaces
 * @module puppeteer/proxy/validation/validator-base
 * @nist cm-6 "Configuration settings"
 */

/**
 * Validation context for passing state between validators
 */
export interface ValidationContext<T> {
  config: T;
  errors: string[];
  warnings: string[];
  options: { checkConnectivity?: boolean };
}

/**
 * Validator interface for chain of responsibility pattern
 */
export interface Validator<T> {
  validate(context: ValidationContext<T>): Promise<void> | void;
}

/**
 * Base validator with chain of responsibility support
 */
export abstract class BaseValidator<T> implements Validator<T> {
  private nextValidator?: Validator<T>;

  setNext(validator: Validator<T>): Validator<T> {
    this.nextValidator = validator;
    return validator;
  }

  async validate(context: ValidationContext<T>): Promise<void> {
    await this.doValidate(context);
    if (this.nextValidator) {
      await this.nextValidator.validate(context);
    }
  }

  protected abstract doValidate(context: ValidationContext<T>): Promise<void> | void;
}