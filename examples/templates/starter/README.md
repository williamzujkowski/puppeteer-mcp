# Puppeteer MCP Starter Template

This is a starter template for building automation projects with Puppeteer MCP. It includes a
pre-configured project structure, common utilities, and best practices.

## Features

- ✅ TypeScript configuration
- ✅ Environment-based configuration
- ✅ Structured logging with Winston
- ✅ Error handling and retry logic
- ✅ Example automation scripts
- ✅ Testing setup with Jest
- ✅ Linting and formatting
- ✅ Docker support (optional)

## Project Structure

```
├── src/
│   ├── index.ts              # Main entry point
│   ├── config.ts             # Configuration management
│   ├── client.ts             # Puppeteer MCP client wrapper
│   ├── automations/          # Automation scripts
│   │   ├── base.ts          # Base automation class
│   │   └── example.ts       # Example automation
│   ├── utils/                # Utility functions
│   │   ├── logger.ts        # Logging setup
│   │   ├── retry.ts         # Retry logic
│   │   └── validation.ts    # Input validation
│   └── types/                # TypeScript types
│       └── index.ts         # Type definitions
├── tests/                    # Test files
├── .env.example             # Environment variables template
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Jest configuration
└── package.json             # Project dependencies
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- `API_KEY`: Your Puppeteer MCP API key
- `API_BASE_URL`: The API endpoint URL

### 3. Run the Example

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## Creating Your First Automation

1. Create a new file in `src/automations/`:

```typescript
import { BaseAutomation } from './base';
import { AutomationResult } from '../types';

export class MyAutomation extends BaseAutomation {
  async run(params: any): Promise<AutomationResult> {
    const session = await this.createSession();

    try {
      // Your automation logic here
      await this.navigate(session.id, 'https://example.com');
      const title = await this.getPageTitle(session.id);

      return {
        success: true,
        data: { title },
      };
    } finally {
      await this.cleanup(session.id);
    }
  }
}
```

2. Use it in your main file:

```typescript
import { MyAutomation } from './automations/my-automation';

const automation = new MyAutomation(client);
const result = await automation.run({
  /* params */
});
```

## Common Patterns

### Error Handling

```typescript
try {
  const result = await automation.run(params);
  logger.info('Success', { result });
} catch (error) {
  logger.error('Automation failed', { error });
  // Handle specific error types
  if (error instanceof TimeoutError) {
    // Retry or handle timeout
  }
}
```

### Retry Logic

```typescript
import { retry } from './utils/retry';

const result = await retry(() => automation.run(params), {
  maxAttempts: 3,
  delay: 1000,
  onRetry: (error, attempt) => {
    logger.warn(`Retry attempt ${attempt}`, { error });
  },
});
```

### Session Pool

```typescript
const pool = new SessionPool(client, { size: 5 });

try {
  const session = await pool.acquire();
  // Use session
  await pool.release(session);
} finally {
  await pool.drain();
}
```

## Testing

Run tests with:

```bash
npm test
```

Write tests in the `tests/` directory:

```typescript
describe('MyAutomation', () => {
  it('should extract page title', async () => {
    const automation = new MyAutomation(mockClient);
    const result = await automation.run({ url: 'https://example.com' });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Example Domain');
  });
});
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t my-puppeteer-app .
docker run --env-file .env my-puppeteer-app
```

### PM2

Run with PM2 for process management:

```bash
pm2 start ecosystem.config.js
```

## Best Practices

1. **Always clean up resources**: Use try/finally blocks
2. **Implement proper error handling**: Log errors with context
3. **Use environment variables**: Never hardcode sensitive data
4. **Add retry logic**: Handle transient failures gracefully
5. **Monitor performance**: Track execution times and success rates
6. **Write tests**: Ensure your automations work as expected
7. **Document your code**: Add clear comments and documentation

## Troubleshooting

### Session Creation Fails

- Check if the Puppeteer MCP server is running
- Verify your API key is correct
- Ensure the API URL is accessible

### Timeout Errors

- Increase timeout values in configuration
- Check if selectors are correct
- Verify the target website is accessible

### Memory Issues

- Ensure sessions are properly cleaned up
- Limit concurrent sessions
- Monitor resource usage

## Resources

- [Puppeteer MCP Documentation](https://williamzujkowski.github.io/puppeteer-mcp/)
- [API Reference](https://williamzujkowski.github.io/puppeteer-mcp/reference/api-quick-reference)
- [Examples](https://github.com/williamzujkowski/puppeteer-mcp/tree/main/examples)

## License

MIT
