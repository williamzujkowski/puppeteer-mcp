---
title: Common Patterns
description: 'Common patterns for form automation and browser interactions'
---

# Common Patterns

## Form Automation

```javascript
// Login Form
await page.goto('https://site.com/login');
await page.type('#username', 'user@example.com');
await page.type('#password', 'password');
await page.click('button[type="submit"]');
await page.waitForNavigation();

// Multi-step Form
await page.type('input[name="firstName"]', 'John');
await page.type('input[name="lastName"]', 'Doe');
await page.click('button.next-step');
await page.waitForSelector('.step-2');
await page.select('select[name="country"]', 'US');
await page.click('button.submit');
```

## Wait Strategies

```javascript
// Wait for element
await page.waitForSelector('.content', { timeout: 10000 });

// Wait for text
await page.waitForFunction((text) => document.body.innerText.includes(text), {}, 'Welcome');

// Wait for network idle
await page.goto(url, { waitUntil: 'networkidle0' });

// Custom wait
await page.waitForTimeout(2000);
```

## Data Extraction

```javascript
// Get text
const text = await page.$eval('.title', (el) => el.textContent);

// Get multiple elements
const items = await page.$$eval('.item', (els) =>
  els.map((el) => ({
    title: el.querySelector('.title')?.textContent,
    price: el.querySelector('.price')?.textContent,
  })),
);

// Get attributes
const href = await page.$eval('a.link', (el) => el.href);
```

## Error Handling

```javascript
// Retry pattern
async function retryClick(selector, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.click(selector);
      return;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await page.waitForTimeout(1000);
    }
  }
}

// Element existence check
const exists = (await page.$(selector)) !== null;
```

## Performance

```javascript
// Disable images/CSS
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (['image', 'stylesheet'].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});

// Reuse sessions
const sessionId = await createSession();
// ... multiple operations ...
await closeSession(sessionId);
```
