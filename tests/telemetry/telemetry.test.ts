/**
 * OpenTelemetry integration tests
 * @module tests/telemetry
 */

import { 
  initializeTelemetry, 
  shutdownTelemetry, 
  isTelemetryInitialized,
  getTracer,
  getMeter,
} from '../../src/telemetry/index.js';
import { getTelemetryConfig } from '../../src/telemetry/config.js';
import { checkTelemetryHealth } from '../../src/telemetry/health.js';
import { createEnhancedSampler } from '../../src/telemetry/sampling.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

describe('OpenTelemetry Integration', () => {
  beforeEach(async () => {
    // Ensure telemetry is shut down before each test
    if (isTelemetryInitialized()) {
      await shutdownTelemetry();
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (isTelemetryInitialized()) {
      await shutdownTelemetry();
    }
  });

  describe('Initialization', () => {
    it('should initialize telemetry successfully', async () => {
      await initializeTelemetry();
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await initializeTelemetry();
      await initializeTelemetry(); // Should not throw
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should create tracer instance', async () => {
      await initializeTelemetry();
      const tracer = getTracer('test');
      expect(tracer).toBeDefined();
    });

    it('should create meter instance', async () => {
      await initializeTelemetry();
      const meter = getMeter('test');
      expect(meter).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown telemetry successfully', async () => {
      await initializeTelemetry();
      await shutdownTelemetry();
      expect(isTelemetryInitialized()).toBe(false);
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      await initializeTelemetry();
      await shutdownTelemetry();
      await shutdownTelemetry(); // Should not throw
      expect(isTelemetryInitialized()).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status when initialized', async () => {
      await initializeTelemetry();
      const health = await checkTelemetryHealth();
      
      expect(health.initialized).toBe(true);
      expect(health.enabled).toBe(true);
      expect(['healthy', 'degraded']).toContain(health.status);
    });

    it('should report unhealthy status when not initialized', async () => {
      const config = getTelemetryConfig();
      if (!config.enabled) {
        return; // Skip test if telemetry is disabled
      }
      
      const health = await checkTelemetryHealth();
      expect(health.initialized).toBe(false);
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Tracing', () => {
    it('should create and end spans', async () => {
      await initializeTelemetry();
      const tracer = getTracer('test');
      
      const span = tracer.startSpan('test-span');
      expect(span).toBeDefined();
      expect(span.spanContext().traceId).toBeTruthy();
      expect(span.spanContext().spanId).toBeTruthy();
      
      span.setAttributes({
        'test.attribute': 'value',
        'test.number': 123,
      });
      
      span.addEvent('test-event', {
        'event.data': 'test',
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    it('should create nested spans', async () => {
      await initializeTelemetry();
      const tracer = getTracer('test');
      
      const parentSpan = tracer.startSpan('parent-span');
      const childSpan = tracer.startSpan('child-span', {
        parent: parentSpan,
      });
      
      expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId);
      expect(childSpan.spanContext().spanId).not.toBe(parentSpan.spanContext().spanId);
      
      childSpan.end();
      parentSpan.end();
    });
  });

  describe('Metrics', () => {
    it('should create counter metric', async () => {
      await initializeTelemetry();
      const meter = getMeter('test');
      
      const counter = meter.createCounter('test_counter', {
        description: 'Test counter metric',
      });
      
      counter.add(1, { label: 'test' });
      counter.add(5, { label: 'test' });
    });

    it('should create histogram metric', async () => {
      await initializeTelemetry();
      const meter = getMeter('test');
      
      const histogram = meter.createHistogram('test_histogram', {
        description: 'Test histogram metric',
        unit: 'ms',
      });
      
      histogram.record(100, { operation: 'test' });
      histogram.record(200, { operation: 'test' });
      histogram.record(150, { operation: 'test' });
    });

    it('should create observable gauge', async () => {
      await initializeTelemetry();
      const meter = getMeter('test');
      
      let value = 0;
      const gauge = meter.createObservableGauge('test_gauge', {
        description: 'Test gauge metric',
      });
      
      gauge.addCallback((result) => {
        result.observe(value, { type: 'test' });
      });
      
      value = 42;
    });
  });

  describe('Sampling', () => {
    it('should create enhanced sampler', () => {
      const config = getTelemetryConfig();
      const sampler = createEnhancedSampler(config);
      
      expect(sampler).toBeDefined();
      expect(sampler.toString()).toBeTruthy();
    });

    it('should sample based on configuration', () => {
      const config = getTelemetryConfig();
      const sampler = createEnhancedSampler(config);
      
      // Test error sampling (should always sample)
      const errorResult = sampler.shouldSample(
        trace.setSpanContext(trace.ROOT_CONTEXT, {
          traceId: '12345678901234567890123456789012',
          spanId: '1234567890123456',
          traceFlags: 0,
        }),
        '12345678901234567890123456789012',
        'test-span',
        0,
        { error: 'true' },
        [],
      );
      
      expect(errorResult.decision).toBe(1); // RECORD_AND_SAMPLED
    });
  });
});