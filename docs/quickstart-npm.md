# Puppeteer MCP Quick Start Guide

Welcome to Puppeteer MCP! This guide will help you get started with browser automation through the
Model Context Protocol (MCP) in minutes.

## What is Puppeteer MCP?

Puppeteer MCP is a production-ready browser automation platform that integrates with AI assistants
like Claude Desktop. It provides a simple way to control Chrome/Chromium browsers programmatically
through multiple protocols including MCP, REST, gRPC, and WebSocket.

## Installation Options

### Option 1: Global Installation (Recommended for CLI usage)

```bash
npm install -g puppeteer-mcp
```

After installation, you can run the server from anywhere:

```bash
puppeteer-mcp
```

### Option 2: Using npx (No installation required)

Run directly without installing:

```bash
npx puppeteer-mcp
```

This downloads and runs the latest version automatically.

### Option 3: Local Project Installation

Add to your project:

```bash
npm install puppeteer-mcp
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "mcp-server": "puppeteer-mcp"
  }
}
```

Run with:

```bash
npm run mcp-server
```

## Quick Start Examples

### 1. Basic MCP Server Startup

Start the MCP server with default settings:

```bash
# Using global install
puppeteer-mcp

# Or using npx
npx puppeteer-mcp
```

The server will start on:

- MCP: stdio (for Claude Desktop integration)
- REST API: http://localhost:3000
- WebSocket: ws://localhost:3000
- gRPC: localhost:50051

### 2. Claude Desktop Integration

#### Method 1: Manual Configuration (Recommended)

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "PUPPETEER_MCP_AUTH_TOKEN": "your-secret-token-here"
      }
    }
  }
}
```

#### Method 2: Using Claude CLI (if available)

If you have Claude CLI installed, you can add the MCP server with:

```bash
# Using npx (recommended)
claude mcp add "npx puppeteer-mcp"

# Or if globally installed
claude mcp add "puppeteer-mcp"
```

**Note**: The `claude mcp add` command expects the full command to run the MCP server, not just the
package name.

After adding this configuration:

1. Restart Claude Desktop
2. You'll see "puppeteer" in the available tools
3. Claude can now control browsers for you!

### 3. First Browser Automation Example

Once integrated with Claude Desktop, you can ask Claude to:

```
"Navigate to example.com and take a screenshot"
```

Or use the REST API directly:

```bash
# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer your-secret-token-here" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl": "https://example.com"}'

# Navigate to a page (replace SESSION_ID with the ID from above)
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/navigate \
  -H "Authorization: Bearer your-secret-token-here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Take a screenshot
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/screenshot \
  -H "Authorization: Bearer your-secret-token-here" \
  -H "Content-Type: application/json" \
  -d '{"fullPage": true}'
```

### 4. Common Use Cases

#### Web Scraping

```javascript
// Example: Extract product information
const response = await fetch('http://localhost:3000/api/sessions/SESSION_ID/evaluate', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-secret-token-here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    script: `
      Array.from(document.querySelectorAll('.product')).map(el => ({
        name: el.querySelector('.name')?.textContent,
        price: el.querySelector('.price')?.textContent
      }))
    `,
  }),
});
```

#### Automated Testing

```javascript
// Example: Fill and submit a form
await fetch('http://localhost:3000/api/sessions/SESSION_ID/fill', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-secret-token-here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    selector: '#email',
    value: 'test@example.com',
  }),
});

await fetch('http://localhost:3000/api/sessions/SESSION_ID/click', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-secret-token-here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    selector: 'button[type="submit"]',
  }),
});
```

#### PDF Generation

```javascript
// Generate PDF from a webpage
await fetch('http://localhost:3000/api/sessions/SESSION_ID/pdf', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-secret-token-here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    format: 'A4',
    printBackground: true,
  }),
});
```

## Configuration

### Environment Variables

Create a `.env` file in your project root or set these environment variables:

```bash
# Authentication (required for production)
PUPPETEER_MCP_AUTH_TOKEN=your-secret-token-here

