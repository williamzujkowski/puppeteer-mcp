/**
 * Action Executor Interface for Puppeteer Integration
 * @module action-executor
 * @description Re-exports all action executor interfaces for backward compatibility
 *
 * This file maintains backward compatibility by re-exporting all interfaces
 * from the modularized structure. The interfaces have been organized into:
 *
 * - Core types and base interfaces (./action-executor/core.interface.ts)
 * - Navigation actions (./action-executor/navigation.interface.ts)
 * - Interaction actions (./action-executor/interaction.interface.ts)
 * - Content actions (./action-executor/content.interface.ts)
 * - File operations (./action-executor/file-operations.interface.ts)
 * - Main executor interface (./action-executor/executor.interface.ts)
 * - Combined types and utilities (./action-executor/types.ts)
 */

// Re-export everything from the modular structure
export * from './action-executor/index.js';

// For backward compatibility, also re-export specific imports that may be used
export type { KeyInput } from 'puppeteer';
