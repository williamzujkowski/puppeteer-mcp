# Puppeteer MCP Documentation

**Version:** 1.0.10  
**Last Updated:** 2025-01-06  
**Status:** Beta - Seeking Production Feedback  
**Type:** Documentation Hub  
**Audience:** Developers, Users, Contributors

Welcome to the comprehensive documentation for **Puppeteer MCP** - a beta AI-enabled browser
automation platform that provides REST, gRPC, WebSocket, and Model Context Protocol (MCP) interfaces
with unified session management, enterprise-focused security, and comprehensive Puppeteer
integration.

> **🔔 Beta Release - Feedback Needed!**  
> This project is in beta and we're actively seeking user feedback to ensure it meets production
> requirements. Please [report issues](https://github.com/williamzujkowski/puppeteer-mcp/issues) or
> share your experience to help us improve.

## 🚀 Quick Navigation

<!-- prettier-ignore-start -->
<div class="grid" markdown>

<div class="card">

### :material-rocket-launch: Getting Started

New to Puppeteer MCP? Start here for a quick setup guide.

[Quick Start Guide :octicons-arrow-right-24:](quickstart/index.md){ .md-button .md-button--primary }

</div>

<div class="card">

### :material-api: API Reference

Complete API documentation for all supported protocols.

[API Documentation :octicons-arrow-right-24:](quick-reference/api-cheatsheet.md){ .md-button
.md-button--primary }

</div>

<div class="card">

### :material-robot: Browser Automation

Learn how to automate browsers with our Puppeteer integration.

[Automation Guide :octicons-arrow-right-24:](guides/browser-automation.md){ .md-button
.md-button--primary }

</div>

<div class="card">

### :material-shield-check: Security

NIST-compliant security architecture and best practices.

[Security Documentation :octicons-arrow-right-24:](architecture/security.md){ .md-button
.md-button--primary }

</div>

</div>
<!-- prettier-ignore-end -->

## 📋 What is Puppeteer MCP?

Puppeteer MCP is a **beta platform** that bridges AI agents and browser automation through multiple
protocol interfaces. We're seeking feedback to ensure production readiness. It enables:

- **AI-Driven Browser Control**: LLMs can control browsers through the Model Context Protocol
- **Multi-Protocol Support**: Choose between REST, gRPC, WebSocket, or MCP interfaces
- **Enterprise Security**: NIST 800-53r5 compliant with comprehensive authentication
- **Unified Sessions**: Consistent session management across all protocols
- **Resource Management**: Production-grade browser pooling and lifecycle management

## 🎯 Key Features

### Browser Automation

- **13 Action Types**: Navigate, click, type, screenshot, evaluate JavaScript, and more
- **Security Sandbox**: XSS prevention and input validation
- **Resource Pooling**: Efficient browser instance management
- **Event Streaming**: Real-time browser events via WebSocket

### Protocol Support

- **REST API**: OpenAPI 3.0 compliant with comprehensive endpoints
- **gRPC**: High-performance binary protocol with streaming
- **WebSocket**: Real-time bidirectional communication
- **MCP**: AI agent integration with standardized tools

### Security & Compliance

- **NIST 800-53r5**: Full compliance with tagged controls
- **Multi-Modal Auth**: JWT tokens and API keys
- **Audit Logging**: Complete security event tracking
- **Zero Trust**: All requests authenticated and authorized

### Developer Experience

- **TypeScript**: 100% type-safe with zero compilation errors
- **Testing**: Comprehensive test suite with 283 tests
- **Standards**: Follows William Zujkowski's coding standards
- **Documentation**: Progressive disclosure with AI optimization

## 🔍 Use Cases

<div class="grid" markdown>

:material-test-tube: **E2E Testing** : AI-guided browser testing with natural language commands

:material-web-sync: **Web Scraping** : Intelligent data extraction with browser automation

:material-monitor-screenshot: **Visual Testing** : Automated screenshot comparison and regression
testing

:material-api: **API Testing** : Browser-based API testing with full network control

</div>

## 📚 Documentation Structure

Our documentation follows the
[Knowledge Management Standards](https://github.com/williamzujkowski/standards/blob/master/docs/standards/KNOWLEDGE_MANAGEMENT_STANDARDS.md)
with progressive disclosure:

### For New Users

1. [Getting Started Guide](quickstart/index.md) - Set up and run your first automation
2. [API Quick Reference](quick-reference/api-cheatsheet.md) - Common API patterns
3. [MCP Usage Examples](guides/mcp-usage-examples.md) - AI agent integration examples

### For Developers

1. [Architecture Overview](architecture/overview.md) - System design and components
2. [Development Workflow](development/workflow.md) - Build, test, and contribute
3. [API Integration Guide](guides/api-integration.md) - Deep dive into protocols

### For Contributors

1. [Contributing Guidelines](contributing.md) - How to contribute
2. [Coding Standards](development/standards.md) - Code quality requirements
3. [Testing Guide](development/testing.md) - Testing strategies and coverage

## 🛠️ Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Basic Usage

=== "REST API"

    ```bash
    # Create a browser context
    curl -X POST http://localhost:8443/api/v1/contexts \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "my-browser"}'

    # Navigate to a page
    curl -X POST http://localhost:8443/api/v1/contexts/{id}/execute \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"action": "navigate", "params": {"url": "https://example.com"}}'
    ```

=== "MCP"

    ```json
    {
      "tool": "create-context",
      "arguments": {
        "name": "test-browser",
        "options": {
          "viewport": {
            "width": 1920,
            "height": 1080
          }
        }
      }
    }
    ```

## 🔗 Quick Links

- [GitHub Repository](https://github.com/williamzujkowski/puppeteer-mcp)
- [Issue Tracker](https://github.com/williamzujkowski/puppeteer-mcp/issues)
- [Security Policy](https://github.com/williamzujkowski/puppeteer-mcp/blob/main/SECURITY.md)
- [Changelog](https://github.com/williamzujkowski/puppeteer-mcp/blob/main/CHANGELOG.md)

## 📊 Project Status

!!! success "Production Ready"

    - ✅ **Zero TypeScript Errors** - Clean compilation
    - ✅ **NIST Compliant** - Full security compliance
    - ✅ **283 Tests** - Comprehensive test coverage
    - ✅ **13 Browser Actions** - Complete automation toolkit
    - ✅ **4 Protocol Interfaces** - REST, gRPC, WebSocket, MCP

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](contributing.md) for details on:

- Code standards and style guide
- Testing requirements
- Pull request process
- Security considerations

## 📄 License

This project is licensed under the Apache License 2.0 - see the
[LICENSE](https://github.com/williamzujkowski/puppeteer-mcp/blob/main/LICENSE) file for details.

---

<div class="text-center" markdown>
**Built with ❤️ following [William Zujkowski's Standards](https://github.com/williamzujkowski/standards)**
</div>
