---
title: Claude Desktop Setup Guide
description: 'Version 1.0.11 - Setup guide for Claude Desktop integration'
---

# Claude Desktop Setup Guide

**Version**: 1.0.11  
**Last Updated**: 2025-01-05  
**Reading Time**: 5 minutes

## Overview

Set up Puppeteer MCP with Claude Desktop to enable AI-powered browser automation. Claude will be
able to browse websites, take screenshots, fill forms, and extract data on your behalf.

## Prerequisites

- Claude Desktop installed on your computer
- Node.js 18.0.0+ and npm 9.0.0+
- Puppeteer MCP installed (see [Installation Guide](/puppeteer-mcp/quickstart/installation.md))

## Quick Setup (3 Steps)

### Step 1: Install Puppeteer MCP

```bash
npm install -g puppeteer-mcp
```

Verify installation:

```bash
puppeteer-mcp --version
```

### Step 2: Configure Claude Desktop

Find your Claude Desktop configuration file:

<details>
<summary><strong>📁 Configuration File Locations</strong></summary>

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

If the file doesn't exist, create it with the directory structure.

</details>

Add this configuration:

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

### Step 3: Restart Claude Desktop

1. Completely quit Claude Desktop (not just close the window)
2. Start Claude Desktop again
3. Look for "puppeteer" in the available tools list

## Configuration Options

### Basic Configuration (Recommended)

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["puppeteer-mcp"]
    }
  }
}
```

This uses default settings - perfect for getting started.

### Advanced Configuration

<details>
<summary><strong>With Authentication</strong></summary>

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "PUPPETEER_MCP_AUTH_TOKEN": "generate-a-secure-token-here",
        "NODE_ENV": "production"
      }
    }
  }
}
```

Generate a secure token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

</details>

<details>
<summary><strong>With Custom Settings</strong></summary>

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "PUPPETEER_HEADLESS": "true",
        "MAX_SESSIONS": "5",
        "SESSION_TIMEOUT": "1800000",
        "PORT": "3001",
        "DEBUG": "puppeteer:*"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Using Global Installation</strong></summary>

If you installed globally:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "puppeteer-mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Using Local Project Path</strong></summary>

