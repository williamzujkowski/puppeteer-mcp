/**
 * Resource management event definitions
 * @module puppeteer/pool/resource-management/resource-events
 * @nist si-4 "Information system monitoring"
 */

import type { ResourceAlert, SystemResources } from './resource-types.js';

/**
 * Resource event types
 */
export enum ResourceEventType {
  MONITORING_STARTED = 'monitoring-started',
  MONITORING_STOPPED = 'monitoring-stopped',
  RESOURCES_MONITORED = 'resources-monitored',
  BROWSER_OPTIMIZED = 'browser-optimized',
  CONFIG_UPDATED = 'config-updated',
  RESOURCE_ALERT = 'resource-alert',
}

/**
 * Resource monitored event data
 */
export interface ResourcesMonitoredEvent {
  systemResources: SystemResources | null;
  browserCount: number;
  alertCount: number;
}

/**
 * Browser optimized event data
 */
export interface BrowserOptimizedEvent {
  browserId: string;
}

/**
 * Configuration updated event data
 */
export interface ConfigUpdatedEvent {
  config: any;
}

/**
 * Resource event map
 */
export interface ResourceEventMap {
  [ResourceEventType.MONITORING_STARTED]: void;
  [ResourceEventType.MONITORING_STOPPED]: void;
  [ResourceEventType.RESOURCES_MONITORED]: ResourcesMonitoredEvent;
  [ResourceEventType.BROWSER_OPTIMIZED]: BrowserOptimizedEvent;
  [ResourceEventType.CONFIG_UPDATED]: ConfigUpdatedEvent;
  [ResourceEventType.RESOURCE_ALERT]: ResourceAlert;
}

/**
 * Resource event listener
 */
export type ResourceEventListener<T = any> = (data: T) => void;

/**
 * Resource event emitter interface
 */
export interface IResourceEventEmitter {
  emit<K extends keyof ResourceEventMap>(event: K, data: ResourceEventMap[K]): void;
  on<K extends keyof ResourceEventMap>(
    event: K,
    listener: ResourceEventListener<ResourceEventMap[K]>,
  ): void;
  off<K extends keyof ResourceEventMap>(
    event: K,
    listener: ResourceEventListener<ResourceEventMap[K]>,
  ): void;
}
