/**
 * Unit tests for CLI module
 * @module tests/unit/cli/index
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('CLI Module', () => {
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    // Mock process.exit to prevent tests from exiting
    const originalExit = process.exit.bind(process);
    originalProcessExit = originalExit;
    const mockExit = jest.fn<never, [code?: number | undefined]>(() => undefined as never);
    process.exit = mockExit as typeof process.exit;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
  });

  describe('CLI Commands', () => {
    it('should display version information', (done) => {
      const child = spawn('node', ['dist/cli/index.js', '--version'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      let stdout = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (_data) => {
        // Handle stderr if needed
      });

      child.on('close', () => {
        expect(stdout).toContain('puppeteer-mcp v1.0.14');
        expect(stdout).toContain('Node.js');
        expect(stdout).toContain('Platform:');
        done();
      });

      // Kill the process after 10 seconds if it doesn't exit
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      }, 10000);
    }, 15000);

    it('should display help information', (done) => {
      const child = spawn('node', ['dist/cli/index.js', '--help'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      let stdout = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (_data) => {
        // Handle stderr if needed
      });

      child.on('close', () => {
        expect(stdout).toContain('Usage: puppeteer-mcp [command] [options]');
        expect(stdout).toContain('Commands:');
        expect(stdout).toContain('Examples:');
        expect(stdout).toContain('Environment Variables:');
        done();
      });

      // Kill the process after 10 seconds if it doesn't exit
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      }, 10000);
    }, 15000);

    it('should validate configuration', (done) => {
      const child = spawn('node', ['dist/cli/index.js', 'validate-config'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      let stdout = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (_data) => {
        // Handle stderr if needed
      });

      child.on('close', () => {
        expect(stdout).toContain('Validating configuration...');
        expect(stdout).toContain('Configuration Summary:');
        done();
      });

      // Kill the process after 10 seconds if it doesn't exit
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      }, 10000);
    }, 15000);
  });

  describe('Package.json Integration', () => {
    it('should have correct bin entry in package.json', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin['puppeteer-mcp']).toBe('dist/cli/index.js');
    });

    it('should have correct npm script', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts['puppeteer-mcp']).toBe('node dist/cli/index.js');
    });
  });
});
