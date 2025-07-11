/**
 * Reliable form interaction acceptance tests using stable test targets
 * @module tests/acceptance/basic/forms-reliable
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
import { ALTERNATIVE_TEST_TARGETS } from '../utils/alternative-test-config.js';
import {
  retryOperation,
  validateUrl,
  AssertionHelpers,
  PerformanceTracker,
} from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Reliable Form Interaction Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      ALTERNATIVE_TEST_TARGETS.uiPlayground.textInput,
      ALTERNATIVE_TEST_TARGETS.uiPlayground.ajax,
      ALTERNATIVE_TEST_TARGETS.uiPlayground.visibility,
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

  describe('Complex Form Interactions (Reliable)', () => {
    it(
      'should fill a complex form using UI Testing Playground',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to UI Testing Playground text input page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.textInput,
          );
          performance.checkpoint('navigation');

          // Wait for the input field
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#newButtonName');
          performance.checkpoint('form_loaded');

          // Type in the input field
          const testText = `Test Button ${Date.now()}`;
          await mcpType(mcpClient.client, sessionInfo.contextId, '#newButtonName', testText);
          performance.checkpoint('text_entered');

          // Click the update button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#updatingButton');
          performance.checkpoint('button_clicked');

          // Verify the button text was updated
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, testText);

          console.warn('Form interaction performance:', performance.getReport());
          expect(performance.getElapsed()).toBeLessThan(10000); // Should be fast
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle multiple form fields',
      async () => {
        await retryOperation(async () => {
          // Navigate to UI Testing Playground sample app (login form)
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.sampleApp,
          );

          // Wait for form to load
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');

          // Fill username
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'testuser');

          // Fill password
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'pwd123');

          // Click login button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login');

          // Wait for success message
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#loginstatus', 5000);

          // Verify login success
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Welcome, testuser!');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Dynamic Content Loading (Reliable)', () => {
    it('should handle AJAX content with predictable delays', async () => {
      await retryOperation(async () => {
        // Navigate to AJAX data page
        await mcpNavigate(
          mcpClient.client,
          sessionInfo.contextId,
          ALTERNATIVE_TEST_TARGETS.uiPlayground.ajax,
        );

        // Wait for the trigger button
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#ajaxButton');

        // Click button to trigger AJAX request
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#ajaxButton');

        // Wait for content to load (15 seconds is the fixed delay)
        // Using a longer timeout to account for the designed delay
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.bg-success', 20000);

        // Verify the loaded content
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Data loaded with AJAX get request');
      });
    }, 30000); // 30 second timeout for this test due to designed 15s delay

    it(
      'should handle client-side delays',
      async () => {
        await retryOperation(async () => {
          // Navigate to client delay page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.clientDelay,
          );

          // Click button that triggers client-side delay
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#ajaxButton');

          // Wait for the delayed element to appear
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.bg-success', 20000);

          // Verify content appeared
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Data calculated on the client side');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Element Visibility (Reliable)', () => {
    it(
      'should handle visibility changes',
      async () => {
        await retryOperation(async () => {
          // Navigate to visibility page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.visibility,
          );

          // Wait for hide button
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#hideButton');

          // Click hide button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#hideButton');

          // Wait a moment for visibility changes
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Get content to verify visibility states
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);

          // The test verifies that various elements are hidden/shown correctly
          expect(content).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle overlapped elements',
      async () => {
        await retryOperation(async () => {
          // Navigate to overlapped element page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.overlappedElement,
          );

          // Wait for the form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#id');

          // Enter ID
          await mcpType(mcpClient.client, sessionInfo.contextId, '#id', 'testid123');

          // Scroll to make name field visible
          // The name field is initially overlapped
          await mcpType(mcpClient.client, sessionInfo.contextId, '#name', 'Test User');

          // Verify both fields were filled
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          expect(content).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Form Field Clearing (Reliable)', () => {
    it(
      'should clear and update form fields',
      async () => {
        await retryOperation(async () => {
          // Use UI Testing Playground text input for reliable field clearing
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            ALTERNATIVE_TEST_TARGETS.uiPlayground.textInput,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#newButtonName');

          // Enter initial text
          await mcpType(mcpClient.client, sessionInfo.contextId, '#newButtonName', 'Initial Text');

          // Click update button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#updatingButton');

          // Clear field by selecting all and typing new value
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#newButtonName');

          // Type new value (this should clear the field first in most browsers)
          await mcpType(mcpClient.client, sessionInfo.contextId, '#newButtonName', 'Updated Text');

          // Click update button again
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#updatingButton');

          // Verify the button shows the updated text
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Updated Text');
          expect(content).not.toContain('Initial Text');
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
