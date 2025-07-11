/**
 * Service dependency registration and management
 * @module server/service-registry
 * @nist cm-7 "Least functionality"
 */

import { pino, Logger } from 'pino';
import { config } from '../core/config.js';
import { InMemorySessionStore } from '../store/in-memory-session-store.js';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from '../puppeteer/config.js';
import { initializeRedis, closeRedis } from '../utils/redis-client.js';
import {
  initializeTelemetry,
  shutdownTelemetry,
  startTelemetryHealthMonitoring,
  instrumentSessionStore,
} from '../telemetry-stub.js';
const createBrowserPoolMetrics = () => {};
import { SessionStore } from '../store/session-store.interface.js';
import { ServerDependencies } from './types.js';
import { createServerConfig } from './server-config.js';

/**
 * Initialize logger with configuration
 */
export function createLogger(): Logger {
  return pino({
    name: 'app',
    level: config.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        ...bindings,
        environment: config.NODE_ENV,
        service: 'puppeteer-mcp',
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });
}

/**
 * Initialize session store
 */
export function createSessionStore(logger: Logger): SessionStore {
  return new InMemorySessionStore(logger.child({ module: 'session-store' }));
}

/**
 * Initialize browser pool
 */
export function createBrowserPool(): BrowserPool {
  return new BrowserPool({
    maxBrowsers: puppeteerConfig.poolMaxSize,
    maxPagesPerBrowser: 10, // Default reasonable limit
    idleTimeout: puppeteerConfig.idleTimeout,
    healthCheckInterval: 60000, // 1 minute
    launchOptions: {
      headless: puppeteerConfig.headless,
      executablePath: puppeteerConfig.executablePath,
      args: puppeteerConfig.args,
    },
  });
}

/**
 * Initialize all telemetry services
 */
export async function initializeAllTelemetry(
  sessionStore: SessionStore,
  _browserPool: BrowserPool,
): Promise<{
  instrumentedSessionStore: SessionStore;
  browserPoolMetrics: unknown;
}> {
  // Initialize telemetry as early as possible
  await initializeTelemetry();

  // Instrument session store after telemetry is initialized
  const instrumentedSessionStore = instrumentSessionStore(sessionStore);

  // Create browser pool metrics
  const browserPoolMetrics = createBrowserPoolMetrics();

  // Start telemetry health monitoring
  if (config.TELEMETRY_ENABLED) {
    startTelemetryHealthMonitoring(); // Check every minute
  }

  return { instrumentedSessionStore, browserPoolMetrics };
}

/**
 * Initialize browser pool for non-test environments
 */
export async function initializeBrowserPool(
  browserPool: BrowserPool,
  logger: Logger,
): Promise<void> {
  if (config.NODE_ENV !== 'test') {
    try {
      await browserPool.initialize();
      logger.info('Browser pool initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize browser pool');
      throw error;
    }
  }
}

/**
 * Initialize all external services
 */
export async function initializeExternalServices(logger: Logger): Promise<void> {
  // Initialize Redis if configured
  try {
    await initializeRedis();
    logger.info('Redis connection initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis connection');
    throw error;
  }
}

/**
 * Create and initialize all server dependencies
 */
export async function createServerDependencies(): Promise<ServerDependencies> {
  const logger = createLogger();
  let sessionStore = createSessionStore(logger);
  const browserPool = createBrowserPool();
  const serverConfig = createServerConfig();

  // Initialize external services
  await initializeExternalServices(logger);

  // Initialize browser pool
  await initializeBrowserPool(browserPool, logger);

  // Initialize telemetry and get instrumented components
  const { instrumentedSessionStore } = await initializeAllTelemetry(sessionStore, browserPool);
  sessionStore = instrumentedSessionStore;

  return {
    logger,
    sessionStore,
    browserPool,
    config: serverConfig,
  };
}

/**
 * Shutdown all services gracefully
 */
export async function shutdownAllServices(
  browserPool: BrowserPool,
  sessionStore: SessionStore,
  logger: Logger,
): Promise<void> {
  // Clean up session store
  if ('clear' in sessionStore && typeof sessionStore.clear === 'function') {
    try {
      await sessionStore.clear();
      logger.info('Session store cleared');
    } catch (error) {
      logger.error({ error }, 'Error clearing session store');
    }
  }

  // Shutdown browser pool
  try {
    logger.info('Shutting down browser pool...');
    await browserPool.shutdown();
    logger.info('Browser pool shut down successfully');
  } catch (error) {
    logger.error({ error }, 'Error shutting down browser pool');
  }

  // Close Redis connection
  try {
    logger.info('Closing Redis connection...');
    await closeRedis();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing Redis connection');
  }

  // Shutdown telemetry
  try {
    logger.info('Shutting down telemetry...');
    await shutdownTelemetry();
    logger.info('Telemetry shut down successfully');
  } catch (error) {
    logger.error({ error }, 'Error shutting down telemetry');
  }
}
