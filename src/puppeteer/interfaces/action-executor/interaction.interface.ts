/**
 * Interaction Action Interfaces
 * @module action-executor/interaction
 * @description User interaction actions for browser automation
 * @nist si-10 "Information input validation"
 */

import type { KeyInput } from 'puppeteer';
import type { BaseBrowserAction } from './core.interface.js';

/**
 * Click action
 * @description Click on an element with various options
 */
export interface ClickAction extends BaseBrowserAction {
  type: 'click';
  
  /** CSS selector for target element */
  selector: string;
  
  /** Number of consecutive clicks */
  clickCount?: number;
  
  /** Mouse button to use */
  button?: 'left' | 'right' | 'middle';
  
  /** Delay between down and up in milliseconds */
  delay?: number;
  
  /** X offset from element center */
  offsetX?: number;
  
  /** Y offset from element center */
  offsetY?: number;
}

/**
 * Type action
 * @description Type text into an input element
 */
export interface TypeAction extends BaseBrowserAction {
  type: 'type';
  
  /** CSS selector for target element */
  selector: string;
  
  /** Text to type */
  text: string;
  
  /** Delay between key presses in milliseconds */
  delay?: number;
  
  /** Clear existing content before typing */
  clearFirst?: boolean;
}

/**
 * Select action
 * @description Select options from a dropdown element
 */
export interface SelectAction extends BaseBrowserAction {
  type: 'select';
  
  /** CSS selector for select element */
  selector: string;
  
  /** Values to select */
  values: string[];
}

/**
 * Keyboard action
 * @description Keyboard input actions
 */
export interface KeyboardAction extends BaseBrowserAction {
  type: 'keyboard';
  
  /** Key to press */
  key: KeyInput;
  
  /** Keyboard action type */
  action: 'press' | 'down' | 'up';
  
  /** Modifier keys to hold during action */
  modifiers?: string[];
}

/**
 * Mouse action
 * @description Mouse movement and button actions
 */
export interface MouseAction extends BaseBrowserAction {
  type: 'mouse';
  
  /** Mouse action type */
  action: 'move' | 'down' | 'up' | 'wheel';
  
  /** X coordinate for mouse position */
  x?: number;
  
  /** Y coordinate for mouse position */
  y?: number;
  
  /** Horizontal scroll delta */
  deltaX?: number;
  
  /** Vertical scroll delta */
  deltaY?: number;
  
  /** Mouse button for down/up actions */
  button?: 'left' | 'right' | 'middle';
}

/**
 * Upload file action
 * @description Upload files to file input elements
 * @nist ac-3 "Access enforcement"
 */
export interface UploadAction extends BaseBrowserAction {
  type: 'upload';
  
  /** CSS selector for file input element */
  selector: string;
  
  /** Array of file paths to upload */
  filePaths: string[];
}

/**
 * Hover action
 * @description Hover over an element
 */
export interface HoverAction extends BaseBrowserAction {
  type: 'hover';
  
  /** CSS selector for target element */
  selector: string;
}

/**
 * Interaction-related action types
 */
export type InteractionActionType = 
  | ClickAction 
  | TypeAction 
  | SelectAction 
  | KeyboardAction 
  | MouseAction 
  | UploadAction
  | HoverAction;