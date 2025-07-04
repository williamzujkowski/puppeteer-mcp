# Browser Automation Guide

This guide covers the comprehensive browser automation capabilities provided by the Puppeteer
integration in this platform. Learn how to leverage browser pooling, execute actions, and build
powerful automation workflows.

## Introduction to Puppeteer Integration

The platform provides enterprise-grade browser automation through Puppeteer, offering:

- **Resource-efficient browser pooling** with automatic cleanup
- **13 comprehensive browser actions** covering all automation needs
- **Multi-protocol support** via REST, gRPC, WebSocket, and MCP
- **Security-first design** with NIST compliance and XSS prevention
- **Real-time event streaming** for monitoring browser activities

### Quick Start Example

```typescript
// Create a browser context
const context = await client.createContext({
  name: 'shopping-bot',
  viewport: { width: 1920, height: 1080 },
});

// Navigate to a website
await client.executeAction(context.id, {
  action: 'navigate',
  params: { url: 'https://example-shop.com' },
});

// Take a screenshot
const screenshot = await client.executeAction(context.id, {
  action: 'screenshot',
  params: { fullPage: true },
});
```

## Browser Pool and Resource Management

The browser pool manages Chrome/Chromium instances efficiently, preventing resource exhaustion while
maintaining performance.

### Pool Configuration

```typescript
// Environment variables for pool configuration
BROWSER_POOL_MAX_SIZE = 5; // Maximum concurrent browsers
BROWSER_IDLE_TIMEOUT = 300000; // 5 minutes idle timeout
PUPPETEER_HEADLESS = true; // Run browsers in headless mode
PUPPETEER_CACHE_ENABLED = true; // Enable browser binary caching
```

### Resource Management Features

- **Automatic browser recycling** after idle timeout
- **Health monitoring** with automatic recovery
- **Queue management** for acquisition requests
- **Graceful shutdown** with proper cleanup
- **Memory leak prevention** through session tracking

### Best Practices for Resource Usage

```typescript
// Always clean up contexts when done
try {
  const context = await createContext();
  // ... perform automation tasks
} finally {
  await deleteContext(context.id); // Triggers automatic browser cleanup
}

// Use connection pooling for multiple operations
const operations = ['page1', 'page2', 'page3'];
const results = await Promise.all(operations.map((page) => executeInNewContext(page)));
```

## All 13 Action Types with Examples

### Navigation Actions

#### 1. Navigate

```typescript
await executeAction(contextId, {
  action: 'navigate',
  params: {
    url: 'https://example.com',
    waitUntil: 'networkidle2', // Options: load, domcontentloaded, networkidle0, networkidle2
  },
});
```

#### 2. Go Back

```typescript
await executeAction(contextId, {
  action: 'goBack',
  params: { waitUntil: 'networkidle2' },
});
```

#### 3. Go Forward

```typescript
await executeAction(contextId, {
  action: 'goForward',
  params: { waitUntil: 'networkidle2' },
});
```

#### 4. Reload

```typescript
await executeAction(contextId, {
  action: 'reload',
  params: { waitUntil: 'networkidle2' },
});
```

### Interaction Actions

#### 5. Click

```typescript
await executeAction(contextId, {
  action: 'click',
  params: {
    selector: '#submit-button',
    clickCount: 1, // Single or double click
    button: 'left', // left, right, middle
  },
});
```

#### 6. Type

```typescript
await executeAction(contextId, {
  action: 'type',
  params: {
    selector: "input[name='email']",
    text: 'user@example.com',
    delay: 100, // Milliseconds between keystrokes
  },
});
```

#### 7. Select

```typescript
await executeAction(contextId, {
  action: 'select',
  params: {
    selector: 'select#country',
    values: ['US', 'CA'], // Multiple values for multi-select
  },
});
```

#### 8. Upload

