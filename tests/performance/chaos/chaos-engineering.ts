/**
 * Chaos Engineering Framework for Puppeteer-MCP
 * @module tests/performance/chaos/chaos-engineering
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ChaosScenario {
  name: string;
  description: string;
  probability: number;
  duration: number;
  action: () => Promise<void>;
  rollback: () => Promise<void>;
}

export interface ChaosResult {
  scenario: string;
  started: Date;
  ended: Date;
  success: boolean;
  impact: {
    errorsInduced: number;
    recoveryTime: number;
    dataLoss: boolean;
    serviceAvailable: boolean;
  };
  errors?: string[];
}

/**
 * Base chaos engineering framework
 */
export class ChaosEngineer extends EventEmitter {
  private activeScenarios: Map<string, NodeJS.Timeout> = new Map();
  private results: ChaosResult[] = [];
  private isRunning: boolean = false;

  /**
   * Start chaos engineering
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('chaos-started');
  }

  /**
   * Stop all chaos scenarios
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Stop all active scenarios
    for (const [name, timeout] of this.activeScenarios) {
      clearTimeout(timeout);
      this.emit('scenario-stopped', name);
    }

    this.activeScenarios.clear();
    this.emit('chaos-stopped');
  }

  /**
   * Run a specific chaos scenario
   */
  async runScenario(scenario: ChaosScenario): Promise<ChaosResult> {
    const startTime = new Date();
    const result: ChaosResult = {
      scenario: scenario.name,
      started: startTime,
      ended: new Date(),
      success: false,
      impact: {
        errorsInduced: 0,
        recoveryTime: 0,
        dataLoss: false,
        serviceAvailable: true,
      },
    };

    try {
      this.emit('scenario-started', scenario.name);

      // Execute chaos action
      await scenario.action();

      // Wait for duration
      await new Promise((resolve) => setTimeout(resolve, scenario.duration));

      // Rollback
      await scenario.rollback();

      result.success = true;
      result.ended = new Date();
      result.impact.recoveryTime = result.ended.getTime() - startTime.getTime();

      this.emit('scenario-completed', result);
    } catch (error) {
      result.success = false;
      result.errors = [error.message];
      this.emit('scenario-failed', result);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Schedule random chaos scenarios
   */
  scheduleRandom(scenarios: ChaosScenario[], intervalMs: number = 60000): void {
    const runRandom = async () => {
      if (!this.isRunning) return;

      // Select random scenario based on probability
      const scenario = this.selectScenario(scenarios);
      if (scenario) {
        await this.runScenario(scenario);
      }

      // Schedule next run
      const timeout = setTimeout(runRandom, intervalMs);
      this.activeScenarios.set('random', timeout);
    };

    runRandom();
  }

  /**
   * Get chaos results
   */
  getResults(): ChaosResult[] {
    return [...this.results];
  }

  /**
   * Select scenario based on probability
   */
  private selectScenario(scenarios: ChaosScenario[]): ChaosScenario | null {
    const random = Math.random();
    let cumulative = 0;

    for (const scenario of scenarios) {
      cumulative += scenario.probability;
      if (random <= cumulative) {
        return scenario;
      }
    }

    return null;
  }
}

/**
 * Network chaos for introducing network issues
 */
export class NetworkChaos {
  private tcCommands: string[] = [];

  /**
   * Add network latency
   */
  async addLatency(interface: string, latency: number, jitter: number = 0): Promise<void> {
    const cmd = `tc qdisc add dev ${interface} root netem delay ${latency}ms ${jitter}ms`;
    await execAsync(cmd);
    this.tcCommands.push(`tc qdisc del dev ${interface} root netem`);
  }

  /**
   * Add packet loss
   */
  async addPacketLoss(interface: string, lossPercentage: number): Promise<void> {
    const cmd = `tc qdisc add dev ${interface} root netem loss ${lossPercentage}%`;
    await execAsync(cmd);
    this.tcCommands.push(`tc qdisc del dev ${interface} root netem`);
  }

  /**
   * Add bandwidth limitation
   */
  async limitBandwidth(interface: string, rate: string): Promise<void> {
    const cmd = `tc qdisc add dev ${interface} root tbf rate ${rate} burst 32kbit latency 400ms`;
    await execAsync(cmd);
    this.tcCommands.push(`tc qdisc del dev ${interface} root tbf`);
  }

  /**
   * Create network partition
   */
  async createPartition(sourceHosts: string[], targetHosts: string[]): Promise<void> {
    for (const source of sourceHosts) {
      for (const target of targetHosts) {
        const cmd = `iptables -A INPUT -s ${source} -d ${target} -j DROP`;
        await execAsync(cmd);
        this.tcCommands.push(`iptables -D INPUT -s ${source} -d ${target} -j DROP`);
      }
    }
  }

  /**
   * Reset all network changes
   */
  async reset(): Promise<void> {
    for (const cmd of this.tcCommands.reverse()) {
      try {
        await execAsync(cmd);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.tcCommands = [];
  }
}

/**
 * Process chaos for killing/suspending processes
 */
export class ProcessChaos {
  /**
   * Kill process by name
   */
  async killProcess(processName: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`pgrep ${processName}`);
      const pids = stdout.trim().split('\n').filter(Boolean);

      for (const pid of pids) {
        await execAsync(`kill -9 ${pid}`);
      }

      return pids.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Suspend process
   */
  async suspendProcess(pid: number, durationMs: number): Promise<void> {
    await execAsync(`kill -STOP ${pid}`);

    setTimeout(async () => {
      await execAsync(`kill -CONT ${pid}`);
    }, durationMs);
  }

  /**
   * Kill random browser process
   */
  async killRandomBrowser(): Promise<void> {
    const { stdout } = await execAsync('pgrep -f "chrome|chromium"');
    const pids = stdout.trim().split('\n').filter(Boolean);

    if (pids.length > 0) {
      const randomPid = pids[Math.floor(Math.random() * pids.length)];
      await execAsync(`kill -9 ${randomPid}`);
    }
  }
}

/**
 * Resource chaos for exhausting system resources
 */
export class ResourceChaos {
  private activeStressors: Map<string, any> = new Map();

  /**
   * Consume CPU resources
   */
  async stressCPU(cores: number, percentage: number): Promise<() => void> {
    const workers: any[] = [];

    for (let i = 0; i < cores; i++) {
      const worker = {
        active: true,
        run: async () => {
          while (worker.active) {
            // CPU intensive calculation
            const start = Date.now();
            while (Date.now() - start < percentage) {
              Math.sqrt(Math.random());
            }
            // Sleep for remaining time
            await new Promise((resolve) => setTimeout(resolve, 100 - percentage));
          }
        },
      };

      workers.push(worker);
      worker.run();
    }

    const stopFn = () => {
      workers.forEach((w) => (w.active = false));
    };

    this.activeStressors.set('cpu', stopFn);
    return stopFn;
  }

  /**
   * Consume memory resources
   */
  async stressMemory(sizeMB: number, incrementMB: number = 100): Promise<() => void> {
    const arrays: any[] = [];
    let allocated = 0;
    let active = true;

    const allocate = async () => {
      while (active && allocated < sizeMB) {
        // Allocate incrementMB of memory
        const size = (incrementMB * 1024 * 1024) / 8; // 8 bytes per number
        const array = new Array(size);
        for (let i = 0; i < size; i++) {
          array[i] = Math.random();
        }
        arrays.push(array);
        allocated += incrementMB;

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    allocate();

    const stopFn = () => {
      active = false;
      arrays.length = 0; // Release memory
    };

    this.activeStressors.set('memory', stopFn);
    return stopFn;
  }

  /**
   * Fill disk space
   */
  async fillDisk(path: string, sizeMB: number): Promise<() => Promise<void>> {
    const filename = path + `/chaos-disk-${Date.now()}.tmp`;
    const chunkSize = 1024 * 1024; // 1MB chunks
    const buffer = Buffer.alloc(chunkSize);

    const handle = await fs.open(filename, 'w');

    for (let i = 0; i < sizeMB; i++) {
      await handle.write(buffer);
    }

    await handle.close();

    const cleanupFn = async () => {
      await fs.unlink(filename);
    };

    this.activeStressors.set('disk', cleanupFn);
    return cleanupFn;
  }

  /**
   * Stop all resource stressors
   */
  async stopAll(): Promise<void> {
    for (const [name, stopFn] of this.activeStressors) {
      if (typeof stopFn === 'function') {
        await stopFn();
      }
    }
    this.activeStressors.clear();
  }
}

/**
 * Service chaos for service-level failures
 */
export class ServiceChaos {
  /**
   * Restart service
   */
  async restartService(serviceName: string): Promise<void> {
    await execAsync(`systemctl restart ${serviceName}`);
  }

  /**
   * Stop service
   */
  async stopService(serviceName: string): Promise<void> {
    await execAsync(`systemctl stop ${serviceName}`);
  }

  /**
   * Start service
   */
  async startService(serviceName: string): Promise<void> {
    await execAsync(`systemctl start ${serviceName}`);
  }

  /**
   * Corrupt service configuration
   */
  async corruptConfig(configPath: string): Promise<() => Promise<void>> {
    const backup = await fs.readFile(configPath, 'utf-8');
    const corrupted = backup.replace(/port:\s*\d+/, 'port: 99999');
    await fs.writeFile(configPath, corrupted);

    return async () => {
      await fs.writeFile(configPath, backup);
    };
  }
}

/**
 * Predefined chaos scenarios
 */
export const chaosScenarios = {
  networkLatency: (latency: number = 500): ChaosScenario => ({
    name: 'network-latency',
    description: `Add ${latency}ms network latency`,
    probability: 0.1,
    duration: 300000, // 5 minutes
    action: async () => {
      const chaos = new NetworkChaos();
      await chaos.addLatency('eth0', latency, latency * 0.1);
    },
    rollback: async () => {
      const chaos = new NetworkChaos();
      await chaos.reset();
    },
  }),

  packetLoss: (percentage: number = 5): ChaosScenario => ({
    name: 'packet-loss',
    description: `Add ${percentage}% packet loss`,
    probability: 0.05,
    duration: 180000, // 3 minutes
    action: async () => {
      const chaos = new NetworkChaos();
      await chaos.addPacketLoss('eth0', percentage);
    },
    rollback: async () => {
      const chaos = new NetworkChaos();
      await chaos.reset();
    },
  }),

  browserCrash: (): ChaosScenario => ({
    name: 'browser-crash',
    description: 'Kill random browser process',
    probability: 0.1,
    duration: 1000, // Immediate
    action: async () => {
      const chaos = new ProcessChaos();
      await chaos.killRandomBrowser();
    },
    rollback: async () => {
      // Browser should auto-recover
    },
  }),

  cpuSpike: (percentage: number = 80): ChaosScenario => ({
    name: 'cpu-spike',
    description: `Spike CPU usage to ${percentage}%`,
    probability: 0.05,
    duration: 120000, // 2 minutes
    action: async () => {
      const chaos = new ResourceChaos();
      const cores = require('os').cpus().length;
      await chaos.stressCPU(cores, percentage);
    },
    rollback: async () => {
      const chaos = new ResourceChaos();
      await chaos.stopAll();
    },
  }),

  memoryLeak: (sizeMB: number = 1000): ChaosScenario => ({
    name: 'memory-leak',
    description: `Consume ${sizeMB}MB of memory`,
    probability: 0.05,
    duration: 300000, // 5 minutes
    action: async () => {
      const chaos = new ResourceChaos();
      await chaos.stressMemory(sizeMB);
    },
    rollback: async () => {
      const chaos = new ResourceChaos();
      await chaos.stopAll();
    },
  }),

  diskFull: (sizeMB: number = 5000): ChaosScenario => ({
    name: 'disk-full',
    description: `Fill ${sizeMB}MB of disk space`,
    probability: 0.02,
    duration: 600000, // 10 minutes
    action: async () => {
      const chaos = new ResourceChaos();
      await chaos.fillDisk('/tmp', sizeMB);
    },
    rollback: async () => {
      const chaos = new ResourceChaos();
      await chaos.stopAll();
    },
  }),

  serviceRestart: (serviceName: string): ChaosScenario => ({
    name: 'service-restart',
    description: `Restart ${serviceName} service`,
    probability: 0.02,
    duration: 30000, // 30 seconds for restart
    action: async () => {
      const chaos = new ServiceChaos();
      await chaos.restartService(serviceName);
    },
    rollback: async () => {
      // Service should be running after restart
    },
  }),
};

/**
 * Chaos test runner
 */
export class ChaosTestRunner {
  private engineer: ChaosEngineer;
  private scenarios: ChaosScenario[];

  constructor(scenarios: ChaosScenario[]) {
    this.engineer = new ChaosEngineer();
    this.scenarios = scenarios;
  }

  /**
   * Run chaos tests
   */
  async run(
    duration: number,
    options?: {
      interval?: number;
      parallel?: boolean;
      maxConcurrent?: number;
    },
  ): Promise<ChaosResult[]> {
    const { interval = 60000, parallel = false, maxConcurrent = 3 } = options || {};

    this.engineer.start();

    if (parallel) {
      // Run multiple scenarios concurrently
      const endTime = Date.now() + duration;
      const running = new Set<Promise<ChaosResult>>();

      while (Date.now() < endTime) {
        if (running.size < maxConcurrent) {
          const scenario = this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
          const promise = this.engineer.runScenario(scenario);
          running.add(promise);

          promise.then(() => running.delete(promise));
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      // Wait for remaining scenarios
      await Promise.all(running);
    } else {
      // Run scenarios sequentially
      this.engineer.scheduleRandom(this.scenarios, interval);
      await new Promise((resolve) => setTimeout(resolve, duration));
    }

    await this.engineer.stop();
    return this.engineer.getResults();
  }

  /**
   * Generate chaos report
   */
  generateReport(results: ChaosResult[]): {
    summary: {
      total: number;
      successful: number;
      failed: number;
      averageRecoveryTime: number;
      dataLossIncidents: number;
      serviceUnavailable: number;
    };
    scenarios: Record<
      string,
      {
        runs: number;
        successes: number;
        failures: number;
        averageRecoveryTime: number;
      }
    >;
    recommendations: string[];
  } {
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      averageRecoveryTime:
        results.reduce((sum, r) => sum + r.impact.recoveryTime, 0) / results.length,
      dataLossIncidents: results.filter((r) => r.impact.dataLoss).length,
      serviceUnavailable: results.filter((r) => !r.impact.serviceAvailable).length,
    };

    const scenarios: any = {};
    for (const result of results) {
      if (!scenarios[result.scenario]) {
        scenarios[result.scenario] = {
          runs: 0,
          successes: 0,
          failures: 0,
          totalRecoveryTime: 0,
        };
      }

      scenarios[result.scenario].runs++;
      if (result.success) {
        scenarios[result.scenario].successes++;
      } else {
        scenarios[result.scenario].failures++;
      }
      scenarios[result.scenario].totalRecoveryTime += result.impact.recoveryTime;
    }

    // Calculate averages
    for (const scenario of Object.values(scenarios) as any[]) {
      scenario.averageRecoveryTime = scenario.totalRecoveryTime / scenario.runs;
      delete scenario.totalRecoveryTime;
    }

    const recommendations = this.generateRecommendations(summary, scenarios);

    return { summary, scenarios, recommendations };
  }

  private generateRecommendations(summary: any, scenarios: any): string[] {
    const recommendations: string[] = [];

    if (summary.averageRecoveryTime > 10000) {
      recommendations.push('Average recovery time exceeds 10 seconds - improve failure detection');
    }

    if (summary.dataLossIncidents > 0) {
      recommendations.push('Data loss incidents detected - implement better data persistence');
    }

    if (summary.serviceUnavailable > 0) {
      recommendations.push('Service availability issues - improve redundancy and failover');
    }

    if (summary.failed / summary.total > 0.1) {
      recommendations.push('High failure rate in chaos tests - improve system resilience');
    }

    for (const [name, stats] of Object.entries(scenarios)) {
      if ((stats as any).failures > 0) {
        recommendations.push(`Scenario "${name}" has failures - investigate and fix`);
      }
    }

    return recommendations;
  }
}
