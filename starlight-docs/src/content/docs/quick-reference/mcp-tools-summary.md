---
title: MCP Tools Summary
description: 'Summary of MCP tools for session management and browser automation'
---

# MCP Tools Summary

## Session Management

| Tool                       | Purpose                | Example                                      |
| -------------------------- | ---------------------- | -------------------------------------------- |
| `puppeteer_create_session` | Create browser session | `{ viewport: { width: 1280, height: 720 } }` |
| `puppeteer_close_session`  | Close session          | `{ sessionId: "abc123" }`                    |
| `puppeteer_list_sessions`  | Get active sessions    | `{}`                                         |

## Navigation

| Tool                   | Purpose         | Example                                               |
| ---------------------- | --------------- | ----------------------------------------------------- |
| `puppeteer_navigate`   | Go to URL       | `{ url: "https://example.com", sessionId: "abc123" }` |
| `puppeteer_reload`     | Reload page     | `{ sessionId: "abc123" }`                             |
| `puppeteer_go_back`    | Browser back    | `{ sessionId: "abc123" }`                             |
| `puppeteer_go_forward` | Browser forward | `{ sessionId: "abc123" }`                             |

## Interaction

| Tool               | Purpose         | Example                                                         |
| ------------------ | --------------- | --------------------------------------------------------------- |
| `puppeteer_click`  | Click element   | `{ selector: "button", sessionId: "abc123" }`                   |
| `puppeteer_type`   | Type text       | `{ selector: "input", text: "hello", sessionId: "abc123" }`     |
| `puppeteer_select` | Select dropdown | `{ selector: "select", value: "option1", sessionId: "abc123" }` |
| `puppeteer_hover`  | Hover element   | `{ selector: ".menu", sessionId: "abc123" }`                    |
| `puppeteer_focus`  | Focus element   | `{ selector: "input", sessionId: "abc123" }`                    |

## Data Extraction

| Tool                    | Purpose         | Example                                   |
| ----------------------- | --------------- | ----------------------------------------- |
| `puppeteer_screenshot`  | Take screenshot | `{ sessionId: "abc123", fullPage: true }` |
| `puppeteer_pdf`         | Generate PDF    | `{ sessionId: "abc123", format: "A4" }`   |
| `puppeteer_get_content` | Get HTML        | `{ sessionId: "abc123" }`                 |
| `puppeteer_get_title`   | Get page title  | `{ sessionId: "abc123" }`                 |
| `puppeteer_get_url`     | Get current URL | `{ sessionId: "abc123" }`                 |

## Evaluation

| Tool                        | Purpose        | Example                                             |
| --------------------------- | -------------- | --------------------------------------------------- |
| `puppeteer_evaluate`        | Run JS in page | `{ script: "document.title", sessionId: "abc123" }` |
| `puppeteer_evaluate_handle` | Get JS handle  | `{ script: "document.body", sessionId: "abc123" }`  |

## Waiting

| Tool                            | Purpose           | Example                                              |
| ------------------------------- | ----------------- | ---------------------------------------------------- |
| `puppeteer_wait_for_selector`   | Wait for element  | `{ selector: ".loaded", sessionId: "abc123" }`       |
| `puppeteer_wait_for_navigation` | Wait nav complete | `{ sessionId: "abc123", waitUntil: "networkidle0" }` |
| `puppeteer_wait_for_timeout`    | Wait time         | `{ timeout: 2000, sessionId: "abc123" }`             |

## Advanced

| Tool                       | Purpose         | Example                                                    |
| -------------------------- | --------------- | ---------------------------------------------------------- |
| `puppeteer_set_viewport`   | Change viewport | `{ width: 1920, height: 1080, sessionId: "abc123" }`       |
| `puppeteer_set_user_agent` | Set UA string   | `{ userAgent: "Mozilla/5.0...", sessionId: "abc123" }`     |
| `puppeteer_add_script_tag` | Inject script   | `{ url: "https://cdn.js", sessionId: "abc123" }`           |
| `puppeteer_add_style_tag`  | Inject CSS      | `{ content: "body { color: red; }", sessionId: "abc123" }` |
| `puppeteer_emulate_media`  | Emulate media   | `{ type: "print", sessionId: "abc123" }`                   |

## Quick Examples

```javascript
// Login flow
await puppeteer_navigate({ url: 'https://app.com/login', sessionId });
await puppeteer_type({ selector: '#email', text: 'user@example.com', sessionId });
await puppeteer_type({ selector: '#password', text: 'password', sessionId });
await puppeteer_click({ selector: "button[type='submit']", sessionId });
await puppeteer_wait_for_navigation({ sessionId });

// Extract data
await puppeteer_wait_for_selector({ selector: '.data-table', sessionId });
const data = await puppeteer_evaluate({
  script: `Array.from(document.querySelectorAll('.row')).map(r => r.innerText)`,
  sessionId,
});
```
