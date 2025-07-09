/**
 * Error classification, resolution, and context enrichment types
 * @module core/errors/resolution-types
 */

import { ErrorCategory } from './error-context.js';

/**
 * Error classification type
 */
export interface ErrorClassification {
  primary: ErrorCategory;
  secondary?: ErrorCategory;
  tags: string[];
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  technicalImpact: 'low' | 'medium' | 'high' | 'critical';
  userImpact: 'none' | 'single' | 'multiple' | 'system-wide';
  dataImpact: 'none' | 'read' | 'write' | 'corruption';
  securityImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error resolution type
 */
export interface ErrorResolution {
  id: string;
  errorId: string;
  method: 'automatic' | 'manual' | 'escalated';
  strategy: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  steps: Array<{
    order: number;
    description: string;
    startTime: Date;
    endTime: Date;
    success: boolean;
    details?: Record<string, unknown>;
  }>;
  outcome: {
    resolved: boolean;
    partiallyResolved: boolean;
    rootCause?: string;
    preventionMeasures?: string[];
    followUpRequired?: boolean;
  };
}

/**
 * Error context enrichment type
 */
export interface ErrorContextEnrichment {
  requestMetadata?: {
    clientVersion?: string;
    clientPlatform?: string;
    clientLocation?: string;
    networkInfo?: {
      type: string;
      speed: string;
      latency: number;
    };
  };
  userMetadata?: {
    roles: string[];
    permissions: string[];
    preferences: Record<string, unknown>;
    history: Array<{
      action: string;
      timestamp: Date;
    }>;
  };
  systemMetadata?: {
    loadAverage: number[];
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    diskUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    processInfo: {
      pid: number;
      ppid: number;
      uptime: number;
      version: string;
    };
  };
  businessMetadata?: {
    tenant?: string;
    organizationId?: string;
    feature?: string;
    experimentId?: string;
    abTestVariant?: string;
  };
}
