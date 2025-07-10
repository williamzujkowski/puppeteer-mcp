/**
 * Content Action Interfaces
 * @module action-executor/content
 * @description Content extraction and generation actions
 * @nist ac-4 "Information flow enforcement"
 */

import type { BaseBrowserAction } from './core.interface.js';

/**
 * Screenshot action
 * @description Capture screenshot of page or element
 */
export interface ScreenshotAction extends BaseBrowserAction {
  type: 'screenshot';
  
  /** Capture full page */
  fullPage?: boolean;
  
  /** CSS selector for specific element */
  selector?: string;
  
  /** Image quality (0-100, for JPEG/WebP) */
  quality?: number;
  
  /** Image format */
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * PDF generation action
 * @description Generate PDF from page content
 */
export interface PDFAction extends BaseBrowserAction {
  type: 'pdf';
  
  /** Page format */
  format?:
    | 'letter'
    | 'legal'
    | 'tabloid'
    | 'ledger'
    | 'a0'
    | 'a1'
    | 'a2'
    | 'a3'
    | 'a4'
    | 'a5'
    | 'a6';
    
  /** Use landscape orientation */
  landscape?: boolean;
  
  /** Scale of the webpage rendering (0.1 - 2) */
  scale?: number;
  
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  
  /** HTML template for header */
  headerTemplate?: string;
  
  /** HTML template for footer */
  footerTemplate?: string;
  
  /** Print background graphics */
  printBackground?: boolean;
  
  /** Use CSS page size */
  preferCSSPageSize?: boolean;
  
  /** Page ranges to print (e.g., '1-5, 8, 11-13') */
  pageRanges?: string;
  
  /** Page margins */
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

/**
 * Content retrieval action
 * @description Get HTML content of page or element
 */
export interface ContentAction extends BaseBrowserAction {
  type: 'content';
  
  /** CSS selector for specific element */
  selector?: string;
}

/**
 * Get text action
 * @description Extract text content from element
 */
export interface GetTextAction extends BaseBrowserAction {
  type: 'getText';
  
  /** CSS selector for target element */
  selector: string;
}

/**
 * Get attribute action
 * @description Get attribute value from element
 */
export interface GetAttributeAction extends BaseBrowserAction {
  type: 'getAttribute';
  
  /** CSS selector for target element */
  selector: string;
  
  /** Attribute name to retrieve */
  attribute: string;
}

/**
 * Evaluate action
 * @description Execute JavaScript in page context
 * @nist ac-3 "Access enforcement"
 */
export interface EvaluateAction extends BaseBrowserAction {
  type: 'evaluate';
  
  /** JavaScript function to execute as string */
  function: string;
  
  /** Arguments to pass to function */
  args?: unknown[];
}

/**
 * Content-related action types
 */
export type ContentActionType = 
  | ScreenshotAction 
  | PDFAction 
  | ContentAction 
  | GetTextAction 
  | GetAttributeAction 
  | EvaluateAction;