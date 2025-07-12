---
title: UX Test Scenarios - Implementation Guide
description: Comprehensive test scenario implementations for puppeteer-mcp UX testing strategy with concrete examples, measurement frameworks, and evaluation criteria
---

# UX Test Scenarios - Implementation Guide

This document provides concrete test scenario implementations for the puppeteer-mcp UX testing strategy. Each scenario includes setup instructions, test scripts, expected outcomes, and evaluation criteria.

:::note[Comprehensive UX Testing]
These scenarios cover real-world usage patterns across different user personas, from web scraping developers to QA automation engineers, providing comprehensive validation of user experience quality.
:::

## Test Scenario Implementations

### Scenario Set 1: Web Scraping Workflows

#### Test 1.1: E-commerce Product Scraper

**Persona**: Alex (Web Scraping Developer)  
**Complexity**: Medium  
**Duration**: 15 minutes

```javascript
// Test Setup
const testSites = [
  'https://demo.vercel.store/',
  'https://demo.vendure.io/',
  'https://demo.evershop.io/',
];

// User Task Script
const productScraperTest = {
  id: 'WS-001',
  name: 'Extract Product Catalog',
  steps: [
    {
      instruction: 'Create a session using puppeteer-mcp',
      expectedAction: 'User initiates MCP session',
      successCriteria: 'Session created within 5 seconds',
      metrics: ['time_to_create', 'api_calls_made'],
    },
    {
      instruction: 'Navigate to the demo e-commerce site',
      expectedAction: 'Uses navigate tool/API',
      successCriteria: 'Page loads completely',
      metrics: ['navigation_time', 'error_rate'],
    },
    {
      instruction: 'Extract all product names, prices, and images',
      expectedAction: 'Uses evaluate or content extraction',
      successCriteria: 'Extracts >90% of visible products',
      metrics: ['extraction_accuracy', 'data_completeness'],
    },
    {
      instruction: 'Handle pagination to get all products',
      expectedAction: 'Implements pagination logic',
      successCriteria: 'Retrieves products from all pages',
      metrics: ['pages_processed', 'total_products'],
    },
    {
      instruction: 'Export data in JSON format',
      expectedAction: 'Structures and saves data',
      successCriteria: 'Valid JSON with all fields',
      metrics: ['data_structure_validity', 'export_time'],
    },
  ],
  evaluation: {
    taskCompletion: 'User successfully extracts product data',
    timeLimit: 900, // 15 minutes
    errorTolerance: 2, // Max 2 recoverable errors
    qualityMetrics: {
      dataAccuracy: 0.95, // 95% accurate
      performanceTarget: 300, // 300 seconds max
    },
  },
};

// Measurement Code
function measureScenario(userId, scenarioId) {
  const metrics = {
    startTime: Date.now(),
    errors: [],
    apiCalls: [],
    userActions: [],

    recordAction(action) {
      this.userActions.push({
        timestamp: Date.now(),
        action,
        duration: Date.now() - this.lastAction,
      });
      this.lastAction = Date.now();
    },

    recordError(error) {
      this.errors.push({
        timestamp: Date.now(),
        error: error.message,
        recoverable: error.recoverable || false,
      });
    },

    complete() {
      return {
        totalTime: Date.now() - this.startTime,
        errorCount: this.errors.length,
        recoverableErrors: this.errors.filter((e) => e.recoverable).length,
        apiCallCount: this.apiCalls.length,
        actionCount: this.userActions.length,
      };
    },
  };

  return metrics;
}
```

#### Test 1.2: Dynamic Content Scraper

**Persona**: Alex (Web Scraping Developer)  
**Complexity**: High  
**Duration**: 20 minutes