# Server ports (optional)
PORT=3000                    # REST/WebSocket port
GRPC_PORT=50051             # gRPC port

# Browser settings (optional)
PUPPETEER_HEADLESS=true     # Run browsers in headless mode
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome  # Custom Chrome path

# Session limits (optional)
MAX_SESSIONS=10             # Maximum concurrent browser sessions
SESSION_TIMEOUT=1800000     # Session timeout in ms (30 minutes)

# Security (optional)
CORS_ORIGIN=http://localhost:3001  # Allowed CORS origin
RATE_LIMIT_MAX=100               # Max requests per 15 minutes
```

### Config File Options

You can also use a configuration file. Create `puppeteer-mcp.config.json`:

```json
{
  "auth": {
    "token": "your-secret-token-here",
    "type": "bearer"
  },
  "server": {
    "port": 3000,
    "grpcPort": 50051
  },
  "browser": {
    "headless": true,
    "defaultViewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "session": {
    "maxSessions": 10,
    "timeout": 1800000
  }
}
```

### Authentication Setup

For production use, always set up authentication:

1. **Generate a secure token**:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set the token in your environment**:

   ```bash
   export PUPPETEER_MCP_AUTH_TOKEN=your-generated-token
   ```

3. **Use the token in requests**:
   - REST API: Add `Authorization: Bearer your-token` header
   - WebSocket: Send auth message after connection
   - gRPC: Include token in metadata
   - MCP: Set in Claude Desktop config

## Troubleshooting

### Common Installation Issues

#### 1. Permission Errors (Global Install)

**Problem**: `npm ERR! code EACCES`

**Solution**:

```bash
# Option 1: Use npx instead (recommended)
npx puppeteer-mcp

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g puppeteer-mcp

# Option 3: Use sudo (not recommended)
sudo npm install -g puppeteer-mcp
```

#### 2. Chrome/Chromium Download Problems

**Problem**: Puppeteer can't download Chrome

**Solution**:

```bash
# Option 1: Set download host (for corporate networks)
export PUPPETEER_DOWNLOAD_HOST=https://storage.googleapis.com

# Option 2: Skip download and use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Option 3: Manual download
# Download Chrome manually and set the path in config
```

#### 3. Missing Dependencies (Linux)

**Problem**: Chrome won't start on Linux

**Solution**:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libgtk-3-0 libasound2

# CentOS/RHEL
sudo yum install -y \
  alsa-lib atk cups-libs gtk3 libXcomposite libXdamage \
  libXrandr libgbm libxkbcommon
```

### Port Conflicts

**Problem**: `Error: listen EADDRINUSE: address already in use`

**Solution**:

```bash
# Find what's using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or use different ports
PORT=3001 GRPC_PORT=50052 puppeteer-mcp
```

### Claude Desktop Integration Issues

**Problem**: Claude doesn't see the Puppeteer tools

**Solutions**:

1. **Check config file location**: Make sure you're editing the right file
2. **Validate JSON**: Ensure the config file is valid JSON
3. **Check logs**: Look at Claude Desktop logs for errors
4. **Restart Claude**: Always restart after config changes
5. **Test manually**: Try running `npx puppeteer-mcp` in terminal first

### Memory Issues

**Problem**: Chrome processes consuming too much memory

**Solution**:

```bash
# Limit concurrent sessions
export MAX_SESSIONS=3

# Add Chrome flags for lower memory usage
export PUPPETEER_ARGS='--disable-dev-shm-usage --no-sandbox'

# Enable automatic cleanup
export SESSION_TIMEOUT=600000  # 10 minutes
```

## Next Steps

Now that you have Puppeteer MCP running:

1. **Explore the API**: Check out the full API documentation at `/docs/api/`
2. **Advanced Features**: Learn about WebSocket events, gRPC streams, and more
3. **Security**: Review security best practices in `/docs/development/standards.md`
4. **Contributing**: See `/CONTRIBUTING.md` to help improve the project

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-repo/puppeteer-mcp/issues)
- **Documentation**: Full docs in the `/docs` directory
- **Examples**: Check `/examples` for more code samples

Happy automating! 🚀
