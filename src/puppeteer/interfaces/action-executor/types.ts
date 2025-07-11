/**
 * Action Types Union
 * @module action-executor/types
 * @description Combined type definitions for all browser actions
 */

import type { NavigationActionType } from './navigation.interface.js';
import type { InteractionActionType } from './interaction.interface.js';
import type { ContentActionType } from './content.interface.js';
import type { FileOperationActionType } from './file-operations.interface.js';

/**
 * Union type of all browser actions
 * @description Complete set of available browser actions
 */
export type BrowserAction =
  | NavigationActionType
  | InteractionActionType
  | ContentActionType
  | FileOperationActionType;

/**
 * Action type string literals
 * @description String literal types for action type checking
 */
export type ActionType = BrowserAction['type'];

/**
 * Type guard for navigation actions
 */
export function isNavigationAction(action: BrowserAction): action is NavigationActionType {
  return ['navigate', 'wait', 'scroll', 'goBack', 'goForward', 'refresh', 'setViewport'].includes(
    action.type,
  );
}

/**
 * Type guard for interaction actions
 */
export function isInteractionAction(action: BrowserAction): action is InteractionActionType {
  return ['click', 'type', 'select', 'keyboard', 'mouse', 'upload', 'hover'].includes(action.type);
}

/**
 * Type guard for content actions
 */
export function isContentAction(action: BrowserAction): action is ContentActionType {
  return ['screenshot', 'pdf', 'content', 'getText', 'getAttribute', 'evaluate'].includes(
    action.type,
  );
}

/**
 * Type guard for file operation actions
 */
export function isFileOperationAction(action: BrowserAction): action is FileOperationActionType {
  return ['download', 'cookie'].includes(action.type);
}
