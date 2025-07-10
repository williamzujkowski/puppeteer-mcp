/**
 * OpenTelemetry sampling strategies
 * @module telemetry/sampling
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import {
  Sampler,
  SamplingDecision,
  SamplingResult,
  Context,
  Attributes,
  Link,
} from '@opentelemetry/api';
import {
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import type { TelemetryConfig } from './config.js';

/**
 * Adaptive sampler that adjusts sampling rate based on throughput
 */
export class AdaptiveSampler implements Sampler {
  private sampler: Sampler;
  private targetRate: number;
  private currentRate: number;
  private traceCount = 0;
  private sampleCount = 0;
  private lastReset = Date.now();
  private resetInterval = 60000; // 1 minute

  constructor(targetRate: number, initialRate: number = 0.1) {
    this.targetRate = targetRate;
    this.currentRate = initialRate;
    this.sampler = new TraceIdRatioBasedSampler(this.currentRate);
  }

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: number,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    this.updateStats();
    
    const result = this.sampler.shouldSample(
      context,
      traceId,
      spanName,
      spanKind,
      attributes,
    );
    
    this.traceCount++;
    if (result.decision === SamplingDecision.RECORD_AND_SAMPLED) {
      this.sampleCount++;
    }
    
    return result;
  }

  toString(): string {
    return `AdaptiveSampler{targetRate=${this.targetRate}, currentRate=${this.currentRate}}`;
  }

  private updateStats(): void {
    const now = Date.now();
    const elapsed = now - this.lastReset;
    
    if (elapsed >= this.resetInterval) {
      const actualRate = this.traceCount > 0 ? this.sampleCount / elapsed * 1000 : 0;
      
      // Adjust sampling rate to meet target
      if (actualRate > this.targetRate * 1.1) {
        // Reduce sampling if we're over target
        this.currentRate = Math.max(0.001, this.currentRate * 0.9);
      } else if (actualRate < this.targetRate * 0.9 && this.currentRate < 1) {
        // Increase sampling if we're under target
        this.currentRate = Math.min(1, this.currentRate * 1.1);
      }
      
      this.sampler = new TraceIdRatioBasedSampler(this.currentRate);
      this.traceCount = 0;
      this.sampleCount = 0;
      this.lastReset = now;
    }
  }
}

/**
 * Custom sampler that samples based on specific attributes
 */
export class AttributeBasedSampler implements Sampler {
  constructor(
    private baseSampler: Sampler,
    private attributeRules: Array<{
      attribute: string;
      value: string | RegExp;
      samplingRate: number;
    }>,
  ) {}

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: number,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    // Check attribute rules
    for (const rule of this.attributeRules) {
      const attrValue = attributes[rule.attribute];
      if (attrValue !== undefined) {
        const matches = rule.value instanceof RegExp
          ? rule.value.test(String(attrValue))
          : String(attrValue) === rule.value;
          
        if (matches) {
          const sampler = new TraceIdRatioBasedSampler(rule.samplingRate);
          return sampler.shouldSample(context, traceId, spanName, spanKind, attributes);
        }
      }
    }
    
    // Fall back to base sampler
    return this.baseSampler.shouldSample(context, traceId, spanName, spanKind, attributes);
  }

  toString(): string {
    return `AttributeBasedSampler{baseSampler=${this.baseSampler.toString()}}`;
  }
}

/**
 * Create sampler based on configuration
 */
export function createSampler(config: TelemetryConfig): Sampler {
  const { sampling, tracing } = config;
  
  switch (sampling.strategy) {
    case 'always_on':
      return new AlwaysOnSampler();
      
    case 'always_off':
      return new AlwaysOffSampler();
      
    case 'trace_id_ratio':
      return new TraceIdRatioBasedSampler(tracing.samplingRate);
      
    case 'parent_based':
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(tracing.samplingRate),
      });
      
    case 'adaptive':
      return new AdaptiveSampler(
        sampling.adaptiveTargetRate ?? 100,
        tracing.samplingRate,
      );
      
    default:
      return new TraceIdRatioBasedSampler(tracing.samplingRate);
  }
}

/**
 * Create an enhanced sampler with common attribute rules
 */
export function createEnhancedSampler(config: TelemetryConfig): Sampler {
  const baseSampler = createSampler(config);
  
  // Add common attribute-based rules
  return new AttributeBasedSampler(baseSampler, [
    // Always sample errors
    { attribute: 'error', value: 'true', samplingRate: 1.0 },
    { attribute: 'http.status_code', value: /^[45]\d\d$/, samplingRate: 1.0 },
    
    // Sample health checks at a lower rate
    { attribute: 'http.route', value: '/health', samplingRate: 0.01 },
    { attribute: 'http.route', value: '/metrics', samplingRate: 0.01 },
    
    // Sample specific operations at higher rates
    { attribute: 'operation.type', value: 'browser.launch', samplingRate: 1.0 },
    { attribute: 'operation.type', value: 'auth.login', samplingRate: 1.0 },
    { attribute: 'operation.type', value: 'security.event', samplingRate: 1.0 },
  ]);
}

/**
 * Priority-based sampler that always samples high-priority traces
 */
export class PriorityBasedSampler implements Sampler {
  constructor(
    private baseSampler: Sampler,
    private priorityAttribute: string = 'trace.priority',
  ) {}

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: number,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    const priority = attributes[this.priorityAttribute];
    
    // Always sample high priority traces
    if (priority === 'high' || priority === 1) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes,
        traceState: undefined,
      };
    }
    
    // Never sample low priority traces
    if (priority === 'low' || priority === 0) {
      return {
        decision: SamplingDecision.NOT_RECORD,
        attributes,
        traceState: undefined,
      };
    }
    
    // Use base sampler for normal priority
    return this.baseSampler.shouldSample(context, traceId, spanName, spanKind, attributes);
  }

  toString(): string {
    return `PriorityBasedSampler{baseSampler=${this.baseSampler.toString()}}`;
  }
}