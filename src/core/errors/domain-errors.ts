/**
 * Domain-specific error classes with comprehensive error context
 * @module core/errors/domain-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 * 
 * This file re-exports all domain errors from their modular files
 * for backward compatibility.
 */

// Re-export all domain errors from the modular files
export * from './domain/index.js';