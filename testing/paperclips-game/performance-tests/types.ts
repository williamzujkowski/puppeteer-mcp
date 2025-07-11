/**
 * Types for performance testing
 */

export interface PerformanceTestConfig {
  baseUrl: string;
  maxConcurrentSessions: number;
  testDurationMs: number;
  rampUpTimeMs: number;
  testUrls: string[];
  serverPort: number;
  serverHost: string;
  outputDir: string;
  monitoringIntervalMs: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  browserId?: string;
  pageCount: number;
  memoryUsage: number;
  cpuUsage: number;
  errors: Array<{
    timestamp: number;
    error: string;
    type: string;
  }>;
}

export interface SystemMetrics {
  timestamp: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    percent: number;
  };
  processMetrics: {
    pid: number;
    memory: number;
    cpu: number;
  };
  browserPoolMetrics: {
    totalBrowsers: number;
    activeBrowsers: number;
    idleBrowsers: number;
    totalPages: number;
    activePages: number;
    utilizationPercentage: number;
  };
}

export interface PerformanceTestResult {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  config: PerformanceTestConfig;
  sessionMetrics: SessionMetrics[];
  systemMetrics: SystemMetrics[];
  summary: {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    throughput: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
    maxConcurrentSessions: number;
    bottlenecks: string[];
    recommendations: string[];
  };
}

export interface LoadTestScenario {
  name: string;
  sessionCount: number;
  rampUpTime: number;
  testDuration: number;
  targetUrls: string[];
  actions: string[];
}

export interface BrowserPoolStatus {
  totalBrowsers: number;
  activeBrowsers: number;
  idleBrowsers: number;
  totalPages: number;
  activePages: number;
  utilizationPercentage: number;
  avgBrowserLifetime: number;
  browsersCreated: number;
  browsersDestroyed: number;
  lastHealthCheck: Date;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  requestsPerSecond: number;
  responseTime: number;
  connectionCount: number;
  activeConnections: number;
}

export interface ResourceUtilization {
  cpu: {
    user: number;
    system: number;
    idle: number;
    total: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    buffers: number;
    cached: number;
  };
  network: NetworkMetrics;
  disk: {
    read: number;
    write: number;
    readTime: number;
    writeTime: number;
  };
}

export interface ScalabilityTestResult {
  sessionCounts: number[];
  responseTimesBySessionCount: Record<number, number[]>;
  errorRatesBySessionCount: Record<number, number>;
  resourceUtilizationBySessionCount: Record<number, ResourceUtilization>;
  maxSustainableSessions: number;
  performanceDegradationPoint: number;
  recommendations: string[];
}

export interface StressTestResult {
  breakingPoint: number;
  degradationPoints: {
    responseTime: number;
    errorRate: number;
    resourceExhaustion: number;
  };
  recoveryTime: number;
  criticalErrors: string[];
  systemBehavior: string[];
}
