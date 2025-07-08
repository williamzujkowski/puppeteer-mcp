/**
 * Browser context type definitions
 * @module puppeteer/types/browser-context
 * @description Types for code executed in browser context via Puppeteer
 */

// These types are used in browser evaluation contexts where DOM types are available
// but TypeScript doesn't know about them in Node.js context

/**
 * Browser window type with common DOM globals
 */
export interface BrowserWindow {
  document: {
    querySelector: (selector: string) => unknown;
  };
  pageXOffset?: number;
  pageYOffset?: number;
  HTMLElement: {
    new (): unknown;
    prototype: unknown;
  };
  File: new (bits: unknown[], name: string, options?: { type?: string }) => unknown;
  DataTransfer: new () => {
    items: {
      add: (file: unknown) => void;
    };
  };
  DragEvent: new (
    type: string,
    eventInitDict?: { bubbles?: boolean; cancelable?: boolean; dataTransfer?: unknown },
  ) => unknown;
}

/**
 * Type guard for HTMLInputElement in browser context
 */
export function isInputElement(el: unknown): el is { value: string; type: string } {
  return (
    typeof el === 'object' &&
    el !== null &&
    'tagName' in el &&
    (el as { tagName: string }).tagName === 'INPUT'
  );
}

/**
 * Type guard for HTMLTextAreaElement in browser context
 */
export function isTextAreaElement(el: unknown): el is { value: string } {
  return (
    typeof el === 'object' &&
    el !== null &&
    'tagName' in el &&
    (el as { tagName: string }).tagName === 'TEXTAREA'
  );
}
