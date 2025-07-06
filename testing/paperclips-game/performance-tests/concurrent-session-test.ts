/**
 * Concurrent Session Performance Test
 * Tests multiple browser sessions running simultaneously
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';
import type { SessionMetrics, SystemMetrics, PerformanceTestResult } from './types.js';

export class ConcurrentSessionTest {
  private config = DEFAULT_CONFIG;
  private sessions: Map<string, SessionMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private testStartTime = 0;

  async runTest(maxConcurrentSessions: number = 10): Promise<PerformanceTestResult> {
    console.log(`🚀 Starting concurrent session test with ${maxConcurrentSessions} sessions...`);
    
    this.testStartTime = Date.now();
    const token = PerformanceUtils.generateTestToken();
    
    // Start system monitoring
    this.startMonitoring();
    
    // Create and run sessions concurrently
    const sessionPromises: Promise<void>[] = [];
    
    for (let i = 0; i < maxConcurrentSessions; i++) {
      const sessionPromise = this.runSession(i, token);
      sessionPromises.push(sessionPromise);
      
      // Stagger session creation
      if (i < maxConcurrentSessions - 1) {
        await PerformanceUtils.delay(500);
      }
    }
    
    // Wait for all sessions to complete
    await Promise.allSettled(sessionPromises);
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Calculate results
    const result = this.calculateResults();
    
    console.log(`✅ Test completed in ${PerformanceUtils.formatDuration(result.duration)}`);
    console.log(`📊 Sessions: ${result.summary.successfulSessions}/${result.summary.totalSessions} successful`);
    console.log(`⚡ Throughput: ${result.summary.throughput.toFixed(2)} requests/second`);
    console.log(`🔴 Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`);
    
    return result;
  }

  private async runSession(sessionIndex: number, token: string): Promise<void> {
    const sessionId = `session-${sessionIndex}`;
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
      console.log(`🔄 Starting session ${sessionIndex + 1}/${this.config.maxConcurrentSessions}`);
      
      // Create session
      const puppeteerSessionId = await PerformanceUtils.createSession(this.config.baseUrl, token);
      sessionMetrics.browserId = puppeteerSessionId;
      
      // Run test actions
      await this.runSessionActions(sessionMetrics, puppeteerSessionId, token);
      
      // Close session
      await PerformanceUtils.closeSession(this.config.baseUrl, puppeteerSessionId, token);
      
      sessionMetrics.endTime = Date.now();
      sessionMetrics.duration = sessionMetrics.endTime - sessionMetrics.startTime;
      
      console.log(`✅ Session ${sessionIndex + 1} completed in ${PerformanceUtils.formatDuration(sessionMetrics.duration)}`);
      
    } catch (error) {
      sessionMetrics.errorCount++;
      sessionMetrics.errors.push({
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        type: 'session_error'
      });
      
      console.error(`❌ Session ${sessionIndex + 1} failed:`, error);
      
      sessionMetrics.endTime = Date.now();
      sessionMetrics.duration = sessionMetrics.endTime - sessionMetrics.startTime;
    }
  }

  private async runSessionActions(
    sessionMetrics: SessionMetrics,
    puppeteerSessionId: string,
    token: string
  ): Promise<void> {
    const actions = [
      { action: 'navigate', params: { url: this.config.testUrls[0] } },
      { action: 'wait', params: { selector: 'body', timeout: 5000 } },
      { action: 'click', params: { selector: '#btnMakePaperclip' } },
      { action: 'wait', params: { time: 1000 } },
      { action: 'click', params: { selector: '#btnMakePaperclip' } },
      { action: 'wait', params: { time: 1000 } },
      { action: 'screenshot', params: { filename: `session-${sessionMetrics.sessionId}-gameplay.png` } },
      { action: 'navigate', params: { url: this.config.testUrls[1] } },
      { action: 'wait', params: { selector: 'body', timeout: 5000 } },
      { action: 'screenshot', params: { filename: `session-${sessionMetrics.sessionId}-homepage.png` } }
    ];

    const responseTimes: number[] = [];

    for (const { action, params } of actions) {
      try {
        const result = await PerformanceUtils.performBrowserAction(
          this.config.baseUrl,
          puppeteerSessionId,
          action,
          params,
          token
        );

        sessionMetrics.requestCount++;
        responseTimes.push(result.duration);

        if (result.success) {
          sessionMetrics.maxResponseTime = Math.max(sessionMetrics.maxResponseTime, result.duration);
          sessionMetrics.minResponseTime = Math.min(sessionMetrics.minResponseTime, result.duration);
        } else {
          sessionMetrics.errorCount++;
          sessionMetrics.errors.push({
            timestamp: Date.now(),
            error: result.error || 'Unknown error',
            type: 'action_error'
          });
        }

        // Small delay between actions
        await PerformanceUtils.delay(200);
        
      } catch (error) {
        sessionMetrics.errorCount++;
        sessionMetrics.errors.push({
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          type: 'action_error'
        });
      }
    }

    // Calculate average response time
    if (responseTimes.length > 0) {
      sessionMetrics.avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    }

    // Fix infinite minResponseTime
    if (sessionMetrics.minResponseTime === Infinity) {
      sessionMetrics.minResponseTime = 0;
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const systemMetrics = await PerformanceUtils.getSystemMetrics();
        const browserPoolMetrics = await PerformanceUtils.getBrowserPoolMetrics(this.config.baseUrl);
        
        systemMetrics.browserPoolMetrics = {
          totalBrowsers: browserPoolMetrics.totalBrowsers,
          activeBrowsers: browserPoolMetrics.activeBrowsers,
          idleBrowsers: browserPoolMetrics.idleBrowsers,
          totalPages: browserPoolMetrics.totalPages,
          activePages: browserPoolMetrics.activePages,
          utilizationPercentage: browserPoolMetrics.utilizationPercentage
        };
        
        this.systemMetrics.push(systemMetrics);
        
        // Log current status
        if (this.systemMetrics.length % 10 === 0) { // Log every 10 seconds
          console.log(`📊 Active sessions: ${this.sessions.size}, CPU: ${systemMetrics.cpuUsage.percent.toFixed(1)}%, Memory: ${PerformanceUtils.formatBytes(systemMetrics.memoryUsage.heapUsed)}`);
        }
        
      } catch (error) {
        console.warn('Failed to collect system metrics:', error);
      }
    }, this.config.monitoringIntervalMs);
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
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
    
    return {
      testName: 'Concurrent Session Test',
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
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ConcurrentSessionTest();
  const maxSessions = parseInt(process.argv[2]) || 10;
  
  test.runTest(maxSessions)
    .then(result => {
      PerformanceUtils.saveResults(result, DEFAULT_CONFIG.outputDir);
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}