/**
 * Telemetry exporters module - main entry point
 * @module telemetry/exporters
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// Re-export everything from the main exporters coordinator
export * from './exporters.js';

// Main functions for backward compatibility
export {
  createTraceExporter,
  createMetricExporter,
  createMultiTraceExporter,
  createMultiMetricExporter,
  checkExporterHealth,
} from './exporters.js';