```javascript
const dynamicScraperTest = {
  id: 'WS-002',
  name: 'Handle SPA with Infinite Scroll',
  testSite: 'https://infinite-scroll-demo.vercel.app/',

  challenges: [
    'Detect infinite scroll mechanism',
    'Implement smart scrolling strategy',
    'Know when to stop scrolling',
    'Handle loading states',
  ],

  testSteps: [
    {
      step: 1,
      action: 'Identify scroll trigger',
      validation: async (page) => {
        // User should discover they need to scroll
        const initialItems = await page.$$('.item');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        const afterScrollItems = await page.$$('.item');
        return afterScrollItems.length > initialItems.length;
      },
    },
    {
      step: 2,
      action: 'Implement scroll loop',
      validation: async (page) => {
        // User should create efficient scroll logic
        let previousHeight = 0;
        let currentHeight = await page.evaluate(() => document.body.scrollHeight);
        let scrollCount = 0;

        while (previousHeight !== currentHeight && scrollCount < 10) {
          previousHeight = currentHeight;
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(1000);
          currentHeight = await page.evaluate(() => document.body.scrollHeight);
          scrollCount++;
        }

        return scrollCount > 0 && scrollCount < 10;
      },
    },
  ],

  successCriteria: {
    completionTime: 1200, // 20 minutes
    scrollEfficiency: 0.8, // 80% of scrolls load new content
    dataCompleteness: 0.95, // 95% of available items extracted
    memoryUsage: '< 500MB',
    errorRecovery: 'Handles network timeouts gracefully',
  },
};
```

### Scenario Set 2: Automated Testing Scenarios

#### Test 2.1: Login Flow Testing

**Persona**: Sarah (QA Automation Engineer)  
**Complexity**: Low  
**Duration**: 10 minutes

```javascript
const loginFlowTest = {
  id: 'AT-001',
  name: 'Multi-Site Login Testing',
  testAccounts: [
    { site: 'https://demo-site-1.com', user: 'test@example.com', pass: 'Test123!' },
    { site: 'https://demo-site-2.com', user: 'qa@example.com', pass: 'Qa456!' },
    { site: 'https://demo-site-3.com', user: 'auto@example.com', pass: 'Auto789!' },
  ],

  parallelExecution: true,

  testImplementation: `
    // User should implement parallel login testing
    async function testParallelLogins(accounts) {
      const results = await Promise.all(
        accounts.map(async (account) => {
          const sessionId = await createSession();
          try {
            await navigateToSite(sessionId, account.site);
            await fillLoginForm(sessionId, account.user, account.pass);
            await submitAndVerify(sessionId);
            return { site: account.site, success: true };
          } catch (error) {
            return { site: account.site, success: false, error: error.message };
          } finally {
            await closeSession(sessionId);
          }
        })
      );
      return results;
    }
  `,

  evaluationPoints: [
    {
      aspect: 'Parallel Execution',
      check: 'All logins run simultaneously',
      metric: 'Total time < sum of individual times',
    },
    {
      aspect: 'Error Handling',
      check: "Failed logins don't affect others",
      metric: 'Isolated failures',
    },
    {
      aspect: 'Resource Management',
      check: 'All sessions properly closed',
      metric: 'No lingering browsers',
    },
    {
      aspect: 'Result Reporting',
      check: 'Clear success/failure for each site',
      metric: 'Structured results object',
    },
  ],
};
```

#### Test 2.2: Visual Regression Testing

**Persona**: Sarah (QA Automation Engineer)  
**Complexity**: Medium  
**Duration**: 15 minutes

```javascript
const visualRegressionTest = {
  id: 'AT-002',
  name: 'Screenshot Comparison Workflow',

  scenario: 'Compare staging vs production visuals',

  testFlow: [
    {
      phase: 'Baseline Capture',
      steps: [
        'Navigate to production site',
        'Wait for full page load',
        'Take full-page screenshot',
        'Store as baseline',
      ],
      expectedImplementation: `
        const baseline = await captureBaseline({
          url: 'https://prod.example.com',
          fullPage: true,
          waitUntil: 'networkidle0'
        });
      `,
    },
    {
      phase: 'Test Capture',
      steps: [
        'Navigate to staging site',
        'Ensure same viewport size',
        'Take screenshot with same settings',
        'Compare with baseline',
      ],
      expectedImplementation: `
        const test = await captureTest({
          url: 'https://staging.example.com',
          fullPage: true,
          waitUntil: 'networkidle0'
        });
        
        const diff = await compareImages(baseline, test);
      `,
    },
    {
      phase: 'Difference Analysis',
      steps: [
        'Identify visual differences',
        'Categorize by severity',
        'Generate diff report',
        'Flag critical changes',
      ],
    },
  ],

  qualityChecks: {
    screenshotConsistency: 'Same dimensions and settings',
    waitStrategy: 'Proper wait conditions used',
    errorHandling: 'Handles timing issues',
    reporting: 'Clear visual diff output',
  },
};
```

