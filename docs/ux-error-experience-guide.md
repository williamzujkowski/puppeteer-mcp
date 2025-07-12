# Error Experience Testing Guide

## Overview

This guide provides a comprehensive framework for testing and improving error handling in
puppeteer-mcp from the user's perspective. Good error experiences turn frustrating failures into
learning opportunities and maintain user confidence.

## Error Experience Principles

### 1. Clarity Over Brevity

Users need to understand what went wrong, not just that something failed.

### 2. Actionability Over Information

Every error should guide users toward resolution.

### 3. Context Preservation

Users shouldn't lose work or state due to errors.

### 4. Progressive Disclosure

Show simple explanations first, technical details on demand.

## Error Taxonomy

### Category 1: User Errors (Preventable)

```javascript
const userErrorPatterns = {
  INVALID_SELECTOR: {
    trigger: 'page.click("#nonexistent")',
    current: 'Error: No element found for selector: #nonexistent',
    improved: {
      title: 'Element not found',
      message: 'Could not find an element matching "#nonexistent"',
      suggestions: [
        'Check if the element exists: await page.$("#nonexistent")',
        'Wait for element to appear: await page.waitForSelector("#nonexistent")',
        'Use a different selector strategy (class, text, xpath)',
      ],
      example: 'await page.waitForSelector("#nonexistent", { timeout: 5000 })',
      diagnostic: {
        availableElements: ['#existent-id', '.available-class'],
        screenshot: 'error-context.png',
      },
    },
  },

  INVALID_URL: {
    trigger: 'page.goto("not-a-url")',
    current: 'Protocol error (Invalid URL)',
    improved: {
      title: 'Invalid URL format',
      message: 'The URL "not-a-url" is not valid',
      problem: 'URLs must start with http:// or https://',
      suggestions: [
        'Add protocol: "https://not-a-url"',
        'Check for typos in the domain',
        'Verify the URL is accessible',
      ],
      validFormats: ['https://example.com', 'http://localhost:3000', 'https://sub.domain.com/path'],
    },
  },
};
```

### Category 2: System Errors (Recoverable)

```javascript
const systemErrorPatterns = {
  TIMEOUT: {
    trigger: 'Slow page load exceeds timeout',
    current: 'TimeoutError: Navigation timeout of 30000 ms exceeded',
    improved: {
      title: 'Page load timeout',
      message: 'The page took longer than 30 seconds to load',
      url: 'https://slow-site.example.com',
      duration: '30 seconds',
      reasons: [
        'The website is slow or overloaded',
        'Network connection is poor',
        'Page has heavy resources',
      ],
      solutions: [
        {
          action: 'Increase timeout',
          code: 'await page.goto(url, { timeout: 60000 })',
        },
        {
          action: 'Load without waiting for all resources',
          code: 'await page.goto(url, { waitUntil: "domcontentloaded" })',
        },
        {
          action: 'Skip images and stylesheets',
          code: 'await page.setRequestInterception(true)',
        },
      ],
      autoRetry: {
        available: true,
        command: 'retry with extended timeout',
      },
    },
  },

  BROWSER_CRASH: {
    trigger: 'Chrome process crashes',
    current: 'Error: Protocol error: Connection closed',
    improved: {
      title: 'Browser crashed',
      message: 'The browser process stopped unexpectedly',
      impact: 'Your session data has been preserved',
      reasons: ['Out of memory', 'Website caused crash', 'System resources exhausted'],
      recovery: {
        automatic: true,
        message: 'Creating new browser session...',
        dataRestored: ['cookies', 'localStorage', 'sessionState'],
      },
      prevention: ['Close unused tabs', 'Limit concurrent sessions', 'Monitor memory usage'],
    },
  },
};
```

### Category 3: External Errors (Informative)

