/**
 * Load Test Runner for Puppeteer-MCP Performance Testing
 * @module tests/performance/load-test-runner
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import * as os from 'os';

export interface LoadTestConfig {
  baseUrl: string;
  protocol: 'rest' | 'websocket' | 'grpc' | 'mcp';
  authentication?: {
    username: string;
    password: string;
  };
  timeout?: number;
  retries?: number;
}

export interface LoadTestStage {
  duration: string;
  target: number;
  rampUp?: boolean;
}

export interface LoadTestScenario {
  name: string;
  stages: LoadTestStage[];
  executor: (userId: number) => Promise<any>;
  setupFn?: () => Promise<void>;
  teardownFn?: () => Promise<void>;
}

export interface LoadTestResult {
  scenario: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  metrics: {
    [key: string]: {
      count: number;
      min: number;
      max: number;
      mean: number;
      p50: number;
      p90: number;
      p95: number;
      p99: number;
      errorRate: number;
    };
  };
  errors: Array<{
    timestamp: Date;
    userId: number;
    error: string;
    operation?: string;
  }>;
}

export interface ConcurrentTestConfig {
  sessions: any[];
  duration: string;
  targetRate: number;
  action: (session: any) => Promise<{ success: boolean; latency: number; error?: any }>;
}

/**
 * Load Test Runner for orchestrating performance tests
 */
export class LoadTestRunner extends EventEmitter {
  private config: LoadTestConfig;
  private workers: Worker[] = [];
  private metrics: Map<string, number[]> = new Map();
  private errors: any[] = [];
  private startTime: number = 0;

