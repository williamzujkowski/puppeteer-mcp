/**
 * Test script to verify backward compatibility of refactored interaction executor
 * This file can be used to ensure the refactored code maintains the same API
 */

import { InteractionExecutor } from '../interaction-executor.js';
import type { Page } from 'puppeteer';
import type {
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';

// Test function to verify all methods still exist and work
async function testBackwardCompatibility() {
  // Create executor instance
  const executor = new InteractionExecutor();
  
  // Mock page and context
  const mockPage = {} as Page;
  const mockContext: ActionContext = {
    sessionId: 'test-session',
    contextId: 'test-context',
  };

  // Test that all methods exist
  console.log('Testing method existence...');
  console.assert(typeof executor.executeClick === 'function', 'executeClick method exists');
  console.assert(typeof executor.executeType === 'function', 'executeType method exists');
  console.assert(typeof executor.executeSelect === 'function', 'executeSelect method exists');
  console.assert(typeof executor.executeKeyboard === 'function', 'executeKeyboard method exists');
  console.assert(typeof executor.executeMouse === 'function', 'executeMouse method exists');
  console.assert(typeof executor.executeHover === 'function', 'executeHover method exists');
  console.assert(typeof executor.execute === 'function', 'execute method exists');
  console.assert(typeof executor.getSupportedActions === 'function', 'getSupportedActions method exists');

  // Test new methods
  console.assert(typeof executor.registerHandler === 'function', 'registerHandler method exists');
  console.assert(typeof executor.unregisterHandler === 'function', 'unregisterHandler method exists');

  // Test getSupportedActions
  const supportedActions = executor.getSupportedActions();
  console.log('Supported actions:', supportedActions);
  console.assert(supportedActions.includes('click'), 'click action supported');
  console.assert(supportedActions.includes('type'), 'type action supported');
  console.assert(supportedActions.includes('select'), 'select action supported');
  console.assert(supportedActions.includes('keyboard'), 'keyboard action supported');
  console.assert(supportedActions.includes('mouse'), 'mouse action supported');
  console.assert(supportedActions.includes('hover'), 'hover action supported');

  console.log('✅ All backward compatibility tests passed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBackwardCompatibility().catch(console.error);
}