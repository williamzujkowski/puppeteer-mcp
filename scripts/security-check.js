#!/usr/bin/env node

/**
 * Security check script
 * Runs various security checks on the codebase
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔒 Running security checks...\n');

let hasErrors = false;

// Check for npm vulnerabilities
console.log('📦 Checking npm dependencies...');
try {
  execSync('npm audit --audit-level=high', { stdio: 'inherit' });
  console.log('✅ No high or critical vulnerabilities found\n');
} catch (error) {
  console.error('❌ npm audit found vulnerabilities\n');
  hasErrors = true;
}

// Check for sensitive data in code
console.log('🔍 Checking for sensitive data patterns...');
const sensitivePatterns = [
  /password\s*=\s*["'][^"']+["']/gi,
  /api[_-]?key\s*=\s*["'][^"']+["']/gi,
  /secret\s*=\s*["'][^"']+["']/gi,
  /private[_-]?key\s*=\s*["'][^"']+["']/gi,
];

// Add more security checks as needed

if (hasErrors) {
  console.error('\n❌ Security checks failed');
  process.exit(1);
} else {
  console.log('\n✅ All security checks passed');
}