```javascript
const externalErrorPatterns = {
  WEBSITE_ERROR: {
    trigger: 'Site returns 500 error',
    current: 'Error: Navigation failed: 500',
    improved: {
      title: 'Website returned an error',
      message: 'The website is experiencing problems',
      statusCode: 500,
      statusText: 'Internal Server Error',
      meaning: "The website's server encountered an error",
      userActions: [
        'Wait a few minutes and try again',
        'Check if the website is down for everyone',
        'Contact website support if persistent',
      ],
      diagnostics: {
        url: 'https://example.com/broken',
        timestamp: '2024-01-15T10:30:00Z',
        responseHeaders: {
          /* ... */
        },
      },
    },
  },

  CAPTCHA_DETECTED: {
    trigger: 'CAPTCHA challenge appears',
    current: 'Error: Automation detected',
    improved: {
      title: 'CAPTCHA detected',
      message: 'The website is requesting human verification',
      type: 'reCAPTCHA v2',
      location: 'Login form',
      explanation: 'This website uses CAPTCHA to prevent automation',
      options: [
        {
          action: 'Manual intervention',
          description: 'Solve CAPTCHA manually in headed mode',
          code: 'await page.solve_captcha_manually()',
        },
        {
          action: 'Use CAPTCHA service',
          description: 'Integrate with 2captcha or similar',
          documentation: '/docs/captcha-handling',
        },
        {
          action: 'Alternative approach',
          description: 'Use official API if available',
        },
      ],
    },
  },
};
```

## Error Message Components

### Anatomy of a Good Error Message

```typescript
interface ImprovedErrorMessage {
  // Quick identification
  code: string; // ELEMENT_NOT_FOUND
  title: string; // Human-readable title

  // What happened
  message: string; // Clear, non-technical explanation
  technical?: string; // Technical details (on demand)

  // Why it happened
  cause?: string; // Root cause explanation
  context?: object; // Relevant state/parameters

  // How to fix it
  solutions?: Solution[]; // Ordered by likelihood
  documentation?: string; // Link to detailed help

  // Automated help
  autoFix?: AutoFix; // Can we fix it automatically?
  diagnostic?: Diagnostic; // Additional debugging info
}

interface Solution {
  description: string;
  code?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface AutoFix {
  available: boolean;
  description: string;
  apply: () => Promise<void>;
}
```

### Error Message Templates

```javascript
const errorTemplates = {
  // Network-related errors
  networkError: (url, error) => ({
    code: 'NETWORK_ERROR',
    title: 'Could not connect to website',
    message: `Failed to load ${new URL(url).hostname}`,
    cause: detectNetworkCause(error),
    solutions: [
      {
        description: 'Check your internet connection',
        confidence: 'high',
      },
      {
        description: 'Verify the URL is correct',
        code: `await page.goto("${url}")`,
        confidence: 'medium',
      },
      {
        description: 'Try with a longer timeout',
        code: `await page.goto("${url}", { timeout: 60000 })`,
        confidence: 'medium',
      },
    ],
  }),

  // Element interaction errors
  elementError: (selector, action) => ({
    code: 'ELEMENT_ERROR',
    title: `Cannot ${action} element`,
    message: `The element "${selector}" was not found or not ${getActionableState(action)}`,
    diagnostic: {
      screenshot: true,
      suggestedSelectors: findSimilarSelectors(selector),
      pageState: capturePageState(),
    },
    solutions: [
      {
        description: 'Wait for element to be ready',
        code: `await page.waitForSelector("${selector}", { visible: true })`,
        confidence: 'high',
      },
      {
        description: 'Check if element is in an iframe',
        code: `const frame = page.frames().find(f => f.url().includes('part-of-url'))`,
        confidence: 'medium',
      },
    ],
  }),
};
```

## Error Recovery Strategies

### Automatic Recovery

```javascript
class ErrorRecoverySystem {
  async handleError(error, context) {
    const recovery = this.getRecoveryStrategy(error);

    if (recovery.automatic) {
      try {
        const result = await recovery.execute(context);
        return {
          recovered: true,
          result,
          message: `Automatically recovered from ${error.code}`,
          action: recovery.description,
        };
      } catch (recoveryError) {
        return this.manualRecovery(error, recoveryError);
      }
    }

    return this.manualRecovery(error);
  }

  getRecoveryStrategy(error) {
    const strategies = {
      TIMEOUT: {
        automatic: true,
        description: 'Retry with extended timeout',
        execute: async (ctx) => {
          return await ctx.retry({ timeout: ctx.timeout * 2 });
        },
      },

      ELEMENT_NOT_FOUND: {
        automatic: true,
        description: 'Wait for element and retry',
        execute: async (ctx) => {
          await ctx.page.waitForSelector(ctx.selector, { timeout: 5000 });
          return await ctx.retry();
        },
      },

      BROWSER_CRASH: {
        automatic: true,
        description: 'Restart browser and restore state',
        execute: async (ctx) => {
          const newBrowser = await this.restartBrowser();
          await this.restoreState(newBrowser, ctx.savedState);
          return await ctx.retry({ browser: newBrowser });
        },
      },
    };

    return strategies[error.code] || { automatic: false };
  }
}
```

