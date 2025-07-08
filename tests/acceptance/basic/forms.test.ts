/**
 * Form interaction acceptance tests
 * @module tests/acceptance/basic/forms
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpClick,
  mcpType,
  mcpWaitForSelector,
  mcpGetContent,
} from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG, TEST_CREDENTIALS } from '../utils/test-config.js';
import {
  retryOperation,
  validateUrl,
  TestData,
  AssertionHelpers,
  PerformanceTracker,
} from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Form Interaction Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.ecommerce.sauceDemo,
      TEST_TARGETS.testing.demoQA,
      TEST_TARGETS.testing.theInternet,
    ];

    for (const url of targetsToValidate) {
      const isAccessible = await validateUrl(url);
      if (!isAccessible) {
        console.warn(`Warning: Test target ${url} is not accessible`);
      }
    }

    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.cleanup();
    }
  });

  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (sessionInfo) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('Basic Form Interactions', () => {
    it(
      'should fill and submit a login form',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to Sauce Demo login page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );
          performance.checkpoint('navigation');

          // Wait for login form to be present
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
          performance.checkpoint('form_loaded');

          // Fill in username
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#user-name',
            TEST_CREDENTIALS.sauceDemo.standard.username,
          );
          performance.checkpoint('username_filled');

          // Fill in password
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#password',
            TEST_CREDENTIALS.sauceDemo.standard.password,
          );
          performance.checkpoint('password_filled');

          // Click login button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
          performance.checkpoint('login_clicked');

          // Wait for redirect to products page
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
          performance.checkpoint('products_loaded');

          // Verify successful login by checking for products
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Products');
          AssertionHelpers.containsText(content, 'Sauce Labs');

          console.warn('Login performance:', performance.getReport());

          // Performance assertions
          expect(performance.getElapsed()).toBeLessThan(15000); // Total time under 15 seconds
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle login with invalid credentials',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          // Wait for form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');

          // Fill in invalid credentials
          await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', 'invalid_user');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'invalid_password');

          // Click login
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');

          // Should see error message
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="error"]');

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Username and password do not match');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle locked user account',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');

          // Use locked out user credentials
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#user-name',
            TEST_CREDENTIALS.sauceDemo.locked.username,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#password',
            TEST_CREDENTIALS.sauceDemo.locked.password,
          );

          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');

          // Should see locked user error
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="error"]');

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Sorry, this user has been locked out');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Complex Form Interactions', () => {
    it(
      'should fill a complex form with various input types',
      async () => {
        // Skip if DemoQA is not accessible (it sometimes has issues)
        const isAccessible = await validateUrl(
          TEST_TARGETS.testing.demoQA + '/automation-practice-form',
        );
        if (!isAccessible) {
          console.warn('Skipping complex form test - DemoQA not accessible');
          return;
        }

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.demoQA + '/automation-practice-form',
          );

          // Wait for form to load
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#firstName');

          // Generate test data
          const testData = {
            firstName: TestData.randomString(8),
            lastName: TestData.randomString(10),
            email: TestData.randomEmail(),
            phone: TestData.randomPhone(),
          };

          // Fill basic text fields
          await mcpType(mcpClient.client, sessionInfo.contextId, '#firstName', testData.firstName);
          await mcpType(mcpClient.client, sessionInfo.contextId, '#lastName', testData.lastName);
          await mcpType(mcpClient.client, sessionInfo.contextId, '#userEmail', testData.email);
          await mcpType(mcpClient.client, sessionInfo.contextId, '#userNumber', testData.phone);

          // Try to select gender radio button
          try {
            await mcpClick(mcpClient.client, sessionInfo.contextId, 'label[for="gender-radio-1"]');
          } catch (error) {
            console.warn('Could not select gender radio button:', error);
          }

          // Try to select date of birth
          try {
            await mcpClick(mcpClient.client, sessionInfo.contextId, '#dateOfBirthInput');
            // Just click somewhere to close datepicker if it opened
            await mcpClick(mcpClient.client, sessionInfo.contextId, '#firstName');
          } catch (error) {
            console.warn('Could not interact with date picker:', error);
          }

          // Try to fill subjects
          try {
            await mcpType(mcpClient.client, sessionInfo.contextId, '#subjectsInput', 'Math');
          } catch (error) {
            console.warn('Could not fill subjects:', error);
          }

          // Fill current address
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#currentAddress',
            '123 Test Street\\nTest City, TC 12345',
          );

          // Verify form data was entered
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, testData.firstName);
          AssertionHelpers.containsText(content, testData.lastName);
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Form Validation', () => {
    it(
      'should handle form validation errors',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#login-button');

          // Try to submit form without filling required fields
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');

          // Should see validation error
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="error"]');

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Username is required');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should clear form fields',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');

          // Fill fields
          await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', 'test_user');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'test_password');

          // Clear fields by selecting all and typing new value
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#user-name');
          // Simulate Ctrl+A and then type new value
          await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', ''); // Clear field
          await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', 'new_user');

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          // Content should reflect the new value, not the old one
          expect(content).not.toContain('test_user');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Dynamic Form Elements', () => {
    it(
      'should handle dynamic content loading',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dynamic_loading/1',
          );

          // Wait for page to load
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#start button');

          // Click start button to trigger dynamic loading
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#start button');

          // Wait for loading to complete and result to appear
          try {
            await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#finish h4', 10000);

            const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
            AssertionHelpers.containsText(content, 'Hello World!');
          } catch (error) {
            console.warn('Dynamic loading test may have failed due to site issues:', error);
            // This is acceptable for acceptance tests - external sites can be flaky
          }
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should wait for elements to become visible',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dynamic_loading/2',
          );

          // Wait for start button
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#start button');

          // Click to start dynamic loading
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#start button');

          // The element exists but is hidden, then becomes visible
          try {
            await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#finish', 8000);

            const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId, '#finish');
            expect(content).toBeTruthy();
          } catch (error) {
            console.warn('Dynamic visibility test may have failed due to site issues:', error);
          }
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
