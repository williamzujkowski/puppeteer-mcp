---
title: Error Codes
description: ## Authentication Errors
---

# Error Codes

## Authentication Errors

| Code      | Message                  | Fix                     |
| --------- | ------------------------ | ----------------------- |
| `AUTH001` | Invalid credentials      | Check username/password |
| `AUTH002` | Token expired            | Refresh or re-login     |
| `AUTH003` | Invalid token            | Verify token format     |
| `AUTH004` | Insufficient permissions | Check user role         |
| `AUTH005` | API key invalid          | Verify API key          |

## Session Errors

| Code         | Message               | Fix                        |
| ------------ | --------------------- | -------------------------- |
| `SESSION001` | Session not found     | Session ID invalid/expired |
| `SESSION002` | Session timeout       | Recreate session           |
| `SESSION003` | Max sessions reached  | Close unused sessions      |
| `SESSION004` | Session locked        | Wait or force close        |
| `SESSION005` | Invalid session state | Restart session            |

## Browser Errors

| Code         | Message                 | Fix                             |
| ------------ | ----------------------- | ------------------------------- |
| `BROWSER001` | Failed to launch        | Check Chrome/Chromium installed |
| `BROWSER002` | Page crash              | Restart session                 |
| `BROWSER003` | Navigation timeout      | Increase timeout or check URL   |
| `BROWSER004` | Element not found       | Verify selector exists          |
| `BROWSER005` | Script execution failed | Check script syntax             |

## Network Errors

| Code     | Message               | Fix                                 |
| -------- | --------------------- | ----------------------------------- |
| `NET001` | Connection refused    | Check server running                |
| `NET002` | Request timeout       | Increase timeout                    |
| `NET003` | DNS resolution failed | Verify domain                       |
| `NET004` | SSL certificate error | Check cert or use ignoreHTTPSErrors |
| `NET005` | Proxy error           | Verify proxy settings               |

## Validation Errors

| Code     | Message                | Fix                       |
| -------- | ---------------------- | ------------------------- |
| `VAL001` | Missing required field | Check request body        |
| `VAL002` | Invalid field type     | Verify data types         |
| `VAL003` | Value out of range     | Check min/max values      |
| `VAL004` | Invalid URL format     | Use valid URL             |
| `VAL005` | Invalid selector       | Check CSS selector syntax |

## Quick Fixes

```javascript
// Retry on timeout
try {
  await page.goto(url, { timeout: 60000 });
} catch (err) {
  if (err.message.includes('timeout')) {
    await page.goto(url, { timeout: 120000 });
  }
}

// Handle navigation errors
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Element not found
await page.waitForSelector(selector, { visible: true });

// Session cleanup
process.on('SIGTERM', async () => {
  await closeAllSessions();
});
```
