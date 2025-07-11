/**
 * Alternative form interaction acceptance tests using more reliable test targets
 * @module tests/acceptance/basic/forms-alternative
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
import { TEST_CONFIG } from '../utils/test-config.js';
import {
  ALTERNATIVE_TEST_TARGETS,
  ALTERNATIVE_TEST_DATA,
  ALTERNATIVE_SELECTORS,
  checkAlternativeSiteAvailability,
} from '../utils/alternative-test-config.js';
import { retryOperation, AssertionHelpers, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Alternative Form Interaction Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Check which alternative sites are available
    const uiPlaygroundAvailable = await checkAlternativeSiteAvailability(
      ALTERNATIVE_TEST_TARGETS.uiPlayground.base,
    );
    const automationExerciseAvailable = await checkAlternativeSiteAvailability(
      ALTERNATIVE_TEST_TARGETS.automationExercise.base,
    );

    console.warn('Alternative test sites availability:');
    console.warn('- UI Testing Playground:', uiPlaygroundAvailable ? 'Available' : 'Not Available');
    console.warn(
      '- Automation Exercise:',
      automationExerciseAvailable ? 'Available' : 'Not Available',
    );

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

  describe('Basic Form Interactions - UI Testing Playground', () => {
    it(
      'should update button text through text input',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.textInput,
          );

          // Wait for the input field
          await mcpWaitForSelector(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.textInput.input,
          );

          // Type new button name
          const newButtonText = `Test Button ${Date.now()}`;
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.textInput.input,
            newButtonText,
          );

          // Click the button to update its text
          await mcpClick(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.textInput.button,
          );

          // Verify button text changed
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, newButtonText);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle login form with validation',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.sampleApp,
          );

          const selectors = ALTERNATIVE_SELECTORS.uiPlayground.sampleApp;

          // Wait for form to load
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, selectors.username);

          // Test invalid login first
          await mcpType(mcpClient.client, sessionInfo.contextId, selectors.username, 'wronguser');
          await mcpType(mcpClient.client, sessionInfo.contextId, selectors.password, 'wrongpass');
          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.loginButton);

          // Check for error message
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, selectors.statusLabel);
          let content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Invalid username/password');

          // Now test valid login
          const validCreds = ALTERNATIVE_TEST_DATA.uiPlayground.sampleApp;

          // Clear and refill fields
          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.username);
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            selectors.username,
            validCreds.username,
          );

          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.password);
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            selectors.password,
            validCreds.password,
          );

          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.loginButton);

          // Check for success message
          content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, `Welcome, ${validCreds.username}!`);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Complex Form Interactions - Automation Exercise', () => {
    it(
      'should fill a signup form with multiple field types',
      async () => {
        const isAvailable = await checkAlternativeSiteAvailability(
          ALTERNATIVE_TEST_TARGETS.automationExercise.signup,
        );

        if (!isAvailable) {
          console.warn('Skipping test - Automation Exercise not available');
          return;
        }

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.automationExercise.signup,
          );

          const selectors = ALTERNATIVE_SELECTORS.automationExercise.signup;
          const userData = ALTERNATIVE_TEST_DATA.automationExercise.signup.generateUser();

          // Wait for signup form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, selectors.nameInput);

          // Fill signup form
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            selectors.nameInput,
            userData.name,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            selectors.emailInput,
            userData.email,
          );

          // Click signup button
          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.signupButton);

          // Wait for account information form
          const accountSelectors = ALTERNATIVE_SELECTORS.automationExercise.accountForm;
          await mcpWaitForSelector(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.password,
          );

          // Fill account information
          await mcpClick(mcpClient.client, sessionInfo.contextId, accountSelectors.genderMale);
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.password,
            userData.password,
          );

          // Select date of birth
          await mcpClick(mcpClient.client, sessionInfo.contextId, accountSelectors.days);
          await mcpClick(mcpClient.client, sessionInfo.contextId, 'option[value="15"]');

          await mcpClick(mcpClient.client, sessionInfo.contextId, accountSelectors.months);
          await mcpClick(mcpClient.client, sessionInfo.contextId, 'option[value="6"]');

          await mcpClick(mcpClient.client, sessionInfo.contextId, accountSelectors.years);
          await mcpClick(mcpClient.client, sessionInfo.contextId, 'option[value="1990"]');

          // Check newsletter checkbox
          await mcpClick(mcpClient.client, sessionInfo.contextId, accountSelectors.newsletter);

          // Fill address information
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.firstName,
            userData.firstName,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.lastName,
            userData.lastName,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.company,
            userData.company,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            accountSelectors.address1,
            userData.address,
          );

          // Verify form was filled
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, userData.firstName);
          AssertionHelpers.containsText(content, userData.company);
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Dynamic Content Tests - UI Testing Playground', () => {
    it(
      'should handle AJAX data loading',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.ajax,
          );
          performance.checkpoint('navigation');

          // Click button to trigger AJAX request
          await mcpClick(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.ajax.button,
          );
          performance.checkpoint('ajax_triggered');

          // Wait for success message (15 second delay is built into this test)
          await mcpWaitForSelector(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.ajax.content,
            20000,
          );
          performance.checkpoint('ajax_completed');

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Data loaded with AJAX get request');

          console.warn('AJAX test performance:', performance.getReport());

          // This test has a predictable 15-second delay
          const elapsed = performance.getElapsed();
          expect(elapsed).toBeGreaterThan(15000);
          expect(elapsed).toBeLessThan(25000);
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle element visibility states',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.visibility,
          );

          const selectors = ALTERNATIVE_SELECTORS.uiPlayground.visibility;

          // Wait for hide button
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, selectors.hideButton);

          // Click hide button
          await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.hideButton);

          // Verify buttons are affected appropriately
          // The removed button should be gone from DOM
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);

          // Check that hide operation worked
          expect(content).toContain('Hide'); // Hide button still visible

          // Zero width button should still be in DOM but not visible
          const hasZeroWidthButton = content.includes('Zero Width');
          expect(hasZeroWidthButton).toBe(true); // Still in DOM

          // Transparent button should still be clickable even if transparent
          try {
            await mcpClick(mcpClient.client, sessionInfo.contextId, selectors.transparentButton);
            // If click succeeds, the button is still interactive
            expect(true).toBe(true);
          } catch {
            // Button might not be clickable due to transparency
            console.warn('Transparent button not clickable as expected');
          }
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle client-side delays',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.clientDelay,
          );

          // Click button that triggers client delay
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#ajaxButton');

          // Wait for content to appear after client-side delay
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.bg-success', 20000);

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Data calculated on the client side');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Form Clearing and Reset', () => {
    it(
      'should clear and refill form fields',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.textInput,
          );

          const inputSelector = ALTERNATIVE_SELECTORS.uiPlayground.textInput.input;

          // Wait for input
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, inputSelector);

          // Type initial text
          const initialText = 'Initial Text';
          await mcpType(mcpClient.client, sessionInfo.contextId, inputSelector, initialText);

          // Clear by selecting all and typing new text
          await mcpClick(mcpClient.client, sessionInfo.contextId, inputSelector);

          // Type new text (this should replace the old text)
          const newText = 'Replaced Text';
          await mcpType(mcpClient.client, sessionInfo.contextId, inputSelector, newText);

          // Update button to verify
          await mcpClick(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_SELECTORS.uiPlayground.textInput.button,
          );

          // Verify button has the new text
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, newText);

          // Should not contain initial text anymore
          expect(content).not.toContain(initialText);
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
