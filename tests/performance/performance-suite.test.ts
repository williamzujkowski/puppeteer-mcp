/**
 * Comprehensive Performance Test Suite for Puppeteer-MCP
 * @module tests/performance/performance-suite.test
 *
 * This suite tests:
 * 1. MCP tool response times
 * 2. Browser command execution performance
 * 3. Concurrent session handling
 * 4. Resource consumption monitoring
 * 5. Performance metrics generation for CI/CD
 */

import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { LoadTestRunner, LoadTestScenario, MetricsCollector } from './load-test-runner.js';
import { PerformanceMonitor, SLAMonitor } from './monitoring/performance-monitor.js';
import {
  createMCPClient,
  createMCPSession,
  mcpNavigate,
  mcpClick,
  mcpType,
  mcpGetContent,
  mcpScreenshot,
  mcpEvaluate,
  cleanupMCPSession,
  MCPTestClient,
} from '../acceptance/utils/mcp-client.js';
import { TestDataUrls } from '../utils/test-data-urls.js';
import { setupTestLogging } from '../utils/log-suppressor.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Test configuration
const testPort = process.env.TEST_SERVER_PORT || process.env.PORT || '3000';
const PERFORMANCE_CONFIG = {
  baseUrl: `http://localhost:${testPort}`,
  testDuration: '30s',
  warmupDuration: '5s',
  targetConcurrency: 10,
  maxSessions: 20,
  slaTargets: {
    'mcp.tool.response.p95': 200, // 200ms P95 for MCP tool calls
    'browser.command.p95': 500, // 500ms P95 for browser commands
    'session.create.p95': 2000, // 2s P95 for session creation
    'concurrent.throughput': 50, // 50 ops/sec minimum throughput
  },
  outputDir: join(process.cwd(), 'performance-results'),
};

// Ensure output directory exists
if (!existsSync(PERFORMANCE_CONFIG.outputDir)) {
  mkdirSync(PERFORMANCE_CONFIG.outputDir, { recursive: true });
}

