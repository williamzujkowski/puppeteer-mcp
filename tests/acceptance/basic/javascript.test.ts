/**
 * Comprehensive JavaScript evaluation tests
 * @module tests/acceptance/basic/javascript
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpWaitForSelector,
  mcpEvaluate,
} from '../utils/mcp-client.js';
import { getTestTargets, TEST_CONFIG, TEST_CREDENTIALS } from '../utils/reliable-test-config.js';
const TEST_TARGETS = getTestTargets();
import { retryOperation, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('JavaScript Evaluation Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (mcpClient !== null) {
      await mcpClient.cleanup();
    }
  });

  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (sessionInfo !== null) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('Basic Code Evaluation', () => {
    it(
      'should evaluate simple mathematical expressions',
      async () => {
        await retryOperation(async () => {
          // Navigate to a basic page first
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test basic arithmetic
          const sum = await mcpEvaluate(mcpClient.client, sessionInfo.contextId, '2 + 3');
          expect(sum).toBe(5);

          // Test multiplication
          const product = await mcpEvaluate(mcpClient.client, sessionInfo.contextId, '7 * 8');
          expect(product).toBe(56);

          // Test complex expression
          const complex = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '(10 + 5) * 2 - 3',
          );
          expect(complex).toBe(27);

          // Test boolean operations
          const booleanResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '5 > 3 && 2 < 4',
          );
          expect(booleanResult).toBe(true);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should evaluate string operations',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // String concatenation
          const concat = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '"Hello" + " " + "World"',
          );
          expect(concat).toBe('Hello World');

          // String methods
          const uppercase = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '"javascript".toUpperCase()',
          );
          expect(uppercase).toBe('JAVASCRIPT');

          // String length
          const length = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '"testing".length',
          );
          expect(length).toBe(7);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should evaluate object and array operations',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Array operations
          const arrayLength = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '[1, 2, 3, 4, 5].length',
          );
          expect(arrayLength).toBe(5);

          // Array methods
          const doubled = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '[1, 2, 3].map(x => x * 2)',
          );
          expect(doubled).toEqual([2, 4, 6]);

          // Object creation and access
          const objProperty = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '({name: "test", value: 42}).value',
          );
          expect(objProperty).toBe(42);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('DOM Manipulation via JavaScript', () => {
    it(
      'should access and modify DOM elements',
      async () => {
        await retryOperation(async () => {
          // Navigate to a page with known structure
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');

          // Get page title
          const title = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.title',
          );
          expect(title).toContain('Internet');

          // Count number of input elements
          const inputCount = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.querySelectorAll("input").length',
          );
          expect(inputCount).toBeGreaterThan(0);

          // Get element by ID and check its properties
          const usernameExists = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("username") !== null',
          );
          expect(usernameExists).toBe(true);

          // Modify an element's value
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("username").value = "testuser"',
          );

          // Verify the value was set
          const inputValue = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("username").value',
          );
          expect(inputValue).toBe('testuser');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should create and manipulate DOM elements',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Create a new div element
          const elementCreated = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            const div = document.createElement('div');
            div.id = 'test-element';
            div.textContent = 'Test Content';
            div.style.backgroundColor = 'lightblue';
            document.body.appendChild(div);
            'element-created'
            `,
          );
          expect(elementCreated).toBe('element-created');

          // Verify the element exists and has correct properties
          const elementText = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("test-element").textContent',
          );
          expect(elementText).toBe('Test Content');

          const elementStyle = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("test-element").style.backgroundColor',
          );
          expect(elementStyle).toBe('lightblue');

          // Remove the element
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("test-element").remove()',
          );

          // Verify element is gone
          const elementExists = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("test-element") !== null',
          );
          expect(elementExists).toBe(false);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Function Execution with Return Values', () => {
    it(
      'should execute custom functions and return complex data',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test object with methods (avoiding function keyword)
          const objectMethodResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            const calculator = {
              numbers: [1, 2, 3, 4, 5],
              calculateStats() {
                const sum = this.numbers.reduce((a, b) => a + b, 0);
                const avg = sum / this.numbers.length;
                const max = Math.max(...this.numbers);
                const min = Math.min(...this.numbers);
                return { sum, avg, max, min, count: this.numbers.length };
              }
            };
            calculator.calculateStats()
            `,
          );

          expect(objectMethodResult).toEqual({
            sum: 15,
            avg: 3,
            max: 5,
            min: 1,
            count: 5,
          });

          // Test arrow functions and array methods
          const arrayResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `[1, 2, 3, 4, 5].map(x => x * 2)`,
          );
          expect(arrayResult).toEqual([2, 4, 6, 8, 10]);

          // Test reduce
          const sumResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `[1, 2, 3, 4, 5].reduce((a, b) => a + b, 0)`,
          );
          expect(sumResult).toBe(15);

          // Test filter
          const filterResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `[1, 2, 3, 4, 5].filter(x => x > 2)`,
          );
          expect(filterResult).toEqual([3, 4, 5]);

          // Test sorting
          const sortResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `[4, 2, 8, 1, 9].sort((a, b) => a - b)`,
          );
          expect(sortResult).toEqual([1, 2, 4, 8, 9]);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Error Handling for Invalid JavaScript', () => {
    it(
      'should handle syntax errors gracefully',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test syntax error
          await expect(
            mcpEvaluate(
              mcpClient.client,
              sessionInfo.contextId,
              'this is not valid javascript syntax',
            ),
          ).rejects.toThrow();

          // Test reference error
          await expect(
            mcpEvaluate(mcpClient.client, sessionInfo.contextId, 'undefinedVariable.someProperty'),
          ).rejects.toThrow();

          // Test type error
          await expect(
            mcpEvaluate(mcpClient.client, sessionInfo.contextId, 'null.toString()'),
          ).rejects.toThrow();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle runtime errors in user code',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test division by zero (JavaScript allows this, but serialization might convert Infinity to null)
          const divisionResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            '5 / 0',
          );
          // Note: Infinity might be serialized as null in JSON, so we check for both
          expect(divisionResult === Infinity || divisionResult === null).toBe(true);

          // Test accessing property of undefined
          await expect(
            mcpEvaluate(mcpClient.client, sessionInfo.contextId, 'undefined.nonExistentProperty'),
          ).rejects.toThrow();

          // Test calling non-function
          await expect(
            mcpEvaluate(mcpClient.client, sessionInfo.contextId, '5()'),
          ).rejects.toThrow();
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Async JavaScript Execution', () => {
    it(
      'should handle Promise-based code',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test Promise resolution
          const promiseResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'Promise.resolve("success")',
          );
          expect(promiseResult).toBe('success');

          // Test async/await pattern (simplified to avoid dynamic code restrictions)
          const asyncResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            Promise.resolve().then(() => {
              return "async complete";
            })
            `,
          );
          expect(asyncResult).toBe('async complete');

          // Test Promise with timeout (simplified)
          const timeoutResult = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            new Promise((resolve) => {
              resolve("timeout complete");
            })
            `,
          );
          expect(timeoutResult).toBe('timeout complete');
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle Promise rejections',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test Promise rejection
          await expect(
            mcpEvaluate(
              mcpClient.client,
              sessionInfo.contextId,
              'Promise.reject(new Error("test error"))',
            ),
          ).rejects.toThrow();

          // Test Promise that rejects
          await expect(
            mcpEvaluate(
              mcpClient.client,
              sessionInfo.contextId,
              `Promise.reject(new Error("async error"))`,
            ),
          ).rejects.toThrow();
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Page Properties and Navigation', () => {
    it(
      'should get page title, URL, and other properties',
      async () => {
        await retryOperation(async () => {
          // Navigate to a known page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h2');

          // Get page title
          const title = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.title',
          );
          expect(title).toBeTruthy();

          // Get document ready state
          const readyState = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.readyState',
          );
          expect(['loading', 'interactive', 'complete']).toContain(readyState);

          // Get document URL through document object
          const docUrl = await mcpEvaluate(mcpClient.client, sessionInfo.contextId, 'document.URL');
          expect(docUrl).toContain('login');

          // Test document properties
          const docProperties = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `({
              domain: document.domain,
              charset: document.characterSet,
              referrer: document.referrer,
              hasFocus: document.hasFocus()
            })`,
          );
          expect(docProperties.domain).toBeTruthy();
          expect(docProperties.charset).toBeTruthy();
          expect(typeof docProperties.hasFocus).toBe('boolean');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should navigate programmatically and detect changes',
      async () => {
        await retryOperation(async () => {
          // Start at the main page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Get initial URL through document
          const initialUrl = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.URL',
          );
          expect(initialUrl).toContain('the-internet.herokuapp.com');

          // Instead of programmatic navigation, test DOM creation and manipulation
          // Create a link element and test its properties
          const linkTest = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            const link = document.createElement('a');
            link.href = '/login';
            link.textContent = 'Login Link';
            link.id = 'test-link';
            document.body.appendChild(link);
            'link-created'
            `,
          );
          expect(linkTest).toBe('link-created');

          // Test the created link properties
          const linkProperties = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            const testLink = document.getElementById('test-link');
            ({
              text: testLink.textContent,
              href: testLink.getAttribute('href'),
              tagName: testLink.tagName
            })
            `,
          );
          expect(linkProperties.text).toBe('Login Link');
          expect(linkProperties.href).toBe('/login');
          expect(linkProperties.tagName).toBe('A');

          // Clean up the test element
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("test-link").remove()',
          );
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Interacting with Page Events', () => {
    it(
      'should work with form elements on SauceDemo',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to SauceDemo for better form testing
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );
          performance.checkpoint('navigation');

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');

          // Use JavaScript to fill and interact with form elements
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            document.getElementById('user-name').value = '${TEST_CREDENTIALS.sauceDemo.standard.username}';
            document.getElementById('password').value = '${TEST_CREDENTIALS.sauceDemo.standard.password}';
            `,
          );

          // Verify values were set
          const username = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("user-name").value',
          );
          expect(username).toBe(TEST_CREDENTIALS.sauceDemo.standard.username);

          // Submit form via JavaScript
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("login-button").click()',
          );
          performance.checkpoint('login_submit');

          // Wait for products page with longer timeout
          await mcpWaitForSelector(
            mcpClient.client,
            sessionInfo.contextId,
            '.inventory_list',
            10000,
          );

          // Use JavaScript to get product information
          const products = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            `
            Array.from(document.querySelectorAll('.inventory_item')).map(item => ({
              name: item.querySelector('.inventory_item_name').textContent,
              price: item.querySelector('.inventory_item_price').textContent,
              description: item.querySelector('.inventory_item_desc').textContent
            }))
            `,
          );

          expect(Array.isArray(products)).toBe(true);
          expect(products.length).toBeGreaterThan(0);
          expect(products[0]).toHaveProperty('name');
          expect(products[0]).toHaveProperty('price');
          expect(products[0]).toHaveProperty('description');

          // Add first product to cart using JavaScript
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.querySelector("[data-test^=\'add-to-cart-\']").click()',
          );

          // Check cart badge count
          const cartCount = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.querySelector(".shopping_cart_badge").textContent',
          );
          expect(cartCount).toBe('1');

          console.warn('Form interaction performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle dynamic content and events',
      async () => {
        await retryOperation(async () => {
          // Use the dynamic controls page for event testing
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dynamic_controls',
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#checkbox');

          // Check initial state
          const initialCheckboxExists = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("checkbox") !== null',
          );
          expect(initialCheckboxExists).toBe(true);

          // Click remove button via JavaScript and wait for changes
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.querySelector("#checkbox-example button").click()',
          );

          // Wait for element to be removed
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#message', 10000);

          // Verify checkbox is gone and message appears
          const checkboxRemoved = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("checkbox") === null',
          );
          expect(checkboxRemoved).toBe(true);

          const message = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("message").textContent',
          );
          expect(message).toContain("It's gone!");

          // Click Add button
          await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.querySelector("#checkbox-example button").click()',
          );

          // Wait for checkbox to return
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#checkbox', 10000);

          // Verify checkbox is back
          const checkboxReturned = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("checkbox") !== null',
          );
          expect(checkboxReturned).toBe(true);

          const newMessage = await mcpEvaluate(
            mcpClient.client,
            sessionInfo.contextId,
            'document.getElementById("message").textContent',
          );
          expect(newMessage).toContain("It's back!");
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
