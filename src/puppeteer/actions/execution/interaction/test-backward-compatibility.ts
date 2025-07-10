/**
 * Test script to verify backward compatibility of refactored interaction executor
 * This file can be used to ensure the refactored code maintains the same API
 */

import { InteractionExecutor } from '../interaction-executor.js';

// Test function to verify all methods still exist and work
async function testBackwardCompatibility() {
  // Create executor instance
  const executor = new InteractionExecutor();
  
  // Mock context would be created here if needed for tests

  // Test that all methods exist
  console.warn('Testing method existence...');
  if (typeof executor.executeClick !== 'function') throw new Error('executeClick method missing');
  if (typeof executor.executeType !== 'function') throw new Error('executeType method missing');
  if (typeof executor.executeSelect !== 'function') throw new Error('executeSelect method missing');
  if (typeof executor.executeKeyboard !== 'function') throw new Error('executeKeyboard method missing');
  if (typeof executor.executeMouse !== 'function') throw new Error('executeMouse method missing');
  if (typeof executor.executeHover !== 'function') throw new Error('executeHover method missing');
  if (typeof executor.execute !== 'function') throw new Error('execute method missing');
  if (typeof executor.getSupportedActions !== 'function') throw new Error('getSupportedActions method missing');

  // Test new methods
  if (typeof executor.registerHandler !== 'function') throw new Error('registerHandler method missing');
  if (typeof executor.unregisterHandler !== 'function') throw new Error('unregisterHandler method missing');

  // Test getSupportedActions
  const supportedActions = executor.getSupportedActions();
  console.warn('Supported actions:', supportedActions);
  if (!supportedActions.includes('click')) throw new Error('click action not supported');
  if (!supportedActions.includes('type')) throw new Error('type action not supported');
  if (!supportedActions.includes('select')) throw new Error('select action not supported');
  if (!supportedActions.includes('keyboard')) throw new Error('keyboard action not supported');
  if (!supportedActions.includes('mouse')) throw new Error('mouse action not supported');
  if (!supportedActions.includes('hover')) throw new Error('hover action not supported');

  console.warn('✅ All backward compatibility tests passed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBackwardCompatibility().catch(console.error);
}