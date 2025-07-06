---
title: User Guides
description:
  'Welcome to the Puppeteer MCP user guides. These guides provide detailed instructions for common
  use'
---

# User Guides

Welcome to the Puppeteer MCP user guides. These guides provide detailed instructions for common use
cases and advanced scenarios.

## Available Guides

### [Browser Automation](/puppeteer-mcp/guides/browser-automation)

Learn how to automate web browsers effectively with Puppeteer MCP. This guide covers:

- Page navigation and interaction
- Form filling and submission
- Content extraction and scraping
- Screenshot and PDF generation
- Handling dynamic content

### [API Integration](/puppeteer-mcp/guides/api-integration)

Integrate Puppeteer MCP into your applications using various protocols:

- REST API integration patterns
- WebSocket real-time communication
- gRPC service implementation
- Authentication and security
- Error handling strategies

### [MCP Usage Examples](/puppeteer-mcp/guides/mcp-usage-examples)

Practical examples of using Puppeteer MCP with Claude Desktop:

- Setting up Claude Desktop integration
- Common automation scenarios
- Natural language commands
- Advanced MCP patterns
- Troubleshooting tips

### [Advanced Scenarios](/puppeteer-mcp/guides/advanced-scenarios)

_(Coming soon)_ Advanced techniques and patterns:

- Multi-session management
- Parallel browser operations
- Custom browser contexts
- Performance optimization
- Enterprise deployment patterns

## Quick Navigation

Looking for something specific?

- **First time user?** Start with [Browser Automation](/puppeteer-mcp/guides/browser-automation)
- **Integrating with your app?** See [API Integration](/puppeteer-mcp/guides/api-integration)
- **Using with Claude?** Check [MCP Usage Examples](/puppeteer-mcp/guides/mcp-usage-examples)
- **Need API reference?** Visit the [API Reference](/puppeteer-mcp/reference/)

## Common Tasks

### Web Scraping

```javascript
// Extract data from websites
const data = await session.evaluate(() => {
  return Array.from(document.querySelectorAll('.item')).map((item) => ({
    title: item.querySelector('.title')?.textContent,
    price: item.querySelector('.price')?.textContent,
  }));
});
```

### Form Automation

```javascript
// Fill and submit forms
await session.fill('#email', 'user@example.com');
await session.fill('#password', 'password');
await session.click('#submit');
await session.waitForNavigation();
```

### Screenshot Generation

```javascript
// Capture screenshots
const screenshot = await session.screenshot({
  fullPage: true,
  type: 'png',
});
```

## Best Practices

1. **Session Management**: Always close sessions when done
2. **Error Handling**: Implement proper error handling
3. **Timeouts**: Set appropriate timeouts for operations
4. **Resource Limits**: Monitor and limit resource usage
5. **Security**: Use strong authentication tokens

## Need Help?

- Check the [Troubleshooting Guide](/puppeteer-mcp/troubleshooting)
- Review [Quick Reference](/puppeteer-mcp/quick-reference/) for rapid answers
- Explore [API Documentation](/puppeteer-mcp/reference/) for detailed specs
- Visit [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues) for support
