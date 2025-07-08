/**
 * Authentication workflow acceptance tests
 * @module tests/acceptance/workflows/authentication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createMCPClient, createMCPSession, cleanupMCPSession, mcpNavigate, mcpClick, mcpType, mcpWaitForSelector, mcpGetContent } from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG, TEST_CREDENTIALS } from '../utils/test-config.js';
import { retryOperation, validateUrl, AssertionHelpers, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Authentication Workflow Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;
  
  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.testing.theInternet + '/login',
      TEST_TARGETS.ecommerce.sauceDemo,
      TEST_TARGETS.realWorld.angularDemo
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

  describe('Basic Authentication Patterns', () => {
    it('should handle form-based authentication with valid credentials', async () => {
      const performance = new PerformanceTracker();
      
      await retryOperation(async () => {
        // Navigate to The Internet login page
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        performance.checkpoint('page_load');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        // Fill in valid credentials (The Internet test site credentials)
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'SuperSecretPassword!');
        performance.checkpoint('credentials_entered');
        
        // Submit form
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        performance.checkpoint('form_submitted');
        
        // Wait for redirect to secure area
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.success');
        performance.checkpoint('login_success');
        
        // Verify successful login
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'You logged into a secure area!');
        AssertionHelpers.containsText(content, 'Welcome to the Secure Area');
        AssertionHelpers.containsText(content, 'Logout');
        
        console.warn('Authentication performance:', performance.getReport());
        
        // Performance assertion
        expect(performance.getElapsed()).toBeLessThan(10000); // Login under 10 seconds
      });
    }, TEST_CONFIG.timeout);

    it('should handle authentication failure with invalid credentials', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        // Use invalid credentials
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'invalid_user');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'invalid_password');
        
        // Submit form
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        // Should see error message
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.error');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Your username is invalid!');
        
        // Should still be on login page
        AssertionHelpers.containsText(content, 'Login Page');
        AssertionHelpers.containsText(content, 'Username');
        AssertionHelpers.containsText(content, 'Password');
      });
    }, TEST_CONFIG.timeout);

    it('should handle partial authentication (wrong password)', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        // Valid username, invalid password
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'wrongpassword');
        
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.error');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Your password is invalid!');
      });
    }, TEST_CONFIG.timeout);
  });

  describe('Session Management', () => {
    it('should handle logout functionality', async () => {
      await retryOperation(async () => {
        // First login successfully
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'SuperSecretPassword!');
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.success');
        
        // Now logout
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'a[href="/logout"]');
        
        // Should be redirected to login page
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        const logoutContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(logoutContent, 'You logged out of the secure area!');
        AssertionHelpers.containsText(logoutContent, 'Login Page');
      });
    }, TEST_CONFIG.timeout);

    it('should prevent access to secure areas without authentication', async () => {
      await retryOperation(async () => {
        // Try to access secure area directly without login
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/secure');
        
        // Should be redirected to login or see unauthorized message
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Could be redirected to login page or show access denied
        const hasUnauthorized = content.includes('not authorized') || 
                               content.includes('access denied') ||
                               content.includes('Login Page') ||
                               content.includes('Unauthorized') ||
                               content.includes('403') ||
                               content.includes('401');
        
        expect(hasUnauthorized).toBe(true);
      });
    }, TEST_CONFIG.timeout);
  });

  describe('E-commerce Authentication', () => {
    it('should handle multiple user types and roles', async () => {
      const userTypes = [
        { user: TEST_CREDENTIALS.sauceDemo.standard, type: 'standard' },
        { user: TEST_CREDENTIALS.sauceDemo.problem, type: 'problem' },
        { user: TEST_CREDENTIALS.sauceDemo.performance, type: 'performance' }
      ];
      
      for (const { user, type } of userTypes) {
        await retryOperation(async () => {
          // Login with different user types
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
          
          await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', user.username);
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', user.password);
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
          
          // All valid users should reach products page
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.inventory_list');
          
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Products');
          
          console.warn(`Successfully logged in as ${type} user`);
          
          // Logout before next iteration
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#react-burger-menu-btn');
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#logout_sidebar_link');
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#logout_sidebar_link');
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        });
      }
    }, TEST_CONFIG.timeout * 3);

    it('should handle locked user account properly', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#user-name');
        
        // Try to login with locked user
        await mcpType(mcpClient.client, sessionInfo.contextId, '#user-name', TEST_CREDENTIALS.sauceDemo.locked.username);
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', TEST_CREDENTIALS.sauceDemo.locked.password);
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        // Should see locked user error
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="error"]');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Sorry, this user has been locked out');
        
        // Should remain on login page
        const usernameField = await mcpGetContent(mcpClient.client, sessionInfo.contextId, '#user-name');
        expect(usernameField).toBeTruthy();
      });
    }, TEST_CONFIG.timeout);
  });

  describe('Authentication Security Features', () => {
    it('should handle empty credentials validation', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.ecommerce.sauceDemo);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        // Try to submit without any credentials
        await mcpClick(mcpClient.client, sessionInfo.contextId, '#login-button');
        
        // Should see validation error
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '[data-test="error"]');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Username is required');
      });
    }, TEST_CONFIG.timeout);

    it('should handle special characters in credentials', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        // Try credentials with special characters
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'test@user.com');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'p@ssw0rd!$%^&*()');
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        // Should handle special characters gracefully (likely with invalid username error)
        expect(content).toContain('Your username is invalid!');
      });
    }, TEST_CONFIG.timeout);

    it('should handle SQL injection attempts safely', async () => {
      await retryOperation(async () => {
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        // Try common SQL injection strings
        const injectionAttempts = [
          "' OR '1'='1",
          "admin'--",
          "'; DROP TABLE users; --"
        ];
        
        for (const injection of injectionAttempts) {
          // Clear fields first
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#username');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', '');
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', '');
          
          // Try injection
          await mcpType(mcpClient.client, sessionInfo.contextId, '#username', injection);
          await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'password');
          await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
          
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash');
          
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          
          // Should reject injection attempts with invalid username error
          AssertionHelpers.containsText(content, 'Your username is invalid!');
          
          // Should not indicate successful login or database errors
          expect(content).not.toContain('Welcome to the Secure Area');
          expect(content).not.toContain('SQL');
          expect(content).not.toContain('database');
          expect(content).not.toContain('mysql');
        }
      });
    }, TEST_CONFIG.timeout * 2);
  });

  describe('Authentication State Persistence', () => {
    it('should maintain authentication across page navigation', async () => {
      await retryOperation(async () => {
        // Login successfully
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'SuperSecretPassword!');
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.success');
        
        // Navigate to other pages and back
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet);
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');
        
        // Go back to secure area - should still be authenticated
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/secure');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        AssertionHelpers.containsText(content, 'Welcome to the Secure Area');
        AssertionHelpers.containsText(content, 'Logout');
        
        // Should not be on login page
        expect(content).not.toContain('Login Page');
        expect(content).not.toContain('Username');
      });
    }, TEST_CONFIG.timeout);

    it('should handle session timeout gracefully', async () => {
      // This test simulates potential session timeout scenarios
      await retryOperation(async () => {
        // Login successfully
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/login');
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#username');
        
        await mcpType(mcpClient.client, sessionInfo.contextId, '#username', 'tomsmith');
        await mcpType(mcpClient.client, sessionInfo.contextId, '#password', 'SuperSecretPassword!');
        await mcpClick(mcpClient.client, sessionInfo.contextId, 'button[type="submit"]');
        
        await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.flash.success');
        
        // Wait for a period (simulating inactivity)
        await new Promise<void>(resolve => {
          setTimeout(resolve, 3000);
        });
        
        // Try to access secure area after wait
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet + '/secure');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // For this test site, session likely persists, but we test the handling
        if (content.includes('Welcome to the Secure Area')) {
          // Session persisted - this is fine
          AssertionHelpers.containsText(content, 'Logout');
        } else {
          // Session expired - should be redirected to login
          expect(content.includes('Login Page') || content.includes('login')).toBe(true);
        }
      });
    }, TEST_CONFIG.timeout);
  });
});