/**
 * Utility functions for performance testing
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import pidusage from 'pidusage';
import type { 
  SystemMetrics, 
  SessionMetrics, 
  PerformanceTestResult,
  ResourceUtilization,
  BrowserPoolStatus 
} from './types.js';

export class PerformanceUtils {
  static async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    let processMetrics = { pid: process.pid, memory: 0, cpu: 0 };
    try {
      const stats = await pidusage(process.pid);
      processMetrics = {
        pid: process.pid,
        memory: stats.memory,
        cpu: stats.cpu
      };
    } catch (error) {
      console.warn('Failed to get process metrics:', error);
    }

    return {
      timestamp: Date.now(),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: processMetrics.cpu
      },
      processMetrics,
      browserPoolMetrics: {
        totalBrowsers: 0,
        activeBrowsers: 0,
        idleBrowsers: 0,
        totalPages: 0,
        activePages: 0,
        utilizationPercentage: 0
      }
    };
  }

  static async getBrowserPoolMetrics(baseUrl: string): Promise<BrowserPoolStatus> {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        totalBrowsers: data.browserPool?.totalBrowsers || 0,
        activeBrowsers: data.browserPool?.activeBrowsers || 0,
        idleBrowsers: data.browserPool?.idleBrowsers || 0,
        totalPages: data.browserPool?.totalPages || 0,
        activePages: data.browserPool?.activePages || 0,
        utilizationPercentage: data.browserPool?.utilizationPercentage || 0,
        avgBrowserLifetime: data.browserPool?.avgBrowserLifetime || 0,
        browsersCreated: data.browserPool?.browsersCreated || 0,
        browsersDestroyed: data.browserPool?.browsersDestroyed || 0,
        lastHealthCheck: new Date(data.browserPool?.lastHealthCheck || Date.now())
      };
    } catch (error) {
      console.warn('Failed to get browser pool metrics:', error);
      return {
        totalBrowsers: 0,
        activeBrowsers: 0,
        idleBrowsers: 0,
        totalPages: 0,
        activePages: 0,
        utilizationPercentage: 0,
        avgBrowserLifetime: 0,
        browsersCreated: 0,
        browsersDestroyed: 0,
        lastHealthCheck: new Date()
      };
    }
  }

  static calculateMetrics(sessions: SessionMetrics[]): any {
    const validSessions = sessions.filter(s => s.duration && s.duration > 0);
    
    if (validSessions.length === 0) {
      return {
        totalSessions: sessions.length,
        successfulSessions: 0,
        failedSessions: sessions.length,
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 1,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        throughput: 0
      };
    }

    const totalRequests = validSessions.reduce((sum, s) => sum + s.requestCount, 0);
    const totalErrors = validSessions.reduce((sum, s) => sum + s.errorCount, 0);
    const avgResponseTime = validSessions.reduce((sum, s) => sum + s.avgResponseTime, 0) / validSessions.length;
    const maxResponseTime = Math.max(...validSessions.map(s => s.maxResponseTime));
    const minResponseTime = Math.min(...validSessions.map(s => s.minResponseTime));
    const totalDuration = validSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const throughput = totalDuration > 0 ? (totalRequests / (totalDuration / 1000)) : 0;

    return {
      totalSessions: sessions.length,
      successfulSessions: validSessions.length,
      failedSessions: sessions.length - validSessions.length,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput
    };
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static saveResults(result: PerformanceTestResult, outputDir: string): void {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${result.testName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
    const filepath = join(outputDir, filename);
    
    writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`Results saved to: ${filepath}`);
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateTestToken(): string {
    // Generate a simple test token - in production this would use proper JWT
    return Buffer.from(`test-${Date.now()}-${Math.random()}`).toString('base64');
  }

  static async createSession(baseUrl: string, token: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        config: {
          headless: true,
          width: 1920,
          height: 1080
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessionId;
  }

  static async closeSession(baseUrl: string, sessionId: string, token: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.warn(`Failed to close session ${sessionId}: ${response.status} ${response.statusText}`);
    }
  }

  static async performBrowserAction(
    baseUrl: string,
    sessionId: string,
    action: string,
    params: any,
    token: string
  ): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, params })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          duration,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return { success: true, duration };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  static identifyBottlenecks(
    systemMetrics: SystemMetrics[],
    sessionMetrics: SessionMetrics[]
  ): string[] {
    const bottlenecks: string[] = [];

    // Check memory usage
    const peakMemory = Math.max(...systemMetrics.map(m => m.memoryUsage.heapUsed));
    if (peakMemory > 500 * 1024 * 1024) { // 500MB
      bottlenecks.push('High memory usage detected');
    }

    // Check CPU usage
    const peakCpu = Math.max(...systemMetrics.map(m => m.cpuUsage.percent));
    if (peakCpu > 80) {
      bottlenecks.push('High CPU usage detected');
    }

    // Check response times
    const avgResponseTime = sessionMetrics.reduce((sum, s) => sum + s.avgResponseTime, 0) / sessionMetrics.length;
    if (avgResponseTime > 3000) {
      bottlenecks.push('High response times detected');
    }

    // Check error rates
    const totalErrors = sessionMetrics.reduce((sum, s) => sum + s.errorCount, 0);
    const totalRequests = sessionMetrics.reduce((sum, s) => sum + s.requestCount, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    if (errorRate > 0.05) {
      bottlenecks.push('High error rate detected');
    }

    return bottlenecks;
  }

  static generateRecommendations(
    systemMetrics: SystemMetrics[],
    sessionMetrics: SessionMetrics[],
    bottlenecks: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.includes('High memory usage detected')) {
      recommendations.push('Consider increasing browser pool recycling frequency');
      recommendations.push('Monitor for memory leaks in browser instances');
    }

    if (bottlenecks.includes('High CPU usage detected')) {
      recommendations.push('Consider reducing concurrent browser instances');
      recommendations.push('Optimize browser launch options for better performance');
    }

    if (bottlenecks.includes('High response times detected')) {
      recommendations.push('Review browser pool configuration for optimal sizing');
      recommendations.push('Consider implementing request queuing with priority');
    }

    if (bottlenecks.includes('High error rate detected')) {
      recommendations.push('Implement better error handling and retry logic');
      recommendations.push('Add health checks for browser instances');
    }

    // General recommendations
    recommendations.push('Monitor browser pool utilization regularly');
    recommendations.push('Implement automated cleanup of idle resources');
    recommendations.push('Consider horizontal scaling for high-load scenarios');

    return recommendations;
  }
}