  constructor(config: LoadTestConfig) {
    super();
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
    };
  }

  /**
   * Run a load test scenario
   */
  async runScenario(scenario: LoadTestScenario): Promise<LoadTestResult> {
    this.startTime = Date.now();
    this.metrics.clear();
    this.errors = [];

    try {
      // Setup phase
      if (scenario.setupFn) {
        await scenario.setupFn();
      }

      // Execute stages
      for (const stage of scenario.stages) {
        await this.executeStage(stage, scenario.executor);
      }

      // Teardown phase
      if (scenario.teardownFn) {
        await scenario.teardownFn();
      }

      return this.generateReport(scenario.name);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a single stage of the load test
   */
  private async executeStage(stage: LoadTestStage, executor: Function): Promise<void> {
    const duration = this.parseDuration(stage.duration);
    const startUsers = this.getCurrentUserCount();
    const targetUsers = stage.target;
    const rampUp = stage.rampUp !== false;

    const stageStartTime = Date.now();
    const stageEndTime = stageStartTime + duration;

    // Start user simulation
    const userPromises: Promise<void>[] = [];

    if (rampUp && targetUsers > startUsers) {
      // Gradual ramp-up
      const usersToAdd = targetUsers - startUsers;
      const rampUpInterval = duration / usersToAdd;

      for (let i = 0; i < usersToAdd; i++) {
        const delay = i * rampUpInterval;
        userPromises.push(this.scheduleUser(startUsers + i, executor, delay, stageEndTime));
      }
    } else if (rampUp && targetUsers < startUsers) {
      // Gradual ramp-down
      const usersToRemove = startUsers - targetUsers;
      const rampDownInterval = duration / usersToRemove;

      for (let i = 0; i < usersToRemove; i++) {
        setTimeout(() => {
          this.removeUser(startUsers - i - 1);
        }, i * rampDownInterval);
      }

      // Keep remaining users active
      for (let i = 0; i < targetUsers; i++) {
        userPromises.push(this.runUser(i, executor, stageEndTime));
      }
    } else {
      // Immediate transition
      for (let i = 0; i < targetUsers; i++) {
        userPromises.push(this.runUser(i, executor, stageEndTime));
      }
    }

    // Wait for stage completion
    await Promise.all(userPromises);
  }

  /**
   * Schedule a user to start after a delay
   */
  private async scheduleUser(
    userId: number,
    executor: Function,
    delay: number,
    endTime: number,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.runUser(userId, executor, endTime);
  }

  /**
   * Run a single user's workload
   */
  private async runUser(userId: number, executor: Function, endTime: number): Promise<void> {
    while (Date.now() < endTime) {
      const startTime = Date.now();
      try {
        const result = await executor(userId);
        const latency = Date.now() - startTime;
        this.recordMetric('overall', latency);

        if (result?.metrics) {
          for (const [metric, value] of Object.entries(result.metrics)) {
            this.recordMetric(metric, value as number);
          }
        }
      } catch (error) {
        const latency = Date.now() - startTime;
        this.recordError(userId, error, 'executor');
        this.recordMetric('overall_error', latency);
      }

      // Small delay between iterations
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Run concurrent load test
   */
  async runConcurrent(config: ConcurrentTestConfig): Promise<any> {
    const duration = this.parseDuration(config.duration);
    const interval = 1000 / config.targetRate; // milliseconds between actions
    const endTime = Date.now() + duration;

    const results = [];
    let actionCount = 0;

    while (Date.now() < endTime) {
      const sessionIndex = actionCount % config.sessions.length;
      const session = config.sessions[sessionIndex];

      // Execute action without waiting
      config
        .action(session)
        .then((result) => {
          results.push(result);
        })
        .catch((error) => {
          results.push({ success: false, error, latency: 0 });
        });

      actionCount++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    // Wait for all pending actions to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return results;
  }

  /**
   * Create a session pool for testing
   */
  async createSessionPool(size: number): Promise<any[]> {
    const sessions = [];
    const promises = [];

    for (let i = 0; i < size; i++) {
      promises.push(
        this.createSession({
          username: `test_user_${i}`,
          password: 'test123!',
          duration: 3600,
        }),
      );
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sessions.push(result.value);
      }
    }

    return sessions;
  }

  /**
   * Create a single session
   */
  async createSession(credentials: any): Promise<any> {
    // Implementation depends on protocol
    switch (this.config.protocol) {
      case 'rest':
        return this.createRestSession(credentials);
      case 'websocket':
        return this.createWebSocketSession(credentials);
      case 'grpc':
        return this.createGrpcSession(credentials);
      case 'mcp':
        return this.createMcpSession(credentials);
      default:
        throw new Error(`Unsupported protocol: ${this.config.protocol}`);
    }
  }

  /**
   * Perform actions with a session
   */
  async performActions(sessionId: string, actions: any[]): Promise<void> {
    for (const action of actions) {
      const startTime = Date.now();
      try {
        await this.executeAction(sessionId, action);
        const latency = Date.now() - startTime;
        this.recordMetric(`action_${action.type}`, latency);
      } catch (error) {
        const latency = Date.now() - startTime;
        this.recordError(0, error, `action_${action.type}`);
        this.recordMetric(`action_${action.type}_error`, latency);
      }
    }
  }

  /**
   * Compare performance across protocols
   */
  async compareProtocols(config: {
    protocols: string[];
    operations: string[];
    iterations: number;
    concurrency: number;
  }): Promise<any> {
    const results: any = {};

    for (const protocol of config.protocols) {
      this.config.protocol = protocol as any;
      results[protocol] = {};

      for (const operation of config.operations) {
        const operationResults = await this.benchmarkOperation(operation, {
          iterations: config.iterations,
          concurrency: config.concurrency,
        });

        results[protocol][operation] = operationResults;
      }
    }

    return results;
  }

  /**
   * Benchmark a specific operation
   */
  private async benchmarkOperation(operation: string, config: any): Promise<any> {
    const latencies: number[] = [];
    const errors: any[] = [];
    const startTime = Date.now();

    const workerPromises = [];
    for (let i = 0; i < config.concurrency; i++) {
      workerPromises.push(
        this.runBenchmarkWorker(
          operation,
          config.iterations / config.concurrency,
          latencies,
          errors,
        ),
      );
    }

    await Promise.all(workerPromises);

    const totalTime = Date.now() - startTime;
    const throughput = (config.iterations / totalTime) * 1000;

    return {
      latency: this.calculatePercentiles(latencies),
      throughput,
      errorRate: errors.length / config.iterations,
      errors: errors.slice(0, 10), // First 10 errors
    };
  }

  /**
   * Record a metric value
   */
  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Record an error
   */
  private recordError(userId: number, error: any, operation?: string): void {
    this.errors.push({
      timestamp: new Date(),
      userId,
      error: error.message || String(error),
      operation,
    });
  }

  /**
   * Generate test report
   */
  private generateReport(scenarioName: string): LoadTestResult {
    const duration = Date.now() - this.startTime;
    const metrics: any = {};

    for (const [name, values] of this.metrics.entries()) {
      const sortedValues = values.sort((a, b) => a - b);
      const errorValues = this.metrics.get(`${name}_error`) || [];

      metrics[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p50: this.percentile(sortedValues, 0.5),
        p90: this.percentile(sortedValues, 0.9),
        p95: this.percentile(sortedValues, 0.95),
        p99: this.percentile(sortedValues, 0.99),
        errorRate: errorValues.length / (values.length + errorValues.length),
      };
    }

    const overallMetrics = metrics.overall || { count: 0 };
    const errorMetrics = metrics.overall_error || { count: 0 };

    return {
      scenario: scenarioName,
      duration,
      totalRequests: overallMetrics.count + errorMetrics.count,
      successfulRequests: overallMetrics.count,
      failedRequests: errorMetrics.count,
      metrics,
      errors: this.errors,
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Calculate multiple percentiles
   */
  private calculatePercentiles(values: number[]): any {
    const sorted = values.sort((a, b) => a - b);
    return {
      min: sorted[0] || 0,
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      max: sorted[sorted.length - 1] || 0,
    };
  }

  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid duration unit: ${unit}`);
    }
  }

  /**
   * Get current user count
   */
  private getCurrentUserCount(): number {
    return this.workers.length;
  }

  /**
   * Remove a user
   */
  private removeUser(userId: number): void {
    // In a real implementation, this would stop the user's worker
    this.emit('user-removed', userId);
  }

  /**
   * Protocol-specific session creation methods
   */
  private async createRestSession(credentials: any): Promise<any> {
    // REST implementation
    const response = await fetch(`${this.config.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return response.json();
  }

  private async createWebSocketSession(credentials: any): Promise<any> {
    // WebSocket implementation
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.config.baseUrl.replace('http', 'ws')}/ws`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'create_session', ...credentials }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'session_created') {
          resolve(message.session);
        } else if (message.type === 'error') {
          reject(new Error(message.error));
        }
      });
    });
  }

  private async createGrpcSession(credentials: any): Promise<any> {
    // gRPC implementation placeholder
    throw new Error('gRPC implementation pending');
  }

  private async createMcpSession(credentials: any): Promise<any> {
    // MCP implementation using the MCP client
    try {
      // Import the MCP client utilities
      const { createMCPClient } = await import('../acceptance/utils/mcp-client.js');

      // Create a new MCP client for this session
      const mcpClient = await createMCPClient();

      // Create a session using the create-session tool
      const result = await mcpClient.client.callTool({
        name: 'create-session',
        arguments: {
          username: credentials.username,
          password: credentials.password,
          duration: credentials.duration || 3600,
        },
      });

      return {
        sessionId: result.content?.[0]?.text ? JSON.parse(result.content[0].text).sessionId : null,
        mcpClient,
        credentials,
      };
    } catch (error) {
      console.warn('Failed to create MCP session:', error);
      return null;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(sessionId: string, action: any): Promise<any> {
    // Implementation depends on protocol and action type
    switch (this.config.protocol) {
      case 'rest':
        return this.executeRestAction(sessionId, action);
      default:
        throw new Error(`Action execution not implemented for protocol: ${this.config.protocol}`);
    }
  }

  private async executeRestAction(sessionId: string, action: any): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/sessions/${sessionId}/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionId}`,
      },
      body: JSON.stringify(action),
    });
    return response.json();
  }

  /**
   * Run benchmark in worker
   */
  private async runBenchmarkWorker(
    operation: string,
    iterations: number,
    latencies: number[],
    errors: any[],
  ): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        await this.executeBenchmarkOperation(operation);
        latencies.push(Date.now() - startTime);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  private async executeBenchmarkOperation(operation: string): Promise<any> {
    // Placeholder for operation execution
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Terminate all workers
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }
}

/**
 * Metrics collector for tracking performance metrics
 */
export class MetricsCollector {
  private metrics: Map<string, Array<{ value: number; timestamp: Date }>> = new Map();

  recordSuccess(operation: string, latency: number): void {
    this.record(operation, latency);
  }

  recordFailure(operation: string, latency: number, error: any): void {
    this.record(`${operation}_error`, latency);
  }

  private record(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push({ value, timestamp: new Date() });
  }

  analyze(results: any[]): any {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const latencies = successful.map((r) => r.latency).sort((a, b) => a - b);

    return {
      successRate: successful.length / results.length,
      totalRequests: results.length,
      successful: successful.length,
      failed: failed.length,
      p50Latency: this.percentile(latencies, 0.5),
      p95Latency: this.percentile(latencies, 0.95),
      p99Latency: this.percentile(latencies, 0.99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
