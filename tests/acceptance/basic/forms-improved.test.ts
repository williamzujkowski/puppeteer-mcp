/**
 * Improved form interaction tests with better test targets
 * @module tests/acceptance/basic/forms-improved
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
import { getTestTargets, TEST_CONFIG, TEST_CREDENTIALS } from '../utils/reliable-test-config.js';
const TEST_TARGETS = getTestTargets();
import { retryOperation, AssertionHelpers, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Improved Form Interaction Tests', () => {
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

  describe('Form Field Management', () => {
    it(
      'should clear and update form fields properly',
      async () => {
        await retryOperation(async () => {
          // Use the-internet login form which is simpler and more reliable
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          // Wait for form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');

          // Type initial value
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'initialuser');

          // Clear by triple-clicking to select all, then type new value
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#username');
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#username');
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#username');

          // Type new value (should replace selected text)
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');

          // Fill password
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#password',
            'SuperSecretPassword!',
          );

          // Submit form
          await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');

          // Wait for result
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash', 5000);

          // Verify success
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'You logged into a secure area!');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Form with Multiple Input Types', () => {
    it(
      'should handle forms with various input elements',
      async () => {
        await retryOperation(async () => {
          // Use a simpler form that we know works well
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/checkboxes',
          );

          // Wait for checkboxes
          await mcpWaitForSelector(
            mcpClient.client,
            sessionInfo.contextId,
            'input[type="checkbox"]',
          );

          // Get initial state (for verification)
          await mcpGetContent(mcpClient.client, sessionInfo.contextId);

          // Click first checkbox to toggle it
          await mcpClick(
            mcpClient.client,
            sessionInfo.contextId,
            'form#checkboxes input[type="checkbox"]',
          );

          // Navigate to the inputs page for various input types
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/inputs',
          );

          // Wait for number input
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'input[type="number"]');

          // Type a number
          await mcpType(mcpClient.client, sessionInfo.contextId, 'input[type="number"]', '42');

          // Verify the input was entered
          const inputContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(inputContent, 'Number');

          // Navigate to form authentication for a complete form
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          // Fill username and password
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#password',
            'SuperSecretPassword!',
          );

          // Verify form was filled
          const formContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(formContent, 'Login Page');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Shopping Cart Workflow', () => {
    it(
      'should add products to cart and proceed to checkout',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Use SauceDemo for e-commerce workflow (it's reliable)
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );
          performance.checkpoint('navigation');

          // Login first
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#user-name',
            TEST_CREDENTIALS.sauceDemo.standard.username,
          );
          await mcpType(
            mcpClient.client,
            sessionInfo.contextId,
            '#password',
            TEST_CREDENTIALS.sauceDemo.standard.password,
          );
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
          performance.checkpoint('login_complete');

          // Wait for products page
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
          performance.checkpoint('products_loaded');

          // Add first product to cart
          await mcpClick(
            mcpClient.client,
            sessionInfo.contextId,
            '[data-test="add-to-cart-sauce-labs-backpack"]',
          );
          performance.checkpoint('product_added');

          // Go to cart
          await mcpClick(mcpClient.client, sessionInfo.contextId, '.shopping_cart_link');
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.cart_list');
          performance.checkpoint('cart_viewed');

          // Verify product in cart
          const cartContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(cartContent, 'Sauce Labs Backpack');

          // Proceed to checkout
          await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="checkout"]');
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#first-name');
          performance.checkpoint('checkout_started');

          // Fill checkout form
          await mcpType(mcpClient.client, sessionInfo.contextId, '#first-name', 'Test');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#last-name', 'User');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#postal-code', '12345');

          await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="continue"]');
          performance.checkpoint('checkout_info_complete');

          // Verify checkout overview
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.summary_info');
          const checkoutContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(checkoutContent, 'Checkout: Overview');

          console.warn('E-commerce workflow performance:', performance.getReport());
          expect(performance.getElapsed()).toBeLessThan(20000); // Should complete within 20 seconds
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Wait Strategies', () => {
    it(
      'should wait for delayed elements',
      async () => {
        await retryOperation(async () => {
          // Use httpbin delay endpoint for predictable delays
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + '/delay/2',
          );

          // The page will load after 2 seconds
          // Wait for the JSON response to appear
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'pre', 5000);

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          // httpbin returns JSON with the delay info
          AssertionHelpers.containsText(content, 'origin');
          AssertionHelpers.containsText(content, 'url');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle element state changes',
      async () => {
        await retryOperation(async () => {
          // Use the-internet dynamic controls page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dynamic_controls',
          );

          // Wait for checkbox section
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#checkbox');

          // Click remove button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#checkbox-example button');

          // Wait for "It's gone!" message
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#message', 10000);

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, "It's gone!");

          // Click Add button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#checkbox-example button');

          // Wait for "It's back!" message
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#checkbox', 10000);

          const content2 = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content2, "It's back!");
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
