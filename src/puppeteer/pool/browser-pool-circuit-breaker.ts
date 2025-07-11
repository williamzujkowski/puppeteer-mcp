/**
 * Circuit breaker patterns for failure handling in browser pool
 * @module puppeteer/pool/browser-pool-circuit-breaker
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 * @nist au-5 "Response to audit processing failures"
 */

// Re-export all circuit breaker functionality from the modular implementation
export * from './circuit-breaker/index.js';

// Import and re-export main components for backward compatibility
import { CircuitBreaker } from './circuit-breaker/circuit-breaker-core.js';
import { CircuitBreakerRegistry } from './circuit-breaker/registry.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker/config.js';

// Re-export main components
export { CircuitBreaker, CircuitBreakerRegistry, DEFAULT_CIRCUIT_BREAKER_CONFIG };

/**
 * @deprecated Use imports from './circuit-breaker/index.js' instead
 * This file now acts as a facade for backward compatibility
 */
