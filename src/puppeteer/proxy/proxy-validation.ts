/**
 * Proxy Validation Utilities
 * @module puppeteer/proxy/proxy-validation
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * 
 * This file re-exports all proxy validation functionality from the modular structure
 */

export {
  // Main validation functions
  validateProxyConfig,
  validateContextProxyConfig,
  
  // Utility functions
  sanitizeProxyConfigForLogging,
  validateProxyCredentials,
  generateSecureProxyConfig,
  
  // Types
  type ProxyValidationResult,
  type ContextProxyValidationResult,
} from './validation/index.js';