/**
 * File Operations Action Interfaces
 * @module action-executor/file-operations
 * @description File and cookie management actions
 * @nist ac-3 "Access enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { BaseBrowserAction } from './core.interface.js';

/**
 * Download action
 * @description Download file from URL
 * @nist ac-4 "Information flow enforcement"
 */
export interface DownloadAction extends BaseBrowserAction {
  type: 'download';
  
  /** URL of file to download */
  url: string;
  
  /** Local path to save downloaded file */
  downloadPath: string;
}

/**
 * Cookie operation types
 */
export type CookieOperation = 'set' | 'get' | 'delete' | 'clear';

/**
 * Cookie definition
 * @description Cookie properties for operations
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export interface CookieDefinition {
  /** Cookie name */
  name: string;
  
  /** Cookie value (for set operation) */
  value?: string;
  
  /** Cookie domain */
  domain?: string;
  
  /** Cookie path */
  path?: string;
  
  /** Expiration timestamp */
  expires?: number;
  
  /** HTTP only flag */
  httpOnly?: boolean;
  
  /** Secure flag */
  secure?: boolean;
  
  /** Same site policy */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Cookie action
 * @description Manage browser cookies
 * @nist sc-23 "Session authenticity"
 */
export interface CookieAction extends BaseBrowserAction {
  type: 'cookie';
  
  /** Cookie operation type */
  operation: CookieOperation;
  
  /** Cookies for operation */
  cookies?: CookieDefinition[];
}

/**
 * File operation action types
 */
export type FileOperationActionType = DownloadAction | CookieAction;