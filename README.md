# Puppeteer MCP

[![npm version](https://img.shields.io/npm/v/puppeteer-mcp.svg)](https://www.npmjs.com/package/puppeteer-mcp)
[![npm downloads](https://img.shields.io/npm/dm/puppeteer-mcp.svg)](https://www.npmjs.com/package/puppeteer-mcp)
[![License](https://img.shields.io/npm/l/puppeteer-mcp.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/security-NIST%20compliant-blue.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-85%25-green.svg)]()

**Production-ready AI-enabled browser automation platform** with REST, gRPC, WebSocket, and Model
Context Protocol (MCP) interfaces, unified session management, and enterprise-grade security.

## Overview

Puppeteer MCP is a comprehensive browser automation platform that enables both traditional API
clients and AI agents to control web browsers programmatically. It provides multiple protocol
interfaces, secure session management, and extensive browser automation capabilities through
Puppeteer.

### Key Capabilities

- 🤖 **AI-Ready**: Native MCP support for LLM browser control
- 🌐 **Multi-Protocol**: REST, gRPC, WebSocket, and MCP interfaces
- 🔒 **Enterprise Security**: NIST-compliant with zero-trust architecture
- 🎭 **Full Puppeteer Integration**: 13+ browser action types
- 📊 **Production Grade**: Resource pooling, health monitoring, metrics
- 🚀 **High Performance**: Sub-100ms API response times

## Features

### Browser Automation

- **13 Action Types**: Navigate, click, type, screenshot, PDF, evaluate, and more
- **Resource Management**: Configurable browser pool with health monitoring
- **Security Controls**: XSS prevention, input sanitization, execution sandboxing
- **Event Streaming**: Real-time browser events across all protocols

### Multi-Protocol Support

- **REST API**: Express with HTTP/2, OpenAPI 3.0 ready
- **gRPC**: Full streaming support with Protocol Buffers
- **WebSocket**: Real-time bidirectional communication
- **MCP**: AI agent integration with tools and resources

### Enterprise Features

- **Authentication**: JWT tokens and API keys with RBAC
- **Session Management**: Unified store across all protocols
- **Audit Logging**: Complete security event tracking
- **Health Monitoring**: Comprehensive system metrics

## Installation

### npm Package

The easiest way to get started is through npm:

```bash
# Install globally
npm install -g puppeteer-mcp

# Or use with npx (no installation required)
npx puppeteer-mcp
```

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

## Quick Start with npm

After installing the package globally with npm, you can start using Puppeteer MCP immediately:

```bash
# Start the MCP server (after global installation)
puppeteer-mcp

# The server will start with default configuration
# Output: MCP server running on stdio
```

### Using with Claude Desktop

```bash
# Add to Claude Desktop configuration
claude mcp add puppeteer-mcp
```

### Using with npx (no installation required)

```bash
# Run directly without installation
npx puppeteer-mcp

# With specific version
npx puppeteer-mcp@1.0.0
```

The server will start in MCP mode by default, ready to accept connections from AI agents like Claude
Desktop.

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Chrome/Chromium installed (automatically downloaded by Puppeteer if not present)

### Basic Usage

#### REST API Example

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

#### MCP Usage with Claude

If you've installed puppeteer-mcp from npm:

```bash
# Start the MCP server (if installed globally)
puppeteer-mcp

# Or use npx without installation
npx puppeteer-mcp
```

For Claude Desktop integration:

```bash
# Add puppeteer-mcp to Claude Desktop (using npx)
claude mcp add "npx puppeteer-mcp"

# Or if globally installed
claude mcp add "puppeteer-mcp"
```

Once connected, you can use browser automation tools like:

- `execute-in-context` - Execute browser actions (navigate, click, type, etc.)
- `create-context` - Create new browser contexts
- `list-contexts` - List active browser contexts

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

## Documentation

### 📚 Documentation Structure

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and component overview
- **[API.md](./API.md)** - Complete API reference for all protocols
- **[SECURITY.md](./SECURITY.md)** - Security implementation and NIST compliance
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development setup and guidelines
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant guidance (for contributors)

### 🎯 Quick Links

- [REST API Reference](./API.md#rest-api)
- [gRPC Service Definitions](./API.md#grpc-services)
- [WebSocket Protocol](./API.md#websocket-protocol)
- [MCP Integration](./API.md#mcp-integration)
- [Browser Actions Guide](./API.md#browser-actions)
- [Authentication Setup](./SECURITY.md#authentication)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- src/auth/
npm test -- src/puppeteer/

# Run with coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

### Development Server

```bash
# Start with hot reload
npm run dev

# Start with debugging
npm run dev:debug

# Start MCP server in development
npm run mcp:dev
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format

# Run all checks
npm run check
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development workflow
- Coding standards
- Testing requirements
- Pull request process

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Standards

This project follows [William Zujkowski's Standards](https://github.com/williamzujkowski/standards):

- TypeScript/ESM configuration with strict mode
- Maximum 300 lines per file
- Function complexity ≤ 10
- Comprehensive testing (85%+ coverage)
- NIST security compliance

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Docker Quick Start

```bash
# Build the image
docker build -t puppeteer-mcp .

# Run the container
docker run -p 3000:3000 -p 50051:50051 \
  -e JWT_SECRET=your-secret \
  puppeteer-mcp
```

### Health Check

```bash
# Check system health
curl http://localhost:3000/api/v1/health
```

## Security

This project implements comprehensive security measures:

- **Zero Trust Architecture**: All requests require authentication
- **NIST Compliance**: Full implementation of relevant controls
- **Input Validation**: Strict validation on all endpoints
- **Rate Limiting**: Configurable per-endpoint limits
- **Audit Logging**: Complete security event tracking

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## Performance

- REST API: < 100ms p95 response time
- gRPC: < 50ms p95 for unary calls
- WebSocket: < 10ms latency
- Browser actions: < 5s p95 execution time
- Startup time: < 3 seconds

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **npm Package**: [npmjs.com/package/puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp)
- **Issues**: [GitHub Issues](https://github.com/yourusername/puppeteer-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/puppeteer-mcp/discussions)
- **Security**: See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities

## Acknowledgments

- Built with [Puppeteer](https://pptr.dev/) for browser automation
- Implements [Model Context Protocol](https://modelcontextprotocol.io/) for AI integration
- Follows [NIST SP 800-53r5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
  security controls
- Based on [William Zujkowski's Standards](https://github.com/williamzujkowski/standards)

---

**Made with ❤️ by the Puppeteer MCP Team**
