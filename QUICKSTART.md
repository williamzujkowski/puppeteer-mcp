# 🚀 Puppeteer MCP Quick Start Guide

## Installation

Install globally via npm:

```bash
npm install -g puppeteer-mcp
```

## Basic Usage

Start the server with required environment variables:

```bash
JWT_SECRET=$(openssl rand -hex 32) TLS_ENABLED=false puppeteer-mcp
```

### Common Issues and Solutions

#### Port Already in Use

If you see: `Error: listen EADDRINUSE: address already in use :::8443`

**Solution 1**: Use a different port

```bash
PORT=3000 puppeteer-mcp
```

**Solution 2**: Find and kill the process using the port

```bash
# Find what's using port 8443
sudo lsof -i :8443

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

#### Missing JWT_SECRET

If you see authentication errors, set the JWT_SECRET:

```bash
export JWT_SECRET=$(openssl rand -hex 32)
```

### Environment Variables

#### Required in Production

- `JWT_SECRET` - Secret key for JWT tokens (min 32 chars)
  ```bash
  JWT_SECRET=your-secret-key-here
  ```

#### Security Settings

- `TLS_ENABLED` - Enable HTTPS (default: true in production)

  ```bash
  TLS_ENABLED=false  # For development only
  ```

- `TRUST_PROXY` - Configure Express trust proxy setting
  ```bash
  TRUST_PROXY=false        # Don't trust any proxy (default)
  TRUST_PROXY=1            # Trust first proxy
  TRUST_PROXY=loopback     # Trust localhost only
  ```

#### Server Configuration

| Variable      | Default     | Description                                 |
| ------------- | ----------- | ------------------------------------------- |
| `PORT`        | 8443        | HTTP/WebSocket server port                  |
| `HOST`        | 0.0.0.0     | Server host                                 |
| `NODE_ENV`    | development | Environment mode                            |
| `TLS_ENABLED` | true        | Enable/disable TLS (set to false for dev)   |
| `LOG_LEVEL`   | info        | Logging level (trace/debug/info/warn/error) |
| `GRPC_PORT`   | 50051       | gRPC server port                            |

### Production Setup

For production, you should:

1. Generate and securely store a JWT secret
2. Configure TLS certificates
3. Use environment variables or a `.env` file

```bash
# Production example with TLS
JWT_SECRET=your-secure-secret \
TLS_ENABLED=true \
TLS_CERT_PATH=/path/to/cert.pem \
TLS_KEY_PATH=/path/to/key.pem \
puppeteer-mcp
```

### Checking Server Status

Once running, you can check:

- Health endpoint: `http://localhost:3000/health`
- API docs: `http://localhost:3000/api/v1/docs`

### Using with MCP Clients

The server exposes an MCP interface over stdio. To use with Claude or other MCP clients, configure
the client to run:

```bash
puppeteer-mcp
```

With environment variables:

```json
{
  "command": "puppeteer-mcp",
  "env": {
    "JWT_SECRET": "your-secret",
    "TLS_ENABLED": "false",
    "PORT": "3000"
  }
}
```
