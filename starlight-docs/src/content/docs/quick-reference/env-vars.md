---
title: Environment Variables
description: ## Core Server
---

# Environment Variables

## Core Server

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

## Security

```bash
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
API_KEY=your-api-key-here
SESSION_SECRET=your-session-secret
CORS_ORIGIN=http://localhost:3000
```

## Browser Config

```bash
PUPPETEER_HEADLESS=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
BROWSER_TIMEOUT=30000
MAX_BROWSER_INSTANCES=10
DEFAULT_VIEWPORT_WIDTH=1280
DEFAULT_VIEWPORT_HEIGHT=720
```

## Session Management

```bash
SESSION_TIMEOUT=1800000  # 30 minutes
SESSION_CLEANUP_INTERVAL=300000  # 5 minutes
MAX_SESSIONS_PER_USER=5
```

## gRPC

```bash
GRPC_PORT=50051
GRPC_MAX_MESSAGE_SIZE=4194304  # 4MB
```

## WebSocket

```bash
WS_PORT=3001
WS_PING_INTERVAL=30000
WS_MAX_PAYLOAD=1048576  # 1MB
```

## MCP Server

```bash
MCP_TRANSPORT=stdio
MCP_SERVER_NAME=puppeteer-mcp
MCP_SERVER_VERSION=1.0.0
```

## Database (if used)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
```

## Monitoring

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Development

```bash
DEBUG=puppeteer:*
FORCE_COLOR=1
```