### Scenario Set 3: Data Extraction Pipelines

#### Test 3.1: Table Data Extraction

**Persona**: Mike (Business Analyst)  
**Complexity**: Low  
**Duration**: 10 minutes

```javascript
const tableExtractionTest = {
  id: 'DE-001',
  name: 'Extract Competitor Pricing Table',

  userPrompt: 'Get all prices from the competitor comparison table',

  naturalLanguageVariations: [
    'Extract the pricing table from competitor site',
    'Pull all prices from the comparison page',
    'Get competitor pricing data into Excel',
  ],

  expectedMCPInteraction: {
    tool: 'puppeteer_evaluate',
    generatedCode: `
      const data = await page.evaluate(() => {
        const table = document.querySelector('table.pricing-comparison');
        const headers = Array.from(table.querySelectorAll('th'))
          .map(th => th.textContent.trim());
        
        const rows = Array.from(table.querySelectorAll('tbody tr'))
          .map(tr => {
            const cells = Array.from(tr.querySelectorAll('td'));
            return headers.reduce((obj, header, index) => {
              obj[header] = cells[index]?.textContent.trim();
              return obj;
            }, {});
          });
        
        return { headers, rows };
      });
    `,
  },

  successMetrics: {
    comprehension: 'Understands table extraction request',
    accuracy: 'Extracts all visible data',
    format: 'Returns structured data',
    speed: 'Completes in < 30 seconds',
  },
};
```

#### Test 3.2: Multi-Step Data Pipeline

**Persona**: David (AI Developer)  
**Complexity**: High  
**Duration**: 25 minutes

```javascript
const dataPipelineTest = {
  id: 'DE-002',
  name: 'Autonomous Research Assistant',

  userRequest: 'Research top 5 laptops under $1000 from major retailers',

  expectedWorkflow: [
    {
      phase: 'Planning',
      aiActions: ['Identify major retailer sites', 'Plan search strategy', 'Define data structure'],
    },
    {
      phase: 'Execution',
      aiActions: [
        'Search each retailer',
        'Filter by price',
        'Extract product details',
        'Handle site variations',
      ],
    },
    {
      phase: 'Analysis',
      aiActions: ['Normalize data formats', 'Rank by value metrics', 'Generate summary report'],
    },
  ],

  evaluationCriteria: {
    autonomy: 'Completes without human intervention',
    adaptability: 'Handles different site structures',
    accuracy: 'Correct price and spec extraction',
    presentation: 'Clear, actionable summary',
  },

  complexityChallenges: [
    'Different price formats ($999 vs $999.00)',
    'Specs in various locations',
    'Dynamic pricing updates',
    'Anti-bot measures',
  ],
};
```

### Scenario Set 4: Error Recovery Testing

#### Test 4.1: Network Failure Recovery

**Persona**: Emma (DevOps Engineer)  
**Complexity**: Medium  
**Duration**: 15 minutes

```javascript
const networkFailureTest = {
  id: 'ER-001',
  name: 'Graceful Network Error Handling',

  simulatedFailures: [
    {
      type: 'Timeout',
      trigger: 'Delay response by 35 seconds',
      expectedBehavior: 'Retry with backoff',
      userMessage: 'Clear timeout indication with retry option',
    },
    {
      type: 'Connection Refused',
      trigger: 'Block network request',
      expectedBehavior: 'Fail fast with clear error',
      userMessage: 'Network unreachable - check connection',
    },
    {
      type: 'Intermittent',
      trigger: 'Fail 50% of requests randomly',
      expectedBehavior: 'Automatic retry succeeds',
      userMessage: 'Temporary issue resolved automatically',
    },
  ],

  testImplementation: `
    // Inject network conditions
    await page.setOfflineMode(true);
    
    try {
      await page.goto('https://example.com');
    } catch (error) {
      // User should see helpful error message
      console.log('Expected error format:', {
        code: 'NETWORK_ERROR',
        message: 'Unable to reach example.com',
        suggestion: 'Check your internet connection',
        technicalDetails: error.message
      });
    }
    
    // Test retry logic
    await page.setOfflineMode(false);
    const retryResult = await retryWithBackoff(() => 
      page.goto('https://example.com')
    );
  `,

  successCriteria: {
    errorClarity: 'Non-technical users understand the issue',
    recoveryPath: 'Clear steps to resolve',
    autoRecovery: 'Retries when appropriate',
    noDataLoss: 'Previous work preserved',
  },
};
```

