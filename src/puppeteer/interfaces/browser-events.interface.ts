/**
 * Browser Events Interface for Puppeteer Integration
 * Defines event types and handlers for browser automation events
 */

// Event interfaces use minimal imports to avoid coupling
// Types are defined inline for better portability

/**
 * Page lifecycle event
 */
export interface PageLifecycleEvent {
  type: 'page:created' | 'page:closed' | 'page:crashed';
  pageId: string;
  contextId: string;
  sessionId: string;
  browserId: string;
  url?: string;
  timestamp: Date;
}

/**
 * Navigation event
 */
export interface NavigationEvent {
  type: 'navigation:started' | 'navigation:completed' | 'navigation:failed';
  pageId: string;
  url: string;
  fromUrl?: string;
  status?: number;
  error?: string;
  duration?: number;
  timestamp: Date;
}

/**
 * Network event
 */
export interface NetworkEvent {
  type: 'network:request' | 'network:response' | 'network:failed';
  pageId: string;
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  size?: number;
  duration?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Console event
 */
export interface ConsoleEvent {
  type: 'console:log' | 'console:error' | 'console:warning' | 'console:info';
  pageId: string;
  level: string;
  message: string;
  args?: unknown[];
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  timestamp: Date;
}

/**
 * JavaScript error event
 */
export interface ErrorEvent {
  type: 'error:page' | 'error:uncaught';
  pageId: string;
  message: string;
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: Date;
}

/**
 * Dialog event
 */
export interface DialogEvent {
  type: 'dialog:opened' | 'dialog:closed';
  pageId: string;
  dialogType: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  message: string;
  defaultValue?: string;
  accepted?: boolean;
  userInput?: string;
  timestamp: Date;
}

/**
 * Download event
 */
export interface DownloadEvent {
  type: 'download:started' | 'download:completed' | 'download:failed';
  pageId: string;
  downloadId: string;
  url: string;
  suggestedFilename?: string;
  totalBytes?: number;
  receivedBytes?: number;
  state?: 'progressing' | 'completed' | 'cancelled';
  error?: string;
  timestamp: Date;
}

/**
 * Security event
 */
export interface SecurityEvent {
  type: 'security:certificate-error' | 'security:mixed-content' | 'security:csp-violation';
  pageId: string;
  url: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Performance event
 */
export interface PerformanceEvent {
  type: 'performance:metrics';
  pageId: string;
  metrics: {
    timestamp: number;
    documents: number;
    frames: number;
    jsEventListeners: number;
    nodes: number;
    layoutCount: number;
    recalcStyleCount: number;
    layoutDuration: number;
    recalcStyleDuration: number;
    scriptDuration: number;
    taskDuration: number;
    jsHeapUsedSize: number;
    jsHeapTotalSize: number;
  };
  timestamp: Date;
}

/**
 * Browser lifecycle event
 */
export interface BrowserLifecycleEvent {
  type: 'browser:connected' | 'browser:disconnected' | 'browser:crashed';
  browserId: string;
  pid?: number;
  version?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Target event
 */
export interface TargetEvent {
  type: 'target:created' | 'target:destroyed' | 'target:changed';
  targetId: string;
  targetType: 'page' | 'background_page' | 'service_worker' | 'shared_worker' | 'other' | 'browser' | 'webview';
  url?: string;
  title?: string;
  timestamp: Date;
}

/**
 * Union type of all browser events
 */
export type BrowserEvent =
  | PageLifecycleEvent
  | NavigationEvent
  | NetworkEvent
  | ConsoleEvent
  | ErrorEvent
  | DialogEvent
  | DownloadEvent
  | SecurityEvent
  | PerformanceEvent
  | BrowserLifecycleEvent
  | TargetEvent;

/**
 * Event handler function type
 */
export type EventHandler<T extends BrowserEvent = BrowserEvent> = (event: T) => void | Promise<void>;

/**
 * Event filter options
 */
export interface EventFilter {
  /** Filter by event types */
  types?: BrowserEvent['type'][];
  
  /** Filter by page IDs */
  pageIds?: string[];
  
  /** Filter by session IDs */
  sessionIds?: string[];
  
  /** Filter by browser IDs */
  browserIds?: string[];
  
  /** Filter by time range */
  startTime?: Date;
  endTime?: Date;
  
  /** Custom filter function */
  customFilter?: (event: BrowserEvent) => boolean;
}

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  /** Event filter */
  filter?: EventFilter;
  
  /** Buffer events before delivery */
  bufferSize?: number;
  
  /** Delivery mode */
  mode?: 'immediate' | 'batched';
  
  /** Batch interval for batched mode (ms) */
  batchInterval?: number;
  
  /** Include historical events */
  includeHistory?: boolean;
  
  /** History limit */
  historyLimit?: number;
}

/**
 * Event subscription handle
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  
  /** Subscription filter */
  filter: EventFilter;
  
  /** Subscription options */
  options: EventSubscriptionOptions;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Event count */
  eventCount: number;
  
  /** Unsubscribe function */
  unsubscribe: () => void;
}

/**
 * Browser event emitter interface
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */
export interface BrowserEventEmitter {
  /**
   * Subscribe to browser events
   * @param handler - Event handler function
   * @param options - Subscription options
   * @returns Event subscription handle
   * @nist au-12 "Audit generation"
   */
  subscribe(
    handler: EventHandler,
    options?: EventSubscriptionOptions
  ): EventSubscription;
  
  /**
   * Subscribe to specific event type
   * @param eventType - Event type to subscribe to
   * @param handler - Event handler function
   * @param options - Subscription options
   * @returns Event subscription handle
   */
  subscribeToType<T extends BrowserEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
    options?: EventSubscriptionOptions
  ): EventSubscription;
  
  /**
   * Unsubscribe from events
   * @param subscriptionId - Subscription ID to cancel
   */
  unsubscribe(subscriptionId: string): void;
  
  /**
   * Emit an event
   * @param event - Browser event to emit
   * @nist au-3 "Content of audit records"
   */
  emit(event: BrowserEvent): void;
  
  /**
   * Emit multiple events
   * @param events - Array of browser events
   */
  emitBatch(events: BrowserEvent[]): void;
  
  /**
   * Get event history
   * @param filter - Event filter
   * @param limit - Maximum events to return
   * @param offset - Offset for pagination
   * @returns Array of historical events
   * @nist au-7 "Audit reduction and report generation"
   */
  getHistory(
    filter?: EventFilter,
    limit?: number,
    offset?: number
  ): Promise<BrowserEvent[]>;
  
  /**
   * Clear event history
   * @param filter - Event filter for selective clearing
   * @param before - Clear events before this date
   * @nist au-4 "Audit storage capacity"
   */
  clearHistory(filter?: EventFilter, before?: Date): Promise<void>;
  
  /**
   * Get event statistics
   * @param filter - Event filter
   * @returns Event statistics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getStatistics(filter?: EventFilter): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsPerPage: Record<string, number>;
    eventsPerHour: Record<string, number>;
    errorRate: number;
    averageResponseTime?: number;
  }>;
  
  /**
   * List active subscriptions
   * @returns Array of active subscriptions
   */
  listSubscriptions(): EventSubscription[];
  
  /**
   * Pause event emission
   * @param subscriptionId - Optional subscription ID to pause
   */
  pause(subscriptionId?: string): void;
  
  /**
   * Resume event emission
   * @param subscriptionId - Optional subscription ID to resume
   */
  resume(subscriptionId?: string): void;
  
  /**
   * Check if paused
   * @param subscriptionId - Optional subscription ID to check
   * @returns True if paused
   */
  isPaused(subscriptionId?: string): boolean;
}