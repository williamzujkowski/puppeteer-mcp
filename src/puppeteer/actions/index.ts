/**
 * Puppeteer action executor exports
 * @module puppeteer/actions
 */

// Main executor
export { BrowserActionExecutor } from './action-executor.js';

// Validation utilities
export {
  validateAction,
  validateActionBatch,
  validateJavaScriptCode,
  sanitizeUrl,
  sanitizeSelector,
  getActionSchema,
} from './validation.js';

// Handler exports
export * from './handlers/navigation.js';
export * from './handlers/interaction.js';
export * from './handlers/evaluation.js';
export * from './handlers/waiting.js';
export * from './handlers/content.js';
export * from './handlers/keyboard.js';
export * from './handlers/mouse.js';
export * from './handlers/upload.js';
export * from './handlers/cookies.js';
export * from './handlers/scroll.js';

// Types
export type {
  ActionExecutor,
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction,
} from '../interfaces/action-executor.interface.js';
