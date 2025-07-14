/**
 * Server Info Tool
 * @module mcp/tools/server-info
 * @description Tool for retrieving server information
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface ServerInfoTool {
  getServerInfo(): Promise<{
    version: string;
    uptime: number;
    status: string;
    environment: string;
    timestamp: string;
    process: {
      pid: number;
      memory: NodeJS.MemoryUsage;
      platform: string;
      nodeVersion: string;
    };
  }>;
}

/**
 * Server Info Tool Implementation
 */
export class ServerInfoToolImpl implements ServerInfoTool {
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async getServerInfo() {
    // Get package.json version
    let version = '1.0.0';
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      version = packageJson.version || '1.0.0';
    } catch {
      // Fallback version if package.json not found
    }

    return {
      version,
      uptime: Date.now() - this.startTime,
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };
  }
}
