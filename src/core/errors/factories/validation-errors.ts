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
    defaultContext?: RequestContext
  ): ValidationDomainError =>
    new ValidationDomainError(
      `Field '${field}' is required`,
      'VALIDATION_REQUIRED',
      { field, constraint: 'required' },
      context?.requestId ?? defaultContext?.requestId
    ),

  invalidFormat: (params: FormatValidationParams): ValidationDomainError =>
    new ValidationDomainError(
      `Invalid format for field '${params.field}'`,
      'VALIDATION_INVALID_FORMAT',
      { field: params.field, value: params.value, expectedType: params.expectedFormat, constraint: 'format' },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),

  outOfRange: (params: RangeValidationParams): ValidationDomainError =>
    new ValidationDomainError(
      `Field '${params.field}' is out of range`,
      'VALIDATION_OUT_OF_RANGE',
      { field: params.field, value: params.value, constraint: `${params.min}-${params.max}` },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),

  invalidEnum: (params: EnumValidationParams): ValidationDomainError =>
    new ValidationDomainError(
      `Invalid value for field '${params.field}'`,
      'VALIDATION_INVALID_ENUM',
      { field: params.field, value: params.value, constraint: 'enum', validValues: params.validValues },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),

  tooLong: (params: LengthValidationParams): ValidationDomainError =>
    new ValidationDomainError(
      `Field '${params.field}' is too long`,
      'VALIDATION_TOO_LONG',
      { field: params.field, value: params.value.length, constraint: `max_length_${params.limit}` },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),

  tooShort: (params: LengthValidationParams): ValidationDomainError =>
    new ValidationDomainError(
      `Field '${params.field}' is too short`,
      'VALIDATION_TOO_SHORT',
      { field: params.field, value: params.value.length, constraint: `min_length_${params.limit}` },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),
};