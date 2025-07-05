# Puppeteer MCP

**Version**: 1.0.1  
**Last Updated**: 2025-01-05  
**Status**: Production  
**Type**: Browser Automation Platform  
**Audience**: Developers, AI Engineers, DevOps

[![npm version](https://img.shields.io/npm/v/puppeteer-mcp.svg)](https://www.npmjs.com/package/puppeteer-mcp)
[![npm downloads](https://img.shields.io/npm/dm/puppeteer-mcp.svg)](https://www.npmjs.com/package/puppeteer-mcp)
[![License](https://img.shields.io/npm/l/puppeteer-mcp.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/security-NIST%20compliant-blue.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-85%25-green.svg)]()

**Production-ready AI-enabled browser automation platform** with REST, gRPC, WebSocket, and Model
Context Protocol (MCP) interfaces, unified session management, and enterprise-grade security.

## 🚀 Quick Start

### Install from npm

```bash
# Install globally
npm install -g puppeteer-mcp@1.0.1

# Or use with npx (no installation required)
npx puppeteer-mcp@1.0.1
```

### Start the MCP Server

```bash
# Start MCP server (if installed globally)
puppeteer-mcp

# Or with npx
npx puppeteer-mcp@1.0.1
```

### Integrate with Claude Desktop

```bash
# Add to Claude Desktop configuration
claude mcp add puppeteer-mcp
```

For detailed setup instructions, see [Getting Started Guide](docs/guides/getting-started.md).

## 🎯 Key Features

- **🤖 AI-Ready**: Native MCP support for LLM browser control
- **🌐 Multi-Protocol**: REST, gRPC, WebSocket, and MCP interfaces
- **🔒 Enterprise Security**: NIST-compliant with zero-trust architecture
- **🎭 Full Puppeteer Integration**: 13+ browser action types
- **📊 Production Grade**: Resource pooling, health monitoring, metrics
- **🚀 High Performance**: Sub-100ms API response times

## 📋 Prerequisites

- Node.js 20+ and npm
- Chrome/Chromium (automatically downloaded by Puppeteer if not present)

## 🛠️ Installation Options

### From Source

```bash
# Clone the repository
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## 💻 Usage Examples

### REST API

```bash
# Create a browser context
curl -X POST http://localhost:3000/api/v1/contexts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-browser"}'

# Navigate to a URL
curl -X POST http://localhost:3000/api/v1/contexts/{contextId}/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "navigate",
    "params": {"url": "https://example.com"}
  }'
```

### MCP with Claude

Once connected to Claude Desktop, you can use browser automation tools:

- `execute-in-context` - Execute browser actions (navigate, click, type, etc.)
- `create-context` - Create new browser contexts
- `list-contexts` - List active browser contexts

For detailed MCP usage examples, see [MCP Usage Guide](docs/guides/mcp-usage-examples.md).

### Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Browser Configuration
PUPPETEER_HEADLESS=true
BROWSER_POOL_MAX_SIZE=5
BROWSER_IDLE_TIMEOUT=300000

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 Documentation

### Quick Links

- **[Getting Started](docs/guides/getting-started.md)** - Quick setup guide
- **[API Integration](docs/guides/api-integration.md)** - Working with all protocols
- **[Browser Automation](docs/guides/browser-automation.md)** - Puppeteer actions guide
- **[Security Guide](docs/security.md)** - NIST compliance and authentication
- **[Deployment Guide](docs/guides/deployment.md)** - Production deployment

### API References

- [REST API](docs/reference/rest-api.md)
- [gRPC Services](docs/reference/grpc-api.md)
- [WebSocket Protocol](docs/reference/websocket-api.md)
- [MCP Tools](docs/reference/mcp-tools.md)
- [Puppeteer Actions](docs/reference/puppeteer-actions.md)

## 🔧 Development

```bash
# Install dependencies
npm install

# Development commands
npm run dev          # Start with hot reload
npm test            # Run tests
npm run typecheck   # Type checking
npm run lint        # Linting
npm run check       # Run all checks
```

For detailed development workflow, see [Development Guide](docs/development/workflow.md).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing.md).

This project follows [William Zujkowski's Standards](https://github.com/williamzujkowski/standards):

- TypeScript strict mode, max 300 lines/file
- 85%+ test coverage
- NIST security compliance

## 🚢 Deployment

### Docker

```bash
# Build and run
docker build -t puppeteer-mcp .
docker run -p 3000:3000 -p 50051:50051 -e JWT_SECRET=your-secret puppeteer-mcp
```

For production deployment, see [Deployment Guide](docs/guides/deployment.md).

## 🔒 Security

- Zero Trust Architecture
- NIST SP 800-53r5 compliant
- JWT + API key authentication
- Input validation on all endpoints

See [Security Guide](docs/security.md) for details.

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **npm Package**: [npmjs.com/package/puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp)
- **Issues**: [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)
- **Security**: See [Security Guide](docs/security.md) for reporting vulnerabilities

---

Built with [Puppeteer](https://pptr.dev/) and
[Model Context Protocol](https://modelcontextprotocol.io/)
