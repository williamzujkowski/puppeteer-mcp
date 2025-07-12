---
title: Proxy Configuration Guide
description: Comprehensive proxy support for browser contexts including HTTP/HTTPS/SOCKS proxies, authentication, health monitoring, automatic rotation, and failover capabilities
---

# Proxy Configuration Guide

The puppeteer-mcp project includes comprehensive proxy support for browser contexts, allowing you to route browser traffic through HTTP/HTTPS/SOCKS proxies. This feature supports authentication, health monitoring, automatic rotation, and failover capabilities.

:::note[Enterprise Proxy Support]
The proxy system provides enterprise-grade features including multiple protocols, authentication, health monitoring, automatic rotation, and NIST-compliant security controls.
:::

## Features

- **Multiple Proxy Protocols**: HTTP, HTTPS, SOCKS4, and SOCKS5
- **Authentication Support**: Username/password authentication for all proxy types
- **Bypass Lists**: Configure domains/IPs to bypass proxy
- **Proxy Pools**: Configure multiple proxies with automatic rotation
- **Health Monitoring**: Automatic health checks and failover
- **Load Balancing**: Multiple rotation strategies (round-robin, random, least-used, priority, health-based)
- **Security**: NIST-compliant implementation with secure credential handling
- **Monitoring**: Comprehensive metrics and alerting

## Basic Usage

### Single Proxy Configuration

```typescript
const contextArgs = {
  sessionId: 'your-session-id',
  name: 'proxy-context',
  options: {
    proxy: {
      enabled: true,
      config: {
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'pass',
        },
        bypass: ['localhost', '*.internal.com'],
      },
    },
  },
};

// Create context via MCP
const response = await mcpClient.callTool('createBrowserContext', contextArgs);
```

### Proxy Pool Configuration

```typescript
const contextArgs = {
  sessionId: 'your-session-id',
  name: 'pool-context',
  options: {
    proxy: {
      enabled: true,
      pool: {
        proxies: [
          {
            protocol: 'http',
            host: 'proxy1.example.com',
            port: 8080,
            priority: 100, // Higher priority
          },
          {
            protocol: 'socks5',
            host: 'proxy2.example.com',
            port: 1080,
            priority: 50,
          },
        ],
        strategy: 'priority', // Use priority-based selection
        healthCheckEnabled: true,
        failoverEnabled: true,
        failoverThreshold: 3, // Failover after 3 consecutive failures
      },
      rotateOnError: true,
      rotateOnInterval: true,
      rotationInterval: 3600000, // Rotate every hour
    },
  },
};
```

## Proxy Configuration Options

### Protocol Types

- `http`: Standard HTTP proxy
- `https`: HTTPS proxy with SSL/TLS
- `socks4`: SOCKS4 proxy
- `socks5`: SOCKS5 proxy with optional authentication

### Rotation Strategies

1. **round-robin**: Cycles through proxies in order
2. **random**: Randomly selects a proxy
3. **least-used**: Selects the proxy with fewest requests
4. **priority**: Selects based on configured priority values
5. **health-based**: Selects based on health metrics and performance

### Bypass Patterns

Configure domains/IPs to bypass the proxy:

```typescript
bypass: [
  'localhost', // Exact match
  '127.0.0.1', // IP address
  '*.internal.com', // Wildcard subdomain
  '192.168.1.0/24', // IP range (CIDR notation)
  '10.*', // IP prefix
];
```

## Advanced Configuration

### Health Check Settings

```typescript
{
  healthCheckInterval: 300000,     // Check every 5 minutes
  healthCheckUrl: 'https://www.google.com',
  connectionTimeout: 30000,        // 30 second timeout
  maxRetries: 3,                   // Retry failed requests 3 times
  rejectUnauthorized: true         // Validate SSL certificates
}
```

### Proxy Monitoring

Enable proxy monitoring for detailed metrics:

```typescript
import { proxyMonitor } from 'puppeteer-mcp/proxy';

// Start monitoring
await proxyMonitor.start();

// Listen for events
proxyMonitor.on('proxy:unhealthy', ({ proxyId, error }) => {
  console.warn(`Proxy ${proxyId} is unhealthy: ${error}`);
});

proxyMonitor.on('performance:alert', ({ proxyId, metric, value, threshold }) => {
  console.warn(`Performance alert for ${proxyId}: ${metric}=${value} (threshold: ${threshold})`);
});

// Get current status
const status = proxyMonitor.getStatus();
console.log('Pool health:', status.currentMetrics.poolHealth);
```

## Security Considerations

### Credential Management

:::caution[Security Best Practices]
- Never hardcode proxy credentials in source code
- Use environment variables or secure credential stores
- Passwords are automatically redacted in logs
- Minimum 8-character password requirement
:::

### Network Security

- SSL certificate validation is enabled by default
- Set `rejectUnauthorized: false` only for testing
- Use bypass lists to exclude sensitive internal domains
- Monitor proxy health to detect potential issues

### NIST Compliance

The implementation follows NIST security controls:

- **AC-4**: Information flow enforcement
- **SC-8**: Transmission confidentiality and integrity
- **IA-5**: Authenticator management
- **SI-4**: Information system monitoring
- **AU-3**: Content of audit records

## API Reference

### CreateBrowserContextArgs

```typescript
interface CreateBrowserContextArgs {
  sessionId: string;
  name?: string;
  options?: {
    proxy?: {
      enabled: boolean;
      config?: ProxyConfig;
      pool?: ProxyPoolConfig;
      rotateOnError?: boolean;
      rotateOnInterval?: boolean;
      rotationInterval?: number;
    };
  };
}
```

### ProxyConfig

