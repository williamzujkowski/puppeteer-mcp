/**
 * Configuration for performance tests
 */

import type { PerformanceTestConfig, LoadTestScenario } from './types.js';

export const DEFAULT_CONFIG: PerformanceTestConfig = {
  baseUrl: 'http://localhost:8443',
  maxConcurrentSessions: 15,
  testDurationMs: 5 * 60 * 1000, // 5 minutes
  rampUpTimeMs: 30 * 1000, // 30 seconds
  testUrls: [
    'https://williamzujkowski.github.io/paperclips/index2.html',
    'https://williamzujkowski.github.io/'
  ],
  serverPort: 8443,
  serverHost: 'localhost',
  outputDir: './results',
  monitoringIntervalMs: 1000 // 1 second
};

export const LOAD_TEST_SCENARIOS: LoadTestScenario[] = [
  {
    name: 'Light Load',
    sessionCount: 2,
    rampUpTime: 10000,
    testDuration: 60000,
    targetUrls: [
      'https://williamzujkowski.github.io/paperclips/index2.html'
    ],
    actions: ['navigate', 'click', 'wait', 'screenshot']
  },
  {
    name: 'Medium Load',
    sessionCount: 5,
    rampUpTime: 20000,
    testDuration: 120000,
    targetUrls: [
      'https://williamzujkowski.github.io/paperclips/index2.html',
      'https://williamzujkowski.github.io/'
    ],
    actions: ['navigate', 'click', 'wait', 'screenshot', 'scroll']
  },
  {
    name: 'Heavy Load',
    sessionCount: 10,
    rampUpTime: 30000,
    testDuration: 180000,
    targetUrls: [
      'https://williamzujkowski.github.io/paperclips/index2.html',
      'https://williamzujkowski.github.io/'
    ],
    actions: ['navigate', 'click', 'wait', 'screenshot', 'scroll', 'type']
  },
  {
    name: 'Stress Test',
    sessionCount: 15,
    rampUpTime: 45000,
    testDuration: 300000,
    targetUrls: [
      'https://williamzujkowski.github.io/paperclips/index2.html',
      'https://williamzujkowski.github.io/'
    ],
    actions: ['navigate', 'click', 'wait', 'screenshot', 'scroll', 'type', 'evaluate']
  }
];

export const STRESS_TEST_LEVELS = [
  { sessions: 1, duration: 30000 },
  { sessions: 3, duration: 60000 },
  { sessions: 5, duration: 90000 },
  { sessions: 8, duration: 120000 },
  { sessions: 10, duration: 150000 },
  { sessions: 12, duration: 180000 },
  { sessions: 15, duration: 210000 },
  { sessions: 20, duration: 240000 } // Push beyond normal limits
];

export const PERFORMANCE_THRESHOLDS = {
  maxResponseTime: 5000, // 5 seconds
  maxErrorRate: 0.05, // 5%
  maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
  maxCpuUsage: 80, // 80%
  maxBrowserPoolUtilization: 90, // 90%
  minThroughput: 1 // 1 request per second
};

export const MONITORING_CONFIG = {
  systemMetricsInterval: 1000,
  browserPoolMetricsInterval: 2000,
  networkMetricsInterval: 5000,
  logLevel: 'info',
  enableRealTimeMonitoring: true,
  enableResourceProfiling: true,
  enableNetworkProfiling: true
};