```typescript
await executeAction(contextId, {
  action: 'upload',
  params: {
    selector: "input[type='file']",
    files: ['/path/to/document.pdf', '/path/to/image.jpg'],
  },
});
```

### Content Actions

#### 9. Screenshot

```typescript
const result = await executeAction(contextId, {
  action: 'screenshot',
  params: {
    fullPage: true,
    type: 'png', // png or jpeg
    quality: 90, // For jpeg only
    clip: {
      // Optional: capture specific area
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    },
  },
});
// result.data contains base64 encoded image
```

#### 10. Evaluate (Execute JavaScript)

```typescript
const result = await executeAction(contextId, {
  action: 'evaluate',
  params: {
    script: `
      const title = document.title;
      const links = Array.from(document.querySelectorAll('a')).length;
      return { title, linkCount: links };
    `,
  },
});
// result.data contains the returned object
```

### Utility Actions

#### 11. Wait

```typescript
// Wait for selector
await executeAction(contextId, {
  action: 'wait',
  params: {
    selector: '#dynamic-content',
    visible: true, // Wait until visible
    timeout: 30000, // 30 second timeout
  },
});

// Wait for fixed time
await executeAction(contextId, {
  action: 'wait',
  params: {
    duration: 2000, // Wait 2 seconds
  },
});
```

#### 12. Hover

```typescript
await executeAction(contextId, {
  action: 'hover',
  params: {
    selector: '.menu-item:hover',
  },
});
```

#### 13. Focus

```typescript
await executeAction(contextId, {
  action: 'focus',
  params: {
    selector: 'input#search',
  },
});
```

## Advanced Scenarios

### Multi-Page Workflows

```typescript
// E-commerce checkout flow
async function automateCheckout(contextId: string) {
  // Search for product
  await executeAction(contextId, {
    action: 'type',
    params: { selector: '#search', text: 'laptop' },
  });

  await executeAction(contextId, {
    action: 'click',
    params: { selector: '#search-button' },
  });

  // Wait for results and click first product
  await executeAction(contextId, {
    action: 'wait',
    params: { selector: '.product-card', visible: true },
  });

  await executeAction(contextId, {
    action: 'click',
    params: { selector: '.product-card:first-child' },
  });

  // Add to cart
  await executeAction(contextId, {
    action: 'click',
    params: { selector: '#add-to-cart' },
  });

  // Navigate to checkout
  await executeAction(contextId, {
    action: 'navigate',
    params: { url: 'https://shop.example.com/checkout' },
  });
}
```

### Cookie Management

```typescript
// Get all cookies
const cookies = await executeAction(contextId, {
  action: 'evaluate',
  params: {
    script: 'return document.cookie',
  },
});

// Set cookie via JavaScript
await executeAction(contextId, {
  action: 'evaluate',
  params: {
    script: `
      document.cookie = "session=abc123; path=/; max-age=3600";
      return document.cookie;
    `,
  },
});
```

### JavaScript Execution Patterns

