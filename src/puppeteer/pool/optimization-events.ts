/**
 * Optimization event handlers and forwarding
 * @module puppeteer/pool/optimization-events
 * @nist si-4 "Information system monitoring"
 */

import { EventEmitter } from 'events';
import type { BrowserPoolScaling } from './browser-pool-scaling.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import type { BrowserPoolRecycler } from './browser-pool-recycler.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';

/**
 * Optimization event handlers and forwarding
 */
export class OptimizationEvents extends EventEmitter {
  constructor(
    private scaler: BrowserPoolScaling,
    private resourceManager: BrowserPoolResourceManager,
    private recycler: BrowserPoolRecycler,
    private performanceMonitor: BrowserPoolPerformanceMonitor
  ) {
    super();
    this.setupOptimizationEventHandlers();
  }

  /**
   * Setup optimization event handlers
   */
  private setupOptimizationEventHandlers(): void {
    // Scaler events
    this.scaler.on('scaling-action', (event: any) => {
      this.emit('optimization-scaling-action', event);
    });

    // Resource manager events
    this.resourceManager.on('resource-alert', (alert) => {
      this.emit('optimization-resource-alert', alert);
    });

    // Recycler events
    this.recycler.on('browsers-recycled', (events) => {
      this.emit('optimization-browsers-recycled', events);
    });

    // Performance monitor events
    this.performanceMonitor.on('alert-created', (alert) => {
      this.emit('optimization-performance-alert', alert);
    });

    this.performanceMonitor.on('recommendation-generated', (recommendation) => {
      this.emit('optimization-recommendation', recommendation);
    });

    // Performance monitor collection request
    this.performanceMonitor.on('metrics-collection-requested', () => {
      this.emit('metrics-collection-requested');
    });
  }
}