/**
 * Interaction action handlers module
 * @module puppeteer/actions/execution/interaction
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

// Export base handler
export { BaseInteractionHandler } from './base-handler.js';
export type { InteractionHandler } from './base-handler.js';

// Export individual handlers
export { ClickHandler } from './click-handler.js';
export { TypeHandler } from './type-handler.js';
export { SelectHandler } from './select-handler.js';
export { KeyboardHandler } from './keyboard-handler.js';
export { MouseHandler } from './mouse-handler.js';
export { HoverHandler } from './hover-handler.js';
export type { HoverAction } from './hover-handler.js';

// Export factory
export { InteractionHandlerFactory } from './handler-factory.js';