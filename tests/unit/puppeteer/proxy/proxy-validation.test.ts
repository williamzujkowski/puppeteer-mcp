/**
 * Proxy Validation Tests
 * @module tests/unit/puppeteer/proxy/proxy-validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateProxyConfig,
  validateContextProxyConfig,
  validateProxyCredentials,
  sanitizeProxyConfigForLogging,
  generateSecureProxyConfig,
} from '../../../../src/puppeteer/proxy/proxy-validation.js';
import type { ProxyConfig, ContextProxyConfig } from '../../../../src/puppeteer/types/proxy.js';

describe('Proxy Validation', () => {
  describe('validateProxyConfig', () => {
    it('should validate a valid HTTP proxy configuration', async () => {
      const config: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        bypass: ['localhost', '127.0.0.1'],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const result = await validateProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBeDefined();
    });

    it('should validate a SOCKS5 proxy with authentication', async () => {
      const config: ProxyConfig = {
        protocol: 'socks5',
        host: 'socks.example.com',
        port: 1080,
        auth: {
          username: 'testuser',
          password: 'strongpassword123',
        },
        bypass: [],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const result = await validateProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid port numbers', async () => {
      const config = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 70000, // Invalid port
      };

      const result = await validateProxyConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('port');
    });

    it('should warn about weak passwords', async () => {
      const config: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'admin',
          password: 'weak',
        },
        bypass: [],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const result = await validateProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Proxy password should be at least 8 characters long');
      expect(result.warnings).toContain('Proxy username appears to be a default value');
    });

    it('should validate bypass patterns', async () => {
      const config: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        bypass: [
          'localhost',
          '*.example.com',
          '192.168.1.0/24',
          'invalid@pattern', // Invalid
        ],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const result = await validateProxyConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid bypass pattern: invalid@pattern');
    });
  });

  describe('validateContextProxyConfig', () => {
    it('should validate a context with single proxy', async () => {
      const config: ContextProxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080,
          bypass: [],
          connectionTimeout: 30000,
          requestTimeout: 60000,
          maxRetries: 3,
          healthCheckInterval: 300000,
          healthCheckUrl: 'https://www.google.com',
          rejectUnauthorized: true,
          priority: 50,
          tags: [],
        },
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await validateContextProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a context with proxy pool', async () => {
      const config: ContextProxyConfig = {
        enabled: true,
        pool: {
          proxies: [
            {
              protocol: 'http',
              host: 'proxy1.example.com',
              port: 8080,
              bypass: [],
              connectionTimeout: 30000,
              requestTimeout: 60000,
              maxRetries: 3,
              healthCheckInterval: 300000,
              healthCheckUrl: 'https://www.google.com',
              rejectUnauthorized: true,
              priority: 50,
              tags: [],
            },
            {
              protocol: 'socks5',
              host: 'proxy2.example.com',
              port: 1080,
              bypass: [],
              connectionTimeout: 30000,
              requestTimeout: 60000,
              maxRetries: 3,
              healthCheckInterval: 300000,
              healthCheckUrl: 'https://www.google.com',
              rejectUnauthorized: true,
              priority: 50,
              tags: [],
            },
          ],
          strategy: 'round-robin',
          healthCheckEnabled: true,
          healthCheckInterval: 300000,
          failoverEnabled: true,
          failoverThreshold: 3,
          maxConcurrentChecks: 3,
        },
        rotateOnError: true,
        rotateOnInterval: true,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await validateContextProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject enabled context without proxy configuration', async () => {
      const config: ContextProxyConfig = {
        enabled: true,
        rotateOnError: true,
        rotateOnInterval: false,
        rotationInterval: 3600000,
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await validateContextProxyConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Proxy configuration must include either a single proxy or a proxy pool',
      );
    });

    it('should warn about short rotation intervals', async () => {
      const config: ContextProxyConfig = {
        enabled: true,
        proxy: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080,
          bypass: [],
          connectionTimeout: 30000,
          requestTimeout: 60000,
          maxRetries: 3,
          healthCheckInterval: 300000,
          healthCheckUrl: 'https://www.google.com',
          rejectUnauthorized: true,
          priority: 50,
          tags: [],
        },
        rotateOnError: true,
        rotateOnInterval: true,
        rotationInterval: 30000, // 30 seconds
        validateCertificates: true,
        allowInsecure: false,
      };

      const result = await validateContextProxyConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'Rotation interval less than 1 minute may cause excessive proxy switching',
      );
    });
  });

  describe('validateProxyCredentials', () => {
    it('should validate strong credentials', () => {
      const result = validateProxyCredentials('validuser123', 'StrongP@ssw0rd!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty username', () => {
      const result = validateProxyCredentials('', 'StrongP@ssw0rd!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username cannot be empty');
    });

    it('should reject short passwords', () => {
      const result = validateProxyCredentials('user', 'weak');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject common weak passwords', () => {
      const result = validateProxyCredentials('user', 'password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too weak');
    });

    it('should reject invalid username characters', () => {
      const result = validateProxyCredentials('user@name', 'StrongP@ssw0rd!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username contains invalid characters');
    });
  });

  describe('sanitizeProxyConfigForLogging', () => {
    it('should redact password in auth configuration', () => {
      const config: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'testuser',
          password: 'secretpassword',
        },
        bypass: ['localhost'],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        name: 'Test Proxy',
        priority: 50,
        tags: ['test'],
      };

      const sanitized = sanitizeProxyConfigForLogging(config);
      expect(sanitized.auth?.username).toBe('testuser');
      expect(sanitized.auth?.password).toBe('***REDACTED***');
      expect(sanitized.host).toBe('proxy.example.com');
      expect(sanitized.port).toBe(8080);
    });

    it('should not include auth field if not present', () => {
      const config: ProxyConfig = {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        bypass: [],
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRetries: 3,
        healthCheckInterval: 300000,
        healthCheckUrl: 'https://www.google.com',
        rejectUnauthorized: true,
        priority: 50,
        tags: [],
      };

      const sanitized = sanitizeProxyConfigForLogging(config);
      expect(sanitized.auth).toBeUndefined();
    });
  });

  describe('generateSecureProxyConfig', () => {
    it('should generate secure proxy configuration with defaults', () => {
      const config = generateSecureProxyConfig('proxy.example.com', 8080);

      expect(config.host).toBe('proxy.example.com');
      expect(config.port).toBe(8080);
      expect(config.protocol).toBe('http');
      expect(config.bypass).toContain('localhost');
      expect(config.bypass).toContain('127.0.0.1');
      expect(config.bypass).toContain('192.168.*');
      expect(config.rejectUnauthorized).toBe(true);
      expect(config.connectionTimeout).toBe(30000);
    });

    it('should allow protocol override', () => {
      const config = generateSecureProxyConfig('socks.example.com', 1080, 'socks5');
      expect(config.protocol).toBe('socks5');
    });
  });
});