#### Test 4.2: Element Not Found Recovery

**Persona**: Alex (Web Scraping Developer)  
**Complexity**: Medium  
**Duration**: 12 minutes

```javascript
const elementNotFoundTest = {
  id: 'ER-002',
  name: 'Smart Selector Fallback',

  scenario: 'Website changes their HTML structure',

  testCases: [
    {
      original: '#submit-button',
      changed: '.btn-submit',
      expectedBehavior: 'Suggest alternative selectors',
    },
    {
      original: '.price-tag',
      changed: '[data-price]',
      expectedBehavior: 'Detect similar elements',
    },
  ],

  intelligentErrorResponse: {
    error: 'Element not found: #submit-button',
    suggestions: [
      'Found similar elements:',
      '  - button.btn-submit (85% match)',
      '  - button[type="submit"] (80% match)',
      '  - .form-submit-btn (75% match)',
      '',
      'Try using: await page.click("button.btn-submit")',
    ],
    code: 'ELEMENT_NOT_FOUND',
    recovery: 'automatic_retry_with_suggestions',
  },

  implementation: `
    async function smartElementFinder(page, selector) {
      try {
        return await page.$(selector);
      } catch (error) {
        // Intelligent fallback
        const suggestions = await page.evaluate((sel) => {
          // Find similar elements by:
          // 1. Text content
          // 2. Class names
          // 3. Attributes
          // 4. Position
          return findSimilarElements(sel);
        }, selector);
        
        throw new SmartError({
          original: error,
          suggestions,
          autoFix: suggestions[0]
        });
      }
    }
  `,
};
```

### Scenario Set 5: MCP Client Integration

#### Test 5.1: Claude Desktop Natural Language

**Persona**: Mike (Business Analyst)  
**Complexity**: Low  
**Duration**: 8 minutes

```javascript
const claudeDesktopTest = {
  id: 'MCP-001',
  name: 'Natural Language Browser Control',

  testConversations: [
    {
      user: 'Go to Amazon and search for wireless headphones under $50',
      expectedActions: [
        'puppeteer_navigate to amazon.com',
        'puppeteer_type "wireless headphones" in search',
        'puppeteer_click search button',
        'puppeteer_evaluate to filter by price',
      ],
      successCriteria: 'Correct product list displayed',
    },
    {
      user: 'Take a screenshot of the first 3 results',
      expectedActions: [
        'puppeteer_evaluate to identify result boundaries',
        'puppeteer_screenshot with specific clip region',
      ],
      successCriteria: 'Screenshot contains exactly 3 products',
    },
    {
      user: 'Open the top-rated one in a new tab and get the details',
      expectedActions: [
        'puppeteer_evaluate to find highest rating',
        'puppeteer_click with middle mouse button',
        'Switch to new tab',
        'puppeteer_evaluate to extract product details',
      ],
      successCriteria: 'Product details extracted correctly',
    },
  ],

  evaluationMetrics: {
    understanding: 'Correctly interprets user intent',
    efficiency: 'Minimal tool calls to achieve goal',
    errorHandling: 'Gracefully handles ambiguity',
    userExperience: 'Natural conversation flow',
  },
};
```

#### Test 5.2: VS Code Cline Integration

**Persona**: Sarah (QA Automation Engineer)  
**Complexity**: Medium  
**Duration**: 15 minutes

