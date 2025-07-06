/**
 * Comprehensive Performance Test Suite
 * Runs all performance tests and generates a complete analysis
 */

import { PerformanceUtils } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';
import { ConcurrentSessionTest } from './concurrent-session-test.js';
import { ScalabilityTest } from './scalability-test.js';
import { StressTest } from './stress-test.js';
import { ResourceMonitoringTest } from './resource-monitoring-test.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PerformanceTestResult } from './types.js';

interface ComprehensiveTestResult {
  testSuite: string;
  executionTime: number;
  timestamp: string;
  results: {
    concurrent: PerformanceTestResult | null;
    scalability: any | null;
    stress: any | null;
    resourceMonitoring: any | null;
  };
  summary: {
    systemCapabilities: {
      maxConcurrentSessions: number;
      recommendedProductionLimit: number;
      breakingPoint: number;
      sustainableLoad: number;
    };
    performance: {
      avgResponseTime: number;
      maxResponseTime: number;
      errorRate: number;
      throughput: number;
    };
    resources: {
      peakMemoryUsage: number;
      peakCpuUsage: number;
      memoryEfficiency: string;
      cpuEfficiency: string;
    };
    reliability: {
      errorRecovery: string;
      systemStability: string;
      resourceLeaks: boolean;
    };
  };
  recommendations: string[];
  productionReadiness: {
    score: number;
    status: 'Ready' | 'Needs Optimization' | 'Not Ready';
    criticalIssues: string[];
  };
}

export class ComprehensivePerformanceTest {
  private config = DEFAULT_CONFIG;
  private startTime = 0;
  private results: ComprehensiveTestResult;

  constructor() {
    this.results = {
      testSuite: 'Comprehensive Performance Test',
      executionTime: 0,
      timestamp: new Date().toISOString(),
      results: {
        concurrent: null,
        scalability: null,
        stress: null,
        resourceMonitoring: null
      },
      summary: {
        systemCapabilities: {
          maxConcurrentSessions: 0,
          recommendedProductionLimit: 0,
          breakingPoint: 0,
          sustainableLoad: 0
        },
        performance: {
          avgResponseTime: 0,
          maxResponseTime: 0,
          errorRate: 0,
          throughput: 0
        },
        resources: {
          peakMemoryUsage: 0,
          peakCpuUsage: 0,
          memoryEfficiency: '',
          cpuEfficiency: ''
        },
        reliability: {
          errorRecovery: '',
          systemStability: '',
          resourceLeaks: false
        }
      },
      recommendations: [],
      productionReadiness: {
        score: 0,
        status: 'Not Ready',
        criticalIssues: []
      }
    };
  }

