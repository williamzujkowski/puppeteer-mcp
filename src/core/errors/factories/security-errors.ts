/**
 * Security and performance error factories
 * @module core/errors/factories/security-errors
 * @nist si-11 "Error handling"
 */

import {
  SecurityDomainError,
  PerformanceDomainError,
  BusinessLogicDomainError,
} from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Parameters for slow operation errors
 */
interface SlowOperationParams {
  operation: string;
  duration: number;
  threshold: number;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Security error factory methods
 */
export const securityErrors = {
  suspiciousActivity: (
    threatType: string,
    sourceIp: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): SecurityDomainError =>
    new SecurityDomainError({
      message: 'Suspicious activity detected',
      errorCode: 'SECURITY_SUSPICIOUS_ACTIVITY',
      securityInfo: {
        type: threatType,
        details: { sourceIp, riskLevel: 'high' },
        clientIp: sourceIp,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  xssAttempt: (
    input: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): SecurityDomainError =>
    new SecurityDomainError({
      message: 'XSS attempt detected',
      errorCode: 'SECURITY_XSS_ATTEMPT',
      securityInfo: {
        type: 'xss',
        details: { attackVector: 'xss', input },
        clientIp: context?.ipAddress,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  sqlInjection: (
    input: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): SecurityDomainError =>
    new SecurityDomainError({
      message: 'SQL injection attempt detected',
      errorCode: 'SECURITY_SQL_INJECTION',
      securityInfo: {
        type: 'sql_injection',
        details: { attackVector: 'sql_injection', input },
        clientIp: context?.ipAddress,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),
};

/**
 * Performance error factory methods
 */
export const performanceErrors = {
  slowOperation: (params: SlowOperationParams): PerformanceDomainError =>
    new PerformanceDomainError({
      message: `Operation exceeded performance threshold: ${params.operation}`,
      errorCode: 'PERFORMANCE_SLOW_OPERATION',
      performanceInfo: {
        operation: params.operation,
        duration: params.duration,
        threshold: params.threshold,
      },
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
    }),

  memoryLeak: (
    component: string,
    memoryUsage: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): PerformanceDomainError =>
    new PerformanceDomainError({
      message: `Memory leak detected: ${component}`,
      errorCode: 'PERFORMANCE_MEMORY_LEAK',
      performanceInfo: {
        operation: 'memory_monitoring',
        memoryUsage,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),
};

/**
 * Business logic error factory methods
 */
export const businessLogicErrors = {
  ruleViolation: (
    rule: string,
    details: Record<string, unknown>,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BusinessLogicDomainError =>
    new BusinessLogicDomainError({
      message: `Business rule violation: ${rule}`,
      errorCode: 'BUSINESS_RULE_VIOLATION',
      businessInfo: {
        rule,
        violationType: 'rule_violation',
        contextData: details,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  workflowError: (
    workflow: string,
    step: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): BusinessLogicDomainError =>
    new BusinessLogicDomainError({
      message: `Workflow error in ${workflow} at step ${step}`,
      errorCode: 'BUSINESS_WORKFLOW_ERROR',
      businessInfo: {
        rule: workflow,
        violationType: 'workflow_error',
        contextData: { step },
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),
};
