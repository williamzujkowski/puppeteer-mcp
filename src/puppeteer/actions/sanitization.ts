/**
 * Sanitization utilities for browser actions
 * @module puppeteer/actions/sanitization
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */

/**
 * Security keywords to check for in JavaScript code
 * @nist si-10 "Information input validation"
 */
const DANGEROUS_KEYWORDS = [
  'eval',
  'Function',
  'constructor',
  'prototype',
  '__proto__',
  'globalThis',
  'window',
  'self',
  'top',
  'parent',
  'frames',
  'location',
  'document.write',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'execCommand',
  'setTimeout',
  'setInterval',
  'import',
  'require',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'postMessage',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'crypto',
  'atob',
  'btoa',
];

/**
 * Validate JavaScript code for security
 * @param code - JavaScript code to validate
 * @throws Error if code is unsafe
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export function validateJavaScriptCode(code: string): void {
  // Length check
  if (code.length > 50000) {
    throw new Error('JavaScript code is too long');
  }

  // Check for dangerous keywords
  const lowerCode = code.toLowerCase();
  const foundDangerous = DANGEROUS_KEYWORDS.filter(keyword => 
    lowerCode.includes(keyword.toLowerCase())
  );
  
  if (foundDangerous.length > 0) {
    throw new Error(`Dangerous keywords found: ${foundDangerous.join(', ')}`);
  }

  // Check for eval usage
  if (/eval\s*\(/.test(code)) {
    throw new Error('eval() is not allowed');
  }

  // Check for Function constructor
  if (/new\s+Function\s*\(/.test(code)) {
    throw new Error('Function constructor is not allowed');
  }

  // Check for dynamic imports
  if (/import\s*\(/.test(code)) {
    throw new Error('Dynamic imports are not allowed');
  }

  // Check for script injection patterns
  const scriptPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  if (scriptPatterns.some(pattern => pattern.test(code))) {
    throw new Error('Script injection patterns detected');
  }
}

/**
 * Sanitize URL for safe navigation
 * @param url - URL to sanitize
 * @returns Sanitized URL
 * @nist si-10 "Information input validation"
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }
    
    // Remove credentials from URL
    parsed.username = '';
    parsed.password = '';
    
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize file path for upload
 * @param filePath - File path to sanitize
 * @returns Sanitized file path
 * @nist si-10 "Information input validation"
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove any directory traversal attempts
  const sanitized = filePath
    .replace(/\.\./g, '')
    .replace(/[<>:|?*]/g, '')
    .replace(/^\//g, '')
    .replace(/^~\//g, '');
  
  // Ensure path doesn't start with system directories
  const dangerousPaths = ['/etc', '/usr', '/bin', '/sbin', '/var', '/tmp'];
  if (dangerousPaths.some(path => sanitized.startsWith(path))) {
    throw new Error('Access to system directories is not allowed');
  }
  
  return sanitized;
}