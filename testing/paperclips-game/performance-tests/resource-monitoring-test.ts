/**
 * Resource Monitoring Test - Deep analysis of system resource usage
 * Monitors CPU, memory, network, and browser pool metrics in real-time
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';
import { ConcurrentSessionTest } from './concurrent-session-test.js';
import type { SystemMetrics, ResourceUtilization, BrowserPoolStatus } from './types.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class ResourceMonitoringTest {
  private config = DEFAULT_CONFIG;
  private isMonitoring = false;
  private metrics: SystemMetrics[] = [];
  private browserPoolHistory: BrowserPoolStatus[] = [];
  private networkMetrics: any[] = [];
  private startTime = 0;

  async runTest(sessionCount: number = 5, duration: number = 120000): Promise<void> {
    console.log('📊 Starting resource monitoring test...');
    console.log(`🎯 Testing ${sessionCount} sessions for ${PerformanceUtils.formatDuration(duration)}`);
    
    this.startTime = Date.now();
    this.isMonitoring = true;
    
    // Start monitoring
    const monitoringPromise = this.startResourceMonitoring();
    
    // Run concurrent sessions
    const test = new ConcurrentSessionTest();
    const testPromise = test.runTest(sessionCount);
    
    // Wait for test completion
    await testPromise;
    
    // Stop monitoring
    this.isMonitoring = false;
    await monitoringPromise;
    
    // Analyze and report
    this.analyzeResourceUsage();
    this.generateResourceReport();
  }

  private async startResourceMonitoring(): Promise<void> {
    console.log('🔍 Starting resource monitoring...');
    
    const monitoringTasks = [
      this.monitorSystemMetrics(),
      this.monitorBrowserPool(),
      this.monitorNetworkMetrics()
    ];
    
    await Promise.all(monitoringTasks);
  }

  private async monitorSystemMetrics(): Promise<void> {
    while (this.isMonitoring) {
      try {
        const metrics = await PerformanceUtils.getSystemMetrics();
        this.metrics.push(metrics);
        
        // Log periodic updates
        if (this.metrics.length % 10 === 0) {
          const elapsed = Date.now() - this.startTime;
          console.log(`📈 [${PerformanceUtils.formatDuration(elapsed)}] CPU: ${metrics.cpuUsage.percent.toFixed(1)}%, Memory: ${PerformanceUtils.formatBytes(metrics.memoryUsage.heapUsed)}`);
        }
        
      } catch (error) {
        console.warn('Failed to collect system metrics:', error);
      }
      
      await PerformanceUtils.delay(1000);
    }
  }

  private async monitorBrowserPool(): Promise<void> {
    while (this.isMonitoring) {
      try {
        const browserPoolStatus = await PerformanceUtils.getBrowserPoolMetrics(this.config.baseUrl);
        this.browserPoolHistory.push(browserPoolStatus);
        
        // Log browser pool changes
        if (this.browserPoolHistory.length > 1) {
          const prev = this.browserPoolHistory[this.browserPoolHistory.length - 2];
          const curr = browserPoolStatus;
          
          if (curr.totalBrowsers !== prev.totalBrowsers || 
              curr.activeBrowsers !== prev.activeBrowsers) {
            console.log(`🌐 Browser Pool: ${curr.activeBrowsers}/${curr.totalBrowsers} active, ${curr.totalPages} pages, ${curr.utilizationPercentage.toFixed(1)}% util`);
          }
        }
        
      } catch (error) {
        console.warn('Failed to collect browser pool metrics:', error);
      }
      
      await PerformanceUtils.delay(2000);
    }
  }

  private async monitorNetworkMetrics(): Promise<void> {
    let lastNetworkStats = { received: 0, sent: 0 };
    
    while (this.isMonitoring) {
      try {
        // Get network stats from system (simplified)
        const networkStats = {
          timestamp: Date.now(),
          received: 0, // Would be populated from system stats
          sent: 0,
          connections: 0,
          requestsPerSecond: 0
        };
        
        this.networkMetrics.push(networkStats);
        
      } catch (error) {
        console.warn('Failed to collect network metrics:', error);
      }
      
      await PerformanceUtils.delay(5000);
    }
  }

  private analyzeResourceUsage(): void {
    console.log('\n📊 Analyzing resource usage...');
    
    // CPU Analysis
    const cpuAnalysis = this.analyzeCpuUsage();
    console.log('🖥️  CPU Analysis:', cpuAnalysis);
    
    // Memory Analysis
    const memoryAnalysis = this.analyzeMemoryUsage();
    console.log('💾 Memory Analysis:', memoryAnalysis);
    
    // Browser Pool Analysis
    const browserPoolAnalysis = this.analyzeBrowserPool();
    console.log('🌐 Browser Pool Analysis:', browserPoolAnalysis);
    
    // Resource Efficiency Analysis
    const efficiencyAnalysis = this.analyzeResourceEfficiency();
    console.log('⚡ Resource Efficiency:', efficiencyAnalysis);
  }

  private analyzeCpuUsage() {
    if (this.metrics.length === 0) return { error: 'No metrics collected' };
    
    const cpuValues = this.metrics.map(m => m.cpuUsage.percent);
    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const maxCpu = Math.max(...cpuValues);
    const minCpu = Math.min(...cpuValues);
    
    // Calculate CPU utilization patterns
    const highCpuPeriods = cpuValues.filter(cpu => cpu > 70).length;
    const highCpuPercentage = (highCpuPeriods / cpuValues.length) * 100;
    
    return {
      average: avgCpu.toFixed(1),
      peak: maxCpu.toFixed(1),
      minimum: minCpu.toFixed(1),
      highUtilizationTime: highCpuPercentage.toFixed(1),
      trend: this.calculateTrend(cpuValues),
      recommendation: this.getCpuRecommendation(avgCpu, maxCpu)
    };
  }

  private analyzeMemoryUsage() {
    if (this.metrics.length === 0) return { error: 'No metrics collected' };
    
    const memoryValues = this.metrics.map(m => m.memoryUsage.heapUsed);
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const maxMemory = Math.max(...memoryValues);
    const minMemory = Math.min(...memoryValues);
    
    // Check for memory leaks
    const trend = this.calculateTrend(memoryValues);
    const isMemoryLeaking = trend > 0.05; // 5% consistent increase
    
    return {
      average: PerformanceUtils.formatBytes(avgMemory),
      peak: PerformanceUtils.formatBytes(maxMemory),
      minimum: PerformanceUtils.formatBytes(minMemory),
      trend: trend.toFixed(3),
      memoryLeak: isMemoryLeaking,
      recommendation: this.getMemoryRecommendation(avgMemory, maxMemory, isMemoryLeaking)
    };
  }

  private analyzeBrowserPool() {
    if (this.browserPoolHistory.length === 0) return { error: 'No browser pool metrics collected' };
    
    const utilizationValues = this.browserPoolHistory.map(b => b.utilizationPercentage);
    const avgUtilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length;
    const maxUtilization = Math.max(...utilizationValues);
    
    const maxBrowsers = Math.max(...this.browserPoolHistory.map(b => b.totalBrowsers));
    const maxPages = Math.max(...this.browserPoolHistory.map(b => b.totalPages));
    
    return {
      avgUtilization: avgUtilization.toFixed(1),
      peakUtilization: maxUtilization.toFixed(1),
      maxBrowsers,
      maxPages,
      efficiency: this.calculateBrowserPoolEfficiency(),
      recommendation: this.getBrowserPoolRecommendation(avgUtilization, maxUtilization)
    };
  }

  private analyzeResourceEfficiency() {
    if (this.metrics.length === 0 || this.browserPoolHistory.length === 0) {
      return { error: 'Insufficient metrics for efficiency analysis' };
    }
    
    // Calculate resource efficiency metrics
    const avgCpu = this.metrics.reduce((sum, m) => sum + m.cpuUsage.percent, 0) / this.metrics.length;
    const avgMemory = this.metrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / this.metrics.length;
    const avgUtilization = this.browserPoolHistory.reduce((sum, b) => sum + b.utilizationPercentage, 0) / this.browserPoolHistory.length;
    
    const efficiency = {
      cpuEfficiency: this.calculateCpuEfficiency(avgCpu, avgUtilization),
      memoryEfficiency: this.calculateMemoryEfficiency(avgMemory, avgUtilization),
      overallEfficiency: 0
    };
    
    efficiency.overallEfficiency = (efficiency.cpuEfficiency + efficiency.memoryEfficiency) / 2;
    
    return {
      cpuEfficiency: efficiency.cpuEfficiency.toFixed(1),
      memoryEfficiency: efficiency.memoryEfficiency.toFixed(1),
      overallEfficiency: efficiency.overallEfficiency.toFixed(1),
      recommendation: this.getEfficiencyRecommendation(efficiency.overallEfficiency)
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstQuarter = values.slice(0, Math.floor(values.length / 4));
    const lastQuarter = values.slice(-Math.floor(values.length / 4));
    
    const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
    const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
    
    return (lastAvg - firstAvg) / firstAvg;
  }

  private calculateBrowserPoolEfficiency(): number {
    if (this.browserPoolHistory.length === 0) return 0;
    
    const avgUtilization = this.browserPoolHistory.reduce((sum, b) => sum + b.utilizationPercentage, 0) / this.browserPoolHistory.length;
    const avgBrowsers = this.browserPoolHistory.reduce((sum, b) => sum + b.totalBrowsers, 0) / this.browserPoolHistory.length;
    const avgPages = this.browserPoolHistory.reduce((sum, b) => sum + b.totalPages, 0) / this.browserPoolHistory.length;
    
    // Efficiency = (pages per browser) * (utilization) / 100
    const pagesPerBrowser = avgBrowsers > 0 ? avgPages / avgBrowsers : 0;
    return (pagesPerBrowser * avgUtilization) / 100;
  }

  private calculateCpuEfficiency(avgCpu: number, avgUtilization: number): number {
    // Good efficiency: high utilization with moderate CPU usage
    if (avgUtilization > 70 && avgCpu < 60) return 90;
    if (avgUtilization > 50 && avgCpu < 70) return 75;
    if (avgUtilization > 30 && avgCpu < 80) return 60;
    return 40;
  }

  private calculateMemoryEfficiency(avgMemory: number, avgUtilization: number): number {
    // Memory efficiency based on memory usage vs utilization
    const memoryGb = avgMemory / (1024 * 1024 * 1024);
    
    if (avgUtilization > 70 && memoryGb < 0.5) return 90;
    if (avgUtilization > 50 && memoryGb < 1) return 75;
    if (avgUtilization > 30 && memoryGb < 1.5) return 60;
    return 40;
  }

  private getCpuRecommendation(avgCpu: number, maxCpu: number): string {
    if (maxCpu > 90) return 'Critical: CPU frequently at maximum capacity';
    if (avgCpu > 70) return 'High: Consider reducing concurrent sessions';
    if (avgCpu > 50) return 'Moderate: Monitor for sustained high usage';
    return 'Good: CPU usage within acceptable range';
  }

  private getMemoryRecommendation(avgMemory: number, maxMemory: number, isLeaking: boolean): string {
    if (isLeaking) return 'Critical: Memory leak detected - investigate immediately';
    if (maxMemory > 1024 * 1024 * 1024) return 'High: Memory usage approaching 1GB limit';
    if (avgMemory > 512 * 1024 * 1024) return 'Moderate: Monitor memory usage trends';
    return 'Good: Memory usage within acceptable range';
  }

  private getBrowserPoolRecommendation(avgUtilization: number, maxUtilization: number): string {
    if (maxUtilization > 95) return 'Critical: Browser pool at maximum capacity';
    if (avgUtilization > 80) return 'High: Consider increasing browser pool size';
    if (avgUtilization > 60) return 'Moderate: Good utilization levels';
    return 'Low: Pool may be oversized for current workload';
  }

  private getEfficiencyRecommendation(efficiency: number): string {
    if (efficiency > 80) return 'Excellent: System running efficiently';
    if (efficiency > 60) return 'Good: Minor optimizations possible';
    if (efficiency > 40) return 'Fair: Consider resource optimization';
    return 'Poor: Significant optimization needed';
  }

  private generateResourceReport(): void {
    console.log('\n📋 RESOURCE MONITORING REPORT');
    console.log('=' .repeat(60));
    
    const duration = Date.now() - this.startTime;
    console.log(`⏱️  Test Duration: ${PerformanceUtils.formatDuration(duration)}`);
    console.log(`📊 Metrics Collected: ${this.metrics.length} system metrics, ${this.browserPoolHistory.length} browser pool metrics`);
    
    // Save detailed metrics to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportData = {
      testInfo: {
        duration,
        startTime: this.startTime,
        endTime: Date.now(),
        metricsCount: this.metrics.length
      },
      systemMetrics: this.metrics,
      browserPoolHistory: this.browserPoolHistory,
      networkMetrics: this.networkMetrics,
      analysis: {
        cpu: this.analyzeCpuUsage(),
        memory: this.analyzeMemoryUsage(),
        browserPool: this.analyzeBrowserPool(),
        efficiency: this.analyzeResourceEfficiency()
      }
    };
    
    const filename = `resource-monitoring-${timestamp}.json`;
    const filepath = join(this.config.outputDir, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Detailed report saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ResourceMonitoringTest();
  const sessionCount = parseInt(process.argv[2]) || 5;
  const duration = parseInt(process.argv[3]) || 120000;
  
  test.runTest(sessionCount, duration)
    .then(() => {
      console.log('\n🎉 Resource monitoring test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Resource monitoring test failed:', error);
      process.exit(1);
    });
}