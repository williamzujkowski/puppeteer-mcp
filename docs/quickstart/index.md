# Puppeteer MCP Quick Start

**Version**: 1.0.10  
**Last Updated**: 2025-01-05  
**Reading Time**: 2 minutes

## Welcome to Puppeteer MCP! 🚀

Get started with browser automation in minutes. Choose your path:

### 🎯 Quick Navigation

<div class="quickstart-grid">

#### [📦 Installation](./installation.md)

All installation methods - npm, source, Docker  
_2 minute setup_

#### [🚀 First Steps](./first-steps.md)

Basic usage examples and your first automation  
_5 minute tutorial_

#### [🤖 Claude Desktop](./claude-desktop.md)

Set up AI-powered browser automation  
_3 minute setup_

#### [⚙️ Configuration](./configuration.md)

Essential settings and environment setup  
_5 minute guide_

</div>

## What is Puppeteer MCP?

Puppeteer MCP is a **beta browser automation platform** that provides:

- **Multi-Protocol Support**: REST, gRPC, WebSocket, and Model Context Protocol (MCP)
- **AI Integration**: Works seamlessly with Claude Desktop and other AI assistants
- **Enterprise Security**: JWT + API key authentication, NIST compliance
- **Comprehensive Automation**: Full Puppeteer API with session management
- **Zero Setup**: Works out of the box with sensible defaults

## Choose Your Starting Point

### 💡 I want to...

<details>
<summary><strong>Use with Claude Desktop</strong></summary>

1. Install globally: `npm install -g puppeteer-mcp`
2. Configure Claude Desktop ([see guide](./claude-desktop.md))
3. Ask Claude to browse websites for you!

</details>

<details>
<summary><strong>Integrate into my Node.js project</strong></summary>

1. Install in project: `npm install puppeteer-mcp`
2. Import and configure ([see examples](./first-steps.md))
3. Start automating browsers programmatically

</details>

<details>
<summary><strong>Run as a standalone service</strong></summary>

1. Clone repository or use Docker ([see installation](./installation.md))
2. Configure environment ([see configuration](./configuration.md))
3. Access via REST API, gRPC, or WebSocket

</details>

<details>
<summary><strong>Try it quickly without installation</strong></summary>

```bash
npx puppeteer-mcp
```

This runs the latest version without installing anything!

</details>

## Quick Example

Here's browser automation in action:

```javascript
// Using the REST API
const response = await fetch('http://localhost:3000/api/sessions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    baseUrl: 'https://example.com',
  }),
});

const { sessionId } = await response.json();

// Take a screenshot
await fetch(`http://localhost:3000/api/sessions/${sessionId}/screenshot`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fullPage: true,
  }),
});
```

## System Requirements

<div class="requirements-grid">

### Minimum

- Node.js 18.0.0+
- 2GB RAM
- 1GB disk space

### Recommended

- Node.js 20.0.0+
- 4GB RAM
- 2GB disk space
- Chrome/Chromium installed

</div>

## Common Use Cases

- **🕷️ Web Scraping**: Extract data from dynamic websites
- **🧪 Automated Testing**: End-to-end browser testing
- **📄 PDF Generation**: Convert web pages to PDFs
- **📸 Screenshots**: Capture website screenshots
- **🤖 AI Automation**: Let AI agents browse the web
- **📊 Monitoring**: Track website changes and performance

## 📣 Beta Feedback Welcome!

As this is a beta release, we're actively seeking your feedback:

- **🐛 [Report Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)**: Help us identify
  bugs
- **💡 Share Ideas**: What features would make this production-ready for you?
- **📊 Performance**: Let us know about any performance concerns
- **📝 Documentation**: Tell us what needs better explanation

Your feedback is crucial for making this project truly production-ready!

## Need Help?

- **📚 [Full Documentation](/docs)**: Comprehensive guides and API reference
- **💬 [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)**: Report bugs or
  request features
- **🔧 [Troubleshooting](./installation.md#troubleshooting)**: Common issues and solutions

## Ready to Start?

<div class="cta-buttons">

[📦 Install Now](./installation.md) | [🚀 View Examples](./first-steps.md) |
[🤖 Setup Claude](./claude-desktop.md)

</div>

---

**Pro Tip**: Using `npx puppeteer-mcp` is the fastest way to try it out - no installation needed! 🎉
