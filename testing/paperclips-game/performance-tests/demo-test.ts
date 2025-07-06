/**
 * Demo Performance Test - Demonstrates the test framework capabilities
 * This runs without requiring a live server connection
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';
import type { SessionMetrics, SystemMetrics, PerformanceTestResult } from './types.js';

export class DemoPerformanceTest {
  private config = DEFAULT_CONFIG;
  private sessions: Map<string, SessionMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private testStartTime = 0;

  async runDemoTest(): Promise<PerformanceTestResult> {
    console.log('🚀 Running Performance Test Demo');
    console.log('This demo simulates performance testing without requiring a live server');
    console.log('=' .repeat(60));
    
    this.testStartTime = Date.now();
    
    // Simulate concurrent sessions
    const sessionCount = 5;
    const sessionPromises: Promise<void>[] = [];
    
    console.log(`🔄 Simulating ${sessionCount} concurrent sessions...`);
    
    // Start system monitoring
    this.startMetricsCollection();
    
    for (let i = 0; i < sessionCount; i++) {
      const sessionPromise = this.simulateSession(i);
      sessionPromises.push(sessionPromise);
      
      // Stagger session creation
      await PerformanceUtils.delay(500);
    }
    
    // Wait for all sessions to complete
    await Promise.allSettled(sessionPromises);
    
    // Stop monitoring
    await PerformanceUtils.delay(2000);
    
    // Calculate results
    const result = this.calculateResults();
    
    console.log('✅ Demo test completed!');
    console.log(`📊 Results: ${result.summary.successfulSessions}/${result.summary.totalSessions} sessions successful`);
    console.log(`⚡ Avg Response Time: ${result.summary.avgResponseTime.toFixed(0)}ms`);
    console.log(`🔴 Error Rate: ${(result.summary.errorRate * 100).toFixed(1)}%`);
    console.log(`💾 Peak Memory: ${PerformanceUtils.formatBytes(result.summary.peakMemoryUsage)}`);
    console.log(`🖥️  Peak CPU: ${result.summary.peakCpuUsage.toFixed(1)}%`);
    
    return result;
  }

  private async simulateSession(sessionIndex: number): Promise<void> {
    const sessionId = `demo-session-${sessionIndex}`;
    const sessionMetrics: SessionMetrics = {
      sessionId,
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      pageCount: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errors: []
    };

    this.sessions.set(sessionId, sessionMetrics);

    try {
      console.log(`🔄 Starting demo session ${sessionIndex + 1}`);
      
      // Simulate browser actions with realistic timings
      const actions = [
        { name: 'create_session', duration: 800 + Math.random() * 400 },
        { name: 'navigate', duration: 1200 + Math.random() * 800 },
        { name: 'wait_for_load', duration: 500 + Math.random() * 300 },
        { name: 'click_element', duration: 200 + Math.random() * 100 },
        { name: 'wait', duration: 1000 + Math.random() * 500 },
        { name: 'click_element', duration: 200 + Math.random() * 100 },
        { name: 'screenshot', duration: 600 + Math.random() * 400 },
        { name: 'navigate_home', duration: 1000 + Math.random() * 600 },
        { name: 'final_screenshot', duration: 600 + Math.random() * 400 }
      ];

      const responseTimes: number[] = [];

      for (const action of actions) {
        const startTime = Date.now();
        
        // Simulate action execution time
        await PerformanceUtils.delay(action.duration);
        
        const actualDuration = Date.now() - startTime;
        responseTimes.push(actualDuration);
        sessionMetrics.requestCount++;
        
        // Simulate occasional errors
        if (Math.random() < 0.02) { // 2% error rate
          sessionMetrics.errorCount++;
          sessionMetrics.errors.push({
            timestamp: Date.now(),
            error: `Simulated error in ${action.name}`,
            type: 'simulation_error'
          });
        }
        
        sessionMetrics.maxResponseTime = Math.max(sessionMetrics.maxResponseTime, actualDuration);
        sessionMetrics.minResponseTime = Math.min(sessionMetrics.minResponseTime, actualDuration);
        
        // Small delay between actions
        await PerformanceUtils.delay(100 + Math.random() * 200);
      }

      // Calculate metrics
      if (responseTimes.length > 0) {
        sessionMetrics.avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
      }

      if (sessionMetrics.minResponseTime === Infinity) {
        sessionMetrics.minResponseTime = 0;
      }

      sessionMetrics.endTime = Date.now();
      sessionMetrics.duration = sessionMetrics.endTime - sessionMetrics.startTime;
      
      console.log(`✅ Demo session ${sessionIndex + 1} completed in ${PerformanceUtils.formatDuration(sessionMetrics.duration)}`);
      
    } catch (error) {
      sessionMetrics.errorCount++;
      sessionMetrics.errors.push({
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        type: 'session_error'
      });
      
      sessionMetrics.endTime = Date.now();
      sessionMetrics.duration = sessionMetrics.endTime - sessionMetrics.startTime;
      
      console.error(`❌ Demo session ${sessionIndex + 1} failed:`, error);
    }
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect system metrics periodically
    const metricsCollection = setInterval(async () => {
      const systemMetrics = await PerformanceUtils.getSystemMetrics();
      
      // Add some realistic browser pool simulation
      systemMetrics.browserPoolMetrics = {
        totalBrowsers: Math.min(5, this.sessions.size + Math.floor(Math.random() * 2)),
        activeBrowsers: this.sessions.size,
        idleBrowsers: Math.max(0, Math.floor(Math.random() * 2)),
        totalPages: this.sessions.size * (1 + Math.floor(Math.random() * 3)),
        activePages: this.sessions.size,
        utilizationPercentage: this.sessions.size > 0 ? (this.sessions.size / 5) * 100 : 0
      };
      
      this.systemMetrics.push(systemMetrics);
    }, 1000);

    // Stop collection after a reasonable time
    setTimeout(() => clearInterval(metricsCollection), 15000);
  }

  private calculateResults(): PerformanceTestResult {
    const endTime = Date.now();
    const duration = endTime - this.testStartTime;
    
    const sessionMetrics = Array.from(this.sessions.values());
    const calculatedMetrics = PerformanceUtils.calculateMetrics(sessionMetrics);
    
    const peakMemoryUsage = Math.max(...this.systemMetrics.map(m => m.memoryUsage.heapUsed));
    const peakCpuUsage = Math.max(...this.systemMetrics.map(m => m.cpuUsage.percent));
    const maxConcurrentSessions = Math.max(...this.systemMetrics.map(m => m.browserPoolMetrics.activeBrowsers));
    
    const bottlenecks = PerformanceUtils.identifyBottlenecks(this.systemMetrics, sessionMetrics);
    const recommendations = PerformanceUtils.generateRecommendations(this.systemMetrics, sessionMetrics, bottlenecks);
    
    // Add demo-specific recommendations
    recommendations.push('This is a demonstration - run against live server for accurate results');
    recommendations.push('Actual performance may vary based on server configuration and network conditions');
    
    return {
      testName: 'Demo Performance Test',
      startTime: this.testStartTime,
      endTime,
      duration,
      config: this.config,
      sessionMetrics,
      systemMetrics: this.systemMetrics,
      summary: {
        ...calculatedMetrics,
        peakMemoryUsage,
        peakCpuUsage,
        maxConcurrentSessions,
        bottlenecks,
        recommendations
      }
    };
  }

  async generateDemoReport(): Promise<void> {
    console.log('\n📋 DEMO PERFORMANCE TEST CAPABILITIES');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 AVAILABLE TEST TYPES:');
    console.log('1. Concurrent Session Test - Tests multiple browser sessions simultaneously');
    console.log('   • Measures session creation time');
    console.log('   • Tracks response times and error rates');
    console.log('   • Monitors resource utilization');
    
    console.log('\n2. Scalability Test - Finds maximum sustainable load');
    console.log('   • Tests 1, 2, 3, 5, 8, 10, 12, 15 concurrent sessions');
    console.log('   • Identifies performance degradation points');
    console.log('   • Provides production capacity recommendations');
    
    console.log('\n3. Stress Test - Pushes system beyond normal limits');
    console.log('   • Tests breaking points and failure modes');
    console.log('   • Measures system recovery capabilities');
    console.log('   • Identifies critical error patterns');
    
    console.log('\n4. Resource Monitoring Test - Deep system analysis');
    console.log('   • CPU usage patterns and efficiency');
    console.log('   • Memory allocation and leak detection');
    console.log('   • Browser pool utilization analysis');
    
    console.log('\n5. Comprehensive Test Suite - Complete assessment');
    console.log('   • Runs all tests with cross-analysis');
    console.log('   • Production readiness scoring (0-100)');
    console.log('   • Actionable optimization recommendations');
    
    console.log('\n📊 KEY METRICS TRACKED:');
    console.log('• Response Times (avg, max, min)');
    console.log('• Error Rates and Types');
    console.log('• CPU Usage Patterns');
    console.log('• Memory Usage and Leaks');
    console.log('• Browser Pool Efficiency');
    console.log('• Network Resource Usage');
    console.log('• Session Isolation');
    console.log('• Resource Cleanup');
    
    console.log('\n🎯 PERFORMANCE THRESHOLDS:');
    console.log('Acceptable: <3s response, <5% errors, <1GB memory, <70% CPU');
    console.log('Warning:    3-5s response, 5-10% errors, 1-2GB memory, 70-85% CPU');
    console.log('Critical:   >5s response, >10% errors, >2GB memory, >85% CPU');
    
    console.log('\n🚀 USAGE EXAMPLES:');
    console.log('# Run all tests');
    console.log('./run-performance-tests.sh all');
    console.log('');
    console.log('# Test specific scenarios');
    console.log('./run-performance-tests.sh concurrent 10');
    console.log('./run-performance-tests.sh scalability');
    console.log('./run-performance-tests.sh stress');
    console.log('./run-performance-tests.sh resource 5 120000');
    console.log('./run-performance-tests.sh comprehensive');
    
    console.log('\n📄 REPORTS GENERATED:');
    console.log('• JSON results with detailed metrics');
    console.log('• Performance summaries and analysis');
    console.log('• Bottleneck identification');
    console.log('• Production readiness assessment');
    console.log('• Optimization recommendations');
    
    console.log('\n✅ READY FOR PRODUCTION TESTING');
    console.log('Start the puppeteer-mcp server and run the test suite to validate');
    console.log('your system\'s performance characteristics and production readiness.');
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new DemoPerformanceTest();
  
  demo.runDemoTest()
    .then(async (result) => {
      PerformanceUtils.saveResults(result, DEFAULT_CONFIG.outputDir);
      
      console.log('\n');
      await demo.generateDemoReport();
      
      console.log('\n🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}