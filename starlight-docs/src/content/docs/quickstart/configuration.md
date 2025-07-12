---
title: Configuration Guide
description: 'Version 1.0.13 - Configuration guide for Puppeteer MCP'
---

# Configuration Guide

**Version**: 1.0.13  
**Reading Time**: 8 minutes

## Overview

Configure Puppeteer MCP to match your needs. This guide covers environment variables, configuration
files, security settings, and performance tuning.

## Configuration Methods

Puppeteer MCP can be configured through:

1. **Environment Variables** (recommended)
2. **Configuration Files** (`.env` or JSON)
3. **Command Line Arguments**
4. **Runtime API** (for dynamic changes)

## Quick Configuration

### Basic Setup (.env file)

Create a `.env` file in your project root:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Authentication
PUPPETEER_MCP_AUTH_TOKEN=your-secure-token-here

# Browser Settings
PUPPETEER_HEADLESS=true
MAX_SESSIONS=10
SESSION_TIMEOUT=1800000
```

### Generate Secure Token

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

## Environment Variables Reference

### Server Configuration

<details open>
<summary><strong>Core Server Settings</strong></summary>

| Variable    | Default       | Description                                            |
| ----------- | ------------- | ------------------------------------------------------ |
| `PORT`      | `3000`        | REST API and WebSocket port                            |
| `GRPC_PORT` | `50051`       | gRPC service port                                      |
| `NODE_ENV`  | `development` | Environment mode (`development`, `production`, `test`) |
| `LOG_LEVEL` | `info`        | Logging level (`debug`, `info`, `warn`, `error`)       |
| `HOST`      | `0.0.0.0`     | Server bind address                                    |

Example:

```bash
PORT=3001 GRPC_PORT=50052 NODE_ENV=production puppeteer-mcp
```

</details>

### Authentication & Security

<details>
<summary><strong>Security Settings</strong></summary>

| Variable                   | Default        | Description                         |
| -------------------------- | -------------- | ----------------------------------- |
| `PUPPETEER_MCP_AUTH_TOKEN` | none           | Bearer token for API authentication |
| `JWT_SECRET`               | auto-generated | Secret for JWT signing              |
| `JWT_EXPIRES_IN`           | `1h`           | JWT token expiration                |
| `JWT_REFRESH_EXPIRES_IN`   | `7d`           | Refresh token expiration            |
| `API_KEY_HEADER`           | `X-API-Key`    | Header name for API key auth        |
| `ENABLE_CORS`              | `true`         | Enable CORS support                 |
| `CORS_ORIGIN`              | `*`            | Allowed CORS origins                |

Example:

```bash
PUPPETEER_MCP_AUTH_TOKEN=abc123 JWT_SECRET=mysecret puppeteer-mcp
```

</details>

### Browser Configuration

<details>
<summary><strong>Puppeteer Settings</strong></summary>

| Variable                        | Default     | Description                     |
| ------------------------------- | ----------- | ------------------------------- |
| `PUPPETEER_HEADLESS`            | `true`      | Run browsers in headless mode   |
| `PUPPETEER_EXECUTABLE_PATH`     | auto-detect | Path to Chrome/Chromium         |
| `PUPPETEER_ARGS`                | none        | Additional browser launch args  |
| `PUPPETEER_IGNORE_HTTPS_ERRORS` | `false`     | Ignore HTTPS certificate errors |
| `PUPPETEER_SLOW_MO`             | `0`         | Slow down operations by ms      |
| `PUPPETEER_DEVTOOLS`            | `false`     | Auto-open DevTools              |
| `DEFAULT_VIEWPORT_WIDTH`        | `1920`      | Default viewport width          |
| `DEFAULT_VIEWPORT_HEIGHT`       | `1080`      | Default viewport height         |

Example:

```bash
PUPPETEER_HEADLESS=false PUPPETEER_SLOW_MO=250 puppeteer-mcp
```

</details>

### Session Management

<details>
<summary><strong>Session & Resource Limits</strong></summary>

| Variable                | Default   | Description                         |
| ----------------------- | --------- | ----------------------------------- |
| `MAX_SESSIONS`          | `10`      | Maximum concurrent browser sessions |
| `SESSION_TIMEOUT`       | `1800000` | Session idle timeout (ms)           |
| `MAX_PAGES_PER_SESSION` | `10`      | Max pages per browser session       |
| `CLEANUP_INTERVAL`      | `60000`   | Resource cleanup interval (ms)      |
| `MEMORY_LIMIT`          | `1024`    | Memory limit per browser (MB)       |
| `CPU_LIMIT`             | `0.5`     | CPU limit per browser (0.5 = 50%)   |

Example:

```bash
MAX_SESSIONS=5 SESSION_TIMEOUT=600000 puppeteer-mcp
```

</details>

### Performance & Optimization

<details>
<summary><strong>Performance Tuning</strong></summary>

| Variable                       | Default  | Description               |
| ------------------------------ | -------- | ------------------------- |
| `BROWSER_POOL_MIN`             | `1`      | Minimum browsers in pool  |
| `BROWSER_POOL_MAX`             | `5`      | Maximum browsers in pool  |
| `BROWSER_POOL_ACQUIRE_TIMEOUT` | `30000`  | Pool acquire timeout (ms) |
| `BROWSER_POOL_IDLE_TIMEOUT`    | `300000` | Pool idle timeout (ms)    |
| `ENABLE_BROWSER_CACHE`         | `true`   | Enable browser disk cache |
| `CACHE_SIZE_MB`                | `100`    | Browser cache size (MB)   |
| `RATE_LIMIT_ENABLED`           | `true`   | Enable API rate limiting  |
| `RATE_LIMIT_MAX`               | `100`    | Max requests per window   |
| `RATE_LIMIT_WINDOW`            | `15m`    | Rate limit time window    |

Example:

```bash
BROWSER_POOL_MAX=3 RATE_LIMIT_MAX=50 puppeteer-mcp
```

</details>

## Configuration Files

### JSON Configuration

Create `puppeteer-mcp.config.json`:

```json
{
  "server": {
    "port": 3000,
    "grpcPort": 50051,
    "host": "localhost"
  },
  "auth": {
    "token": "your-secure-token",
    "jwtSecret": "your-jwt-secret",
    "jwtExpiresIn": "1h"
  },
  "browser": {
    "headless": true,
    "args": ["--no-sandbox", "--disable-setuid-sandbox"],
    "defaultViewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "session": {
    "maxSessions": 10,
    "timeout": 1800000,
    "maxPagesPerSession": 10
  },
  "pool": {
    "min": 1,
    "max": 5,
    "acquireTimeout": 30000,
    "idleTimeout": 300000
  }
}
```

### YAML Configuration

Create `puppeteer-mcp.config.yaml`:

```yaml
server:
  port: 3000
  grpcPort: 50051
  host: localhost

