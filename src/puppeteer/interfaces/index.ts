/**
 * Puppeteer Integration Interfaces
 * Export all interface definitions for browser automation
 */

// Browser Pool interfaces
export type {
  BrowserPool,
  BrowserPoolOptions,
  PoolMetrics,
  BrowserInstance,
} from './browser-pool.interface.js';

// Page Manager interfaces
export type {
  PageManager,
  PageOptions,
  PageInfo,
  NavigationOptions,
  ScreenshotOptions,
} from './page-manager.interface.js';

// Action Executor interfaces
export type {
  ActionExecutor,
  BrowserAction,
  BaseBrowserAction,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction,
  ActionResult,
  ValidationResult,
  ActionContext,
} from './action-executor.interface.js';

// Browser Events interfaces
export type {
  BrowserEventEmitter,
  BrowserEvent,
  PageLifecycleEvent,
  NavigationEvent,
  NetworkEvent,
  ConsoleEvent,
  ErrorEvent,
  DialogEvent,
  DownloadEvent,
  SecurityEvent,
  PerformanceEvent,
  BrowserLifecycleEvent,
  TargetEvent,
  EventHandler,
  EventFilter,
  EventSubscriptionOptions,
  EventSubscription,
} from './browser-events.interface.js';
