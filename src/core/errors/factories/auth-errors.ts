/**
 * Authentication and authorization error factories
 * @module core/errors/factories/auth-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import {
  AuthenticationDomainError,
  AuthorizationDomainError,
} from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Authentication error factory methods
 */
export const authErrors = {
  invalidCredentials: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Invalid credentials provided',
      'AUTH_INVALID_CREDENTIALS',
      { reason: 'credentials_mismatch' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  tokenExpired: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Authentication token has expired',
      'AUTH_TOKEN_EXPIRED',
      { reason: 'token_expired' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  tokenInvalid: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Invalid authentication token',
      'AUTH_TOKEN_INVALID',
      { reason: 'token_invalid' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  missingToken: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Authentication token is required',
      'AUTH_TOKEN_MISSING',
      { reason: 'token_missing' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  accountLocked: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Account is locked due to too many failed attempts',
      'AUTH_ACCOUNT_LOCKED',
      { reason: 'account_locked' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  accountDisabled: (context?: RequestContext, defaultContext?: RequestContext): AuthenticationDomainError =>
    new AuthenticationDomainError(
      'Account is disabled',
      'AUTH_ACCOUNT_DISABLED',
      { reason: 'account_disabled' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),
};

/**
 * Authorization error factory methods
 */
export const authorizationErrors = {
  insufficientPermissions: (
    requiredPermissions: string[],
    userPermissions: string[],
    context?: RequestContext,
    defaultContext?: RequestContext
  ): AuthorizationDomainError =>
    new AuthorizationDomainError(
      'Insufficient permissions to perform this action',
      'AUTH_INSUFFICIENT_PERMISSIONS',
      requiredPermissions,
      userPermissions,
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  roleRequired: (
    requiredRole: string,
    userRole: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): AuthorizationDomainError =>
    new AuthorizationDomainError(
      `Role '${requiredRole}' is required for this action`,
      'AUTH_ROLE_REQUIRED',
      [requiredRole],
      [userRole],
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  resourceAccessDenied: (
    resource: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): AuthorizationDomainError =>
    new AuthorizationDomainError(
      `Access denied to resource: ${resource}`,
      'AUTH_RESOURCE_ACCESS_DENIED',
      ['resource_access'],
      [],
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  operationForbidden: (
    operation: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): AuthorizationDomainError =>
    new AuthorizationDomainError(
      `Operation '${operation}' is forbidden`,
      'AUTH_OPERATION_FORBIDDEN',
      [operation],
      [],
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),
};