# Alternative Test Targets for Acceptance Tests

## Analysis of Current Failing Tests

Based on the timeout issues in the acceptance tests, here's an analysis of each failing test and
recommended alternatives:

### 1. Complex Form with Various Input Types (Currently using demoqa.com)

**Issues with demoqa.com:**

- Slow loading times
- Heavy JavaScript frameworks
- Inconsistent availability
- Complex DOM structure with dynamic element rendering

**Recommended Alternatives:**

1. **UI Testing Playground (uitestingplayground.com)**
   - Purpose-built for automation testing
   - Stable selectors
   - Fast loading
   - Specific form testing scenarios at `/textinput`, `/clientdelay`
2. **Automation Exercise (automationexercise.com)**
   - Dedicated signup/contact forms
   - Consistent structure
   - Well-documented test cases
   - Available at `/signup`, `/contact_us`

3. **Practice Automation Testing (practice.automationtesting.in)**
   - E-commerce focused forms
   - Registration and checkout forms
   - Stable and fast
   - Available at `/my-account/`

### 2. Clear Form Fields (Currently using saucedemo.com)

**Current Status:** SauceDemo is actually quite reliable and shouldn't be timing out. The issue
might be with the clearing approach.

**Recommendation:** Keep SauceDemo but add alternatives:

1. **UI Testing Playground - Text Input Page**
   - URL: `http://uitestingplayground.com/textinput`
   - Simple, fast, designed for input testing
   - No rate limiting

2. **The Internet - Login Page**
   - URL: `https://the-internet.herokuapp.com/login`
   - Simple form with clear behavior
   - Well-maintained by Elemental Selenium

### 3. Dynamic Content Loading (Currently using the-internet.herokuapp.com)

**Issues with current approach:**

- Heroku free tier can be slow
- Unpredictable response times

**Recommended Alternatives:**

1. **UI Testing Playground - AJAX Data**
   - URL: `http://uitestingplayground.com/ajax`
   - Controlled AJAX delays
   - Predictable behavior
   - Designed for testing async operations

2. **UI Testing Playground - Client Side Delay**
   - URL: `http://uitestingplayground.com/clientdelay`
   - Simulates client-side rendering delays
   - More realistic than server delays

3. **Automation Exercise - Products Page**
   - URL: `https://automationexercise.com/products`
   - Dynamic product loading
   - Search functionality with async results

### 4. Wait for Elements to Become Visible (Currently using the-internet.herokuapp.com)

**Recommended Alternatives:**

1. **UI Testing Playground - Visibility**
   - URL: `http://uitestingplayground.com/visibility`
   - Elements with different visibility states
   - Designed specifically for visibility testing

2. **UI Testing Playground - Hidden Layers**
   - URL: `http://uitestingplayground.com/hiddenlayers`
   - Tests for overlay and z-index issues
   - Common automation challenge

3. **UI Testing Playground - Progress Bar**
   - URL: `http://uitestingplayground.com/progressbar`
   - Elements appear after progress completes
   - Good for testing wait conditions

## Implementation Recommendations

### Updated Test Configuration

```typescript
export const ALTERNATIVE_TEST_TARGETS = {
  forms: {
    // Primary targets - fast and reliable
    uiPlayground: {
      textInput: 'http://uitestingplayground.com/textinput',
      ajax: 'http://uitestingplayground.com/ajax',
      clientDelay: 'http://uitestingplayground.com/clientdelay',
      visibility: 'http://uitestingplayground.com/visibility',
      hiddenLayers: 'http://uitestingplayground.com/hiddenlayers',
      progressBar: 'http://uitestingplayground.com/progressbar',
      dynamicTable: 'http://uitestingplayground.com/dynamictable',
      click: 'http://uitestingplayground.com/click',
    },
    // Secondary targets - more complex scenarios
    automationExercise: {
      signup: 'https://automationexercise.com/signup',
      login: 'https://automationexercise.com/login',
      contactUs: 'https://automationexercise.com/contact_us',
      products: 'https://automationexercise.com/products',
    },
    // Tertiary targets - e-commerce focused
    practiceAutomation: {
      myAccount: 'https://practice.automationtesting.in/my-account/',
      shop: 'https://practice.automationtesting.in/shop/',
      basket: 'https://practice.automationtesting.in/basket/',
    },
  },
  // Keep existing reliable targets
  existing: {
    sauceDemo: 'https://www.saucedemo.com/',
    httpbin: 'https://httpbin.org/',
  },
};
```

### Benefits of These Alternatives

1. **Purpose-Built**: These sites are specifically designed for automation testing
2. **Stable Selectors**: Use data-test attributes and consistent IDs
3. **No Rate Limiting**: Designed to handle repeated automated access
4. **Fast Loading**: Minimal JavaScript frameworks, optimized for testing
5. **Predictable Behavior**: Controlled delays and consistent responses
6. **Documentation**: Well-documented test scenarios and expected behaviors

### Migration Strategy

1. **Phase 1**: Add UI Testing Playground tests alongside existing tests
2. **Phase 2**: Compare reliability metrics between old and new targets
3. **Phase 3**: Gradually replace unreliable targets with stable alternatives
4. **Phase 4**: Keep SauceDemo for login/e-commerce specific tests

### Example Test Updates

```typescript
// Instead of DemoQA complex form
it('should fill a form with various input types', async () => {
  await mcpNavigate(
    mcpClient.client,
    sessionInfo.contextId,
    'http://uitestingplayground.com/textinput',
  );

  // More reliable selectors
  await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#newButtonName');
  await mcpType(mcpClient.client, sessionInfo.contextId, '#newButtonName', 'Test Button');
  await mcpClick(mcpClient.client, sessionInfo.contextId, '#updatingButton');

  // Verify the button text changed
  const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
  AssertionHelpers.containsText(content, 'Test Button');
});

// Instead of the-internet dynamic loading
it('should handle AJAX loading', async () => {
  await mcpNavigate(mcpClient.client, sessionInfo.contextId, 'http://uitestingplayground.com/ajax');

  await mcpClick(mcpClient.client, sessionInfo.contextId, '#ajaxButton');

  // Wait for data to load - predictable 15 second delay
  await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.bg-success', 20000);

  const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
  AssertionHelpers.containsText(content, 'Data loaded with AJAX get request');
});
```

## Conclusion

By switching to these purpose-built automation testing sites, we can achieve:

- Reduced test flakiness
- Faster test execution
- More predictable results
- Better test maintainability

The UI Testing Playground should be the primary choice for most scenarios, with Automation Exercise
and Practice Automation Testing as alternatives for more complex e-commerce scenarios.