```javascript
const clineIntegrationTest = {
  id: 'MCP-002',
  name: 'IDE-Integrated Browser Automation',

  developerWorkflow: [
    {
      action: 'Write test in VS Code',
      code: `
        describe('E-commerce checkout', () => {
          it('should complete purchase flow', async () => {
            // Cline autocompletes with puppeteer-mcp
            await browser.navigate('https://shop.example.com');
            await browser.addToCart('SKU-12345');
            await browser.checkout({
              email: 'test@example.com',
              payment: 'test-card'
            });
          });
        });
      `,
      clineSupport: [
        'Autocomplete for MCP methods',
        'Inline documentation',
        'Parameter hints',
        'Error prevention',
      ],
    },
    {
      action: 'Run test with live preview',
      features: [
        'See browser in VS Code sidebar',
        'Step through with debugger',
        'Inspect page state',
        'Modify selectors live',
      ],
    },
  ],

  integrationQuality: {
    seamlessness: 'No context switching needed',
    productivity: 'Faster than traditional Puppeteer',
    debugging: 'Superior debugging experience',
    learning: 'Discovers features naturally',
  },
};
```

## Test Execution Framework

### Automated Test Runner

```javascript
class UXTestRunner {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.metrics = new MetricsCollector();
  }

  async runScenario(scenario, user) {
    const session = {
      scenarioId: scenario.id,
      userId: user.id,
      startTime: Date.now(),
      actions: [],
      errors: [],
      feedback: {},
    };

    // Pre-test survey
    session.preTest = await this.collectPreTestData(user);

    // Screen recording
    const recording = await this.startRecording();

    // Execute test steps
    for (const step of scenario.steps) {
      const stepResult = await this.executeStep(step, user);
      session.actions.push(stepResult);

      if (stepResult.error) {
        session.errors.push(stepResult.error);
        if (!stepResult.recovered) break;
      }
    }

    // Post-test survey
    session.postTest = await this.collectPostTestData(user);

    // Stop recording
    session.recording = await recording.stop();

    // Calculate metrics
    session.metrics = this.calculateMetrics(session);

    this.results.push(session);
    return session;
  }

  async executeStep(step, user) {
    const result = {
      step: step.instruction,
      startTime: Date.now(),
    };

    try {
      // Present instruction to user
      await this.ui.showInstruction(step.instruction);

      // Wait for user action
      const action = await this.waitForUserAction();
      result.action = action;

      // Validate action
      const validation = await this.validateAction(action, step);
      result.validation = validation;

      // Collect metrics
      result.metrics = await this.collectStepMetrics(step);

      result.duration = Date.now() - result.startTime;
      result.success = validation.passed;
    } catch (error) {
      result.error = error;
      result.recovered = await this.attemptRecovery(error, user);
    }

    return result;
  }

  calculateMetrics(session) {
    return {
      completionRate: this.getCompletionRate(session),
      errorRate: session.errors.length / session.actions.length,
      avgStepTime: this.getAverageStepTime(session),
      userSatisfaction: session.postTest.satisfaction,
      taskSuccess: this.isTaskSuccessful(session),
      efficiency: this.calculateEfficiency(session),
    };
  }
}
```

### Metrics Collection System

```javascript
class MetricsCollector {
  constructor() {
    this.events = [];
    this.performance = new PerformanceObserver((list) => {
      this.events.push(...list.getEntries());
    });
  }

  trackAPICall(endpoint, method, duration, success) {
    this.events.push({
      type: 'api_call',
      timestamp: Date.now(),
      endpoint,
      method,
      duration,
      success,
    });
  }

  trackUserAction(action, target, result) {
    this.events.push({
      type: 'user_action',
      timestamp: Date.now(),
      action,
      target,
      result,
      context: this.captureContext(),
    });
  }

  trackError(error, recovered, recovery_method) {
    this.events.push({
      type: 'error',
      timestamp: Date.now(),
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack,
      },
      recovered,
      recovery_method,
      user_impact: this.assessUserImpact(error),
    });
  }

  generateReport() {
    return {
      summary: this.generateSummary(),
      timeline: this.events,
      patterns: this.identifyPatterns(),
      recommendations: this.generateRecommendations(),
    };
  }
}
```

## Success Evaluation Framework

### Quantitative Scoring