```typescript
interface ProxyConfig {
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  bypass?: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  maxRetries?: number;
  healthCheckInterval?: number;
  healthCheckUrl?: string;
  rejectUnauthorized?: boolean;
  name?: string;
  tags?: string[];
  priority?: number;
}
```

### ProxyPoolConfig

```typescript
interface ProxyPoolConfig {
  proxies: ProxyConfig[];
  strategy?: 'round-robin' | 'random' | 'least-used' | 'priority' | 'health-based';
  healthCheckEnabled?: boolean;
  healthCheckInterval?: number;
  failoverEnabled?: boolean;
  failoverThreshold?: number;
  maxConcurrentChecks?: number;
}
```

## Examples

### Web Scraping with Rotating Proxies

```typescript
// Configure a pool of proxies for web scraping
const scrapingContext = {
  sessionId: 'scraping-session',
  name: 'scraper',
  options: {
    proxy: {
      enabled: true,
      pool: {
        proxies: [
          // Add multiple proxies for rotation
          { protocol: 'http', host: 'proxy1.provider.com', port: 8080 },
          { protocol: 'http', host: 'proxy2.provider.com', port: 8080 },
          { protocol: 'http', host: 'proxy3.provider.com', port: 8080 },
        ],
        strategy: 'round-robin',
        healthCheckEnabled: true,
      },
      rotateOnError: true,
      rotateOnInterval: true,
      rotationInterval: 600000, // Rotate every 10 minutes
    },
  },
};
```

### Geo-targeted Browsing

```typescript
// Use specific regional proxies
const geoContext = {
  sessionId: 'geo-session',
  name: 'us-browser',
  options: {
    proxy: {
      enabled: true,
      config: {
        protocol: 'http',
        host: 'us-proxy.provider.com',
        port: 8080,
        auth: {
          username: process.env.PROXY_USER,
          password: process.env.PROXY_PASS,
        },
        name: 'US-East-1',
        tags: ['us', 'east'],
      },
    },
  },
};
```

### High-Security Configuration

```typescript
// Maximum security settings
const secureContext = {
  sessionId: 'secure-session',
  name: 'secure-browser',
  options: {
    proxy: {
      enabled: true,
      config: {
        protocol: 'socks5',
        host: 'secure-proxy.company.com',
        port: 1080,
        auth: {
          username: process.env.SECURE_PROXY_USER,
          password: process.env.SECURE_PROXY_PASS,
        },
        bypass: [
          'localhost',
          '127.0.0.1',
          '::1',
          '*.internal.company.com',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '192.168.0.0/16',
        ],
        rejectUnauthorized: true,
        connectionTimeout: 10000,
        maxRetries: 1,
      },
    },
  },
};
```

## Troubleshooting

### Common Issues

:::tip[Troubleshooting Guide]

1. **Proxy Authentication Failed**
   - Verify credentials are correct
   - Check if proxy requires specific authentication method
   - Ensure credentials don't contain special characters that need escaping

2. **Connection Timeouts**
   - Increase `connectionTimeout` value
   - Check proxy server is accessible
   - Verify firewall rules allow proxy connections

3. **SSL Certificate Errors**
   - For testing only: set `rejectUnauthorized: false`
   - For production: install proxy's CA certificate
   - Check proxy supports HTTPS interception

4. **High Failure Rate**
   - Enable health monitoring to identify failing proxies
   - Increase `failoverThreshold` for unstable networks
   - Check proxy provider's rate limits
:::

### Debug Logging

Enable debug logging for proxy operations:

```typescript
import { createLogger } from 'puppeteer-mcp/utils';

const logger = createLogger('proxy-debug');
logger.level = 'debug';
```

### Health Check Failures

If health checks are failing:

1. Verify the health check URL is accessible
2. Check proxy allows connections to the health check domain
3. Increase health check timeout
4. Use a different health check URL

```typescript
healthCheckUrl: 'https://httpbin.org/ip', // Alternative health check
healthCheckInterval: 600000, // Check less frequently
```

## Best Practices

:::tip[Proxy Best Practices]
1. **Use Proxy Pools**: Configure multiple proxies for better reliability
2. **Enable Health Checks**: Automatically detect and remove failing proxies
3. **Set Appropriate Timeouts**: Balance between reliability and performance
4. **Monitor Metrics**: Track proxy performance and adjust configuration
5. **Secure Credentials**: Use environment variables and secure storage
6. **Test Thoroughly**: Verify proxy configuration in development before production
7. **Plan for Failures**: Always have fallback options and error handling
:::

## Related Documentation

- [Architecture Overview](/architecture/) for system design context
- [Security Testing](/testing/security-testing) for proxy security validation
- [Operations Guide](/operations/) for monitoring proxy health
- [Browser Pool Optimization](/guides/advanced/browser-pool-optimization) for performance optimization
- [Session Persistence](/guides/advanced/session-persistence) for session management

## Use Cases

### Enterprise Network Access

Proxy configuration is essential for enterprise environments where:
- Direct internet access is restricted
- Corporate firewalls require proxy routing
- Network policies mandate traffic inspection
- Geographic restrictions apply

### Web Scraping and Data Collection

Proxy rotation provides:
- IP address rotation to avoid rate limiting
- Geographic diversity for location-specific content
- Load distribution across multiple proxy providers
- Fault tolerance with automatic failover

### Security and Privacy

Proxy usage enhances security by:
- Hiding original IP addresses
- Encrypting traffic through secure proxies
- Bypassing geographic restrictions
- Adding an additional layer of network security

## Conclusion

The proxy configuration system provides enterprise-grade capabilities for routing browser traffic through various proxy types with comprehensive monitoring, health checks, and automatic rotation. This enables reliable browser automation in enterprise environments while maintaining security and performance standards.