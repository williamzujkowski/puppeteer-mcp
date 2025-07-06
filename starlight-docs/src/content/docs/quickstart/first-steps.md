---
title: First Steps with Puppeteer MCP
description: 'Version 1.0.11 - Getting started with Puppeteer MCP'
---

# First Steps with Puppeteer MCP

**Version**: 1.0.11  
**Last Updated**: 2025-01-05  
**Reading Time**: 7 minutes

## Your First Browser Automation

Let's create your first browser automation in under 5 minutes!

## Quick Start Examples

### Example 1: Take a Screenshot

<details open>
<summary><strong>Using cURL (Simplest)</strong></summary>

```bash
# 1. Start the server (in one terminal)
npx puppeteer-mcp

# 2. Create a session (in another terminal)
SESSION_ID=$(curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"baseUrl": "https://example.com"}' \
  | jq -r '.sessionId')

# 3. Navigate to a page
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 4. Take a screenshot
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/screenshot \
  -H "Content-Type: application/json" \
  -d '{"fullPage": true}' \
  | jq -r '.screenshot' | base64 -d > screenshot.png

echo "Screenshot saved as screenshot.png!"
```

</details>

<details>
<summary><strong>Using Node.js</strong></summary>

```javascript
// screenshot.js
const fetch = require('node-fetch');
const fs = require('fs');

async function takeScreenshot() {
  const API_BASE = 'http://localhost:3000/api';

  // 1. Create a session
  const sessionResponse = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl: 'https://example.com' }),
  });

  const { sessionId } = await sessionResponse.json();

  // 2. Navigate to the page
  await fetch(`${API_BASE}/sessions/${sessionId}/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });

  // 3. Take a screenshot
  const screenshotResponse = await fetch(`${API_BASE}/sessions/${sessionId}/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullPage: true }),
  });

  const { screenshot } = await screenshotResponse.json();

  // 4. Save the screenshot
  fs.writeFileSync('screenshot.png', Buffer.from(screenshot, 'base64'));
  console.log('Screenshot saved as screenshot.png!');

  // 5. Clean up
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

takeScreenshot().catch(console.error);
```

Run it:

```bash
node screenshot.js
```

</details>

<details>
<summary><strong>Using Python</strong></summary>

```python
# screenshot.py
import requests
import base64

API_BASE = 'http://localhost:3000/api'

# 1. Create a session
session_response = requests.post(f'{API_BASE}/sessions',
  json={'baseUrl': 'https://example.com'})
session_id = session_response.json()['sessionId']

# 2. Navigate to the page
requests.post(f'{API_BASE}/sessions/{session_id}/navigate',
  json={'url': 'https://example.com'})

# 3. Take a screenshot
screenshot_response = requests.post(
  f'{API_BASE}/sessions/{session_id}/screenshot',
  json={'fullPage': True})

# 4. Save the screenshot
screenshot_data = screenshot_response.json()['screenshot']
with open('screenshot.png', 'wb') as f:
  f.write(base64.b64decode(screenshot_data))

print('Screenshot saved as screenshot.png!')

# 5. Clean up
requests.delete(f'{API_BASE}/sessions/{session_id}')
```

Run it:

```bash
python screenshot.py
```

</details>

### Example 2: Extract Page Content

<details open>
<summary><strong>Extract Text from a Website</strong></summary>

```javascript
// extract-content.js
const fetch = require('node-fetch');

async function extractContent() {
  const API_BASE = 'http://localhost:3000/api';

  // Create session and navigate
  const sessionResponse = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl: 'https://example.com' }),
  });

  const { sessionId } = await sessionResponse.json();

  await fetch(`${API_BASE}/sessions/${sessionId}/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });

  // Extract specific content
  const evaluateResponse = await fetch(`${API_BASE}/sessions/${sessionId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      script: `
        ({
          title: document.title,
          headings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent),
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent,
            href: a.href
          })).slice(0, 5) // First 5 links
        })
      `,
    }),
  });

  const content = await evaluateResponse.json();
  console.log('Page Content:', JSON.stringify(content.result, null, 2));

  // Clean up
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

extractContent().catch(console.error);
```

