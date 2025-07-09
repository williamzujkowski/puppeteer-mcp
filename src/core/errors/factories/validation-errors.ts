/**
 * Validation error factories
 * @module core/errors/factories/validation-errors
 * @nist si-11 "Error handling"
 */

import { ValidationDomainError } from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Parameters for validation errors with format
 */
interface FormatValidationParams {
  field: string;
  value: unknown;
  expectedFormat: string;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Parameters for range validation errors
 */
interface RangeValidationParams {
  field: string;
  value: unknown;
  min: number;
  max: number;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Parameters for enum validation errors
 */
interface EnumValidationParams {
  field: string;
  value: unknown;
  validValues: unknown[];
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Parameters for length validation errors
 */
interface LengthValidationParams {
  field: string;
  value: string;
  limit: number;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Validation error factory methods
 */
export const validationErrors = {
  required: (
    field: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ValidationDomainError =>
    new ValidationDomainError({
      message: `Field '${field}' is required`,
      errorCode: 'VALIDATION_REQUIRED',
      validationErrors: [{ field, message: `Field '${field}' is required`, code: 'required' }],
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  invalidFormat: (params: FormatValidationParams): ValidationDomainError =>
    new ValidationDomainError({
      message: `Invalid format for field '${params.field}'`,
      errorCode: 'VALIDATION_INVALID_FORMAT',
      validationErrors: [
        {
          field: params.field,
          message: `Expected format: ${params.expectedFormat}`,
          code: 'invalid_format',
        },
      ],
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      userId: params.context?.userId ?? params.defaultContext?.userId,
    }),

  outOfRange: (params: RangeValidationParams): ValidationDomainError =>
    new ValidationDomainError({
      message: `Field '${params.field}' is out of range`,
      errorCode: 'VALIDATION_OUT_OF_RANGE',
      validationErrors: [
        {
          field: params.field,
          message: `Value must be between ${params.min} and ${params.max}`,
          code: 'out_of_range',
        },
      ],
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      userId: params.context?.userId ?? params.defaultContext?.userId,
    }),

  invalidEnum: (params: EnumValidationParams): ValidationDomainError =>
    new ValidationDomainError({
      message: `Invalid value for field '${params.field}'`,
      errorCode: 'VALIDATION_INVALID_ENUM',
      validationErrors: [
        {
          field: params.field,
          message: `Value must be one of: ${params.validValues.join(', ')}`,
          code: 'invalid_enum',
        },
      ],
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      userId: params.context?.userId ?? params.defaultContext?.userId,
    }),

  tooLong: (params: LengthValidationParams): ValidationDomainError =>
    new ValidationDomainError({
      message: `Field '${params.field}' is too long`,
      errorCode: 'VALIDATION_TOO_LONG',
      validationErrors: [
        {
          field: params.field,
          message: `Maximum length is ${params.limit} characters`,
          code: 'too_long',
        },
      ],
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      userId: params.context?.userId ?? params.defaultContext?.userId,
    }),

  tooShort: (params: LengthValidationParams): ValidationDomainError =>
    new ValidationDomainError({
      message: `Field '${params.field}' is too short`,
      errorCode: 'VALIDATION_TOO_SHORT',
      validationErrors: [
        {
          field: params.field,
          message: `Minimum length is ${params.limit} characters`,
          code: 'too_short',
        },
      ],
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
      userId: params.context?.userId ?? params.defaultContext?.userId,
    }),
};
