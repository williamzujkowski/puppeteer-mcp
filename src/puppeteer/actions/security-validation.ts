/**
 * Security validation for browser actions
 * @module puppeteer/actions/security-validation
 * @nist si-10 "Information input validation"
 * @nist sc-18 "Mobile code"
 */

// Define ValidationError type locally
type ValidationError = {
  field: string;
  message: string;
  code?: string;
};

/**
 * Common XSS patterns to detect in JavaScript code
 */
const XSS_PATTERNS = [
  /document\.cookie/i,
  /window\.location/i,
  /eval\s*\(/,
  /new\s+Function\s*\(/,
  /innerHTML\s*=/,
  /outerHTML\s*=/,
  /document\.write/i,
  /document\.writeln/i,
  /\.appendChild\s*\(/,
  /\.insertBefore\s*\(/,
  /\.replaceChild\s*\(/,
  /\.removeChild\s*\(/,
  /on\w+\s*=/i, // Event handlers
  /<script[^>]*>/i,
  /<iframe[^>]*>/i,
  /<object[^>]*>/i,
  /<embed[^>]*>/i,
  /javascript:/i,
];

/**
 * Dangerous keywords that might indicate malicious code
 */
const DANGEROUS_KEYWORDS = [
  'localStorage',
  'sessionStorage',
  'XMLHttpRequest',
  'fetch',
  'WebSocket',
  'Worker',
  'importScripts',
  'globalThis',
  'window.opener',
  'window.parent',
  'window.top',
  'document.domain',
  '__proto__',
  'constructor',
  'prototype',
];

/**
 * Validate JavaScript code for security issues
 * @param script - JavaScript code to validate
 * @returns Validation result with detected issues
 * @nist sc-18 "Mobile code"
 * @nist si-10 "Information input validation"
 */
export function validateJavaScript(script: string): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(script)) {
      errors.push({
        field: 'script',
        message: `Potentially dangerous pattern detected: ${pattern.source}`,
        code: 'XSS_PATTERN_DETECTED',
      });
    }
  }

  // Check for dangerous keywords
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (script.includes(keyword)) {
      warnings.push({
        field: 'script',
        message: `Potentially dangerous keyword detected: ${keyword}`,
        code: 'DANGEROUS_KEYWORD',
      });
    }
  }

  // Check script length
  if (script.length > 10000) {
    warnings.push({
      field: 'script',
      message: 'Script is very long, consider breaking it down',
      code: 'SCRIPT_TOO_LONG',
    });
  }

  // Check for infinite loops (basic detection)
  const infiniteLoopPatterns = [
    /while\s*\(\s*true\s*\)/,
    /for\s*\(\s*;\s*;\s*\)/,
    /while\s*\(\s*1\s*\)/,
  ];

  for (const pattern of infiniteLoopPatterns) {
    if (pattern.test(script)) {
      errors.push({
        field: 'script',
        message: 'Potential infinite loop detected',
        code: 'INFINITE_LOOP',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}