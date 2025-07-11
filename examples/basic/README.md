# Basic Puppeteer MCP Examples

This directory contains simple, easy-to-understand examples to get you started with Puppeteer MCP.

## Prerequisites

- Node.js >= 20.0.0
- Puppeteer MCP server running locally or accessible via API

## Setup

```bash
npm install
```

## Environment Variables

Create a `.env` file with:

```env
API_BASE_URL=http://localhost:3000/api
API_KEY=your-api-key-here
```

## Examples

### 1. Screenshot Capture

Takes a screenshot of a web page and saves it locally.

```bash
npm run example:screenshot
```

**What it does:**

- Creates a browser session
- Navigates to a URL
- Takes a full-page screenshot
- Saves the image to disk
- Cleans up resources

### 2. Form Automation

Automates filling and submitting web forms.

```bash
npm run example:form
```

**What it does:**

- Fills text fields
- Selects dropdown options
- Toggles checkboxes
- Submits forms
- Handles validation errors

### 3. Content Extraction

Extracts structured data from web pages.

```bash
npm run example:extract
```

**What it does:**

- Extracts text content
- Scrapes product information
- Handles dynamic content
- Exports data to JSON/CSV

### 4. Navigation (Coming Soon)

Demonstrates page navigation and handling redirects.

```bash
npm run example:navigation
```

### 5. PDF Generation (Coming Soon)

Converts web pages to PDF documents.

```bash
npm run example:pdf
```

## Common Patterns

### Error Handling

All examples include proper error handling:

```typescript
try {
  // Your automation code
} catch (error) {
  console.error('Error:', error);
} finally {
  // Always clean up resources
  await cleanup();
}
```

### Session Management

Always create and clean up sessions:

```typescript
const session = await createSession();
try {
  // Use the session
} finally {
  await deleteSession(session.id);
}
```

### Waiting for Elements

Wait for elements before interacting:

```typescript
await waitForSelector('#my-element');
await click('#my-element');
```

## Tips

1. **Start Simple**: Begin with the screenshot example
2. **Check Logs**: Enable debug logging for troubleshooting
3. **Handle Timeouts**: Set appropriate timeouts for your use case
4. **Clean Resources**: Always clean up sessions and contexts
5. **Rate Limiting**: Be respectful of target websites

## Troubleshooting

### Session Creation Failed

- Check if the Puppeteer MCP server is running
- Verify your API key is correct
- Ensure the API URL is accessible

### Timeout Errors

- Increase timeout values
- Check if selectors are correct
- Verify the page loads completely

### Screenshot Issues

- Ensure the output directory exists
- Check file permissions
- Verify the page renders correctly

## Next Steps

Once comfortable with these basics:

1. Explore the [advanced examples](../advanced)
2. Learn about [API integration](../api)
3. Set up [monitoring](../monitoring)
4. Review [security best practices](../security)
