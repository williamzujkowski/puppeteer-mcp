#!/usr/bin/env node
/**
 * CLI Interface for puppeteer-mcp
 * @module cli
 * @description Command-line interface with enhanced commands
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Server is imported dynamically when needed to avoid side effects
import {
  PackageInfo,
  handleVersion,
  handleHelp,
  handleConfigCommand,
  handleTestConnection,
  handleValidateConfig,
  handleUnknownCommand,
  handleCommandFailure,
} from './commands.js';

// Get package.json info
const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const packageJsonPath = join(currentDir, '../../package.json');

let packageInfo: PackageInfo;
try {
  packageInfo = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageInfo;
} catch {
  packageInfo = {
    name: 'puppeteer-mcp',
    version: '1.0.14',
    description: 'AI-enabled browser automation platform',
  };
}

/**
 * Process command-line arguments
 */
async function processCommand(args: string[]): Promise<void> {
  const command = args[0];

  if (command === undefined) {
    handleUnknownCommand('');
    return;
  }

  switch (command) {
    case '--version':
    case '-v':
      handleVersion(packageInfo);
      break;

    case '--help':
    case '-h':
      handleHelp(packageInfo);
      break;

    case 'config':
      await handleConfigCommand(args);
      break;

    case 'test-connection':
      await handleTestConnection();
      break;

    case 'validate-config':
      await handleValidateConfig();
      break;

    case 'start': {
      const { startServer } = await import('./server.js');
      await startServer();
      break;
    }

    default:
      handleUnknownCommand(command);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    const { startServer } = await import('./server.js');
    await startServer();
    return;
  }

  try {
    await processCommand(args);
  } catch (error) {
    await handleCommandFailure(error);
  }
}

/**
 * Check if this script is being run directly
 */
function isMainScript(): boolean {
  const scriptPath = process.argv[1];
  return Boolean(
    scriptPath !== null &&
      scriptPath !== undefined &&
      scriptPath !== '' &&
      (scriptPath.endsWith('/cli/index.js') ||
        scriptPath.endsWith('/dist/cli/index.js') ||
        scriptPath.includes('puppeteer-mcp')),
  );
}

// Run if called directly
if (isMainScript()) {
  void main();
}

export { main };
