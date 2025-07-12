/**
 * Stress Test - Push system beyond normal limits to find breaking points
 * Tests resource exhaustion, recovery, and failure modes
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG, STRESS_TEST_LEVELS } from './config.js';
import { ConcurrentSessionTest } from './concurrent-session-test.js';
import type { StressTestResult, PerformanceTestResult } from './types.js';

export class StressTest {
  private config = DEFAULT_CONFIG;
  private results: PerformanceTestResult[] = [];

  async runTest(): Promise<StressTestResult> {
    console.log('🔥 Starting stress test...');
    console.log('⚠️  Warning: This test may push the system to its limits');

    let breakingPoint = 0;
    const degradationPoints = {
      responseTime: 0,
      errorRate: 0,
      resourceExhaustion: 0,
    };

    const criticalErrors: string[] = [];
    const systemBehavior: string[] = [];

    // Baseline measurement
    console.log('\n📊 Establishing baseline with 1 session...');
    const baseline = await this.runStressLevel(1, 30000);
    const baselineAvgResponseTime = baseline.summary.avgResponseTime;
    const baselineErrorRate = baseline.summary.errorRate;

    systemBehavior.push(
      `Baseline: ${baselineAvgResponseTime.toFixed(0)}ms avg response, ${(baselineErrorRate * 100).toFixed(1)}% error rate`,
    );

    // Progressive stress testing
    for (const level of STRESS_TEST_LEVELS) {
      console.log(
        `\n🔄 Stress level: ${level.sessions} sessions for ${PerformanceUtils.formatDuration(level.duration)}`,
      );

      try {
        const result = await this.runStressLevel(level.sessions, level.duration);
        this.results.push(result);

        // Analyze results
        const analysis = this.analyzeStressResult(result, baseline);

        // Check for breaking point
        if (analysis.isBroken && breakingPoint === 0) {
          breakingPoint = level.sessions;
          criticalErrors.push(`System breaking point reached at ${level.sessions} sessions`);
        }

        // Check for degradation points
        if (analysis.responseTimeDegraded && degradationPoints.responseTime === 0) {
          degradationPoints.responseTime = level.sessions;
          systemBehavior.push(`Response time degradation at ${level.sessions} sessions`);
        }

        if (analysis.errorRateDegraded && degradationPoints.errorRate === 0) {
          degradationPoints.errorRate = level.sessions;
          systemBehavior.push(`Error rate degradation at ${level.sessions} sessions`);
        }

        if (analysis.resourceExhaustion && degradationPoints.resourceExhaustion === 0) {
          degradationPoints.resourceExhaustion = level.sessions;
          systemBehavior.push(`Resource exhaustion at ${level.sessions} sessions`);
        }

        // Log critical errors
        if (analysis.criticalErrors.length > 0) {
          criticalErrors.push(...analysis.criticalErrors);
        }

        console.log(
          `📊 Results: ${(analysis.successRate * 100).toFixed(1)}% success, ${analysis.avgResponseTime.toFixed(0)}ms avg response`,
        );
        console.log(
          `🔍 System state: ${analysis.isBroken ? '❌ BROKEN' : analysis.isUnstable ? '⚠️  UNSTABLE' : '✅ STABLE'}`,
        );

        // If system is completely broken, stop testing
        if (analysis.isBroken && result.summary.successfulSessions === 0) {
          console.log('🛑 System completely unresponsive, stopping stress test');
          break;
        }

        // Recovery time test
        if (analysis.isUnstable || analysis.isBroken) {
          console.log('🔄 Testing system recovery...');
          const recoveryStart = Date.now();
          await this.waitForSystemRecovery();
          const recoveryTime = Date.now() - recoveryStart;
          systemBehavior.push(`Recovery time: ${PerformanceUtils.formatDuration(recoveryTime)}`);
        }
      } catch (error) {
        console.error(`❌ Stress test failed at ${level.sessions} sessions:`, error);
        criticalErrors.push(`Fatal error at ${level.sessions} sessions: ${error}`);

        if (breakingPoint === 0) {
          breakingPoint = level.sessions;
        }

        // Try to recover
        console.log('🔄 Attempting system recovery...');
        await this.waitForSystemRecovery();
      }
    }

    // Final recovery measurement
    console.log('\n🔄 Measuring final recovery...');
    const recoveryStart = Date.now();
    await this.waitForSystemRecovery();
    const finalRecoveryTime = Date.now() - recoveryStart;

    const stressResult: StressTestResult = {
      breakingPoint,
      degradationPoints,
      recoveryTime: finalRecoveryTime,
      criticalErrors,
      systemBehavior,
    };

    this.printStressReport(stressResult);
    return stressResult;
  }

  private async runStressLevel(sessions: number, duration: number): Promise<PerformanceTestResult> {
    // Use shorter duration for stress testing
    const originalDuration = this.config.testDurationMs;
    this.config.testDurationMs = duration;

    const test = new ConcurrentSessionTest();
    const result = await test.runTest(sessions);

    // Restore original duration
    this.config.testDurationMs = originalDuration;

    return result;
  }

  private analyzeStressResult(result: PerformanceTestResult, baseline: PerformanceTestResult) {
    const avgResponseTime = result.summary.avgResponseTime;
    const errorRate = result.summary.errorRate;
    const successRate = 1 - errorRate;
    const peakMemory = result.summary.peakMemoryUsage;
    const peakCpu = result.summary.peakCpuUsage;

    const responseTimeDegraded = avgResponseTime > baseline.summary.avgResponseTime * 2;
    const errorRateDegraded = errorRate > baseline.summary.errorRate * 3 || errorRate > 0.1;
    const resourceExhaustion = peakMemory > 1024 * 1024 * 1024 || peakCpu > 90; // 1GB or 90% CPU

    const isUnstable = responseTimeDegraded || errorRateDegraded || resourceExhaustion;
    const isBroken = errorRate > 0.5 || avgResponseTime > 30000; // 50% error rate or 30s response time

    const criticalErrors: string[] = [];

    if (isBroken) {
      criticalErrors.push('System is broken - high error rate or response time');
    }

    if (resourceExhaustion) {
      criticalErrors.push('Resource exhaustion detected');
    }

    // Check for memory leaks
    if (result.systemMetrics.length > 10) {
      const memoryTrend = this.analyzeMemoryTrend(result.systemMetrics);
      if (memoryTrend.isIncreasing) {
        criticalErrors.push('Memory leak detected - continuous memory increase');
      }
    }

    return {
      avgResponseTime,
      errorRate,
      successRate,
      peakMemory,
      peakCpu,
      responseTimeDegraded,
      errorRateDegraded,
      resourceExhaustion,
      isUnstable,
      isBroken,
      criticalErrors,
    };
  }

  private analyzeMemoryTrend(metrics: any[]): { isIncreasing: boolean; trend: number } {
    if (metrics.length < 5) return { isIncreasing: false, trend: 0 };

    const memoryValues = metrics.map((m) => m.memoryUsage.heapUsed);
    const firstHalf = memoryValues.slice(0, Math.floor(memoryValues.length / 2));
    const secondHalf = memoryValues.slice(Math.floor(memoryValues.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const trend = (secondAvg - firstAvg) / firstAvg;

    return {
      isIncreasing: trend > 0.2, // 20% increase
      trend,
    };
  }

  private async waitForSystemRecovery(): Promise<void> {
    console.log('⏳ Waiting for system recovery...');

    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check system health
        const health = await this.checkSystemHealth();
        if (health.isHealthy) {
          console.log('✅ System recovery confirmed');
          return;
        }

        await PerformanceUtils.delay(checkInterval);
      } catch (error) {
        console.log('🔄 System still recovering...');
        await PerformanceUtils.delay(checkInterval);
      }
    }

    console.log('⚠️  System recovery timeout - continuing anyway');
  }

  private async checkSystemHealth(): Promise<{ isHealthy: boolean; details: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        timeout: 5000,
      });

      if (!response.ok) {
        return { isHealthy: false, details: `HTTP ${response.status}` };
      }

      const data = await response.json();

      // Check if browser pool is responsive
      const browserPoolHealthy =
        data.browserPool &&
        data.browserPool.totalBrowsers !== undefined &&
        data.browserPool.utilizationPercentage < 95;

      return {
        isHealthy: browserPoolHealthy,
        details: browserPoolHealthy ? 'Healthy' : 'Browser pool issues',
      };
    } catch (error) {
      return { isHealthy: false, details: `Connection error: ${error}` };
    }
  }

  private printStressReport(result: StressTestResult): void {
    console.log('\n🔥 STRESS TEST REPORT');
    console.log('='.repeat(50));

    console.log(`💥 Breaking Point: ${result.breakingPoint || 'Not reached'} concurrent sessions`);
    console.log(`📉 Performance Degradation Points:`);
    console.log(
      `   Response Time: ${result.degradationPoints.responseTime || 'Not reached'} sessions`,
    );
    console.log(`   Error Rate: ${result.degradationPoints.errorRate || 'Not reached'} sessions`);
    console.log(
      `   Resource Exhaustion: ${result.degradationPoints.resourceExhaustion || 'Not reached'} sessions`,
    );

    console.log(`⏱️  Recovery Time: ${PerformanceUtils.formatDuration(result.recoveryTime)}`);

    if (result.criticalErrors.length > 0) {
      console.log('\n🚨 Critical Errors:');
      result.criticalErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    if (result.systemBehavior.length > 0) {
      console.log('\n📊 System Behavior:');
      result.systemBehavior.forEach((behavior, index) => {
        console.log(`${index + 1}. ${behavior}`);
      });
    }

    console.log('\n💡 STRESS TEST INSIGHTS:');
    if (result.breakingPoint > 0) {
      console.log(
        `• System can handle up to ${result.breakingPoint - 1} concurrent sessions under stress`,
      );
    }
    if (result.degradationPoints.responseTime > 0) {
      console.log(
        `• Response time degradation begins at ${result.degradationPoints.responseTime} sessions`,
      );
    }
    if (result.degradationPoints.errorRate > 0) {
      console.log(
        `• Error rate increases significantly at ${result.degradationPoints.errorRate} sessions`,
      );
    }
    if (result.degradationPoints.resourceExhaustion > 0) {
      console.log(
        `• Resource exhaustion occurs at ${result.degradationPoints.resourceExhaustion} sessions`,
      );
    }

    console.log(`• System recovery time: ${PerformanceUtils.formatDuration(result.recoveryTime)}`);

    // Production recommendations
    console.log('\n🎯 PRODUCTION RECOMMENDATIONS:');
    if (result.breakingPoint > 0) {
      const safeLimit = Math.max(1, Math.floor(result.breakingPoint * 0.7));
      console.log(
        `• Set production limit to ${safeLimit} concurrent sessions (70% of breaking point)`,
      );
    }
    console.log('• Implement auto-scaling before degradation points');
    console.log('• Monitor system recovery capabilities');
    console.log('• Regular stress testing to validate limits');
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new StressTest();

  test
    .runTest()
    .then((result) => {
      console.log('\n🎉 Stress test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Stress test failed:', error);
      process.exit(1);
    });
}
