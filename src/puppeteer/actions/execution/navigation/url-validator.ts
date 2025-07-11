/**
 * URL validation and SSRF protection for navigation actions
 * @module puppeteer/actions/execution/navigation/url-validator
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist sc-7 "Boundary protection"
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation:url-validator');

/**
 * URL validation result interface
 */
export interface UrlValidationResult {
  /** Whether URL is valid and safe */
  isValid: boolean;
  /** Validation error message if invalid */
  error?: string;
  /** Normalized URL if valid */
  normalizedUrl?: string;
  /** Security warnings */
  warnings?: string[];
}

/**
 * URL validation configuration
 */
export interface UrlValidationConfig {
  /** Allowed protocols */
  allowedProtocols?: string[];
  /** Blocked domains/IPs */
  blockedHosts?: string[];
  /** Allow localhost/private IPs */
  allowPrivateNetworks?: boolean;
  /** Maximum URL length */
  maxLength?: number;
  /** Allow file:// protocol */
  allowFileProtocol?: boolean;
}

/**
 * Default validation configuration
 * @nist sc-7 "Boundary protection"
 */
const DEFAULT_CONFIG: Required<UrlValidationConfig> = {
  allowedProtocols: ['http:', 'https:'],
  blockedHosts: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254', // AWS metadata
    '100.64.0.0/10', // RFC 6598 shared address space
  ],
  allowPrivateNetworks: false,
  maxLength: 2048,
  allowFileProtocol: false,
};