describe('Puppeteer-MCP Performance Test Suite', () => {
  setupTestLogging();
  
  let mcpClient: MCPTestClient;
  let client: Client;
  let loadRunner: LoadTestRunner;
  let performanceMonitor: PerformanceMonitor;
  let slaMonitor: SLAMonitor;
  let metricsCollector: MetricsCollector;

  beforeAll(async () => {
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      latency: { warning: 300, critical: 1000 },
      errorRate: { warning: 0.02, critical: 0.05 },
      cpu: { warning: 0.7, critical: 0.9 },
      memory: { warning: 0.8, critical: 0.95 },
    });

    slaMonitor = new SLAMonitor(performanceMonitor);

    // Define SLA targets
    Object.entries(PERFORMANCE_CONFIG.slaTargets).forEach(([metric, target]) => {
      const [, , , calculation] = metric.split('.');
      slaMonitor.addSLATarget(
        metric,
        metric.replace(/\.\w+$/, ''),
        target,
        '5m',
        calculation === 'p95' ? 'percentile' : 'average',
        calculation === 'p95' ? 95 : undefined,
      );
    });

    // Start monitoring
    performanceMonitor.start(1000);

    // Initialize MCP client
    mcpClient = await createMCPClient();
    client = mcpClient.client;

    // Initialize load test runner
    loadRunner = new LoadTestRunner({
      baseUrl: PERFORMANCE_CONFIG.baseUrl,
      protocol: 'mcp',
      timeout: 30000,
      retries: 3,
    });

    metricsCollector = new MetricsCollector();
  }, 60000);

  afterAll(async () => {
    // Cleanup MCP client
    if (mcpClient) {
      await mcpClient.cleanup();
    }

    // Stop monitoring
    performanceMonitor.stop();

    // Generate performance report
    const report = generatePerformanceReport();

    // Write report to file for CI/CD
    const reportPath = join(PERFORMANCE_CONFIG.outputDir, `performance-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`Performance report written to: ${reportPath}`);

    // Cleanup
    if (mcpClient) {
      await mcpClient.cleanup();
    }
  });

  describe('MCP Tool Response Time Tests', () => {
    it('should measure individual MCP tool response times', async () => {
      const toolTests = [
        {
          name: 'create-session',
          fn: () =>
            measureToolResponse('create-session', async () => {
              return client.callTool({
                name: 'create-session',
                arguments: {
                  username: 'perf_test',
                  password: 'test123!',
                  duration: 300,
                },
              });
            }),
        },
        {
          name: 'list-tools',
          fn: () =>
            measureToolResponse('list-tools', async () => {
              return client.listTools();
            }),
        },
        {
          name: 'get-server-info',
          fn: () =>
            measureToolResponse('get-server-info', async () => {
              return client.callTool({
                name: 'get-server-info',
                arguments: {},
              });
            }),
        },
      ];

      for (const test of toolTests) {
        const results = [];

        // Warmup
        for (let i = 0; i < 5; i++) {
          await test.fn();
        }

        // Actual measurements
        for (let i = 0; i < 50; i++) {
          const result = await test.fn();
          results.push(result);
          performanceMonitor.recordMetric(`mcp.tool.${test.name}`, result.latency);
        }

        const analysis = metricsCollector.analyze(results);
        console.log(`MCP Tool ${test.name} Performance:`, analysis);

        expect(analysis.p95Latency).toBeLessThan(
          PERFORMANCE_CONFIG.slaTargets['mcp.tool.response.p95'],
        );
        expect(analysis.successRate).toBeGreaterThan(0.98);
      }
    }, 120000);

    it('should measure MCP tool throughput under load', async () => {
      const scenario: LoadTestScenario = {
        name: 'MCP Tool Throughput',
        stages: [
          { duration: PERFORMANCE_CONFIG.warmupDuration, target: 2, rampUp: true },
          { duration: PERFORMANCE_CONFIG.testDuration, target: 10, rampUp: false },
        ],
        executor: async (userId: number) => {
          const startTime = performance.now();
          try {
            const result = await client.callTool({
              name: 'get-server-info',
              arguments: {},
            });
            const latency = performance.now() - startTime;

            return {
              success: true,
              latency,
              metrics: {
                'mcp.tool.response': latency,
              },
            };
          } catch (error) {
            const latency = performance.now() - startTime;
            return {
              success: false,
              latency,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      };

      const result = await loadRunner.runScenario(scenario);

      console.log('MCP Tool Throughput Test Results:', {
        totalRequests: result.totalRequests,
        successRate: result.successfulRequests / result.totalRequests,
        metrics: result.metrics,
      });

      // Check if any successful requests were made
      if (result.successfulRequests === 0) {
        console.error('No successful requests were made during the test');
        console.error('Total requests:', result.totalRequests);
        console.error('Failed requests:', result.failedRequests);
        console.error('Errors:', result.errors);
      }

      // Ensure we have metrics before asserting
      expect(result.metrics).toBeDefined();
      expect(result.metrics['mcp.tool.response']).toBeDefined();
      expect(result.metrics['mcp.tool.response'].p95).toBeDefined();
      expect(result.metrics['mcp.tool.response'].p95).toBeLessThan(
        PERFORMANCE_CONFIG.slaTargets['mcp.tool.response.p95'],
      );
    }, 120000);
  });

  describe('Browser Command Execution Performance', () => {
    it('should measure browser command execution times', async () => {
      const { sessionId, contextId } = await createMCPSession(client);

      try {
        const commands = [
          {
            name: 'navigate',
            fn: () =>
              measureBrowserCommand('navigate', async () => {
                await mcpNavigate(client, contextId, TestDataUrls.basicPage());
              }),
          },
          {
            name: 'click',
            fn: () =>
              measureBrowserCommand('click', async () => {
                await mcpClick(client, contextId, 'a');
              }),
          },
          {
            name: 'type',
            fn: () =>
              measureBrowserCommand('type', async () => {
                await mcpType(client, contextId, 'input', 'test');
              }),
          },
          {
            name: 'screenshot',
            fn: () =>
              measureBrowserCommand('screenshot', async () => {
                await mcpScreenshot(client, contextId);
              }),
          },
          {
            name: 'evaluate',
            fn: () =>
              measureBrowserCommand('evaluate', async () => {
                await mcpEvaluate(client, contextId, 'document.title');
              }),
          },
        ];

        for (const command of commands) {
          const results = [];

          // Initial navigation for consistent state
          await mcpNavigate(client, contextId, TestDataUrls.basicPage());

          // Measure command execution
          for (let i = 0; i < 20; i++) {
            try {
              const result = await command.fn();
              results.push(result);
              performanceMonitor.recordMetric(`browser.command.${command.name}`, result.latency);
            } catch (error) {
              // Some commands might fail (e.g., click if no link exists)
              results.push({ success: false, latency: 0 });
            }
          }

          const successfulResults = results.filter((r) => r.success);
          if (successfulResults.length > 0) {
            const analysis = metricsCollector.analyze(successfulResults);
            console.log(`Browser Command ${command.name} Performance:`, analysis);

            expect(analysis.p95Latency).toBeLessThan(
              PERFORMANCE_CONFIG.slaTargets['browser.command.p95'],
            );
          }
        }
      } finally {
        await cleanupMCPSession(client, { sessionId, contextId });
      }
    }, 180000);

    it('should measure complex browser workflows', async () => {
      const scenario: LoadTestScenario = {
        name: 'Browser Workflow Performance',
        stages: [
          { duration: '10s', target: 5, rampUp: true },
          { duration: '20s', target: 5, rampUp: false },
        ],
        executor: async (userId: number) => {
          const startTime = performance.now();
          let session: any = null;

          try {
            // Create session
            session = await createMCPSession(client);

            // Execute workflow
            await mcpNavigate(client, session.contextId, TestDataUrls.basicPage());
            await mcpGetContent(client, session.contextId);
            await mcpScreenshot(client, session.contextId);

            const latency = performance.now() - startTime;

            return {
              success: true,
              latency,
              metrics: {
                'browser.workflow': latency,
              },
            };
          } catch (error) {
            const latency = performance.now() - startTime;
            return {
              success: false,
              latency,
              error: error instanceof Error ? error.message : String(error),
            };
          } finally {
            if (session) {
              await cleanupMCPSession(client, session).catch(() => {});
            }
          }
        },
      };

      const result = await loadRunner.runScenario(scenario);

      console.log('Browser Workflow Performance Results:', {
        totalRequests: result.totalRequests,
        successRate: result.successfulRequests / result.totalRequests,
        metrics: result.metrics,
      });

      expect(result.successfulRequests / result.totalRequests).toBeGreaterThan(0.95);
    }, 120000);
  });

  describe('Concurrent Session Handling', () => {
    it('should handle multiple concurrent sessions efficiently', async () => {
      const sessionPool = await loadRunner.createSessionPool(PERFORMANCE_CONFIG.maxSessions);

      expect(sessionPool.length).toBeGreaterThan(0);
      console.log(`Created ${sessionPool.length} sessions for concurrent testing`);

      const concurrentTest = await loadRunner.runConcurrent({
        sessions: sessionPool,
        duration: '30s',
        targetRate: PERFORMANCE_CONFIG.slaTargets['concurrent.throughput'],
        action: async (session) => {
          const startTime = performance.now();
          try {
            // Simulate concurrent browser operations
            const contextId = session.contextId;
            await mcpNavigate(client, contextId, TestDataUrls.basicPage());
            await mcpGetContent(client, contextId);

            const latency = performance.now() - startTime;
            performanceMonitor.recordMetric('concurrent.operation', latency);

            return { success: true, latency };
          } catch (error) {
            const latency = performance.now() - startTime;
            performanceMonitor.recordMetric('concurrent.operation.error', latency);
            return { success: false, latency, error };
          }
        },
      });

      const analysis = metricsCollector.analyze(concurrentTest);
      console.log('Concurrent Session Test Results:', analysis);

      expect(analysis.successRate).toBeGreaterThan(0.95);
      expect(concurrentTest.length / 30).toBeGreaterThanOrEqual(
        PERFORMANCE_CONFIG.slaTargets['concurrent.throughput'] * 0.9,
      );

      // Cleanup sessions
      for (const session of sessionPool) {
        try {
          await cleanupMCPSession(client, session);
        } catch (error) {
          console.warn('Failed to cleanup session:', error);
        }
      }
    }, 180000);

    it('should measure session creation scalability', async () => {
      const sessionCounts = [1, 5, 10, 20];
      const results = [];

      for (const count of sessionCounts) {
        const startTime = performance.now();
        const sessions = [];

        try {
          // Create sessions in parallel
          const promises = Array(count)
            .fill(null)
            .map(() => createMCPSession(client));
          const createdSessions = await Promise.allSettled(promises);

          const successfulSessions = createdSessions
            .filter((r) => r.status === 'fulfilled')
            .map((r) => (r as PromiseFulfilledResult<any>).value);

          sessions.push(...successfulSessions);

          const totalTime = performance.now() - startTime;
          const avgTime = totalTime / count;

          results.push({
            count,
            totalTime,
            avgTime,
            successRate: successfulSessions.length / count,
          });

          performanceMonitor.recordMetric('session.create.batch', totalTime);
          performanceMonitor.recordMetric('session.create.avg', avgTime);
        } finally {
          // Cleanup
          for (const session of sessions) {
            await cleanupMCPSession(client, session).catch(() => {});
          }
        }
      }

      console.log('Session Creation Scalability Results:', results);

      // Verify linear or better scalability
      const scalabilityFactor = results[results.length - 1].avgTime / results[0].avgTime;
      expect(scalabilityFactor).toBeLessThan(2); // Should not degrade more than 2x
    }, 240000);
  });

  describe('Resource Consumption Tests', () => {
    it('should monitor resource usage during sustained load', async () => {
      const initialResources = performanceMonitor.getSystemResources();
      console.log('Initial System Resources:', {
        cpu: `${(initialResources.cpu.usage * 100).toFixed(2)}%`,
        memory: `${((initialResources.memory.used / initialResources.memory.total) * 100).toFixed(2)}%`,
      });

      const scenario: LoadTestScenario = {
        name: 'Sustained Load Resource Test',
        stages: [
          { duration: '10s', target: 5, rampUp: true },
          { duration: '30s', target: 10, rampUp: false },
          { duration: '10s', target: 0, rampUp: true },
        ],
        executor: async (userId: number) => {
          const session = await createMCPSession(client);

          try {
            // Simulate realistic user behavior
            await mcpNavigate(client, session.contextId, TestDataUrls.basicPage());
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Think time
            await mcpGetContent(client, session.contextId);
            await new Promise((resolve) => setTimeout(resolve, 500));
            await mcpScreenshot(client, session.contextId);

            return { success: true, latency: 0 };
          } finally {
            await cleanupMCPSession(client, session).catch(() => {});
          }
        },
      };

      const result = await loadRunner.runScenario(scenario);

      const finalResources = performanceMonitor.getSystemResources();
      const resourceDelta = {
        cpu: (finalResources.cpu.usage - initialResources.cpu.usage) * 100,
        memory:
          ((finalResources.memory.used - initialResources.memory.used) /
            initialResources.memory.total) *
          100,
      };

      console.log('Resource Consumption Delta:', {
        cpu: `${resourceDelta.cpu.toFixed(2)}%`,
        memory: `${resourceDelta.memory.toFixed(2)}%`,
      });

      // Check resource usage didn't exceed thresholds
      const cpuMetric = performanceMonitor.getMetric('system.cpu.usage');
      const memoryMetric = performanceMonitor.getMetric('system.memory.usage');

      if (cpuMetric && memoryMetric) {
        const cpuStats = cpuMetric.getStats();
        const memoryStats = memoryMetric.getStats();

        expect(cpuStats.max).toBeLessThan(90); // CPU should not exceed 90%
        expect(memoryStats.max).toBeLessThan(95); // Memory should not exceed 95%
      }
    }, 180000);

    it('should detect and report performance anomalies', async () => {
      // Simulate anomaly by creating sudden spike in operations
      const normalLoad = async () => {
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await client.callTool({ name: 'get-server-info', arguments: {} });
          performanceMonitor.recordMetric('anomaly.test', performance.now() - start);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      };

      const spikeLoad = async () => {
        const promises = Array(50)
          .fill(null)
          .map(() => client.callTool({ name: 'get-server-info', arguments: {} }));
        const start = performance.now();
        await Promise.all(promises);
        performanceMonitor.recordMetric('anomaly.test', performance.now() - start);
      };

      // Normal load
      await normalLoad();

      // Spike
      await spikeLoad();

      // Return to normal
      await normalLoad();

      const anomalies = performanceMonitor.getAnomalies();
      console.log('Detected Anomalies:', anomalies);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some((a) => a.metric === 'anomaly.test')).toBe(true);
    }, 60000);
  });

  describe('Performance Metrics Generation', () => {
    it('should generate comprehensive performance metrics for CI/CD', async () => {
      const report = generatePerformanceReport();

      // Validate report structure
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('slaCompliance');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');

      // Check SLA compliance
      const failedSLAs = Object.entries(report.slaCompliance).filter(
        ([, result]) => !result.compliant,
      );

      if (failedSLAs.length > 0) {
        console.warn('Failed SLAs:', failedSLAs);
      }

      // Write detailed metrics file
      const metricsPath = join(PERFORMANCE_CONFIG.outputDir, `detailed-metrics-${Date.now()}.json`);
      writeFileSync(
        metricsPath,
        JSON.stringify(
          {
            ...report,
            detailedMetrics: Array.from(performanceMonitor.getAllMetrics().entries()).map(
              ([name, collector]) => ({
                name,
                stats: collector.getStats(),
                values: collector.getValues().slice(-100), // Last 100 values
              }),
            ),
          },
          null,
          2,
        ),
      );

      console.log(`Detailed metrics written to: ${metricsPath}`);
    });
  });

  // Helper functions
  async function measureToolResponse(toolName: string, fn: () => Promise<any>) {
    const startTime = performance.now();
    try {
      const result = await fn();
      const latency = performance.now() - startTime;
      return { success: true, latency, result };
    } catch (error) {
      const latency = performance.now() - startTime;
      return { success: false, latency, error };
    }
  }

  async function measureBrowserCommand(commandName: string, fn: () => Promise<any>) {
    const startTime = performance.now();
    try {
      await fn();
      const latency = performance.now() - startTime;
      return { success: true, latency };
    } catch (error) {
      const latency = performance.now() - startTime;
      return { success: false, latency, error };
    }
  }

  function generatePerformanceReport() {
    const summary = performanceMonitor.getPerformanceSummary();
    const slaCompliance = slaMonitor.checkCompliance();
    const alerts = performanceMonitor.getActiveAlerts();
    const anomalies = performanceMonitor.getAnomalies();

    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
      },
      summary: {
        healthScore: summary.healthScore,
        performanceGrade: summary.performanceGrade,
        totalAlerts: alerts.length,
        anomaliesDetected: anomalies.length,
      },
      metrics: summary.metrics,
      slaCompliance: Object.fromEntries(slaCompliance),
      alerts: alerts.map((a) => ({
        metric: a.metric,
        severity: a.severity,
        value: a.value,
        threshold: a.threshold,
        message: a.message,
      })),
      anomalies: anomalies.slice(0, 10), // Top 10 anomalies
      recommendations: summary.recommendations,
      testConfig: PERFORMANCE_CONFIG,
    };

    // Add pass/fail status for CI/CD
    const allSLAsPass = Array.from(slaCompliance.values()).every((r) => r.compliant);
    const criticalAlertsCount = alerts.filter((a) => a.severity === 'critical').length;

    return {
      ...report,
      cicd: {
        pass: allSLAsPass && criticalAlertsCount === 0,
        failureReasons: [
          ...(!allSLAsPass ? ['SLA violations detected'] : []),
          ...(criticalAlertsCount > 0 ? [`${criticalAlertsCount} critical alerts`] : []),
        ],
      },
    };
  }
});