</details>

### Example 3: Fill and Submit a Form

<details open>
<summary><strong>Automate Form Interaction</strong></summary>

```javascript
// form-automation.js
const fetch = require('node-fetch');

async function automateForm() {
  const API_BASE = 'http://localhost:3000/api';

  // Create session
  const sessionResponse = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl: 'https://example-form.com' }),
  });

  const { sessionId } = await sessionResponse.json();

  // Navigate to form page
  await fetch(`${API_BASE}/sessions/${sessionId}/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example-form.com/contact' }),
  });

  // Fill form fields
  await fetch(`${API_BASE}/sessions/${sessionId}/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selector: 'input[name="email"]',
      value: 'test@example.com',
    }),
  });

  await fetch(`${API_BASE}/sessions/${sessionId}/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selector: 'textarea[name="message"]',
      value: 'This is an automated test message.',
    }),
  });

  // Click submit button
  await fetch(`${API_BASE}/sessions/${sessionId}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selector: 'button[type="submit"]',
    }),
  });

  // Wait for navigation or response
  await fetch(`${API_BASE}/sessions/${sessionId}/wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selector: '.success-message',
      timeout: 5000,
    }),
  });

  console.log('Form submitted successfully!');

  // Clean up
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

automateForm().catch(console.error);
```

</details>

## Common Automation Patterns

### 1. Web Scraping Pattern

```javascript
async function scrapeProducts() {
  const session = await createSession('https://shop.example.com');

  // Navigate to products page
  await navigate(session.id, '/products');

  // Extract product data
  const products = await evaluate(
    session.id,
    `
    Array.from(document.querySelectorAll('.product')).map(product => ({
      name: product.querySelector('.name')?.textContent,
      price: product.querySelector('.price')?.textContent,
      image: product.querySelector('img')?.src,
      link: product.querySelector('a')?.href
    }))
  `,
  );

  console.log(`Found ${products.length} products`);
  return products;
}
```

### 2. PDF Generation Pattern

```javascript
async function generatePDF(url, outputPath) {
  const session = await createSession(url);

  // Navigate to the page
  await navigate(session.id, url);

  // Wait for content to load
  await waitForSelector(session.id, 'body');

  // Generate PDF
  const pdfResponse = await fetch(`${API_BASE}/sessions/${session.id}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm',
      },
    }),
  });

  const { pdf } = await pdfResponse.json();
  fs.writeFileSync(outputPath, Buffer.from(pdf, 'base64'));

  console.log(`PDF saved to ${outputPath}`);
}
```

### 3. Authentication Pattern

```javascript
async function loginAndScrape() {
  const session = await createSession('https://app.example.com');

  // Navigate to login page
  await navigate(session.id, '/login');

  // Fill login form
  await fill(session.id, '#username', 'myuser@example.com');
  await fill(session.id, '#password', 'mypassword');

  // Submit form
  await click(session.id, 'button[type="submit"]');

  // Wait for dashboard to load
  await waitForSelector(session.id, '.dashboard');

  // Now you can access authenticated content
  const userData = await evaluate(
    session.id,
    `
    ({
      name: document.querySelector('.user-name')?.textContent,
      balance: document.querySelector('.balance')?.textContent
    })
  `,
  );

  return userData;
}
```

## Working with Different Protocols

### REST API (Default)

Already shown in examples above. Use standard HTTP requests.

### WebSocket (Real-time)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  // Subscribe to browser events
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      sessionId: 'your-session-id',
      events: ['console', 'network', 'page'],
    }),
  );
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Browser event:', event);
});
```

### gRPC (High Performance)

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load proto file
const packageDefinition = protoLoader.loadSync('puppeteer.proto');
const puppeteerProto = grpc.loadPackageDefinition(packageDefinition);

// Create client
const client = new puppeteerProto.PuppeteerService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
);

// Use the service
client.createSession({ baseUrl: 'https://example.com' }, (err, response) => {
  if (!err) {
    console.log('Session created:', response.sessionId);
  }
});
```

