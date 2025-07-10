/**
 * Session factory using Factory pattern
 * @module ws/websocket/session/session-factory
 * @nist ac-3 "Access enforcement"
 */

import type { pino } from 'pino';
import type { WSComponentDependencies, SessionManagementOptions } from '../types.js';
import { SessionStateManager } from './state-manager.js';
import { SessionEventEmitter } from './event-emitter.js';
import { SessionSecurityLogger } from './security-logger.js';
import { SessionLifecycleManager } from './lifecycle-manager.js';
import { SessionPersistenceManager } from './persistence-manager.js';
import { SessionValidationManager } from './validation-manager.js';
import { SessionStatisticsManager } from './statistics-manager.js';

/**
 * Session manager components
 */
export interface SessionManagerComponents {
  stateManager: SessionStateManager;
  eventEmitter: SessionEventEmitter;
  securityLogger: SessionSecurityLogger;
  lifecycleManager: SessionLifecycleManager;
  persistenceManager: SessionPersistenceManager;
  validationManager: SessionValidationManager;
  statisticsManager: SessionStatisticsManager;
}

/**
 * Factory for creating session management components
 * @nist ac-3 "Access enforcement"
 */
export class SessionFactory {
  /**
   * Create all session management components
   */
  static createComponents(
    dependencies: WSComponentDependencies,
    options: SessionManagementOptions = {},
  ): SessionManagerComponents {
    const logger = dependencies.logger.child({ module: 'ws-session' });

    // Create base components
    const eventEmitter = new SessionEventEmitter(logger);
    const stateManager = new SessionStateManager(logger);
    const securityLogger = new SessionSecurityLogger(logger);

    // Create lifecycle options with defaults
    const lifecycleOptions = {
      sessionTimeout: options.sessionTimeout ?? 3600000, // 1 hour
      maxSessionsPerUser: options.maxSessionsPerUser ?? 10,
      cleanupInterval: options.cleanupInterval ?? 60000, // 1 minute
    };

    // Create managers
    const lifecycleManager = new SessionLifecycleManager(
      logger,
      stateManager,
      eventEmitter,
      securityLogger,
      lifecycleOptions,
    );

    const persistenceManager = new SessionPersistenceManager(
      logger,
      dependencies.sessionStore,
      eventEmitter,
      {
        persistSessions: options.persistSessions ?? true,
        batchSize: options.batchSize ?? 10,
        flushInterval: options.flushInterval ?? 5000,
      },
    );

    const validationManager = new SessionValidationManager(
      logger,
      stateManager,
      eventEmitter,
      securityLogger,
      lifecycleOptions.sessionTimeout,
    );

    const statisticsManager = new SessionStatisticsManager(
      logger,
      stateManager,
      eventEmitter,
    );

    // Set up event listeners for persistence
    if (options.persistSessions !== false) {
      eventEmitter.on('session:created', (session) => {
        void persistenceManager.queueSession(session);
      });

      eventEmitter.on('session:updated', (session) => {
        void persistenceManager.queueSession(session);
      });

      eventEmitter.on('session:terminated', (session) => {
        void persistenceManager.removeSession(session.sessionId);
      });
    }

    // Set up event listeners for state changes
    eventEmitter.on('session:state-changed', (sessionId, from, to) => {
      const session = stateManager.getSession(sessionId);
      if (session) {
        void securityLogger.logStateChange(sessionId, session.userId, from, to);
      }
    });

    return {
      stateManager,
      eventEmitter,
      securityLogger,
      lifecycleManager,
      persistenceManager,
      validationManager,
      statisticsManager,
    };
  }

  /**
   * Create logger instance
   */
  static createLogger(parentLogger: pino.Logger, module: string): pino.Logger {
    return parentLogger.child({ module: `ws-session-${module}` });
  }
}