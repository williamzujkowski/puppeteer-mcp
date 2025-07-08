/**
 * Configuration Validation Utilities
 * @module cli/config-validation
 * @description Utilities for validating configuration settings
 */

// Config is imported dynamically when needed to avoid side effects

export interface ValidationResult {
  issues: string[];
  warnings: string[];
}

/**
 * Validate security settings for production
 */
async function validateProductionSecurity(): Promise<ValidationResult> {
  const { config } = await import('../core/config.js');
  const issues: string[] = [];
  const warnings: string[] = [];

  if (config.NODE_ENV !== 'production') {
    return { issues, warnings };
  }

  if (!config.TLS_ENABLED) {
    issues.push('TLS must be enabled in production');
  }

  if (config.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (config.SESSION_SECRET.length < 32) {
    issues.push('SESSION_SECRET must be at least 32 characters in production');
  }

  if (config.CORS_ORIGIN === '*') {
    warnings.push('CORS_ORIGIN is set to * in production - consider restricting');
  }

  if (!config.AUDIT_LOG_ENABLED) {
    issues.push('Audit logging must be enabled in production');
  }

  return { issues, warnings };
}

/**
 * Validate TLS configuration
 */
async function validateTLSConfig(): Promise<ValidationResult> {
  const { config } = await import('../core/config.js');
  const issues: string[] = [];
  const warnings: string[] = [];

  if (config.TLS_ENABLED) {
    const hasCertPath =
      config.TLS_CERT_PATH !== null &&
      config.TLS_CERT_PATH !== undefined &&
      config.TLS_CERT_PATH !== '';
    const hasKeyPath =
      config.TLS_KEY_PATH !== null &&
      config.TLS_KEY_PATH !== undefined &&
      config.TLS_KEY_PATH !== '';

    if (!hasCertPath || !hasKeyPath) {
      issues.push('TLS_CERT_PATH and TLS_KEY_PATH must be set when TLS is enabled');
    }
  }

  return { issues, warnings };
}

/**
 * Validate rate limiting configuration
 */
async function validateRateLimiting(): Promise<ValidationResult> {
  const { config } = await import('../core/config.js');
  const issues: string[] = [];
  const warnings: string[] = [];

  if (config.RATE_LIMIT_WINDOW < 60000) {
    warnings.push('Rate limit window is less than 1 minute - may be too restrictive');
  }

  return { issues, warnings };
}

/**
 * Validate browser pool configuration
 */
async function validateBrowserPool(): Promise<ValidationResult> {
  const { config } = await import('../core/config.js');
  const issues: string[] = [];
  const warnings: string[] = [];

  if (config.BROWSER_POOL_MAX_SIZE > 10) {
    warnings.push('Browser pool max size is high - ensure sufficient system resources');
  }

  return { issues, warnings };
}

/**
 * Validate all configuration settings
 */
export async function validateConfiguration(): Promise<ValidationResult> {
  const results: ValidationResult[] = await Promise.all([
    validateProductionSecurity(),
    validateTLSConfig(),
    validateRateLimiting(),
    validateBrowserPool(),
  ]);

  return results.reduce(
    (acc, result) => ({
      issues: [...acc.issues, ...result.issues],
      warnings: [...acc.warnings, ...result.warnings],
    }),
    { issues: [], warnings: [] },
  );
}