### Smart Error Detection

```javascript
class SmartErrorDetector {
  async analyzeFailure(page, error) {
    const analysis = {
      error,
      pageState: await this.capturePageState(page),
      suggestions: [],
    };

    // Detect common patterns
    if (await this.detectCaptcha(page)) {
      analysis.detected = 'CAPTCHA';
      analysis.suggestions.push({
        issue: 'CAPTCHA blocking automation',
        solution: 'Manual intervention required',
      });
    }

    if (await this.detectLoginWall(page)) {
      analysis.detected = 'LOGIN_REQUIRED';
      analysis.suggestions.push({
        issue: 'Login required to access content',
        solution: 'Add authentication step before this action',
      });
    }

    if (await this.detectRateLimit(page)) {
      analysis.detected = 'RATE_LIMITED';
      analysis.suggestions.push({
        issue: 'Too many requests detected',
        solution: 'Add delays between requests',
      });
    }

    return analysis;
  }

  async detectCaptcha(page) {
    const captchaSelectors = [
      '[class*="captcha"]',
      '[id*="captcha"]',
      '.g-recaptcha',
      'iframe[src*="recaptcha"]',
    ];

    for (const selector of captchaSelectors) {
      if (await page.$(selector)) return true;
    }
    return false;
  }
}
```

## Error Testing Scenarios

### Scenario 1: Element Not Found

```javascript
const elementNotFoundTest = {
  name: 'Element interaction failures',

  testCases: [
    {
      description: 'Click non-existent element',
      action: async (page) => {
        await page.click('#does-not-exist');
      },
      expectedError: {
        helpful: true,
        suggests_alternatives: true,
        provides_debugging: true,
      },
      userValidation: [
        'Can user understand why it failed?',
        'Are suggestions actually helpful?',
        'Is there a clear next action?',
      ],
    },

    {
      description: 'Type in hidden input',
      action: async (page) => {
        await page.type('input[type="hidden"]', 'text');
      },
      expectedError: {
        explains_visibility: true,
        suggests_visible_alternatives: true,
      },
    },
  ],
};
```

### Scenario 2: Network Failures

```javascript
const networkFailureTest = {
  name: 'Network and connectivity issues',

  setup: async () => {
    // Simulate network conditions
    await page.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 50 * 1024,
      latency: 2000, // 2s latency
    });
  },

  testCases: [
    {
      description: 'Slow page load',
      action: async (page) => {
        await page.goto('https://heavy-site.example.com', {
          timeout: 5000, // Will timeout
        });
      },
      validateError: (error) => {
        assert(error.showsLoadingTime, 'Should show how long it waited');
        assert(error.suggestsTimeout, 'Should suggest increasing timeout');
        assert(error.offersPartialLoad, 'Should offer partial load option');
      },
    },
  ],
};
```

### Scenario 3: Recovery Flow

```javascript
const recoveryFlowTest = {
  name: 'Error recovery user experience',

  scenario: 'Multi-step form with failures',

  steps: [
    {
      action: 'Fill form page 1',
      injectError: null,
      validate: 'Data saved',
    },
    {
      action: 'Navigate to page 2',
      injectError: 'NETWORK_TIMEOUT',
      expectedRecovery: {
        preservesData: true,
        offersRetry: true,
        showsProgress: true,
      },
    },
    {
      action: 'User chooses retry',
      expectedResult: 'Continues from page 2 with data intact',
    },
  ],

  successCriteria: {
    dataPreservation: 'No form data lost',
    userConfidence: 'User understands system is working',
    timeToRecovery: '< 30 seconds',
  },
};
```

## Error Message Localization

```javascript
const errorLocalization = {
  supportedLanguages: ['en', 'es', 'fr', 'de', 'ja', 'zh'],

  templates: {
    ELEMENT_NOT_FOUND: {
      en: {
        title: 'Element not found',
        message: 'Could not find element: {selector}',
      },
      es: {
        title: 'Elemento no encontrado',
        message: 'No se pudo encontrar el elemento: {selector}',
      },
      ja: {
        title: '要素が見つかりません',
        message: '要素が見つかりませんでした: {selector}',
      },
    },
  },

  formatError(error, locale = 'en') {
    const template = this.templates[error.code]?.[locale] || this.templates[error.code]?.en;
    return this.interpolate(template, error.params);
  },
};
```