  async runComprehensiveTest(): Promise<ComprehensiveTestResult> {
    console.log('🎯 Starting Comprehensive Performance Test Suite');
    console.log('=' .repeat(60));
    console.log('This test will evaluate:');
    console.log('• Concurrent session handling');
    console.log('• System scalability limits');
    console.log('• Stress testing and breaking points');
    console.log('• Resource utilization patterns');
    console.log('• Production readiness assessment');
    console.log('=' .repeat(60));
    
    this.startTime = Date.now();
    
    // Ensure output directory exists
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    try {
      // Test 1: Concurrent Session Performance
      console.log('\n🔄 Phase 1: Concurrent Session Performance Test');
      await this.runConcurrentSessionTest();
      
      // Test 2: Scalability Analysis
      console.log('\n📈 Phase 2: Scalability Analysis');
      await this.runScalabilityTest();
      
      // Test 3: Stress Testing
      console.log('\n🔥 Phase 3: Stress Testing');
      await this.runStressTest();
      
      // Test 4: Resource Monitoring
      console.log('\n📊 Phase 4: Resource Monitoring');
      await this.runResourceMonitoringTest();
      
      // Analysis and Reporting
      console.log('\n🎯 Phase 5: Analysis and Reporting');
      this.analyzeResults();
      this.generateComprehensiveReport();
      
      this.results.executionTime = Date.now() - this.startTime;
      
      console.log('\n🎉 Comprehensive Performance Test Suite Completed!');
      console.log(`⏱️  Total execution time: ${PerformanceUtils.formatDuration(this.results.executionTime)}`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Comprehensive test failed:', error);
      throw error;
    }
  }

  private async runConcurrentSessionTest(): Promise<void> {
    try {
      const test = new ConcurrentSessionTest();
      const result = await test.runTest(8); // Test with 8 concurrent sessions
      this.results.results.concurrent = result;
      console.log('✅ Concurrent session test completed');
    } catch (error) {
      console.error('❌ Concurrent session test failed:', error);
      this.results.productionReadiness.criticalIssues.push('Concurrent session test failed');
    }
  }

  private async runScalabilityTest(): Promise<void> {
    try {
      const test = new ScalabilityTest();
      const result = await test.runTest();
      this.results.results.scalability = result;
      console.log('✅ Scalability test completed');
    } catch (error) {
      console.error('❌ Scalability test failed:', error);
      this.results.productionReadiness.criticalIssues.push('Scalability test failed');
    }
  }

  private async runStressTest(): Promise<void> {
    try {
      const test = new StressTest();
      const result = await test.runTest();
      this.results.results.stress = result;
      console.log('✅ Stress test completed');
    } catch (error) {
      console.error('❌ Stress test failed:', error);
      this.results.productionReadiness.criticalIssues.push('Stress test failed');
    }
  }

  private async runResourceMonitoringTest(): Promise<void> {
    try {
      const test = new ResourceMonitoringTest();
      await test.runTest(5, 60000); // 5 sessions for 1 minute
      this.results.results.resourceMonitoring = 'Completed';
      console.log('✅ Resource monitoring test completed');
    } catch (error) {
      console.error('❌ Resource monitoring test failed:', error);
      this.results.productionReadiness.criticalIssues.push('Resource monitoring test failed');
    }
  }

  private analyzeResults(): void {
    console.log('🔍 Analyzing test results...');
    
    // Analyze concurrent session results
    if (this.results.results.concurrent) {
      const concurrent = this.results.results.concurrent;
      this.results.summary.performance.avgResponseTime = concurrent.summary.avgResponseTime;
      this.results.summary.performance.maxResponseTime = concurrent.summary.maxResponseTime;
      this.results.summary.performance.errorRate = concurrent.summary.errorRate;
      this.results.summary.performance.throughput = concurrent.summary.throughput;
      this.results.summary.resources.peakMemoryUsage = concurrent.summary.peakMemoryUsage;
      this.results.summary.resources.peakCpuUsage = concurrent.summary.peakCpuUsage;
    }
    
    // Analyze scalability results
    if (this.results.results.scalability) {
      const scalability = this.results.results.scalability;
      this.results.summary.systemCapabilities.maxConcurrentSessions = scalability.maxSustainableSessions;
      this.results.summary.systemCapabilities.sustainableLoad = scalability.maxSustainableSessions;
      this.results.summary.systemCapabilities.recommendedProductionLimit = 
        Math.floor(scalability.maxSustainableSessions * 0.8);
    }
    
    // Analyze stress results
    if (this.results.results.stress) {
      const stress = this.results.results.stress;
      this.results.summary.systemCapabilities.breakingPoint = stress.breakingPoint;
      this.results.summary.reliability.errorRecovery = 
        stress.recoveryTime < 30000 ? 'Good' : 'Needs Improvement';
      this.results.summary.reliability.systemStability = 
        stress.criticalErrors.length === 0 ? 'Stable' : 'Unstable';
    }
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Calculate production readiness score
    this.calculateProductionReadiness();
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (this.results.summary.performance.avgResponseTime > 3000) {
      recommendations.push('Response times are high - optimize browser operations');
    }
    
    if (this.results.summary.performance.errorRate > 0.05) {
      recommendations.push('Error rate is above 5% - improve error handling');
    }
    
    // Scalability recommendations
    if (this.results.summary.systemCapabilities.maxConcurrentSessions < 5) {
      recommendations.push('Low scalability - consider system optimization');
    }
    
    // Resource recommendations
    if (this.results.summary.resources.peakMemoryUsage > 1024 * 1024 * 1024) {
      recommendations.push('High memory usage - implement memory optimization');
    }
    
    if (this.results.summary.resources.peakCpuUsage > 80) {
      recommendations.push('High CPU usage - optimize browser pool configuration');
    }
    
    // Reliability recommendations
    if (this.results.summary.reliability.systemStability === 'Unstable') {
      recommendations.push('System shows instability under load - investigate critical errors');
    }
    
    // General recommendations
    recommendations.push('Implement monitoring and alerting for production deployment');
    recommendations.push('Regular performance testing recommended');
    recommendations.push('Consider auto-scaling based on system metrics');
    
    this.results.recommendations = recommendations;
  }

  private calculateProductionReadiness(): void {
    let score = 100;
    const criticalIssues: string[] = [];
    
    // Performance scoring
    if (this.results.summary.performance.avgResponseTime > 5000) {
      score -= 20;
      criticalIssues.push('Response times too high for production');
    }
    
    if (this.results.summary.performance.errorRate > 0.1) {
      score -= 25;
      criticalIssues.push('Error rate too high for production');
    }
    
    // Scalability scoring
    if (this.results.summary.systemCapabilities.maxConcurrentSessions < 3) {
      score -= 30;
      criticalIssues.push('Insufficient scalability for production workloads');
    }
    
    // Resource scoring
    if (this.results.summary.resources.peakMemoryUsage > 2 * 1024 * 1024 * 1024) {
      score -= 15;
      criticalIssues.push('Memory usage too high');
    }
    
    // Reliability scoring
    if (this.results.summary.reliability.systemStability === 'Unstable') {
      score -= 20;
      criticalIssues.push('System stability issues detected');
    }
    
    // Test failures
    score -= this.results.productionReadiness.criticalIssues.length * 10;
    
    this.results.productionReadiness.score = Math.max(0, score);
    this.results.productionReadiness.criticalIssues = criticalIssues;
    
    if (score >= 80) {
      this.results.productionReadiness.status = 'Ready';
    } else if (score >= 60) {
      this.results.productionReadiness.status = 'Needs Optimization';
    } else {
      this.results.productionReadiness.status = 'Not Ready';
    }
  }

  private generateComprehensiveReport(): void {
    console.log('\n📋 COMPREHENSIVE PERFORMANCE TEST REPORT');
    console.log('=' .repeat(70));
    
    console.log(`📊 Test Suite: ${this.results.testSuite}`);
    console.log(`⏱️  Execution Time: ${PerformanceUtils.formatDuration(this.results.executionTime)}`);
    console.log(`📅 Timestamp: ${this.results.timestamp}`);
    
    console.log('\n🎯 SYSTEM CAPABILITIES');
    console.log('-' .repeat(30));
    console.log(`Max Concurrent Sessions: ${this.results.summary.systemCapabilities.maxConcurrentSessions}`);
    console.log(`Recommended Production Limit: ${this.results.summary.systemCapabilities.recommendedProductionLimit}`);
    console.log(`Breaking Point: ${this.results.summary.systemCapabilities.breakingPoint || 'Not reached'}`);
    console.log(`Sustainable Load: ${this.results.summary.systemCapabilities.sustainableLoad}`);
    
    console.log('\n⚡ PERFORMANCE METRICS');
    console.log('-' .repeat(30));
    console.log(`Avg Response Time: ${this.results.summary.performance.avgResponseTime.toFixed(0)}ms`);
    console.log(`Max Response Time: ${this.results.summary.performance.maxResponseTime.toFixed(0)}ms`);
    console.log(`Error Rate: ${(this.results.summary.performance.errorRate * 100).toFixed(2)}%`);
    console.log(`Throughput: ${this.results.summary.performance.throughput.toFixed(2)} req/sec`);
    
    console.log('\n💾 RESOURCE UTILIZATION');
    console.log('-' .repeat(30));
    console.log(`Peak Memory Usage: ${PerformanceUtils.formatBytes(this.results.summary.resources.peakMemoryUsage)}`);
    console.log(`Peak CPU Usage: ${this.results.summary.resources.peakCpuUsage.toFixed(1)}%`);
    
    console.log('\n🔧 RELIABILITY ASSESSMENT');
    console.log('-' .repeat(30));
    console.log(`Error Recovery: ${this.results.summary.reliability.errorRecovery}`);
    console.log(`System Stability: ${this.results.summary.reliability.systemStability}`);
    console.log(`Resource Leaks: ${this.results.summary.reliability.resourceLeaks ? 'Detected' : 'None detected'}`);
    
    console.log('\n🎯 PRODUCTION READINESS');
    console.log('-' .repeat(30));
    console.log(`Score: ${this.results.productionReadiness.score}/100`);
    console.log(`Status: ${this.results.productionReadiness.status}`);
    
    if (this.results.productionReadiness.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.results.productionReadiness.criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    this.results.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save comprehensive report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comprehensive-performance-report-${timestamp}.json`;
    const filepath = join(this.config.outputDir, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(this.results, null, 2));
      console.log(`\n📄 Comprehensive report saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save comprehensive report:', error);
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ComprehensivePerformanceTest();
  
  test.runComprehensiveTest()
    .then(result => {
      console.log('\n🎉 Comprehensive Performance Test Suite completed successfully!');
      console.log(`📊 Production Readiness: ${result.productionReadiness.status} (${result.productionReadiness.score}/100)`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Comprehensive Performance Test Suite failed:', error);
      process.exit(1);
    });
}