/**
 * URL validator with SSRF protection
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class UrlValidator {
  private readonly config: Required<UrlValidationConfig>;

  constructor(config?: Partial<UrlValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.debug('URL validator initialized', {
      allowedProtocols: this.config.allowedProtocols,
      allowPrivateNetworks: this.config.allowPrivateNetworks,
      maxLength: this.config.maxLength,
    });
  }

  /**
   * Validate URL for navigation safety
   * @param url - URL to validate
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  async validateUrl(url: string): Promise<UrlValidationResult> {
    const warnings: string[] = [];

    try {
      // Basic input validation
      if (!url || typeof url !== 'string') {
        return {
          isValid: false,
          error: 'URL must be a non-empty string',
        };
      }

      // Length check
      if (url.length > this.config.maxLength) {
        return {
          isValid: false,
          error: `URL exceeds maximum length of ${this.config.maxLength} characters`,
        };
      }

      // URL parsing
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return {
          isValid: false,
          error: 'Invalid URL format',
        };
      }

      // Protocol validation
      if (!this.config.allowedProtocols.includes(parsedUrl.protocol)) {
        return {
          isValid: false,
          error: `Protocol ${parsedUrl.protocol} is not allowed. Allowed protocols: ${this.config.allowedProtocols.join(', ')}`,
        };
      }

      // File protocol check
      if (parsedUrl.protocol === 'file:' && !this.config.allowFileProtocol) {
        return {
          isValid: false,
          error: 'File protocol is not allowed',
        };
      }

      // SSRF protection
      const ssrfCheck = await this.checkForSsrf(parsedUrl);
      if (!ssrfCheck.isValid) {
        return ssrfCheck;
      }

      // Host validation
      const hostCheck = this.validateHost(parsedUrl.hostname);
      if (!hostCheck.isValid) {
        return hostCheck;
      }

      warnings.push(...(hostCheck.warnings ?? []));

      const normalizedUrl = this.normalizeUrl(parsedUrl);

      logger.debug('URL validation passed', {
        originalUrl: url,
        normalizedUrl,
        warnings,
      });

      return {
        isValid: true,
        normalizedUrl,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

      logger.error('URL validation failed', {
        url,
        error: errorMessage,
      });

      return {
        isValid: false,
        error: `Validation error: ${errorMessage}`,
      };
    }
  }

  /**
   * Check for SSRF vulnerabilities
   * @param parsedUrl - Parsed URL object
   * @returns Validation result
   * @nist sc-7 "Boundary protection"
   */
  private async checkForSsrf(parsedUrl: URL): Promise<UrlValidationResult> {
    const hostname = parsedUrl.hostname;

    // Check for private/local networks
    if (!this.config.allowPrivateNetworks) {
      if (this.isPrivateNetwork(hostname)) {
        return {
          isValid: false,
          error: `Access to private network ${hostname} is not allowed`,
        };
      }
    }

    // Check blocked hosts
    if (this.config.blockedHosts.includes(hostname)) {
      return {
        isValid: false,
        error: `Host ${hostname} is blocked`,
      };
    }

    // Check for URL redirects that might bypass validation
    if (this.hasRedirectIndicators(parsedUrl)) {
      return {
        isValid: false,
        error: 'URL contains potential redirect bypass indicators',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate hostname
   * @param hostname - Hostname to validate
   * @returns Validation result
   */
  private validateHost(hostname: string): UrlValidationResult {
    const warnings: string[] = [];

    // Empty hostname check
    if (!hostname) {
      return {
        isValid: false,
        error: 'Hostname cannot be empty',
      };
    }

    // Hostname length check
    if (hostname.length > 253) {
      return {
        isValid: false,
        error: 'Hostname exceeds maximum length of 253 characters',
      };
    }

    // Check for suspicious patterns
    if (this.hasSuspiciousHostnamePatterns(hostname)) {
      warnings.push('Hostname contains potentially suspicious patterns');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check if hostname is in private network range
   * @param hostname - Hostname to check
   * @returns True if private network
   * @nist sc-7 "Boundary protection"
   */
  private isPrivateNetwork(hostname: string): boolean {
    // Localhost patterns
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) {
      return true;
    }

    // IPv4 private ranges
    const ipv4Patterns = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // Link-local
    ];

    for (const pattern of ipv4Patterns) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    // IPv6 private ranges
    const ipv6Patterns = [
      /^::1$/, // Loopback
      /^fe80:/i, // Link-local
      /^fc00:/i, // Unique local
      /^fd00:/i, // Unique local
    ];

    for (const pattern of ipv6Patterns) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for URL redirect bypass indicators
   * @param parsedUrl - Parsed URL object
   * @returns True if suspicious patterns found
   */
  private hasRedirectIndicators(parsedUrl: URL): boolean {
    const url = parsedUrl.href;

    // Check for double URL encoding
    if (url.includes('%25')) {
      return true;
    }

    // Check for suspicious query parameters
    const suspiciousParams = ['redirect', 'url', 'next', 'continue', 'return', 'goto'];
    for (const param of suspiciousParams) {
      if (parsedUrl.searchParams.has(param)) {
        const value = parsedUrl.searchParams.get(param) ?? '';
        if (value.includes('://') || value.includes('%3A%2F%2F')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check for suspicious hostname patterns
   * @param hostname - Hostname to check
   * @returns True if suspicious patterns found
   */
  private hasSuspiciousHostnamePatterns(hostname: string): boolean {
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+\.nip\.io$/i, // nip.io dynamic DNS
      /\d+\.\d+\.\d+\.\d+\.xip\.io$/i, // xip.io dynamic DNS
      /[0-9a-f:]+\.sslip\.io$/i, // sslip.io DNS
      /\.(tk|ml|ga|cf)$/i, // Free TLDs often used maliciously
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(hostname));
  }

  /**
   * Normalize URL for consistent handling
   * @param parsedUrl - Parsed URL object
   * @returns Normalized URL string
   */
  private normalizeUrl(parsedUrl: URL): string {
    // Remove default ports
    if (
      (parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
      (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')
    ) {
      parsedUrl.port = '';
    }

    // Normalize pathname
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      parsedUrl.pathname = '/';
    }

    return parsedUrl.href;
  }

  /**
   * Validate multiple URLs
   * @param urls - Array of URLs to validate
   * @returns Array of validation results
   */
  async validateUrls(urls: string[]): Promise<UrlValidationResult[]> {
    const results = await Promise.allSettled(urls.map((url) => this.validateUrl(url)));

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error('URL validation promise rejected', {
          url: urls[index],
          error: result.reason,
        });
        return {
          isValid: false,
          error: `Validation failed: ${result.reason}`,
        };
      }
    });
  }

  /**
   * Update validation configuration
   * @param config - New configuration to merge
   */
  updateConfig(config: Partial<UrlValidationConfig>): void {
    Object.assign(this.config, config);

    logger.info('URL validator configuration updated', {
      newConfig: config,
    });
  }

  /**
   * Get current validation configuration
   * @returns Current configuration
   */
  getConfig(): Required<UrlValidationConfig> {
    return { ...this.config };
  }
}

/**
 * Create URL validator instance with default configuration
 * @param config - Optional configuration override
 * @returns URL validator instance
 */
export function createUrlValidator(config?: Partial<UrlValidationConfig>): UrlValidator {
  return new UrlValidator(config);
}

/**
 * Quick URL validation function
 * @param url - URL to validate
 * @param config - Optional validation configuration
 * @returns Validation result
 */
export async function validateUrl(
  url: string,
  config?: Partial<UrlValidationConfig>,
): Promise<UrlValidationResult> {
  const validator = createUrlValidator(config);
  return validator.validateUrl(url);
}