### MCP (AI Integration)

See [Claude Desktop Setup](/puppeteer-mcp/quickstart/claude-desktop.md) for MCP integration.

## Best Practices

### 1. Always Clean Up Sessions

```javascript
const session = await createSession();
try {
  // Your automation code here
} finally {
  // Always clean up
  await deleteSession(session.id);
}
```

### 2. Handle Errors Gracefully

```javascript
async function safeScrape(url) {
  let session;
  try {
    session = await createSession(url);
    // Your scraping logic
  } catch (error) {
    console.error('Scraping failed:', error);
    // Handle specific errors
    if (error.message.includes('timeout')) {
      console.log('Page took too long to load');
    }
  } finally {
    if (session) {
      await deleteSession(session.id);
    }
  }
}
```

### 3. Use Appropriate Timeouts

```javascript
// Set reasonable timeouts
await waitForSelector(session.id, '.content', {
  timeout: 10000, // 10 seconds
});

// For slow pages
await navigate(session.id, url, {
  waitUntil: 'networkidle0',
  timeout: 30000, // 30 seconds
});
```

### 4. Optimize for Performance

```javascript
// Reuse sessions when possible
const session = await createSession();

// Process multiple pages with one session
for (const url of urls) {
  await navigate(session.id, url);
  await processPage(session.id);
}

await deleteSession(session.id);
```

## Common Commands Reference

| Action         | Endpoint                            | Description                 |
| -------------- | ----------------------------------- | --------------------------- |
| Create Session | `POST /api/sessions`                | Start a new browser session |
| Navigate       | `POST /api/sessions/:id/navigate`   | Go to a URL                 |
| Click          | `POST /api/sessions/:id/click`      | Click an element            |
| Fill           | `POST /api/sessions/:id/fill`       | Fill input field            |
| Screenshot     | `POST /api/sessions/:id/screenshot` | Capture screenshot          |
| PDF            | `POST /api/sessions/:id/pdf`        | Generate PDF                |
| Evaluate       | `POST /api/sessions/:id/evaluate`   | Run JavaScript              |
| Wait           | `POST /api/sessions/:id/wait`       | Wait for element            |
| Delete Session | `DELETE /api/sessions/:id`          | Clean up session            |

## Debugging Tips

### Enable Debug Logs

```bash
DEBUG=puppeteer:* npx puppeteer-mcp
```

### Inspect Browser State

```javascript
// Take screenshot when debugging
const debugScreenshot = await screenshot(session.id);
fs.writeFileSync('debug.png', Buffer.from(debugScreenshot, 'base64'));

// Get page content
const html = await evaluate(session.id, 'document.documentElement.outerHTML');
fs.writeFileSync('debug.html', html);
```

### Use Headful Mode for Development

```bash
PUPPETEER_HEADLESS=false npx puppeteer-mcp
```

## Next Steps

Now that you've completed your first automations:

1. **[Set up authentication](/puppeteer-mcp/quickstart/configuration.md)** - Secure your API
2. **[Integrate with Claude Desktop](/puppeteer-mcp/quickstart/claude-desktop.md)** - Enable AI
   automation
3. **[Explore advanced features](/puppeteer-mcp/reference/)** - Full API reference

## Need Help?

- 💡 Check our
  [Examples Repository](https://github.com/williamzujkowski/puppeteer-mcp/tree/main/examples)
- 📚 Read the [API Documentation](/puppeteer-mcp/reference/)
- 💬 Ask questions on [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)

---

**Pro Tip**: Start simple, then gradually add complexity. Browser automation is powerful but can be
tricky - take it step by step! 🎯