auth:
  token: your-secure-token
  jwtSecret: your-jwt-secret
  jwtExpiresIn: 1h

browser:
  headless: true
  args:
    - --no-sandbox
    - --disable-setuid-sandbox
  defaultViewport:
    width: 1920
    height: 1080

session:
  maxSessions: 10
  timeout: 1800000
  maxPagesPerSession: 10
```

## Security Configuration

### Production Security Checklist

<details open>
<summary><strong>Essential Security Settings</strong></summary>

```bash
# 1. Generate strong secrets
export PUPPETEER_MCP_AUTH_TOKEN=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 64)

# 2. Set production mode
export NODE_ENV=production

# 3. Configure CORS
export ENABLE_CORS=true
export CORS_ORIGIN=https://your-domain.com

# 4. Enable rate limiting
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_MAX=50
export RATE_LIMIT_WINDOW=15m

# 5. Set secure browser options
export PUPPETEER_HEADLESS=true
export PUPPETEER_ARGS="--no-sandbox --disable-dev-shm-usage"

# 6. Configure timeouts
export SESSION_TIMEOUT=900000  # 15 minutes
export MAX_SESSIONS=5
```

</details>

### Authentication Strategies

<details>
<summary><strong>Bearer Token Authentication</strong></summary>

```bash
# Set token
export PUPPETEER_MCP_AUTH_TOKEN=your-secure-token

# Client usage
curl -H "Authorization: Bearer your-secure-token" \
  http://localhost:8443/api/sessions
```

</details>

<details>
<summary><strong>API Key Authentication</strong></summary>

```bash
# Set API key header
export API_KEY_HEADER=X-API-Key

# Client usage
curl -H "X-API-Key: your-api-key" \
  http://localhost:8443/api/sessions
```

</details>

<details>
<summary><strong>JWT Authentication</strong></summary>

```bash
# Configure JWT
export JWT_SECRET=your-jwt-secret
export JWT_EXPIRES_IN=1h
export JWT_REFRESH_EXPIRES_IN=7d

# Login to get token
curl -X POST http://localhost:8443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "pass"}'
```

</details>

## Performance Optimization

### Memory Management

<details>
<summary><strong>Optimize Memory Usage</strong></summary>

```bash
# Limit browser memory
export MEMORY_LIMIT=512  # MB per browser
export MAX_SESSIONS=3

# Use shared memory efficiently
export PUPPETEER_ARGS="--disable-dev-shm-usage --shm-size=1gb"

# Enable aggressive cleanup
export CLEANUP_INTERVAL=30000  # 30 seconds
export SESSION_TIMEOUT=300000   # 5 minutes
```

</details>

### CPU Optimization

<details>
<summary><strong>Control CPU Usage</strong></summary>

```bash
# Limit CPU per browser
export CPU_LIMIT=0.25  # 25% per browser

