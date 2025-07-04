# Getting Started with Puppeteer MCP

Welcome to Puppeteer MCP! This guide will help you get up and running with this powerful browser
automation platform that combines Puppeteer with multiple API protocols including REST, gRPC,
WebSocket, and Model Context Protocol (MCP).

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20.0.0 or higher** - Check with `node --version`
- **npm 10.0.0 or higher** - Check with `npm --version`
- **Git** - For cloning the repository
- **Chrome or Chromium** - Puppeteer will download this automatically
- **Docker** (optional) - For containerized deployment

### System Requirements

- **OS**: Linux, macOS, or Windows with WSL2
- **RAM**: Minimum 4GB (8GB recommended for concurrent browser sessions)
- **Disk**: 2GB free space for dependencies and browser cache

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/puppeteer-mcp.git
cd puppeteer-mcp
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including Puppeteer, which will automatically download a
compatible version of Chrome.

### 3. Build the Project

```bash
npm run build
```

### 4. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Browser Configuration
PUPPETEER_HEADLESS=true
BROWSER_POOL_MAX_SIZE=5
BROWSER_IDLE_TIMEOUT=300000

# API Configuration
API_RATE_LIMIT_WINDOW=15m
API_RATE_LIMIT_MAX=100
```

## Basic Configuration

### Starting the Server

For development with hot reload:

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will start on `http://localhost:3000` with:

- REST API at `/api/v1`
- gRPC on port `50051`
- WebSocket at `/ws`
- MCP available via stdio or HTTP

### Verifying Installation

Check the health endpoint:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12.345,
  "timestamp": "2025-01-07T12:00:00.000Z"
}
```

## First Browser Automation Example

Let's create your first browser automation script using the REST API.

### 1. Create an API Key

First, obtain a JWT token (or use API key authentication):

```bash
# Register a user (if using JWT)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secure123"}'

# Or create an API key
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secure123"}'
```

Save the returned token or API key.

### 2. Create a Browser Context

```bash
# Create a new browser context
curl -X POST http://localhost:3000/api/v1/contexts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-first-browser",
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }'
```

Save the returned `contextId`.

### 3. Navigate to a Website

```bash
curl -X POST http://localhost:3000/api/v1/contexts/YOUR_CONTEXT_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "navigate",
    "params": {
      "url": "https://example.com"
    }
  }'
```

### 4. Take a Screenshot

```bash
curl -X POST http://localhost:3000/api/v1/contexts/YOUR_CONTEXT_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "screenshot",
    "params": {
      "fullPage": true
    }
  }'
```

The screenshot will be returned as a base64-encoded string.

### 5. Clean Up

```bash
# Delete the context when done
curl -X DELETE http://localhost:3000/api/v1/contexts/YOUR_CONTEXT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## First API Call Example (Using Node.js)

Here's a complete example using the Node.js client:

```javascript
// example.js
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';
let token = 'YOUR_TOKEN'; // Replace with actual token

async function automateWebsite() {
  try {
    // 1. Create a browser context
    const contextResponse = await axios.post(
      `${API_BASE}/contexts`,
      {
        name: 'automation-example',
        viewport: { width: 1920, height: 1080 },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const contextId = contextResponse.data.data.id;
    console.log('Created context:', contextId);

    // 2. Navigate to a website
    await axios.post(
      `${API_BASE}/contexts/${contextId}/execute`,
      {
        action: 'navigate',
        params: { url: 'https://example.com' },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    console.log('Navigated to example.com');

    // 3. Click an element
    await axios.post(
      `${API_BASE}/contexts/${contextId}/execute`,
      {
        action: 'click',
        params: { selector: 'a[href="/more"]' },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    console.log('Clicked link');

    // 4. Get page content
    const contentResponse = await axios.post(
      `${API_BASE}/contexts/${contextId}/execute`,
      {
        action: 'content',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    console.log('Page title:', contentResponse.data.data.title);

    // 5. Clean up
    await axios.delete(`${API_BASE}/contexts/${contextId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Cleaned up context');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run the example
automateWebsite();
```

Run with:

```bash
node example.js
```

## Using with MCP (Model Context Protocol)

For AI agents and LLMs, you can use the MCP interface:

```bash
# Start MCP server
npm run mcp

# The server provides tools like:
# - execute-api: Call any API endpoint
# - create-context: Create browser contexts
# - execute-in-context: Run browser actions
# - manage-sessions: Handle authentication
```

## Troubleshooting Common Issues

### Browser Won't Start

**Error**: "Failed to launch the browser process"

**Solution**:

```bash
# Install Chrome dependencies on Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 \
  libxkbcommon0 libgbm1 libasound2

# Or use Docker which includes all dependencies
docker build -t puppeteer-mcp .
docker run -p 3000:3000 puppeteer-mcp
```

### Authentication Errors

**Error**: "Unauthorized" or "Invalid token"

**Solution**:

1. Ensure your token hasn't expired
2. Check the JWT_SECRET in your .env file
3. Verify the Authorization header format: `Bearer YOUR_TOKEN`

### Context Not Found

**Error**: "Context not found"

**Solution**:

- Contexts expire after the idle timeout (default 5 minutes)
- Check if the context ID is correct
- Create a new context if the old one expired

### Memory Issues

**Error**: "JavaScript heap out of memory"

**Solution**:

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Or adjust browser pool size in .env
BROWSER_POOL_MAX_SIZE=3
```

### Port Already in Use

**Error**: "EADDRINUSE: address already in use"

**Solution**:

```bash
# Find and kill the process using port 3000
lsof -i :3000
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

## Next Steps

Now that you have Puppeteer MCP running:

1. **Explore the API Documentation** - Check `/api/v1/docs` for OpenAPI specs
2. **Try Advanced Browser Actions** - Experiment with form filling, PDF generation, and JavaScript
   execution
3. **Set Up WebSocket Connections** - For real-time browser events
4. **Configure Security** - Set up proper JWT secrets and API rate limits
5. **Deploy with Docker** - Use the included Dockerfile for production deployment

### Useful Resources

- [API Reference](/docs/reference/api.md) - Complete API documentation
- [Browser Actions Guide](/docs/guides/browser-actions.md) - All available browser automation
  commands
- [Security Best Practices](/docs/guides/security.md) - Securing your deployment
- [MCP Integration](/docs/guides/mcp-usage-examples.md) - Using with AI agents

### Getting Help

- **GitHub Issues** - Report bugs or request features
- **Documentation** - Browse the `/docs` directory
- **Examples** - Check `/examples` for more code samples

Welcome to the Puppeteer MCP community! Happy automating! 🚀
