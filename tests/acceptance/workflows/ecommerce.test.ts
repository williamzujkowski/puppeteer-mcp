/**
 * E-commerce workflow acceptance tests
 * @module tests/acceptance/workflows/ecommerce
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createMCPClient, createMCPSession, cleanupMCPSession, mcpNavigate, mcpClick, mcpType, mcpWaitForSelector, mcpGetContent, mcpScreenshot } from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG, TEST_CREDENTIALS } from '../utils/test-config.js';
import { retryOperation, validateUrl, PerformanceTracker, ScreenshotHelpers, AssertionHelpers } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('E-commerce Workflow Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;
  
  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.ecommerce.sauceDemo,
      TEST_TARGETS.ecommerce.automationPractice
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

  describe('Complete Purchase Flow', () => {
    it('should complete full purchase workflow on Sauce Demo', async () => {
      const performance = new PerformanceTracker();
      
      await retryOperation(async () => {
        // Step 1: Login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        performance.checkpoint('page_load');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        performance.checkpoint('login');
        
        // Step 2: Browse products
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        const productsContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(productsContent, 'Sauce Labs Backpack');
        AssertionHelpers.containsText(productsContent, 'Add to cart');
        performance.checkpoint('products_loaded');
        
        // Step 3: Add products to cart
        // Add Sauce Labs Backpack
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-backpack"]');
        
        // Add another product (Bike Light)
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-bike-light"]');
        performance.checkpoint('products_added');
        
        // Step 4: View cart
        await mcpClick(mcpClient.client, sessionInfo.contextId, '.shopping_cart_link');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.cart_list');
        
        const cartContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(cartContent, 'Sauce Labs Backpack');
        AssertionHelpers.containsText(cartContent, 'Sauce Labs Bike Light');
        AssertionHelpers.containsText(cartContent, 'Remove');
        performance.checkpoint('cart_viewed');
        
        // Step 5: Proceed to checkout
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="checkout"]');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="firstName"]');
        performance.checkpoint('checkout_started');
        
        // Step 6: Fill checkout information
        await mcpType(mcpClient.client, sessionInfo.contextId, '[data-test="firstName"]', 'John');
        await mcpType(mcpClient.client, sessionInfo.contextId, '[data-test="lastName"]', 'Doe');
        await mcpType(mcpClient.client, sessionInfo.contextId, '[data-test="postalCode"]', '12345');
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="continue"]');
        performance.checkpoint('checkout_info_filled');
        
        // Step 7: Review order
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.summary_info');
        
        const summaryContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(summaryContent, 'Payment Information');
        AssertionHelpers.containsText(summaryContent, 'Shipping Information');
        AssertionHelpers.containsText(summaryContent, 'Total');
        performance.checkpoint('order_reviewed');
        
        // Step 8: Complete order
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="finish"]');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.complete-header');
        performance.checkpoint('order_completed');
        
        // Step 9: Verify completion
        const completionContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(completionContent, 'Thank you for your order');
        AssertionHelpers.containsText(completionContent, 'Your order has been dispatched');
        
        // Take screenshot of completion page
        const screenshotPath = await mcpScreenshot(mcpClient.client, sessionInfo.contextId, 
          ScreenshotHelpers.getTimestampedFilename('ecommerce-completion'));
        console.warn('Order completion screenshot:', screenshotPath);
        
        console.warn('E-commerce workflow performance:', performance.getReport());
        
        // Performance assertions
        expect(performance.getElapsed()).toBeLessThan(30000); // Complete flow under 30 seconds
      });
    }, TEST_CONFIG.timeout * 3);

    it('should handle cart modifications during shopping', async () => {
      await retryOperation(async () => {
        // Login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Add product to cart
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-backpack"]');
        
        // Verify button changed to "Remove"
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="remove-sauce-labs-backpack"]');
        
        // Add another product
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-bike-light"]');
        
        // Go to cart
        await mcpClick(mcpClient.client, sessionInfo.contextId, '.shopping_cart_link');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.cart_list');
        
        // Verify both items in cart
        const cartContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(cartContent, 'Sauce Labs Backpack');
        AssertionHelpers.containsText(cartContent, 'Sauce Labs Bike Light');
        
        // Remove one item
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="remove-sauce-labs-bike-light"]');
        
        // Verify item was removed
        const updatedCartContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(updatedCartContent, 'Sauce Labs Backpack');
        expect(updatedCartContent).not.toContain('Sauce Labs Bike Light');
      });
    }, TEST_CONFIG.timeout * 2);
  });

  describe('Product Browsing and Filtering', () => {
    it('should browse and sort products', async () => {
      await retryOperation(async () => {
        // Login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Get initial product order
        const initialContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Change sort order (Name Z to A)
        await mcpClick(mcpClient.client, sessionInfo.contextId, '.product_sort_container');
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'option[value="za"]');
        
        // Wait for sort to apply
        await new Promise<void>(resolve => {
          setTimeout(resolve, 1000);
        });
        
        const sortedContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Content should have changed order
        expect(sortedContent).not.toBe(initialContent);
        
        // Should still contain all products
        AssertionHelpers.containsText(sortedContent, 'Sauce Labs Backpack');
        AssertionHelpers.containsText(sortedContent, 'Sauce Labs Bike Light');
        AssertionHelpers.containsText(sortedContent, 'Add to cart');
      });
    }, TEST_CONFIG.timeout);

    it('should view individual product details', async () => {
      await retryOperation(async () => {
        // Login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Click on product name to view details
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#item_4_title_link');
        
        // Should be on product detail page
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_details_name');
        
        const detailContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(detailContent, 'Sauce Labs Backpack');
        AssertionHelpers.containsText(detailContent, '$29.99');
        AssertionHelpers.containsText(detailContent, 'Add to cart');
        AssertionHelpers.containsText(detailContent, 'Back to products');
        
        // Should be able to add to cart from detail page
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-backpack"]');
        
        // Button should change to Remove
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="remove-sauce-labs-backpack"]');
        
        // Go back to products
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="back-to-products"]');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Should be back on products page
        const productsContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(productsContent, 'Products');
      });
    }, TEST_CONFIG.timeout);
  });

  describe('User Experience and Edge Cases', () => {
    it('should handle problematic user account', async () => {
      await retryOperation(async () => {
        // Login with problem user (has visual glitches)
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.problem.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.problem.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Despite problems, basic functionality should work
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Products');
        
        // Try to add product to cart (might have issues but shouldn't crash)
        try {
          await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-backpack"]');
          
          // Check if cart badge appears
          const cartContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          // Problem user might have broken images or layout issues, but should still function
          expect(cartContent).toBeTruthy();
        } catch (error) {
          console.warn('Problem user exhibited expected issues:', error);
          // This is acceptable for the problem user account
        }
      });
    }, TEST_CONFIG.timeout);

    it('should handle performance issues gracefully', async () => {
      const performance = new PerformanceTracker();
      
      await retryOperation(async () => {
        // Login with performance glitch user
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.performance.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.performance.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        performance.checkpoint('login_with_performance_issues');
        
        // This user has intentional performance delays
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list', 15000); // Longer timeout
        performance.checkpoint('products_loaded_slowly');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Products');
        
        // Performance should be noticeably slower but still functional
        const loginTime = performance.getCheckpoint('login_with_performance_issues');
        const loadTime = performance.getCheckpoint('products_loaded_slowly');
        
        console.warn('Performance glitch user timings:', performance.getReport());
        
        // Should take longer than normal user (but not fail)
        expect(loginTime ?? 0).toBeGreaterThan(1000); // Should be noticeably slow
        expect(loadTime ?? 0).toBeGreaterThan(2000);
      });
    }, TEST_CONFIG.timeout * 2);

    it('should maintain session state across navigation', async () => {
      await retryOperation(async () => {
        // Login and add items to cart
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Add product to cart
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="add-to-cart-sauce-labs-backpack"]');
        
        // Navigate to different product
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#item_0_title_link');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_details_name');
        
        // Go back to products
        await mcpClick(mcpClient.client, sessionInfo.contextId, '[data-test="back-to-products"]');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Cart should still have item (session state maintained)
        const cartBadge = await mcpGetContent(mcpClient.client, sessionInfo.contextId, '.shopping_cart_badge');
        expect(cartBadge).toContain('1');
        
        // Product button should still show "Remove"
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="remove-sauce-labs-backpack"]');
      });
    }, TEST_CONFIG.timeout);
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle navigation errors and recover', async () => {
      await retryOperation(async () => {
        // Start with successful login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.standard.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.standard.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        // Try to navigate to non-existent page within the app
        try {
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo + 'non-existent-page');
          
          // Should handle error gracefully
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          // Might show error page or redirect, both are acceptable
          expect(content).toBeTruthy();
        } catch (error) {
          console.warn('Navigation to non-existent page failed as expected:', error);
        }
        
        // Should be able to navigate back to working page
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo + 'inventory.html');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
        
        const recoveredContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(recoveredContent, 'Products');
      });
    }, TEST_CONFIG.timeout);
  });
});