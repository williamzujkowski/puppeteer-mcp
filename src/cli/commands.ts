/**
 * CLI Command Handlers
 * @module cli/commands
 * @description Command handlers for the CLI interface
 */

// Logger is imported dynamically when needed to avoid side effects
import {
  showVersion,
  showHelp,
  writeError,
  writeOutputLine,
  showConfigValidationResults,
  showConfigSummary,
  showConfigValidationFooter,
} from './output.js';

export interface PackageInfo {
  name: string;
  version: string;
  description: string;
}

/**
 * Handle version command
 */
export function handleVersion(packageInfo: PackageInfo): void {
  showVersion(packageInfo);
}

/**
 * Handle help command
 */
export function handleHelp(packageInfo: PackageInfo): void {
  showHelp(packageInfo);
}

/**
 * Handle config initialization command
 */
export async function handleConfigInit(): Promise<void> {
  const { initializeConfiguration } = await import('./config-init.js');
  await initializeConfiguration();
}

/**
 * Handle connection test command
 */
export async function handleTestConnection(): Promise<void> {
  const { runConnectionTests } = await import('./connection-tests.js');
  await runConnectionTests();
}

/**
 * Handle config validation command
 */
export async function handleValidateConfig(): Promise<void> {
  const { validateConfiguration } = await import('./config-validation.js');

  writeOutputLine('Validating configuration...\n');

  const result = await validateConfiguration();
  showConfigValidationResults(result.issues, result.warnings);
  await showConfigSummary();

  const hasIssues = result.issues.length > 0;
  showConfigValidationFooter(hasIssues);

  if (hasIssues) {
    process.exit(1);
  }
}

/**
 * Handle config command with subcommands
 */
export async function handleConfigCommand(args: string[]): Promise<void> {
  if (args[1] === '--init') {
    await handleConfigInit();
  } else {
    writeError('Unknown config command. Use: config --init');
    process.exit(1);
  }
}

/**
 * Handle unknown command
 */
export function handleUnknownCommand(command: string): void {
  writeError(`Unknown command: ${command}`);
  writeError('Use --help for usage information.');
  process.exit(1);
}

/**
 * Handle command failure
 */
export async function handleCommandFailure(error: unknown): Promise<void> {
  const { logger } = await import('../utils/logger.js');
  logger.error({ error }, 'CLI command failed');
  writeError(`Command failed: ${String(error)}`);
  process.exit(1);
}
