/**
 * Scalability Test - Tests system behavior under increasing load
 * Gradually increases concurrent sessions to find breaking points
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';
import { ConcurrentSessionTest } from './concurrent-session-test.js';
import type { ScalabilityTestResult, PerformanceTestResult } from './types.js';

export class ScalabilityTest {
  private config = DEFAULT_CONFIG;
  private results: PerformanceTestResult[] = [];

  async runTest(): Promise<ScalabilityTestResult> {
    console.log('🎯 Starting scalability test...');
    console.log('📈 Testing session counts: 1, 2, 3, 5, 8, 10, 12, 15');
    
    const sessionCounts = [1, 2, 3, 5, 8, 10, 12, 15];
    const responseTimesBySessionCount: Record<number, number[]> = {};
    const errorRatesBySessionCount: Record<number, number> = {};
    const resourceUtilizationBySessionCount: Record<number, any> = {};
    
    let maxSustainableSessions = 0;
    let performanceDegradationPoint = 0;
    
    for (const sessionCount of sessionCounts) {
      console.log(`\n🔄 Testing with ${sessionCount} concurrent sessions...`);
      
      try {
        const test = new ConcurrentSessionTest();
        const result = await test.runTest(sessionCount);
        
        this.results.push(result);
        
        // Extract metrics
        const responseTimes = result.sessionMetrics.map(s => s.avgResponseTime);
        const errorRate = result.summary.errorRate;
        const peakMemory = result.summary.peakMemoryUsage;
        const peakCpu = result.summary.peakCpuUsage;
        
        responseTimesBySessionCount[sessionCount] = responseTimes;
        errorRatesBySessionCount[sessionCount] = errorRate;
        resourceUtilizationBySessionCount[sessionCount] = {
          cpu: { total: peakCpu },
          memory: { used: peakMemory },
          network: { requestsPerSecond: result.summary.throughput }
        };
        
        // Determine if this session count is sustainable
        const isSustainable = this.isSessionCountSustainable(result);
        if (isSustainable) {
          maxSustainableSessions = sessionCount;
        }
        
        // Check for performance degradation
        if (this.hasPerformanceDegraded(result) && performanceDegradationPoint === 0) {
          performanceDegradationPoint = sessionCount;
        }
        
        console.log(`📊 Results for ${sessionCount} sessions:`);
        console.log(`   Success Rate: ${((1 - errorRate) * 100).toFixed(1)}%`);
        console.log(`   Avg Response Time: ${responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length | 0}ms`);
        console.log(`   Peak Memory: ${PerformanceUtils.formatBytes(peakMemory)}`);
        console.log(`   Peak CPU: ${peakCpu.toFixed(1)}%`);
        console.log(`   Sustainable: ${isSustainable ? '✅' : '❌'}`);
        
        // Wait between tests to let system stabilize
        await PerformanceUtils.delay(5000);
        
      } catch (error) {
        console.error(`❌ Failed to test ${sessionCount} sessions:`, error);
        break;
      }
    }
    
    const recommendations = this.generateScalabilityRecommendations(
      maxSustainableSessions,
      performanceDegradationPoint
    );
    
    const scalabilityResult: ScalabilityTestResult = {
      sessionCounts,
      responseTimesBySessionCount,
      errorRatesBySessionCount,
      resourceUtilizationBySessionCount,
      maxSustainableSessions,
      performanceDegradationPoint,
      recommendations
    };
    
    this.printScalabilityReport(scalabilityResult);
    
    return scalabilityResult;
  }

  private isSessionCountSustainable(result: PerformanceTestResult): boolean {
    const thresholds = {
      maxErrorRate: 0.05, // 5%
      maxAvgResponseTime: 5000, // 5 seconds
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 70 // 70%
    };
    
    return (
      result.summary.errorRate <= thresholds.maxErrorRate &&
      result.summary.avgResponseTime <= thresholds.maxAvgResponseTime &&
      result.summary.peakMemoryUsage <= thresholds.maxMemoryUsage &&
      result.summary.peakCpuUsage <= thresholds.maxCpuUsage
    );
  }

  private hasPerformanceDegraded(result: PerformanceTestResult): boolean {
    // Compare against baseline (assuming first result is baseline)
    if (this.results.length === 0) return false;
    
    const baseline = this.results[0];
    const currentAvgResponseTime = result.summary.avgResponseTime;
    const baselineAvgResponseTime = baseline.summary.avgResponseTime;
    
    // Consider performance degraded if response time increased by >50%
    return currentAvgResponseTime > baselineAvgResponseTime * 1.5;
  }

  private generateScalabilityRecommendations(
    maxSustainable: number,
    degradationPoint: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (maxSustainable < 5) {
      recommendations.push('System shows low scalability - consider optimizing browser pool configuration');
      recommendations.push('Increase browser pool size and optimize resource allocation');
    } else if (maxSustainable < 10) {
      recommendations.push('Moderate scalability - good for small to medium workloads');
      recommendations.push('Consider implementing load balancing for higher demands');
    } else {
      recommendations.push('Good scalability characteristics for production use');
    }
    
    if (degradationPoint > 0) {
      recommendations.push(`Performance degradation starts at ${degradationPoint} concurrent sessions`);
      recommendations.push('Monitor system resources closely beyond this point');
    }
    
    recommendations.push('Implement auto-scaling based on system metrics');
    recommendations.push('Consider horizontal scaling for loads beyond sustainable limits');
    recommendations.push('Regular performance testing recommended as system evolves');
    
    return recommendations;
  }

  private printScalabilityReport(result: ScalabilityTestResult): void {
    console.log('\n📋 SCALABILITY TEST REPORT');
    console.log('=' .repeat(50));
    
    console.log(`🎯 Maximum Sustainable Sessions: ${result.maxSustainableSessions}`);
    console.log(`📉 Performance Degradation Point: ${result.performanceDegradationPoint || 'Not reached'}`);
    
    console.log('\n📊 Performance by Session Count:');
    console.log('Session Count | Avg Response Time | Error Rate | Peak Memory | Peak CPU');
    console.log('-' .repeat(70));
    
    for (const sessionCount of result.sessionCounts) {
      const responseTimes = result.responseTimesBySessionCount[sessionCount];
      const errorRate = result.errorRatesBySessionCount[sessionCount];
      const resources = result.resourceUtilizationBySessionCount[sessionCount];
      
      if (responseTimes && errorRate !== undefined && resources) {
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const memoryStr = PerformanceUtils.formatBytes(resources.memory.used);
        const cpuStr = `${resources.cpu.total.toFixed(1)}%`;
        
        console.log(
          `${sessionCount.toString().padStart(12)} | ${avgResponseTime.toFixed(0).padStart(16)}ms | ${(errorRate * 100).toFixed(1).padStart(9)}% | ${memoryStr.padStart(10)} | ${cpuStr.padStart(7)}`
        );
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    result.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ScalabilityTest();
  
  test.runTest()
    .then(result => {
      // Save detailed results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scalability-test-${timestamp}.json`;
      PerformanceUtils.saveResults(
        { 
          testName: 'Scalability Test',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          config: DEFAULT_CONFIG,
          sessionMetrics: [],
          systemMetrics: [],
          summary: {
            totalSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            totalRequests: 0,
            totalErrors: 0,
            errorRate: 0,
            avgResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: 0,
            throughput: 0,
            peakMemoryUsage: 0,
            peakCpuUsage: 0,
            maxConcurrentSessions: result.maxSustainableSessions,
            bottlenecks: [],
            recommendations: result.recommendations
          }
        },
        DEFAULT_CONFIG.outputDir
      );
      
      console.log('\n🎉 Scalability test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Scalability test failed:', error);
      process.exit(1);
    });
}