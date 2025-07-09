/**
 * Authentication and authorization error factories
 * @module core/errors/factories/auth-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { AuthenticationDomainError, AuthorizationDomainError } from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Authentication error factory methods
 */
export const authErrors = {
  invalidCredentials: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Invalid credentials provided',
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      technicalDetails: { reason: 'credentials_mismatch' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  tokenExpired: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Authentication token has expired',
      errorCode: 'AUTH_TOKEN_EXPIRED',
      technicalDetails: { reason: 'token_expired' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  tokenInvalid: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Invalid authentication token',
      errorCode: 'AUTH_TOKEN_INVALID',
      technicalDetails: { reason: 'token_invalid' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  missingToken: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Authentication token is required',
      errorCode: 'AUTH_TOKEN_MISSING',
      technicalDetails: { reason: 'token_missing' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  accountLocked: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Account is locked due to too many failed attempts',
      errorCode: 'AUTH_ACCOUNT_LOCKED',
      technicalDetails: { reason: 'account_locked' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  accountDisabled: (
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthenticationDomainError =>
    new AuthenticationDomainError({
      message: 'Account is disabled',
      errorCode: 'AUTH_ACCOUNT_DISABLED',
      technicalDetails: { reason: 'account_disabled' },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),
};

/**
 * Authorization error factory methods
 */
export const authorizationErrors = {
  insufficientPermissions: (
    requiredPermissions: string[],
    userPermissions: string[],
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthorizationDomainError =>
    new AuthorizationDomainError({
      message: 'Insufficient permissions to perform this action',
      errorCode: 'AUTH_INSUFFICIENT_PERMISSIONS',
      requiredPermissions,
      userPermissions,
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  roleRequired: (
    requiredRole: string,
    userRole: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthorizationDomainError =>
    new AuthorizationDomainError({
      message: `Role '${requiredRole}' is required for this action`,
      errorCode: 'AUTH_ROLE_REQUIRED',
      requiredPermissions: [requiredRole],
      userPermissions: [userRole],
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  resourceAccessDenied: (
    resource: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthorizationDomainError =>
    new AuthorizationDomainError({
      message: `Access denied to resource: ${resource}`,
      errorCode: 'AUTH_RESOURCE_ACCESS_DENIED',
      requiredPermissions: ['resource_access'],
      userPermissions: [],
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  operationForbidden: (
    operation: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): AuthorizationDomainError =>
    new AuthorizationDomainError({
      message: `Operation '${operation}' is forbidden`,
      errorCode: 'AUTH_OPERATION_FORBIDDEN',
      requiredPermissions: [operation],
      userPermissions: [],
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),
};
