/**
 * Examples of using the modular validation system
 * @module puppeteer/actions/execution/validation/examples
 */

import type { BrowserAction, ActionContext } from '../../../interfaces/action-executor.interface.js';
import { ValidationOrchestrator } from './index.js';
import { ValidatorFactory, ValidatorType } from './validator-factory.js';
import { BaseValidator } from './base-validator.js';

/**
 * Example 1: Basic validation
 */
async function basicValidation() {
  const orchestrator = new ValidationOrchestrator();
  
  const action: BrowserAction = {
    type: 'navigate',
    pageId: 'page-1',
    url: 'https://example.com',
  };
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
  };
  
  const result = await orchestrator.validate(action, context);
  console.log('Validation result:', result);
}

/**
 * Example 2: Parallel validation with timeout
 */
async function parallelValidation() {
  const orchestrator = new ValidationOrchestrator();
  
  const action: BrowserAction = {
    type: 'click',
    pageId: 'page-1',
    selector: 'button#submit',
  };
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
  };
  
  const result = await orchestrator.validate(action, context, {
    parallel: true,
    timeout: 2000, // 2 second timeout
  });
  
  console.log('Parallel validation completed:', result);
}

/**
 * Example 3: Using specific validators
 */
async function specificValidators() {
  // Get navigation validator
  const navValidator = ValidatorFactory.getValidator(ValidatorType.NAVIGATION);
  
  const action: BrowserAction = {
    type: 'navigate',
    pageId: 'page-1',
    url: 'https://example.com',
    waitUntil: 'networkidle0',
  };
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
  };
  
  const result = await navValidator.validate(action, context);
  console.log('Navigation validation:', result);
}

/**
 * Example 4: Custom validator
 */
class CustomActionValidator extends BaseValidator {
  async validate(action: BrowserAction, context: ActionContext) {
    const errors = [];
    const warnings = [];
    
    // Custom validation logic
    if (action.type === 'custom' && !('customField' in action)) {
      this.addError(errors, 'customField', 'Custom field is required', 'MISSING_CUSTOM_FIELD');
    }
    
    return this.createResult(errors, warnings);
  }
  
  canValidate(action: BrowserAction): boolean {
    return action.type === 'custom';
  }
}

// Register custom validator
ValidatorFactory.registerValidator('custom', new CustomActionValidator());

/**
 * Example 5: Batch validation
 */
async function batchValidation() {
  const orchestrator = new ValidationOrchestrator();
  
  const actions: BrowserAction[] = [
    {
      type: 'navigate',
      pageId: 'page-1',
      url: 'https://example.com',
    },
    {
      type: 'click',
      pageId: 'page-1',
      selector: 'button#login',
    },
    {
      type: 'type',
      pageId: 'page-1',
      selector: 'input#username',
      text: 'user@example.com',
    },
  ];
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
  };
  
  const results = await orchestrator.validateBatch(actions, context);
  
  results.forEach((result, index) => {
    console.log(`Action ${index + 1} validation:`, result);
  });
}

/**
 * Example 6: Validation with security context
 */
async function securityValidation() {
  const orchestrator = new ValidationOrchestrator();
  
  const action: BrowserAction = {
    type: 'evaluate',
    pageId: 'page-1',
    function: 'document.querySelector("button").click()',
  };
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
    restrictedMode: true,
    allowEvaluation: false, // This will cause validation to fail
  };
  
  const result = await orchestrator.validate(action, context);
  console.log('Security validation result:', result);
}

/**
 * Example 7: Skip certain validators
 */
async function selectiveValidation() {
  const orchestrator = new ValidationOrchestrator();
  
  const action: BrowserAction = {
    type: 'navigate',
    pageId: 'page-1',
    url: 'http://example.com', // HTTP URL would normally trigger security warning
  };
  
  const context: ActionContext = {
    sessionId: 'session-1',
    contextId: 'context-1',
    timestamp: Date.now(),
  };
  
  // Skip security validator
  const result = await orchestrator.validate(action, context, {
    skipValidators: ['SecurityValidator'],
  });
  
  console.log('Validation without security checks:', result);
}

// Export examples for documentation
export {
  basicValidation,
  parallelValidation,
  specificValidators,
  batchValidation,
  securityValidation,
  selectiveValidation,
};