For development or custom builds:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["/path/to/puppeteer-mcp/dist/bin/puppeteer-mcp.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

</details>

## Verify Setup

### Check Tool Availability

1. Open Claude Desktop
2. Start a new conversation
3. Type: "What tools do you have available?"
4. Claude should list "puppeteer" among the available tools

### Test Browser Automation

Try these commands in Claude:

```
"Navigate to example.com and take a screenshot"
```

```
"Go to Wikipedia and search for 'artificial intelligence'"
```

```
"Visit https://news.ycombinator.com and tell me the top 3 stories"
```

## Usage Examples

### Basic Web Browsing

<details open>
<summary><strong>Take a Screenshot</strong></summary>

Ask Claude:

> "Take a screenshot of https://example.com"

Claude will:

1. Create a browser session
2. Navigate to the website
3. Capture a screenshot
4. Show you the image

</details>

<details>
<summary><strong>Extract Information</strong></summary>

Ask Claude:

> "Go to https://weather.com and tell me today's weather"

Claude will:

1. Navigate to the weather site
2. Extract relevant information
3. Summarize the weather for you

</details>

### Form Automation

<details>
<summary><strong>Fill Out Forms</strong></summary>

Ask Claude:

> "Go to the contact form at example.com/contact and fill it out with test data"

Claude can:

- Fill text inputs
- Select dropdowns
- Check/uncheck boxes
- Submit forms

</details>

### Data Extraction

<details>
<summary><strong>Web Scraping</strong></summary>

Ask Claude:

> "Extract all product names and prices from shop.example.com"

Claude will:

- Navigate to the page
- Identify product elements
- Extract structured data
- Present it in a readable format

</details>

### Advanced Automation

<details>
<summary><strong>Multi-Step Workflows</strong></summary>

Ask Claude:

> "Log into my test account at demo.example.com (username: test, password: demo123), navigate to the
> dashboard, and download the monthly report"

Claude can handle complex, multi-step automations.

</details>

## Best Practices

### 1. Security Considerations

- **Never share real passwords** with Claude
- Use test accounts for automation
- Set up authentication tokens for production use
- Run in headless mode for security

### 2. Clear Instructions

<details>
<summary><strong>Good vs Bad Instructions</strong></summary>

**❌ Bad:**

> "Check that website"

**✅ Good:**

> "Navigate to https://example.com and take a screenshot of the homepage"

**❌ Bad:**

> "Fill the form"

**✅ Good:**

> "Go to example.com/contact, fill the email field with test@example.com, and submit the form"

</details>

### 3. Handle Timeouts

Some websites load slowly. Be patient or specify:

> "Navigate to slow-site.com and wait up to 30 seconds for it to load completely"

### 4. Session Management

Claude automatically manages browser sessions, but you can be explicit:

> "Create a new browser session, navigate to example.com, take a screenshot, then close the session"

## Troubleshooting

### Common Issues

<details>
<summary><strong>❌ Claude doesn't see the tool</strong></summary>

1. **Check configuration file syntax**:

   ```bash
   # Validate JSON
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
   ```

2. **Ensure proper file location**:
   - The config file must be in the exact location
   - Directory must exist

3. **Restart Claude completely**:
   - Quit Claude Desktop (Cmd+Q on Mac)
   - Start it again

4. **Check logs** (if available):
   - Look for MCP-related errors
   - Verify the command runs manually

</details>

<details>
<summary><strong>❌ "Command not found" error</strong></summary>

1. **Verify installation**:

   ```bash
   which puppeteer-mcp  # Should show path
   npx puppeteer-mcp --version  # Should show version
   ```

2. **Try alternative commands**:

   ```json
   {
     "command": "node",
     "args": ["/usr/local/lib/node_modules/puppeteer-mcp/dist/bin/puppeteer-mcp.js"]
   }
   ```

3. **Use npx** (recommended):
   ```json
   {
     "command": "npx",
     "args": ["puppeteer-mcp"]
   }
   ```

</details>

<details>
<summary><strong>❌ Browser fails to launch</strong></summary>

1. **Install Chrome dependencies** (Linux):

   ```bash
   sudo apt-get install -y chromium-browser
   ```

2. **Set Chrome path**:

   ```json
   {
     "env": {
       "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome"
     }
   }
   ```

3. **Use Docker** for consistent environment

</details>

<details>
<summary><strong>❌ Authentication errors</strong></summary>

1. **Generate a secure token**:

   ```bash
   openssl rand -hex 32
   ```

2. **Set in both places**:
   - Claude config: `PUPPETEER_MCP_AUTH_TOKEN`
   - Server expects the same token

3. **Test without auth** first:
   ```json
   {
     "env": {
       "NODE_ENV": "development"
     }
   }
   ```

</details>

### Debug Mode

Enable detailed logging:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "DEBUG": "puppeteer:*",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Advanced Features

### Custom Browser Options

```json
{
  "env": {
    "PUPPETEER_ARGS": "--no-sandbox --disable-setuid-sandbox",
    "PUPPETEER_HEADLESS": "false",
    "DEFAULT_VIEWPORT_WIDTH": "1920",
    "DEFAULT_VIEWPORT_HEIGHT": "1080"
  }
}
```

### Multiple Instances

Run different configurations:

```json
{
  "mcpServers": {
    "puppeteer-prod": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "PORT": "3001",
        "NODE_ENV": "production"
      }
    },
    "puppeteer-dev": {
      "command": "npx",
      "args": ["puppeteer-mcp"],
      "env": {
        "PORT": "3002",
        "NODE_ENV": "development",
        "PUPPETEER_HEADLESS": "false"
      }
    }
  }
}
```

## Security Best Practices

1. **Always use authentication tokens** in production
2. **Never expose real credentials** to Claude
3. **Run in headless mode** for security
4. **Limit session timeouts** to prevent resource leaks
5. **Use read-only operations** when possible

## Next Steps

✅ Setup complete! Now you can:

1. **[Explore usage examples](/puppeteer-mcp/quickstart/first-steps.md)** - See what's possible
2. **[Configure advanced settings](/puppeteer-mcp/quickstart/configuration.md)** - Customize
   behavior
3. **[Read the full API docs](/puppeteer-mcp/reference/)** - Learn all capabilities

## Getting Help

- 💬 Ask Claude directly about browser automation
- 📚 Check the [MCP Documentation](https://modelcontextprotocol.io)
- 🐛 Report issues on [GitHub](https://github.com/williamzujkowski/puppeteer-mcp/issues)

---

**Pro Tip**: Start with simple tasks like screenshots, then gradually try more complex automations.
Claude learns from your usage patterns! 🤖
