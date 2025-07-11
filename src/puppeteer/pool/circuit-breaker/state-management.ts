/**
 * State management for circuit breaker using State Pattern
 * @module puppeteer/pool/circuit-breaker/state-management
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import { CircuitBreakerState, IStateHandler, StateTransitionContext } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-state');

/**
 * Base state handler
 */
abstract class BaseStateHandler implements IStateHandler {
  constructor(
    protected name: string,
    protected state: CircuitBreakerState,
  ) {}

  abstract canExecute(): boolean;
  abstract handleSuccess(context: StateTransitionContext): CircuitBreakerState | null;
  abstract handleFailure(context: StateTransitionContext): CircuitBreakerState | null;

  enter(context?: StateTransitionContext): void {
    logger.debug(
      {
        circuitBreaker: this.name,
        state: this.state,
        context,
      },
      'Entering state',
    );
  }

  exit(context?: StateTransitionContext): void {
    logger.debug(
      {
        circuitBreaker: this.name,
        state: this.state,
        context,
      },
      'Exiting state',
    );
  }
}

/**
 * Closed state handler
 */
export class ClosedStateHandler extends BaseStateHandler {
  constructor(name: string) {
    super(name, CircuitBreakerState.CLOSED);
  }

  canExecute(): boolean {
    return true;
  }

  handleSuccess(_context: StateTransitionContext): CircuitBreakerState | null {
    // Stay in closed state
    return null;
  }

  handleFailure(context: StateTransitionContext): CircuitBreakerState | null {
    if (context.trigger === 'failure_threshold_reached') {
      return CircuitBreakerState.OPEN;
    }
    return null;
  }
}

/**
 * Open state handler
 */
export class OpenStateHandler extends BaseStateHandler {
  constructor(name: string) {
    super(name, CircuitBreakerState.OPEN);
  }

  canExecute(): boolean {
    return false;
  }

  handleSuccess(_context: StateTransitionContext): CircuitBreakerState | null {
    // Cannot handle success in open state
    return null;
  }

  handleFailure(_context: StateTransitionContext): CircuitBreakerState | null {
    // Stay in open state
    return null;
  }

  override enter(context?: StateTransitionContext): void {
    super.enter(context);
    logger.warn(
      {
        circuitBreaker: this.name,
        context,
      },
      'Circuit breaker opened',
    );
  }
}

/**
 * Half-open state handler
 */
export class HalfOpenStateHandler extends BaseStateHandler {
  constructor(name: string) {
    super(name, CircuitBreakerState.HALF_OPEN);
  }

  canExecute(): boolean {
    return true;
  }

  handleSuccess(context: StateTransitionContext): CircuitBreakerState | null {
    if (context.trigger === 'success_threshold_reached') {
      return CircuitBreakerState.CLOSED;
    }
    return null;
  }

  handleFailure(_context: StateTransitionContext): CircuitBreakerState | null {
    // Any failure in half-open goes back to open
    return CircuitBreakerState.OPEN;
  }
}

/**
 * State machine for circuit breaker
 * @nist au-5 "Response to audit processing failures"
 */
export class CircuitBreakerStateMachine {
  private currentState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private stateHandlers: Map<CircuitBreakerState, IStateHandler>;
  private stateChangeTime: Date = new Date();
  private totalStateChanges = 0;
  private stateChangeCounts: Map<CircuitBreakerState, number> = new Map([
    [CircuitBreakerState.CLOSED, 0],
    [CircuitBreakerState.OPEN, 0],
    [CircuitBreakerState.HALF_OPEN, 0],
  ]);

  constructor(private name: string) {
    this.stateHandlers = new Map([
      [CircuitBreakerState.CLOSED, new ClosedStateHandler(name)],
      [CircuitBreakerState.OPEN, new OpenStateHandler(name)],
      [CircuitBreakerState.HALF_OPEN, new HalfOpenStateHandler(name)],
    ]);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.currentState;
  }

  /**
   * Get current state handler
   */
  getCurrentHandler(): IStateHandler {
    const handler = this.stateHandlers.get(this.currentState);
    if (!handler) {
      throw new Error(`No handler for state: ${this.currentState}`);
    }
    return handler;
  }

  /**
   * Check if execution is allowed in current state
   */
  canExecute(): boolean {
    return this.getCurrentHandler().canExecute();
  }

  /**
   * Transition to new state
   */
  transition(newState: CircuitBreakerState, context?: StateTransitionContext): boolean {
    if (this.currentState === newState) {
      return false;
    }

    const currentHandler = this.getCurrentHandler();
    const newHandler = this.stateHandlers.get(newState);

    if (!newHandler) {
      logger.error(
        {
          circuitBreaker: this.name,
          currentState: this.currentState,
          newState,
        },
        'Invalid state transition attempted',
      );
      return false;
    }

    // Exit current state
    currentHandler.exit(context);

    // Update state
    const previousState = this.currentState;
    this.currentState = newState;
    this.stateChangeTime = new Date();
    this.totalStateChanges++;

    // Update state count
    const currentCount = this.stateChangeCounts.get(newState) || 0;
    this.stateChangeCounts.set(newState, currentCount + 1);

    // Enter new state
    newHandler.enter(context);

    logger.info(
      {
        circuitBreaker: this.name,
        previousState,
        newState,
        context,
      },
      'State transition completed',
    );

    return true;
  }

  /**
   * Force state transition
   */
  forceState(newState: CircuitBreakerState, reason?: string): void {
    this.transition(newState, { forced: true, reason });
  }

  /**
   * Handle success event
   */
  handleSuccess(context: StateTransitionContext): CircuitBreakerState | null {
    return this.getCurrentHandler().handleSuccess(context);
  }

  /**
   * Handle failure event
   */
  handleFailure(context: StateTransitionContext): CircuitBreakerState | null {
    return this.getCurrentHandler().handleFailure(context);
  }

  /**
   * Get state metrics
   */
  getStateMetrics() {
    return {
      currentState: this.currentState,
      stateChangeTime: this.stateChangeTime,
      totalStateChanges: this.totalStateChanges,
      closedCount: this.stateChangeCounts.get(CircuitBreakerState.CLOSED) || 0,
      openCount: this.stateChangeCounts.get(CircuitBreakerState.OPEN) || 0,
      halfOpenCount: this.stateChangeCounts.get(CircuitBreakerState.HALF_OPEN) || 0,
    };
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.transition(CircuitBreakerState.CLOSED, { reset: true });
    this.totalStateChanges = 0;
    this.stateChangeCounts.clear();
    this.stateChangeCounts.set(CircuitBreakerState.CLOSED, 1);
    this.stateChangeCounts.set(CircuitBreakerState.OPEN, 0);
    this.stateChangeCounts.set(CircuitBreakerState.HALF_OPEN, 0);
  }
}
