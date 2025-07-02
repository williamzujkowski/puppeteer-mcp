/**
 * System Health Resource Implementation
 * @module mcp/resources/system-health
 */

import type { SystemHealth } from '../types/resource-types.js';

/**
 * System health resource handler
 */
export class SystemHealthResource {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<any> {
    const health: SystemHealth = {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      services: {
        rest: 'operational',
        grpc: 'operational',
        websocket: 'operational',
        mcp: 'operational',
      },
      timestamp: new Date().toISOString(),
    };
    
    return {
      contents: [
        {
          uri: 'api://health',
          mimeType: 'application/json',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }
}