## Error Analytics and Improvement

```javascript
class ErrorAnalytics {
  trackError(error, context) {
    this.send({
      errorCode: error.code,
      errorMessage: error.message,
      userAction: context.lastAction,
      recovered: error.recovered,
      recoveryMethod: error.recoveryMethod,
      userFeedback: context.feedback,
      sessionId: context.sessionId,
      timestamp: Date.now(),
    });
  }

  analyzePatterns() {
    return {
      mostCommonErrors: this.getTopErrors(),
      recoverySuccess: this.getRecoveryRates(),
      userImpact: this.calculateUserImpact(),
      improvementPriorities: this.prioritizeImprovements(),
    };
  }

  generateImprovements() {
    const patterns = this.analyzePatterns();

    return patterns.mostCommonErrors.map((error) => ({
      error: error.code,
      frequency: error.count,
      impact: error.userImpact,
      currentRecoveryRate: error.recoveryRate,
      recommendations: [
        this.suggestBetterPrevention(error),
        this.suggestBetterMessaging(error),
        this.suggestAutoRecovery(error),
      ],
    }));
  }
}
```

## Testing Checklist

### Error Message Quality

- [ ] Title clearly identifies the problem
- [ ] Message explains in non-technical terms
- [ ] Cause is explained when known
- [ ] At least one solution is provided
- [ ] Code examples are correct and tested
- [ ] Technical details available on demand
- [ ] No internal implementation details exposed
- [ ] Consistent formatting across all errors

### Error Recovery

- [ ] Automatic recovery attempted when safe
- [ ] User data/state preserved
- [ ] Progress clearly communicated
- [ ] Manual recovery path always available
- [ ] Recovery doesn't cause additional errors
- [ ] Failed recovery has fallback

### User Experience

- [ ] Error appears within 2 seconds
- [ ] User understands issue without documentation
- [ ] Next action is clear
- [ ] No panic or alarm unless critical
- [ ] Maintains user confidence
- [ ] Provides learning opportunity

### Technical Quality

- [ ] Error codes are unique and searchable
- [ ] Stack traces captured but hidden
- [ ] Context information included
- [ ] Errors are properly categorized
- [ ] Logging includes all details
- [ ] Metrics tracked for improvement

## Implementation Examples

### Enhanced Error Class

```javascript
class UserFriendlyError extends Error {
  constructor(code, userMessage, options = {}) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.solutions = options.solutions || [];
    this.context = options.context || {};
    this.autoRecoverable = options.autoRecoverable || false;
    this.documentation = options.documentation;
    this.diagnostic = options.diagnostic;
  }

  toUserJSON() {
    return {
      error: {
        code: this.code,
        message: this.userMessage,
        solutions: this.solutions,
        help: this.documentation,
      },
    };
  }

  toDeveloperJSON() {
    return {
      ...this.toUserJSON(),
      technical: {
        stack: this.stack,
        context: this.context,
        diagnostic: this.diagnostic,
      },
    };
  }
}
```

### Error Handler Middleware

```javascript
class ErrorHandler {
  async handle(error, request, context) {
    // Enhance error with context
    const enhanced = await this.enhanceError(error, context);

    // Attempt automatic recovery
    if (enhanced.autoRecoverable) {
      const recovered = await this.tryRecover(enhanced, context);
      if (recovered.success) {
        return recovered.result;
      }
    }

    // Format for user
    const userError = this.formatForUser(enhanced);

    // Track for analytics
    await this.track(enhanced, context);

    // Return enhanced error
    throw userError;
  }

  async enhanceError(error, context) {
    const enhanced = new UserFriendlyError(
      error.code || 'UNKNOWN_ERROR',
      this.getUserMessage(error),
      {
        solutions: await this.generateSolutions(error, context),
        context: this.captureContext(context),
        diagnostic: await this.runDiagnostics(error, context),
      },
    );

    return enhanced;
  }
}
```

## Continuous Improvement Process

1. **Monitor**: Track all errors and their impact
2. **Analyze**: Identify patterns and problem areas
3. **Prioritize**: Focus on high-impact improvements
4. **Implement**: Enhance messages and recovery
5. **Test**: Validate with real users
6. **Iterate**: Continuous refinement

By following this comprehensive error experience testing guide, puppeteer-mcp can transform
frustrating failures into opportunities for user education and confidence building.
