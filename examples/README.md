# Puppeteer MCP Examples

This directory contains comprehensive examples, templates, and utilities for the Puppeteer MCP
project. These resources are designed to help developers quickly get started and implement
real-world solutions.

## 📁 Directory Structure

```
examples/
├── basic/              # Simple examples for getting started
├── advanced/           # Complex automation workflows
├── api/                # API integration examples
│   ├── rest/          # REST API examples
│   ├── websocket/     # WebSocket real-time examples
│   ├── grpc/          # gRPC service examples
│   └── mcp/           # MCP protocol examples
├── monitoring/         # Observability and monitoring
├── security/          # Authentication and security
├── templates/         # Project templates
│   ├── starter/       # Basic starter template
│   ├── enterprise/    # Full-featured enterprise template
│   ├── microservice/  # Distributed systems template
│   └── testing/       # Testing-focused template
├── integrations/      # Third-party integrations
│   ├── ci-cd/         # CI/CD pipelines
│   ├── databases/     # Database integrations
│   ├── queues/        # Message queue integrations
│   ├── auth/          # Authentication providers
│   └── monitoring/    # Monitoring platforms
└── utilities/         # Helper tools and scripts
    ├── generators/    # Code generation utilities
    ├── scaffolding/   # Project scaffolding tools
    └── testing/       # Testing utilities
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Puppeteer MCP installed globally: `npm install -g puppeteer-mcp`

### Quick Start

1. **Basic Example**: Start with a simple browser automation

   ```bash
   cd basic
   npm install
   npm run example:screenshot
   ```

2. **API Integration**: Try REST API integration

   ```bash
   cd api/rest
   npm install
   npm run example:session
   ```

3. **Use a Template**: Scaffold a new project
   ```bash
   cd templates/starter
   npm install
   npm run setup
   ```

## 📚 Example Categories

### Basic Examples

- **Screenshot Capture**: Take screenshots of web pages
- **Form Automation**: Fill and submit forms automatically
- **Navigation**: Navigate between pages and handle redirects
- **Content Extraction**: Extract data from web pages
- **PDF Generation**: Convert web pages to PDF

### Advanced Examples

- **Multi-Tab Workflows**: Manage multiple browser tabs
- **Parallel Processing**: Run multiple automations concurrently
- **Error Recovery**: Handle failures gracefully
- **State Management**: Maintain state across sessions
- **Complex Interactions**: Handle dynamic content and SPAs

### API Examples

- **REST API**: CRUD operations, batch processing
- **WebSocket**: Real-time updates, event streaming
- **gRPC**: High-performance RPC calls
- **MCP Protocol**: AI-agent integration

### Security Examples

- **JWT Authentication**: Secure API endpoints
- **API Key Management**: Handle API keys securely
- **Rate Limiting**: Implement request throttling
- **CSRF Protection**: Prevent cross-site attacks

### Monitoring Examples

- **OpenTelemetry**: Distributed tracing
- **Prometheus Metrics**: Performance monitoring
- **Health Checks**: Service availability
- **Custom Dashboards**: Grafana integrations

## 🛠️ Utilities

### Code Generators

```bash
# Generate a new automation script
cd utilities/generators
npm run generate:automation -- --name my-automation

# Generate API client code
npm run generate:client -- --api rest --output ./my-client
```

### Project Scaffolding

```bash
# Create a new project from template
cd utilities/scaffolding
npm run scaffold -- --template enterprise --name my-project
```

### Testing Utilities

```bash
# Run automated tests
cd utilities/testing
npm run test:e2e -- --project ../basic
```

## 📖 Best Practices

1. **Error Handling**: Always implement proper error handling
2. **Resource Cleanup**: Clean up browser resources after use
3. **Rate Limiting**: Respect website rate limits
4. **Security**: Never hardcode credentials
5. **Monitoring**: Add observability to production deployments

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## 📄 License

All examples are provided under the MIT License. See [LICENSE](../LICENSE) for details.
