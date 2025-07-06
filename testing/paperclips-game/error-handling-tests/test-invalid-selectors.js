/**
 * Test Suite: Invalid Selectors and Element Not Found
 * Tests error handling for invalid CSS/XPath selectors and non-existent elements
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:8443/api';
const TOKEN = process.env.API_TOKEN || 'test-token';

// Selector test scenarios
const SELECTOR_TESTS = {
  invalidCSS: [
    {
      name: 'unclosed_bracket',
      selector: 'div[class="test"',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'invalid_pseudo_selector',
      selector: 'div::invalid-pseudo',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'malformed_attribute',
      selector: 'div[class==test]',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'invalid_combinator',
      selector: 'div >> p',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'unclosed_string',
      selector: 'div[title="unclosed',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'invalid_nth_child',
      selector: 'div:nth-child(n+)',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'empty_selector',
      selector: '',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'only_combinators',
      selector: '> >',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'invalid_characters',
      selector: 'div@#$%^&*()',
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'multiple_ids',
      selector: '#id1#id2',
      expectedError: 'INVALID_SELECTOR'
    }
  ],
  invalidXPath: [
    {
      name: 'unclosed_bracket_xpath',
      selector: '//div[@class="test"',
      xpath: true,
      expectedError: 'INVALID_XPATH'
    },
    {
      name: 'invalid_axis',
      selector: '//div/invalid-axis::p',
      xpath: true,
      expectedError: 'INVALID_XPATH'
    },
    {
      name: 'malformed_predicate',
      selector: '//div[[@class="test"]]',
      xpath: true,
      expectedError: 'INVALID_XPATH'
    },
    {
      name: 'invalid_function',
      selector: '//div[invalid-function()]',
      xpath: true,
      expectedError: 'INVALID_XPATH'
    }
  ],
  nonExistentElements: [
    {
      name: 'non_existent_id',
      selector: '#element-that-definitely-does-not-exist-12345',
      action: 'click',
      expectedError: 'ELEMENT_NOT_FOUND'
    },
    {
      name: 'non_existent_class',
      selector: '.class-that-definitely-does-not-exist-67890',
      action: 'click',
      expectedError: 'ELEMENT_NOT_FOUND'
    },
    {
      name: 'non_existent_tag',
      selector: 'nonexistenttag',
      action: 'click',
      expectedError: 'ELEMENT_NOT_FOUND'
    },
    {
      name: 'complex_non_existent',
      selector: 'div.container > ul.list > li.item:nth-child(99) > a.link[href="#nowhere"]',
      action: 'click',
      expectedError: 'ELEMENT_NOT_FOUND'
    },
    {
      name: 'xpath_non_existent',
      selector: '//div[@id="nonexistent"]/span[@class="also-nonexistent"]',
      xpath: true,
      action: 'click',
      expectedError: 'ELEMENT_NOT_FOUND'
    }
  ],
  ambiguousSelectors: [
    {
      name: 'multiple_elements_for_single_action',
      selector: 'div', // Will match multiple elements
      action: 'click',
      expectMultiple: true,
      expectedError: 'MULTIPLE_ELEMENTS'
    },
    {
      name: 'too_generic_selector',
      selector: '*', // Matches everything
      action: 'type',
      params: { text: 'test' },
      expectedError: 'TOO_MANY_ELEMENTS'
    }
  ],
  edgeCases: [
    {
      name: 'null_selector',
      selector: null,
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'undefined_selector',
      selector: undefined,
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'number_as_selector',
      selector: 12345,
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'object_as_selector',
      selector: { id: 'test' },
      expectedError: 'INVALID_SELECTOR'
    },
    {
      name: 'very_long_selector',
      selector: 'div' + '.class'.repeat(1000),
      expectedError: 'SELECTOR_TOO_LONG'
    }
  ]
};

// Helper functions
async function setupSession() {
  try {
    const response = await axios.post(
      `${API_BASE}/v1/sessions/dev-create`,
      {},
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    // Store the token for later use
    if (response.data.data?.tokens?.accessToken) {
      process.env.API_TOKEN = response.data.data.tokens.accessToken;
    }
    return response.data.data.sessionId;
  } catch (error) {
    console.error('Failed to create session:', error.response?.data || error.message);
    throw error;
  }
}

async function testInvalidSelector(sessionId, test, category) {
  const startTime = Date.now();
  let result = {
    test: test.name,
    category,
    selector: test.selector,
    timestamp: new Date().toISOString(),
    success: false,
    expectedError: test.expectedError,
    actualError: null,
    errorMessage: null,
    responseTime: 0,
    errorHandled: false
  };

  try {
    // Navigate to a test page first
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/paperclips/index2.html' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    // Try to use the invalid selector
    const action = test.action || 'wait';
    const params = {
      selector: test.selector,
      xpath: test.xpath,
      timeout: 3000,
      ...test.params
    };

    const response = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action,
        params
      },
      { 
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 5000,
        validateStatus: () => true
      }
    );

    result.responseTime = Date.now() - startTime;

    if (response.status >= 200 && response.status < 300) {
      // Should not succeed for invalid selectors
      result.success = false;
      result.actualError = 'UNEXPECTED_SUCCESS';
      result.errorMessage = 'Operation succeeded with invalid selector';
      result.responseData = response.data;
    } else {
      // Error response (expected)
      result.errorHandled = true;
      result.actualError = response.data.error || response.data.code || 'UNKNOWN_ERROR';
      result.errorMessage = response.data.message || response.statusText;
      result.details = response.data.details;
      
      // Check if error matches expected
      result.success = result.actualError.includes(test.expectedError) ||
                      result.errorMessage?.toLowerCase().includes('selector') ||
                      result.errorMessage?.toLowerCase().includes('element') ||
                      result.errorMessage?.toLowerCase().includes('found');
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.actualError = error.code || 'ERROR';
    result.errorMessage = error.message;
    result.errorHandled = true;
    
    // Check if this is the expected error
    result.success = error.message?.includes('selector') ||
                    error.message?.includes('element');
  }

  return result;
}

async function testElementInteraction(sessionId) {
  // Test various element interaction failures
  const result = {
    test: 'element_interaction_errors',
    timestamp: new Date().toISOString(),
    success: false,
    interactions: []
  };

  const interactions = [
    {
      name: 'click_hidden_element',
      selector: 'input[type="hidden"]',
      action: 'click',
      expectedError: 'ELEMENT_NOT_VISIBLE'
    },
    {
      name: 'type_in_disabled_input',
      selector: 'input:disabled',
      action: 'type',
      params: { text: 'test' },
      expectedError: 'ELEMENT_DISABLED'
    },
    {
      name: 'click_outside_viewport',
      selector: 'body',
      action: 'click',
      params: { x: 9999, y: 9999 },
      expectedError: 'COORDINATES_OUT_OF_BOUNDS'
    }
  ];

  try {
    // Navigate to a page with various elements
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    // Add some test elements
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'evaluate',
        params: { 
          script: `
            // Add hidden input
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.id = 'hidden-input';
            document.body.appendChild(hidden);
            
            // Add disabled input
            const disabled = document.createElement('input');
            disabled.disabled = true;
            disabled.id = 'disabled-input';
            document.body.appendChild(disabled);
            
            'elements added';
          `
        }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    for (const interaction of interactions) {
      const interactionResult = {
        name: interaction.name,
        success: false,
        error: null
      };

      const response = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: interaction.action,
          params: {
            selector: interaction.selector,
            ...interaction.params
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          validateStatus: () => true
        }
      );

      if (response.status >= 400) {
        interactionResult.error = response.data.error || response.data.message;
        interactionResult.success = interactionResult.error?.includes(interaction.expectedError) ||
                                   response.status >= 400;
      }

      result.interactions.push(interactionResult);
    }

    result.success = result.interactions.every(i => i.success);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testSelectorTimeout(sessionId) {
  // Test timeout behavior for non-existent elements
  const result = {
    test: 'selector_timeout_behavior',
    timestamp: new Date().toISOString(),
    success: false,
    timeouts: []
  };

  const timeoutTests = [
    { timeout: 100, selector: '#nonexistent' },
    { timeout: 500, selector: '.does-not-exist' },
    { timeout: 1000, selector: 'nonexistenttag' }
  ];

  try {
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    for (const test of timeoutTests) {
      const startTime = Date.now();
      const timeoutResult = {
        timeout: test.timeout,
        actualTime: 0,
        withinTolerance: false
      };

      const response = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'wait',
          params: {
            selector: test.selector,
            timeout: test.timeout
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: test.timeout + 2000,
          validateStatus: () => true
        }
      );

      timeoutResult.actualTime = Date.now() - startTime;
      timeoutResult.withinTolerance = Math.abs(timeoutResult.actualTime - test.timeout) < 500;
      timeoutResult.error = response.data.error;
      
      result.timeouts.push(timeoutResult);
    }

    result.success = result.timeouts.every(t => t.withinTolerance);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function testSelectorValidation(sessionId) {
  // Test that selector validation happens before execution
  const result = {
    test: 'selector_validation',
    timestamp: new Date().toISOString(),
    success: false,
    validations: []
  };

  const validationTests = [
    {
      name: 'empty_string_rejected',
      selector: '',
      shouldReject: true
    },
    {
      name: 'whitespace_only_rejected',
      selector: '   ',
      shouldReject: true
    },
    {
      name: 'valid_selector_accepted',
      selector: 'body',
      shouldReject: false
    },
    {
      name: 'special_chars_handled',
      selector: 'div[data-test="value"]',
      shouldReject: false
    }
  ];

  try {
    await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://williamzujkowski.github.io/' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    for (const test of validationTests) {
      const validationResult = {
        name: test.name,
        rejected: false,
        correct: false
      };

      const response = await axios.post(
        `${API_BASE}/contexts/${sessionId}/action`,
        {
          sessionId,
          action: 'wait',
          params: {
            selector: test.selector,
            timeout: 100
          }
        },
        { 
          headers: { Authorization: `Bearer ${TOKEN}` },
          validateStatus: () => true
        }
      );

      validationResult.rejected = response.status >= 400;
      validationResult.correct = validationResult.rejected === test.shouldReject;
      validationResult.error = response.data.error;
      
      result.validations.push(validationResult);
    }

    result.success = result.validations.every(v => v.correct);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function runTests() {
  console.log('Starting Invalid Selector and Element Not Found Tests...\n');
  
  const results = {
    testSuite: 'invalid-selectors',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {}
    },
    tests: [],
    interactions: null,
    timeouts: null,
    validation: null
  };

  let sessionId;

  try {
    // Setup session
    console.log('Setting up test session...');
    sessionId = await setupSession();
    console.log(`Session created: ${sessionId}\n`);

    // Test each category
    for (const [category, tests] of Object.entries(SELECTOR_TESTS)) {
      console.log(`\nTesting ${category}:`);
      console.log('='.repeat(50));
      
      results.summary.categories[category] = {
        total: tests.length,
        passed: 0,
        failed: 0
      };

      for (const test of tests) {
        const displaySelector = typeof test.selector === 'string' 
          ? test.selector.substring(0, 50) 
          : String(test.selector).substring(0, 50);
        
        process.stdout.write(`Testing ${test.name} ("${displaySelector}")...`);
        const result = await testInvalidSelector(sessionId, test, category);
        
        results.tests.push(result);
        results.summary.total++;
        
        if (result.success) {
          results.summary.passed++;
          results.summary.categories[category].passed++;
          console.log(' ✓ ERROR HANDLED');
          console.log(`  └─ ${result.actualError}: ${result.errorMessage?.substring(0, 80)}`);
        } else {
          results.summary.failed++;
          results.summary.categories[category].failed++;
          console.log(' ✗ UNEXPECTED BEHAVIOR');
          console.log(`  └─ Expected: ${test.expectedError}`);
          console.log(`  └─ Actual: ${result.actualError}`);
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Test element interactions
    console.log('\n\nTesting Element Interaction Errors:');
    console.log('='.repeat(50));
    results.interactions = await testElementInteraction(sessionId);
    
    if (results.interactions.success) {
      console.log('✓ All interaction errors properly handled');
    } else {
      console.log('✗ Some interaction errors not handled properly');
    }
    results.interactions.interactions?.forEach(interaction => {
      console.log(`  - ${interaction.name}: ${interaction.success ? '✓' : '✗'} ${interaction.error || ''}`);
    });

    // Test timeout behavior
    console.log('\n\nTesting Selector Timeout Behavior:');
    console.log('='.repeat(50));
    results.timeouts = await testSelectorTimeout(sessionId);
    
    if (results.timeouts.success) {
      console.log('✓ Timeout behavior is consistent');
    } else {
      console.log('✗ Timeout behavior is inconsistent');
    }
    results.timeouts.timeouts?.forEach(timeout => {
      console.log(`  - ${timeout.timeout}ms timeout: actual ${timeout.actualTime}ms (${timeout.withinTolerance ? '✓' : '✗'})`);
    });

    // Test selector validation
    console.log('\n\nTesting Selector Validation:');
    console.log('='.repeat(50));
    results.validation = await testSelectorValidation(sessionId);
    
    if (results.validation.success) {
      console.log('✓ Selector validation working correctly');
    } else {
      console.log('✗ Selector validation issues detected');
    }
    results.validation.validations?.forEach(val => {
      console.log(`  - ${val.name}: ${val.correct ? '✓' : '✗'}`);
    });

  } catch (error) {
    console.error('\nTest suite error:', error.message);
    results.error = error.message;
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        await axios.delete(
          `${API_BASE}/v1/sessions/dev-create/${sessionId}`,
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        console.log('\nTest session cleaned up');
      } catch (error) {
        console.error('Failed to cleanup session:', error.message);
      }
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, 'results', `invalid-selectors-${Date.now()}.json`);
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n\nTest Summary:');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} (${(results.summary.passed/results.summary.total*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.summary.failed}`);
  
  console.log('\nBy Category:');
  for (const [category, stats] of Object.entries(results.summary.categories)) {
    const percentage = (stats.passed/stats.total*100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} passed (${percentage}%)`);
  }

  // Selector error handling analysis
  console.log('\n\nSelector Error Handling Analysis:');
  console.log('='.repeat(50));
  
  const handledErrors = results.tests.filter(t => t.errorHandled);
  console.log(`✓ ${handledErrors.length}/${results.tests.length} selector errors properly handled`);
  
  const unhandledErrors = results.tests.filter(t => !t.errorHandled && !t.success);
  if (unhandledErrors.length > 0) {
    console.log(`\n⚠️  ${unhandledErrors.length} unhandled selector errors:`);
    unhandledErrors.forEach(e => {
      console.log(`  - ${e.test}: ${e.actualError}`);
    });
  }

  // Identify patterns
  console.log('\nError Patterns:');
  const errorPatterns = {};
  results.tests.forEach(test => {
    if (test.actualError) {
      errorPatterns[test.actualError] = (errorPatterns[test.actualError] || 0) + 1;
    }
  });
  
  Object.entries(errorPatterns)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} occurrences`);
    });

  return results;
}

// Run tests
runTests().catch(console.error);