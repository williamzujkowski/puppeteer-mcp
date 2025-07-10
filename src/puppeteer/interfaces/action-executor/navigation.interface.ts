/**
 * Navigation Action Interfaces
 * @module action-executor/navigation
 * @description Navigation-related actions for browser automation
 * @nist ac-4 "Information flow enforcement"
 */

import type { BaseBrowserAction } from './core.interface.js';

/**
 * Navigation action
 * @description Navigate to a URL with specified loading conditions
 */
export interface NavigateAction extends BaseBrowserAction {
  type: 'navigate';
  
  /** Target URL to navigate to */
  url: string;
  
  /** Wait condition for navigation completion */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * Wait action
 * @description Wait for various conditions before proceeding
 */
export interface WaitAction extends BaseBrowserAction {
  type: 'wait';
  
  /** Type of wait condition */
  waitType: 'selector' | 'navigation' | 'timeout' | 'function';
  
  /** CSS selector for element waiting */
  selector?: string;
  
  /** Duration in milliseconds for timeout wait */
  duration?: number;
  
  /** JavaScript function string for function wait */
  function?: string;
}

/**
 * Scroll action
 * @description Scroll page or element in various ways
 */
export interface ScrollAction extends BaseBrowserAction {
  type: 'scroll';
  
  /** Scroll direction */
  direction?: 'up' | 'down' | 'left' | 'right';
  
  /** Distance to scroll in pixels */
  distance?: number;
  
  /** CSS selector for element to scroll */
  selector?: string;
  
  /** Scroll to element if true */
  toElement?: boolean;
  
  /** Absolute x coordinate to scroll to */
  x?: number;
  
  /** Absolute y coordinate to scroll to */
  y?: number;
  
  /** Use smooth scrolling */
  smooth?: boolean;
  
  /** Duration of smooth scroll in milliseconds */
  duration?: number;
}

/**
 * Navigation-related action types
 */
export type NavigationActionType = NavigateAction | WaitAction | ScrollAction;