```typescript
// Extract structured data
const productData = await executeAction(contextId, {
  action: 'evaluate',
  params: {
    script: `
      const products = Array.from(document.querySelectorAll('.product')).map(el => ({
        name: el.querySelector('.name')?.textContent,
        price: parseFloat(el.querySelector('.price')?.textContent.replace('$', '')),
        inStock: el.querySelector('.stock')?.textContent.includes('In Stock')
      }));
      return products.filter(p => p.inStock && p.price < 100);
    `,
  },
});

// Monitor for changes
const changes = await executeAction(contextId, {
  action: 'evaluate',
  params: {
    script: `
      return new Promise(resolve => {
        const observer = new MutationObserver(mutations => {
          resolve(mutations.length);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => resolve(0), 5000); // 5s timeout
      });
    `,
  },
});
```

## Performance Tips and Best Practices

### 1. Optimize Navigation

```typescript
// Use appropriate wait conditions
await executeAction(contextId, {
  action: 'navigate',
  params: {
    url: 'https://example.com',
    waitUntil: 'domcontentloaded', // Faster than networkidle2 when appropriate
  },
});
```

### 2. Batch Operations

```typescript
// Execute multiple actions in sequence efficiently
const actions = [
  { action: 'type', params: { selector: '#field1', text: 'value1' } },
  { action: 'type', params: { selector: '#field2', text: 'value2' } },
  { action: 'click', params: { selector: '#submit' } },
];

for (const action of actions) {
  await executeAction(contextId, action);
}
```

### 3. Smart Waiting

```typescript
// Prefer explicit waits over fixed delays
// Bad: Fixed delay
await executeAction(contextId, {
  action: 'wait',
  params: { duration: 5000 },
});

// Good: Wait for specific condition
await executeAction(contextId, {
  action: 'wait',
  params: { selector: '#content-loaded', visible: true },
});
```

### 4. Resource Cleanup

```typescript
// Use try-finally for guaranteed cleanup
async function scrapeWithCleanup(url: string) {
  let contextId;
  try {
    const context = await createContext();
    contextId = context.id;

    await executeAction(contextId, {
      action: 'navigate',
      params: { url },
    });

    return await executeAction(contextId, {
      action: 'evaluate',
      params: { script: 'return document.body.innerHTML' },
    });
  } finally {
    if (contextId) {
      await deleteContext(contextId);
    }
  }
}
```

### 5. Error Handling

```typescript
// Implement retry logic for flaky operations
async function retryAction(contextId: string, action: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeAction(contextId, action);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Common Automation Patterns

### Form Automation

```typescript
async function fillForm(contextId: string, formData: Record<string, string>) {
  // Fill text inputs
  for (const [field, value] of Object.entries(formData)) {
    await executeAction(contextId, {
      action: 'type',
      params: { selector: `input[name="${field}"]`, text: value },
    });
  }

  // Submit form
  await executeAction(contextId, {
    action: 'click',
    params: { selector: "button[type='submit']" },
  });

  // Wait for submission result
  await executeAction(contextId, {
    action: 'wait',
    params: { selector: '.success-message', visible: true, timeout: 10000 },
  });
}
```

### Data Extraction

```typescript
async function extractTableData(contextId: string, tableSelector: string) {
  return await executeAction(contextId, {
    action: 'evaluate',
    params: {
      script: `
        const table = document.querySelector('${tableSelector}');
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
          const cells = Array.from(tr.querySelectorAll('td'));
          return headers.reduce((obj, header, i) => {
            obj[header] = cells[i]?.textContent.trim() || '';
            return obj;
          }, {});
        });
        return { headers, rows };
      `,
    },
  });
}
```

### Visual Testing

```typescript
async function compareScreenshots(contextId: string, baselineUrl: string, testUrl: string) {
  // Capture baseline
  await executeAction(contextId, {
    action: 'navigate',
    params: { url: baselineUrl },
  });

  const baseline = await executeAction(contextId, {
    action: 'screenshot',
    params: { fullPage: true },
  });

  // Capture test version
  await executeAction(contextId, {
    action: 'navigate',
    params: { url: testUrl },
  });

  const test = await executeAction(contextId, {
    action: 'screenshot',
    params: { fullPage: true },
  });

  // Return both for external comparison
  return { baseline: baseline.data, test: test.data };
}
```

## Summary

The browser automation platform provides a powerful, secure, and scalable solution for web
automation tasks. By leveraging the browser pool for resource management and the comprehensive
action system, you can build sophisticated automation workflows while maintaining performance and
security.

Key takeaways:

- Always manage resources properly with cleanup
- Use appropriate wait strategies for reliability
- Leverage JavaScript execution for complex operations
- Implement proper error handling and retries
- Follow security best practices for input validation

For more details on specific protocols, see the [REST API Reference](../reference/rest-api.md) or
[MCP Usage Examples](./mcp-usage-examples.md).