# Disable unnecessary features
export PUPPETEER_ARGS="--disable-gpu --disable-webgl --disable-3d-apis"

# Reduce render load
export PUPPETEER_ARGS="$PUPPETEER_ARGS --disable-images --disable-javascript"
```

</details>

### Network Optimization

<details>
<summary><strong>Optimize Network Performance</strong></summary>

```bash
# Enable compression
export ENABLE_COMPRESSION=true

# Configure proxy
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080

# Optimize DNS
export PUPPETEER_ARGS="--host-resolver-rules='MAP * 8.8.8.8'"
```

</details>

## Docker Configuration

### Docker Environment File

Create `.env.docker`:

```bash
# Server
PORT=3000
NODE_ENV=production

# Security
PUPPETEER_MCP_AUTH_TOKEN=${PUPPETEER_MCP_AUTH_TOKEN}
JWT_SECRET=${JWT_SECRET}

# Browser (Docker-specific)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_ARGS=--no-sandbox --disable-setuid-sandbox

# Resources
MAX_SESSIONS=5
MEMORY_LIMIT=512
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    image: puppeteer-mcp:latest
    ports:
      - '3000:3000'
      - '50051:50051'
    env_file: .env.docker
    environment:
      - NODE_ENV=production
    volumes:
      - ./config:/app/config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Monitoring & Logging

### Logging Configuration

<details>
<summary><strong>Configure Logging</strong></summary>

```bash
# Log levels: debug, info, warn, error
export LOG_LEVEL=info

# Log format
export LOG_FORMAT=json  # or 'pretty'

# Log destinations
export LOG_FILE=/var/log/puppeteer-mcp.log
export LOG_CONSOLE=true

# Debug specific modules
export DEBUG=puppeteer:*  # All Puppeteer logs
export DEBUG=mcp:*        # All MCP logs
export DEBUG=*            # Everything
```

</details>

### Metrics & Health Checks

<details>
<summary><strong>Enable Monitoring</strong></summary>

```bash
# Enable metrics endpoint
export ENABLE_METRICS=true
export METRICS_PORT=9090

# Health check settings
export HEALTH_CHECK_INTERVAL=30000
export HEALTH_CHECK_TIMEOUT=5000

# Prometheus metrics
export PROMETHEUS_ENABLED=true
export PROMETHEUS_PREFIX=puppeteer_mcp_
```

</details>

## Configuration Priority

Configuration is loaded in this order (later overrides earlier):

1. Default values (built-in)
2. Configuration file (`puppeteer-mcp.config.{json,yaml,js}`)
3. `.env` file
4. Environment variables
5. Command line arguments

Example:

```bash
# .env file
PORT=3000

# Override with environment variable
PORT=3001 puppeteer-mcp

# Override with command line
puppeteer-mcp --port 3002
```

## Advanced Configuration

### Custom Browser Profiles

```javascript
// custom-config.js
module.exports = {
  browser: {
    userDataDir: './profiles/user1',
    args: ['--user-agent=CustomBot/1.0', '--window-size=1920,1080', '--lang=en-US'],
    ignoreDefaultArgs: ['--disable-extensions'],
  },
};
```

### Plugin Configuration

```json
{
  "plugins": {
    "authentication": {
      "provider": "oauth2",
      "config": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    },
    "storage": {
      "provider": "s3",
      "config": {
        "bucket": "puppeteer-screenshots",
        "region": "us-east-1"
      }
    }
  }
}
```

## Troubleshooting Configuration

### Verify Configuration

```bash
# Show current configuration
puppeteer-mcp --show-config

# Validate configuration file
puppeteer-mcp --validate-config

# Test configuration
puppeteer-mcp --test
```

### Common Configuration Issues

<details>
<summary><strong>Configuration Not Loading</strong></summary>

1. Check file location and name
2. Verify JSON/YAML syntax
3. Check file permissions
4. Look for error messages on startup

</details>

<details>
<summary><strong>Environment Variables Not Working</strong></summary>

1. Verify variable names (case-sensitive)
2. Check for typos
3. Ensure no spaces around `=`
4. Try `export` before the variable

</details>

## Next Steps

Configuration complete! Continue with:

1. **[First automation examples](/puppeteer-mcp/quickstart/first-steps.md)** - Put configuration to
   use
2. **[Security best practices](/puppeteer-mcp/architecture/security.md)** - Harden your deployment
3. **[Performance tuning](/puppeteer-mcp/architecture/overview.md#performance-optimization)** -
   Optimize for scale

---

**Pro Tip**: Start with minimal configuration and add settings as needed. Over-configuration can
make troubleshooting harder! 🎯
