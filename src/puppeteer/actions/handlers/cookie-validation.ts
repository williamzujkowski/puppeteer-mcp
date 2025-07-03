/**
 * Cookie validation functions
 * @module puppeteer/actions/handlers/cookie-validation
 * @nist si-10 "Information input validation"
 */

import type { Cookie } from 'puppeteer';

/**
 * Validate cookie name
 * @param name - Cookie name to validate
 * @throws Error if name is invalid
 */
export function validateCookieName(name: string): void {
  if (name === null || name === undefined || name === '' || name.trim() === '') {
    throw new Error('Cookie name is required');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid cookie name format');
  }

  if (name.length > 255) {
    throw new Error('Cookie name too long');
  }
}

/**
 * Validate cookie value
 * @param value - Cookie value to validate
 * @throws Error if value is invalid
 */
export function validateCookieValue(value?: string): void {
  if (value !== null && value !== undefined && value !== '' && value.length > 4096) {
    throw new Error('Cookie value too long');
  }
}

/**
 * Validate and normalize cookie domain
 * @param domain - Cookie domain to validate
 * @param currentUrl - Current page URL for domain validation
 * @returns Normalized domain
 * @throws Error if domain is invalid
 */
export function validateCookieDomain(domain: string | undefined, currentUrl: string): string | undefined {
  if (domain === null || domain === undefined || domain === '') {
    return undefined;
  }

  // Remove leading dot if present
  const normalizedDomain = domain.replace(/^\./, '');
  
  // Validate domain format
  if (!/^[a-zA-Z0-9.-]+$/.test(normalizedDomain)) {
    throw new Error('Invalid cookie domain format');
  }

  // Check if domain is related to current URL
  const currentDomain = new URL(currentUrl).hostname;
  if (!currentDomain.endsWith(normalizedDomain) && normalizedDomain !== currentDomain) {
    throw new Error('Cookie domain does not match current page domain');
  }

  return normalizedDomain;
}

/**
 * Validate cookie path
 * @param path - Cookie path to validate
 * @throws Error if path is invalid
 */
export function validateCookiePath(path?: string): void {
  if (path !== null && path !== undefined && path !== '' && (path.length > 255 || path.startsWith('/') === false)) {
    throw new Error('Invalid cookie path');
  }
}

/**
 * Validate cookie expiration
 * @param expires - Cookie expiration time
 * @throws Error if expiration is invalid
 */
export function validateCookieExpiration(expires?: number): void {
  if (expires !== undefined && expires < 0) {
    throw new Error('Invalid cookie expiration time');
  }
}

/**
 * Validate cookie SameSite and security settings
 * @param sameSite - SameSite attribute
 * @param secure - Secure flag
 * @throws Error if settings are invalid
 */
export function validateCookieSecurity(sameSite?: 'Strict' | 'Lax' | 'None', secure?: boolean): void {
  if (sameSite !== null && sameSite !== undefined && ['Strict', 'Lax', 'None'].includes(sameSite) === false) {
    throw new Error('Invalid SameSite value');
  }

  if (sameSite === 'None' && !secure) {
    throw new Error('SameSite=None requires Secure flag');
  }
}

/**
 * Validate cookie data for security and correctness
 * @param cookie - Cookie to validate
 * @param currentUrl - Current page URL for domain validation
 * @returns Validated cookie
 * @nist si-10 "Information input validation"
 */
export function validateCookie(
  cookie: {
    name: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  },
  currentUrl: string
): Cookie {
  // Validate individual components
  validateCookieName(cookie.name);
  validateCookieValue(cookie.value);
  const domain = validateCookieDomain(cookie.domain, currentUrl);
  validateCookiePath(cookie.path);
  validateCookieExpiration(cookie.expires);
  validateCookieSecurity(cookie.sameSite, cookie.secure);

  // Build validated cookie object
  const result: Cookie = {
    name: cookie.name,
    value: cookie.value ?? '',
    domain: domain ?? new URL(currentUrl).hostname,
    path: cookie.path ?? '/',
    expires: cookie.expires ?? -1,
    size: (cookie.name.length + (cookie.value ?? '').length),
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? false,
    session: cookie.expires === undefined,
    sameSite: cookie.sameSite ?? 'Lax',
  };

  return result;
}