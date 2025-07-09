/**
 * Proxy configuration types and schemas
 * @module puppeteer/types/proxy
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ia-5 "Authenticator management"
 */

import { z } from 'zod';

/**
 * Proxy protocol types
 */
export enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5',
}

/**
 * Proxy authentication schema
 * @nist ia-5 "Authenticator management"
 */
export const proxyAuthSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type ProxyAuth = z.infer<typeof proxyAuthSchema>;

/**
 * Proxy bypass configuration schema
 * @nist ac-4 "Information flow enforcement"
 */
export const proxyBypassSchema = z.array(z.string()).default([]);

/**
 * Single proxy configuration schema
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const proxyConfigSchema = z.object({
  protocol: z.nativeEnum(ProxyProtocol),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  auth: proxyAuthSchema.optional(),
  bypass: proxyBypassSchema,
  // Advanced options
  connectionTimeout: z.number().int().positive().default(30000), // 30 seconds
  requestTimeout: z.number().int().positive().default(60000), // 60 seconds
  maxRetries: z.number().int().min(0).max(10).default(3),
  healthCheckInterval: z.number().int().positive().default(300000), // 5 minutes
  healthCheckUrl: z.string().url().default('https://www.google.com'),
  // Security options
  rejectUnauthorized: z.boolean().default(true),
  // Metadata
  name: z.string().optional(),
  tags: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
});

export type ProxyConfig = z.infer<typeof proxyConfigSchema>;

/**
 * Proxy pool configuration for rotation
 * @nist ac-4 "Information flow enforcement"
 */
export const proxyPoolConfigSchema = z.object({
  proxies: z.array(proxyConfigSchema).min(1),
  strategy: z.enum(['round-robin', 'random', 'least-used', 'priority', 'health-based']).default('round-robin'),
  healthCheckEnabled: z.boolean().default(true),
  healthCheckInterval: z.number().int().positive().default(300000), // 5 minutes
  failoverEnabled: z.boolean().default(true),
  failoverThreshold: z.number().int().min(1).max(10).default(3),
  maxConcurrentChecks: z.number().int().min(1).max(10).default(3),
});

export type ProxyPoolConfig = z.infer<typeof proxyPoolConfigSchema>;

/**
 * Browser context proxy configuration
 * @nist ac-4 "Information flow enforcement"
 */
export const contextProxyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  proxy: proxyConfigSchema.optional(),
  pool: proxyPoolConfigSchema.optional(),
  // Context-specific options
  rotateOnError: z.boolean().default(true),
  rotateOnInterval: z.boolean().default(false),
  rotationInterval: z.number().int().positive().default(3600000), // 1 hour
  // Security options
  validateCertificates: z.boolean().default(true),
  allowInsecure: z.boolean().default(false),
});

export type ContextProxyConfig = z.infer<typeof contextProxyConfigSchema>;

/**
 * Proxy health status
 * @nist si-4 "Information system monitoring"
 */
export interface ProxyHealthStatus {
  proxyId: string;
  healthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  errorCount: number;
  successCount: number;
  consecutiveFailures: number;
  lastError?: string;
}

/**
 * Proxy metrics
 * @nist au-3 "Content of audit records"
 */
export interface ProxyMetrics {
  proxyId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  totalBandwidth: number;
  lastUsed: Date;
}

/**
 * Proxy rotation event
 * @nist au-3 "Content of audit records"
 */
export interface ProxyRotationEvent {
  contextId: string;
  oldProxyId?: string;
  newProxyId: string;
  reason: 'scheduled' | 'error' | 'health' | 'manual';
  timestamp: Date;
}

/**
 * Validates a proxy URL
 * @nist cm-6 "Configuration settings"
 */
export function validateProxyUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    const validProtocols = ['http:', 'https:', 'socks4:', 'socks5:'];
    
    if (!validProtocols.includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}` };
    }
    
    if (!parsed.hostname) {
      return { valid: false, error: 'Missing hostname' };
    }
    
    const port = parsed.port ? parseInt(parsed.port, 10) : null;
    if (port !== null && (isNaN(port) || port < 1 || port > 65535)) {
      return { valid: false, error: `Invalid port: ${parsed.port}` };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid proxy URL format' };
  }
}

/**
 * Formats a proxy configuration into a URL string
 * @nist cm-6 "Configuration settings"
 */
export function formatProxyUrl(config: ProxyConfig): string {
  let url = `${config.protocol}://`;
  
  if (config.auth) {
    url += `${encodeURIComponent(config.auth.username)}:${encodeURIComponent(config.auth.password)}@`;
  }
  
  url += `${config.host}:${config.port}`;
  
  return url;
}

/**
 * Checks if a URL should bypass the proxy
 * @nist ac-4 "Information flow enforcement"
 */
export function shouldBypassProxy(url: string, bypassList: string[]): boolean {
  const targetUrl = new URL(url);
  
  for (const pattern of bypassList) {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(targetUrl.hostname)) {
        return true;
      }
    }
    // Handle exact matches
    else if (targetUrl.hostname === pattern || targetUrl.host === pattern) {
      return true;
    }
    // Handle IP ranges (basic support)
    else if (pattern.includes('/') && isIpInRange(targetUrl.hostname, pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Basic IP range checking
 * @private
 */
function isIpInRange(ip: string, range: string): boolean {
  // This is a simplified implementation
  // In production, use a proper IP range library
  try {
    const [rangeIp, rangeMask] = range.split('/');
    if (!rangeIp || !rangeMask) return false;
    
    // For now, just check if the IP starts with the same prefix
    const maskBits = parseInt(rangeMask, 10);
    if (maskBits === 8) {
      return ip.startsWith(rangeIp.split('.')[0] + '.');
    } else if (maskBits === 16) {
      return ip.startsWith(rangeIp.split('.').slice(0, 2).join('.') + '.');
    } else if (maskBits === 24) {
      return ip.startsWith(rangeIp.split('.').slice(0, 3).join('.') + '.');
    }
  } catch {
    return false;
  }
  
  return false;
}