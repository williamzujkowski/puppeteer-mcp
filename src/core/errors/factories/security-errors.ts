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
    defaultContext?: RequestContext
  ): SecurityDomainError =>
    new SecurityDomainError(
      'Suspicious activity detected',
      'SECURITY_SUSPICIOUS_ACTIVITY',
      { threatType, sourceIp, riskLevel: 'high' },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  xssAttempt: (
    input: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): SecurityDomainError =>
    new SecurityDomainError(
      'XSS attempt detected',
      'SECURITY_XSS_ATTEMPT',
      { attackVector: 'xss', sourceIp: context?.ipAddress, input },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  sqlInjection: (
    input: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): SecurityDomainError =>
    new SecurityDomainError(
      'SQL injection attempt detected',
      'SECURITY_SQL_INJECTION',
      { attackVector: 'sql_injection', sourceIp: context?.ipAddress, input },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),
};

/**
 * Performance error factory methods
 */
export const performanceErrors = {
  slowOperation: (params: SlowOperationParams): PerformanceDomainError =>
    new PerformanceDomainError(
      `Operation exceeded performance threshold: ${params.operation}`,
      'PERFORMANCE_SLOW_OPERATION',
      { operation: params.operation, duration: params.duration, threshold: params.threshold },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),

  memoryLeak: (
    component: string,
    memoryUsage: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): PerformanceDomainError =>
    new PerformanceDomainError(
      `Memory leak detected: ${component}`,
      'PERFORMANCE_MEMORY_LEAK',
      { operation: 'memory_monitoring', memoryUsage },
      context?.requestId ?? defaultContext?.requestId
    ),
};

/**
 * Business logic error factory methods
 */
export const businessLogicErrors = {
  ruleViolation: (
    rule: string,
    details: Record<string, unknown>,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BusinessLogicDomainError =>
    new BusinessLogicDomainError(
      `Business rule violation: ${rule}`,
      'BUSINESS_RULE_VIOLATION',
      { rule, violationType: 'rule_violation', contextData: details },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),

  workflowError: (
    workflow: string,
    step: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): BusinessLogicDomainError =>
    new BusinessLogicDomainError(
      `Workflow error in ${workflow} at step ${step}`,
      'BUSINESS_WORKFLOW_ERROR',
      { rule: workflow, violationType: 'workflow_error', contextData: { step } },
      context?.requestId ?? defaultContext?.requestId,
      context?.userId ?? defaultContext?.userId
    ),
};