```javascript
const scoringRubric = {
  taskCompletion: {
    weight: 0.3,
    levels: {
      full: { score: 100, criteria: 'All steps completed successfully' },
      partial: { score: 70, criteria: 'Core objective achieved with workarounds' },
      assisted: { score: 40, criteria: 'Completed with significant help' },
      failed: { score: 0, criteria: 'Unable to complete core objective' },
    },
  },

  efficiency: {
    weight: 0.2,
    calculation: (actual, optimal) => {
      const ratio = optimal / actual;
      return Math.min(100, ratio * 100);
    },
  },

  errorRecovery: {
    weight: 0.2,
    calculation: (errors, recovered) => {
      if (errors === 0) return 100;
      return (recovered / errors) * 100;
    },
  },

  userSatisfaction: {
    weight: 0.3,
    source: 'post-test survey',
    scale: 'Convert 1-5 to 0-100',
  },
};

function calculateOverallScore(session) {
  let totalScore = 0;

  for (const [metric, config] of Object.entries(scoringRubric)) {
    const score = calculateMetricScore(session, metric, config);
    totalScore += score * config.weight;
  }

  return {
    overall: totalScore,
    breakdown: generateBreakdown(session),
    recommendations: generateImprovements(totalScore),
  };
}
```

### Qualitative Analysis

:::tip[Qualitative Analysis Framework]

#### Think-Aloud Analysis

**Capture Points**:
- Initial reaction to interface
- Confusion moments  
- Delight moments
- Frustration points
- Learning breakthroughs

**Coding Scheme**:
- **Confusion**: ['unclear', 'lost', 'not sure', 'what does']
- **Frustration**: ['annoying', 'why', 'stupid', 'broken']
- **Satisfaction**: ['nice', 'easy', 'cool', 'works great']
- **Learning**: ['oh I see', 'now I get it', 'that makes sense']

#### Sentiment Analysis

- **Tool**: Natural language processing
- **Categories**: ['positive', 'negative', 'neutral']
- **Aspects**: ['ease_of_use', 'functionality', 'documentation', 'performance']

#### Behavior Patterns

- **Exploration**: How users discover features
- **Problem Solving**: Approaches to obstacles
- **Documentation**: When and how docs are used
- **Collaboration**: Seeking help patterns
:::

## Continuous Improvement Process

```yaml
UX Test Cycle:
  1. Planning:
    - Review previous cycle results
    - Update test scenarios
    - Recruit participants

  2. Execution:
    - Run test sessions
    - Collect all data
    - Initial analysis

  3. Analysis:
    - Quantitative metrics
    - Qualitative insights
    - Pattern identification

  4. Recommendations:
    - Priority fixes
    - Feature improvements
    - Documentation updates

  5. Implementation:
    - Quick wins first
    - Major changes planned
    - A/B testing

  6. Validation:
    - Verify improvements
    - Measure impact
    - Plan next cycle

Cycle Duration: 2 weeks
Participants per Cycle: 10-15
Success Metric: 10% improvement per cycle
```

## Test Scenario Summary

| Scenario Set | Scenarios | Complexity Range | Total Duration |
|--------------|-----------|------------------|----------------|
| Web Scraping | 2 scenarios | Medium - High | 35 minutes |
| Automated Testing | 2 scenarios | Low - Medium | 25 minutes |
| Data Extraction | 2 scenarios | Low - High | 35 minutes |
| Error Recovery | 2 scenarios | Medium | 27 minutes |
| MCP Integration | 2 scenarios | Low - Medium | 23 minutes |

## Related Documentation

- [UX Testing Strategy](/testing/ux-testing) for overall testing approach
- [UX Testing Checklist](/testing/ux-checklist) for validation criteria
- [UX Error Experience Guide](/testing/ux-error-experience) for error handling
- [Acceptance Testing](/testing/acceptance-testing) for end-to-end validation

## Conclusion

This comprehensive test scenario implementation guide provides concrete examples and frameworks for executing the UX testing strategy effectively. By covering diverse user personas, complexity levels, and measurement frameworks, these scenarios ensure thorough validation of user experience quality across all puppeteer-mcp use cases.